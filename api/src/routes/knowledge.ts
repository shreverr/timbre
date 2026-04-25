import { zValidator } from "@hono/zod-validator";
import { and, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { db } from "../config/database";
import {
  agentKnowledgeBases,
  agents,
  kbChunks,
  kbDocuments,
  knowledgeBases,
} from "../db/schema";
import { env } from "../env";
import { ingestDocument } from "../lib/kb-ingest";
import { searchKB } from "../lib/kb-search";
import { SUPPORTED_MIME } from "../lib/text-extract";
import { requireAuth } from "../middleware/auth";
import { syncDispatchRulesForAgent } from "../telephony/dispatch-rules";

const MAX_BYTES = 20 * 1024 * 1024; // 20 MB

const router = new Hono();

// ==========================================================================
// Authed user routes
// ==========================================================================

router.use("/knowledge", requireAuth);
router.use("/knowledge/*", requireAuth);
router.use("/documents/*", requireAuth);
router.use("/agents/:agentId/knowledge", requireAuth);
router.use("/agents/:agentId/knowledge/*", requireAuth);

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  toolDescription: z.string().trim().max(500).optional(),
});

const updateSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    toolDescription: z.string().trim().max(500).nullable().optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: "at least one field is required",
  });

async function ownsKb(userId: string, kbId: string) {
  const [row] = await db
    .select()
    .from(knowledgeBases)
    .where(and(eq(knowledgeBases.id, kbId), eq(knowledgeBases.userId, userId)));
  return row ?? null;
}

async function ownsAgent(userId: string, agentId: string) {
  const [row] = await db
    .select()
    .from(agents)
    .where(and(eq(agents.id, agentId), eq(agents.userId, userId)));
  return row ?? null;
}

router.get("/knowledge", async (c) => {
  const user = c.get("user");
  const rows = await db
    .select()
    .from(knowledgeBases)
    .where(eq(knowledgeBases.userId, user.sub))
    .orderBy(desc(knowledgeBases.createdAt));
  return c.json({ knowledgeBases: rows });
});

router.post("/knowledge", zValidator("json", createSchema), async (c) => {
  const user = c.get("user");
  const body = c.req.valid("json");
  const [row] = await db
    .insert(knowledgeBases)
    .values({
      userId: user.sub,
      name: body.name,
      toolDescription: body.toolDescription ?? null,
    })
    .returning();
  return c.json({ knowledgeBase: row }, 201);
});

router.get("/knowledge/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const kb = await ownsKb(user.sub, id);
  if (!kb) return c.json({ error: "not found" }, 404);

  const docs = await db
    .select()
    .from(kbDocuments)
    .where(eq(kbDocuments.knowledgeBaseId, id))
    .orderBy(desc(kbDocuments.createdAt));

  return c.json({ knowledgeBase: kb, documents: docs });
});

router.patch(
  "/knowledge/:id",
  zValidator("json", updateSchema),
  async (c) => {
    const user = c.get("user");
    const id = c.req.param("id");
    if (!(await ownsKb(user.sub, id))) {
      return c.json({ error: "not found" }, 404);
    }
    const body = c.req.valid("json");
    const patch: Partial<typeof knowledgeBases.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (body.name !== undefined) patch.name = body.name;
    if (body.toolDescription !== undefined) {
      patch.toolDescription = body.toolDescription;
    }
    const [row] = await db
      .update(knowledgeBases)
      .set(patch)
      .where(
        and(
          eq(knowledgeBases.id, id),
          eq(knowledgeBases.userId, user.sub),
        ),
      )
      .returning();
    if (!row) return c.json({ error: "not found" }, 404);

    // Any agent attached to this KB needs its dispatch rules refreshed so the
    // tool description on the inbound side gets the new value.
    void resyncForKb(id);

    return c.json({ knowledgeBase: row });
  },
);

router.delete("/knowledge/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  if (!(await ownsKb(user.sub, id))) {
    return c.json({ error: "not found" }, 404);
  }
  // Clean up dependent rows (no FK cascades in v1).
  await db.delete(kbChunks).where(eq(kbChunks.knowledgeBaseId, id));
  await db.delete(kbDocuments).where(eq(kbDocuments.knowledgeBaseId, id));
  await db
    .delete(agentKnowledgeBases)
    .where(eq(agentKnowledgeBases.knowledgeBaseId, id));
  const [row] = await db
    .delete(knowledgeBases)
    .where(
      and(
        eq(knowledgeBases.id, id),
        eq(knowledgeBases.userId, user.sub),
      ),
    )
    .returning();
  if (!row) return c.json({ error: "not found" }, 404);

  void resyncForKb(id);
  return c.json({ ok: true });
});

// --- Documents ---

router.post("/knowledge/:id/documents", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const kb = await ownsKb(user.sub, id);
  if (!kb) {
    console.log("[kb-upload] kb not found", { userId: user.sub, kbId: id });
    return c.json({ error: "not found" }, 404);
  }

  if (!env.OPENAI_API_KEY) {
    console.warn("[kb-upload] OPENAI_API_KEY not configured");
    return c.json(
      { error: "OPENAI_API_KEY not configured on the API server" },
      503,
    );
  }

  let form: FormData;
  try {
    form = await c.req.formData();
  } catch {
    return c.json({ error: "expected multipart/form-data" }, 400);
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return c.json({ error: "file is required" }, 400);
  }
  if (file.size > MAX_BYTES) {
    console.warn("[kb-upload] file too large", {
      name: file.name,
      size: file.size,
    });
    return c.json({ error: "file too large (max 20 MB)" }, 413);
  }
  const mime = file.type || guessMime(file.name);
  if (!SUPPORTED_MIME.has(mime)) {
    console.warn("[kb-upload] unsupported mime", { name: file.name, mime });
    return c.json({ error: `unsupported mime type: ${mime}` }, 415);
  }

  const buffer = new Uint8Array(await file.arrayBuffer());
  console.log("[kb-upload] accepted", {
    kbId: id,
    name: file.name,
    mime,
    bytes: buffer.byteLength,
  });

  const [row] = await db
    .insert(kbDocuments)
    .values({
      userId: user.sub,
      knowledgeBaseId: id,
      name: file.name || "untitled",
      mimeType: mime,
      sizeBytes: buffer.byteLength,
      status: "processing",
      chunkCount: 0,
    })
    .returning();

  // Fire-and-forget; status updates flow through the row.
  void ingestDocument(row!.id, buffer, mime);

  return c.json({ document: row }, 201);
});

router.delete("/documents/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const [doc] = await db
    .select()
    .from(kbDocuments)
    .where(
      and(eq(kbDocuments.id, id), eq(kbDocuments.userId, user.sub)),
    );
  if (!doc) return c.json({ error: "not found" }, 404);

  await db.delete(kbChunks).where(eq(kbChunks.documentId, id));
  await db.delete(kbDocuments).where(eq(kbDocuments.id, id));
  return c.json({ ok: true });
});

router.post("/documents/:id/retry", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const [doc] = await db
    .select()
    .from(kbDocuments)
    .where(
      and(eq(kbDocuments.id, id), eq(kbDocuments.userId, user.sub)),
    );
  if (!doc) return c.json({ error: "not found" }, 404);
  // We discarded the original file at ingest time, so a true retry needs a
  // re-upload. v1: respond with a hint; the dashboard will re-upload.
  return c.json(
    {
      error:
        "Retry not supported in v1 — the source file isn't retained. Re-upload to re-ingest.",
    },
    409,
  );
});

// --- Agent attachment ---

router.get("/agents/:agentId/knowledge", async (c) => {
  const user = c.get("user");
  const agentId = c.req.param("agentId");
  if (!(await ownsAgent(user.sub, agentId))) {
    return c.json({ error: "not found" }, 404);
  }
  const rows = await db
    .select()
    .from(agentKnowledgeBases)
    .where(eq(agentKnowledgeBases.agentId, agentId));
  const ids = rows.map((r) => r.knowledgeBaseId);

  const kbs = await db
    .select()
    .from(knowledgeBases)
    .where(eq(knowledgeBases.userId, user.sub));
  const set = new Set(ids);
  const attached = kbs.filter((k) => set.has(k.id));

  return c.json({ knowledgeBases: attached });
});

const attachSchema = z.object({
  knowledgeBaseId: z.string().uuid(),
});

router.post(
  "/agents/:agentId/knowledge",
  zValidator("json", attachSchema),
  async (c) => {
    const user = c.get("user");
    const agentId = c.req.param("agentId");
    if (!(await ownsAgent(user.sub, agentId))) {
      return c.json({ error: "not found" }, 404);
    }
    const { knowledgeBaseId } = c.req.valid("json");
    if (!(await ownsKb(user.sub, knowledgeBaseId))) {
      return c.json({ error: "knowledge base not found" }, 404);
    }
    // Ignore conflict if already attached (composite PK).
    const existing = await db
      .select()
      .from(agentKnowledgeBases)
      .where(
        and(
          eq(agentKnowledgeBases.agentId, agentId),
          eq(agentKnowledgeBases.knowledgeBaseId, knowledgeBaseId),
        ),
      );
    if (existing.length === 0) {
      await db
        .insert(agentKnowledgeBases)
        .values({ agentId, knowledgeBaseId });
    }
    void syncDispatchRulesForAgent(agentId).catch((e) =>
      console.warn("syncDispatchRulesForAgent failed", { agentId, e }),
    );
    return c.json({ ok: true }, 201);
  },
);

router.delete("/agents/:agentId/knowledge/:kbId", async (c) => {
  const user = c.get("user");
  const agentId = c.req.param("agentId");
  const kbId = c.req.param("kbId");
  if (!(await ownsAgent(user.sub, agentId))) {
    return c.json({ error: "not found" }, 404);
  }
  await db
    .delete(agentKnowledgeBases)
    .where(
      and(
        eq(agentKnowledgeBases.agentId, agentId),
        eq(agentKnowledgeBases.knowledgeBaseId, kbId),
      ),
    );
  void syncDispatchRulesForAgent(agentId).catch((e) =>
    console.warn("syncDispatchRulesForAgent failed", { agentId, e }),
  );
  return c.json({ ok: true });
});

// ==========================================================================
// Internal route (called by the agent runtime via shared secret)
// ==========================================================================

const searchSchema = z.object({
  knowledgeBaseIds: z.array(z.string().uuid()).min(1).max(20),
  query: z.string().min(1).max(2000),
  k: z.number().int().min(1).max(20).optional(),
});

router.post(
  "/internal/kb/search",
  zValidator("json", searchSchema),
  async (c) => {
    const auth = c.req.header("authorization") ?? c.req.header("Authorization");
    if (
      !auth ||
      !auth.startsWith("Bearer ") ||
      auth.slice("Bearer ".length).trim() !== env.INTERNAL_API_KEY
    ) {
      console.warn("[kb-search-route] unauthorized");
      return c.json({ error: "unauthorized" }, 401);
    }
    const { knowledgeBaseIds, query, k } = c.req.valid("json");
    console.log("[kb-search-route] hit", {
      knowledgeBaseIds,
      query: query.slice(0, 100),
      k,
    });
    try {
      const chunks = await searchKB(knowledgeBaseIds, query, k);
      console.log("[kb-search-route] returning", { chunks: chunks.length });
      return c.json({ chunks });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[kb-search-route] failed", msg);
      return c.json({ error: "search_failed", detail: msg.slice(0, 200) }, 502);
    }
  },
);

// --- helpers ---

async function resyncForKb(kbId: string) {
  try {
    const links = await db
      .select()
      .from(agentKnowledgeBases)
      .where(eq(agentKnowledgeBases.knowledgeBaseId, kbId));
    await Promise.allSettled(
      links.map((l) => syncDispatchRulesForAgent(l.agentId)),
    );
  } catch (e) {
    console.warn("resyncForKb failed", { kbId, e });
  }
}

function guessMime(name: string): string {
  const ext = name.toLowerCase().split(".").pop();
  if (ext === "pdf") return "application/pdf";
  if (ext === "md" || ext === "markdown") return "text/markdown";
  if (ext === "txt") return "text/plain";
  return "application/octet-stream";
}

export default router;
