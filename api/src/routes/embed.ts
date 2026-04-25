import { zValidator } from "@hono/zod-validator";
import { randomBytes } from "node:crypto";
import { and, desc, eq, gte, isNull, or } from "drizzle-orm";
import { Hono } from "hono";
import { AccessToken, AgentDispatchClient } from "livekit-server-sdk";
import { z } from "zod";
import { db } from "../config/database";
import {
  agents,
  embedCalls,
  embedConfigs,
} from "../db/schema";
import { env } from "../env";
import { sanitizeSvg } from "../lib/sanitize-svg";
import { requireAuth } from "../middleware/auth";
import { buildAgentMetadata } from "../telephony/dispatch-rules";

const router = new Hono();

const MAX_EMBED_DURATION_MS = 10 * 60 * 1000;

// ---------- helpers ----------

function generatePublicKey(): string {
  return `pk_${randomBytes(24).toString("base64url")}`;
}

function parseOrigins(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((s) => typeof s === "string") : [];
  } catch {
    return [];
  }
}

function publicView(row: typeof embedConfigs.$inferSelect) {
  return {
    id: row.id,
    agentId: row.agentId,
    publicKey: row.publicKey,
    allowedOrigins: parseOrigins(row.allowedOrigins),
    enabled: row.enabled,
    buttonLabel: row.buttonLabel,
    buttonShape: row.buttonShape,
    buttonIconSvg: row.buttonIconSvg,
    accentColor: row.accentColor,
    position: row.position,
    greetingText: row.greetingText,
    maxConcurrent: row.maxConcurrent,
    dailyCallQuota: row.dailyCallQuota,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function themeView(row: typeof embedConfigs.$inferSelect, agentName: string) {
  return {
    agentName,
    enabled: row.enabled,
    buttonLabel: row.buttonLabel,
    buttonShape: row.buttonShape,
    buttonIconSvg: row.buttonIconSvg,
    accentColor: row.accentColor,
    position: row.position,
    greetingText: row.greetingText,
  };
}

const originField = z
  .string()
  .trim()
  .min(1)
  .max(500)
  .refine(
    (raw) => {
      try {
        const u = new URL(raw);
        if (!u.protocol.startsWith("http")) return false;
        if (u.pathname && u.pathname !== "/") return false;
        if (u.search || u.hash) return false;
        return true;
      } catch {
        return false;
      }
    },
    { message: "must be a bare scheme://host[:port] origin" },
  );

const colorField = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, "must be a #RRGGBB hex color");

const shapeField = z.enum(["circle", "pill"]);
const positionField = z.enum([
  "bottom-right",
  "bottom-left",
  "top-right",
  "top-left",
]);

const updateSchema = z
  .object({
    enabled: z.boolean().optional(),
    allowedOrigins: z.array(originField).max(20).optional(),
    buttonLabel: z.string().max(100).nullable().optional(),
    buttonShape: shapeField.optional(),
    buttonIconSvg: z.string().max(20_000).nullable().optional(),
    accentColor: colorField.optional(),
    position: positionField.optional(),
    greetingText: z.string().max(500).nullable().optional(),
    maxConcurrent: z.number().int().min(1).max(1000).optional(),
    dailyCallQuota: z.number().int().min(1).max(100_000).optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: "at least one field is required",
  });

async function ownsAgent(userSub: string, agentId: string) {
  const [row] = await db
    .select()
    .from(agents)
    .where(and(eq(agents.id, agentId), eq(agents.userId, userSub)));
  return row ?? null;
}

function startOfTodayUtc(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

// ==========================================================================
// Authed (admin) endpoints
// ==========================================================================

router.use("/agents/:agentId/embed", requireAuth);
router.use("/agents/:agentId/embed/*", requireAuth);

router.get("/agents/:agentId/embed", async (c) => {
  const user = c.get("user");
  const agentId = c.req.param("agentId");
  if (!(await ownsAgent(user.sub, agentId))) {
    return c.json({ error: "not found" }, 404);
  }
  const [row] = await db
    .select()
    .from(embedConfigs)
    .where(eq(embedConfigs.agentId, agentId))
    .orderBy(desc(embedConfigs.createdAt));
  if (!row) return c.json({ error: "not found" }, 404);
  return c.json({ embed: publicView(row) });
});

router.post("/agents/:agentId/embed", async (c) => {
  const user = c.get("user");
  const agentId = c.req.param("agentId");
  if (!(await ownsAgent(user.sub, agentId))) {
    return c.json({ error: "not found" }, 404);
  }
  const [existing] = await db
    .select()
    .from(embedConfigs)
    .where(eq(embedConfigs.agentId, agentId));
  if (existing) {
    return c.json({ embed: publicView(existing) });
  }
  const [row] = await db
    .insert(embedConfigs)
    .values({
      userId: user.sub,
      agentId,
      publicKey: generatePublicKey(),
      allowedOrigins: JSON.stringify([]),
    })
    .returning();
  return c.json({ embed: publicView(row!) }, 201);
});

router.patch(
  "/agents/:agentId/embed",
  zValidator("json", updateSchema),
  async (c) => {
    const user = c.get("user");
    const agentId = c.req.param("agentId");
    if (!(await ownsAgent(user.sub, agentId))) {
      return c.json({ error: "not found" }, 404);
    }
    const body = c.req.valid("json");

    const patch: Partial<typeof embedConfigs.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (body.enabled !== undefined) patch.enabled = body.enabled;
    if (body.allowedOrigins !== undefined)
      patch.allowedOrigins = JSON.stringify(body.allowedOrigins);
    if (body.buttonLabel !== undefined) patch.buttonLabel = body.buttonLabel;
    if (body.buttonShape !== undefined) patch.buttonShape = body.buttonShape;
    if (body.buttonIconSvg !== undefined) {
      if (body.buttonIconSvg === null) {
        patch.buttonIconSvg = null;
      } else {
        const cleaned = sanitizeSvg(body.buttonIconSvg);
        if (cleaned === null) {
          return c.json({ error: "invalid SVG" }, 400);
        }
        patch.buttonIconSvg = cleaned;
      }
    }
    if (body.accentColor !== undefined) patch.accentColor = body.accentColor;
    if (body.position !== undefined) patch.position = body.position;
    if (body.greetingText !== undefined) patch.greetingText = body.greetingText;
    if (body.maxConcurrent !== undefined)
      patch.maxConcurrent = body.maxConcurrent;
    if (body.dailyCallQuota !== undefined)
      patch.dailyCallQuota = body.dailyCallQuota;

    const [row] = await db
      .update(embedConfigs)
      .set(patch)
      .where(
        and(
          eq(embedConfigs.agentId, agentId),
          eq(embedConfigs.userId, user.sub),
        ),
      )
      .returning();
    if (!row) return c.json({ error: "not found" }, 404);
    return c.json({ embed: publicView(row) });
  },
);

router.post("/agents/:agentId/embed/rotate-key", async (c) => {
  const user = c.get("user");
  const agentId = c.req.param("agentId");
  if (!(await ownsAgent(user.sub, agentId))) {
    return c.json({ error: "not found" }, 404);
  }
  const [row] = await db
    .update(embedConfigs)
    .set({ publicKey: generatePublicKey(), updatedAt: new Date() })
    .where(
      and(
        eq(embedConfigs.agentId, agentId),
        eq(embedConfigs.userId, user.sub),
      ),
    )
    .returning();
  if (!row) return c.json({ error: "not found" }, 404);
  return c.json({ embed: publicView(row) });
});

router.delete("/agents/:agentId/embed", async (c) => {
  const user = c.get("user");
  const agentId = c.req.param("agentId");
  if (!(await ownsAgent(user.sub, agentId))) {
    return c.json({ error: "not found" }, 404);
  }
  const [row] = await db
    .delete(embedConfigs)
    .where(
      and(
        eq(embedConfigs.agentId, agentId),
        eq(embedConfigs.userId, user.sub),
      ),
    )
    .returning();
  if (!row) return c.json({ error: "not found" }, 404);
  return c.json({ ok: true });
});

// ==========================================================================
// Public endpoints (no auth)
// ==========================================================================

router.get("/embed/:publicKey/config", async (c) => {
  const publicKey = c.req.param("publicKey");
  const [config] = await db
    .select()
    .from(embedConfigs)
    .where(eq(embedConfigs.publicKey, publicKey));
  if (!config || !config.enabled) return c.json({ error: "not found" }, 404);
  const [agent] = await db
    .select()
    .from(agents)
    .where(eq(agents.id, config.agentId));
  if (!agent) return c.json({ error: "not found" }, 404);
  return c.json({ theme: themeView(config, agent.name) });
});

const tokenSchema = z.object({
  publicKey: z.string().min(1),
  parentOrigin: z.string().min(1),
});

router.post("/embed/token", zValidator("json", tokenSchema), async (c) => {
  const { publicKey, parentOrigin } = c.req.valid("json");

  const [config] = await db
    .select()
    .from(embedConfigs)
    .where(eq(embedConfigs.publicKey, publicKey));
  if (!config || !config.enabled) {
    return c.json({ error: "not found" }, 404);
  }

  // The widget runs inside an iframe served from our own frontend, so the
  // browser's Origin header is *our* origin, not the host site. The host's
  // origin is passed through the iframe URL as ?parent= and forwarded here.
  // CSP frame-ancestors (set on the embed page response) is the real gate
  // that prevents disallowed parents from rendering the iframe at all.
  let normalizedParent = "";
  try {
    const u = new URL(parentOrigin);
    if (u.protocol.startsWith("http")) {
      normalizedParent = `${u.protocol}//${u.host}`;
    }
  } catch {
    // ignore — falls through to 403
  }

  const allowed = parseOrigins(config.allowedOrigins);
  if (!normalizedParent || !allowed.includes(normalizedParent)) {
    return c.json({ error: "origin not allowed" }, 403);
  }

  const now = new Date();

  // Concurrent: count rows whose endedAt is null OR endedAt is in the future.
  const concurrentRows = await db
    .select()
    .from(embedCalls)
    .where(
      and(
        eq(embedCalls.publicKey, publicKey),
        or(isNull(embedCalls.endedAt), gte(embedCalls.endedAt, now)),
      ),
    );
  if (concurrentRows.length >= config.maxConcurrent) {
    return c.json({ error: "concurrent limit reached" }, 429);
  }

  const dailyRows = await db
    .select()
    .from(embedCalls)
    .where(
      and(
        eq(embedCalls.publicKey, publicKey),
        gte(embedCalls.startedAt, startOfTodayUtc()),
      ),
    );
  if (dailyRows.length >= config.dailyCallQuota) {
    return c.json({ error: "daily quota reached" }, 429);
  }

  const [agent] = await db
    .select()
    .from(agents)
    .where(eq(agents.id, config.agentId));
  if (!agent) return c.json({ error: "not found" }, 404);

  const baseMetadata = await buildAgentMetadata(agent);
  // Annotate the metadata with mode=embed so the agent runtime can branch.
  let metadata = baseMetadata;
  try {
    const parsed = JSON.parse(baseMetadata);
    parsed.mode = "embed";
    metadata = JSON.stringify(parsed);
  } catch {
    // leave as-is
  }

  const room = `embed-${agent.id}-${randomBytes(4).toString("hex")}`;

  const dispatchClient = new AgentDispatchClient(
    env.LIVEKIT_URL,
    env.LIVEKIT_API_KEY,
    env.LIVEKIT_API_SECRET,
  );
  try {
    await dispatchClient.createDispatch(room, "agent", { metadata });
  } catch (err) {
    console.error("embed dispatch failed", err);
    return c.json({ error: "dispatch_failed" }, 502);
  }

  // Insert the call row with a soft endedAt so the seat is auto-released
  // after MAX_EMBED_DURATION_MS even without a webhook.
  const endedAt = new Date(now.getTime() + MAX_EMBED_DURATION_MS);
  await db
    .insert(embedCalls)
    .values({
      publicKey,
      agentId: agent.id,
      room,
      startedAt: now,
      endedAt,
    })
    .returning();

  const at = new AccessToken(env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET, {
    identity: `embed-${randomBytes(4).toString("hex")}`,
    ttl: "30s",
  });
  at.addGrant({
    roomJoin: true,
    room,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });
  const token = await at.toJwt();

  return c.json({ url: env.LIVEKIT_URL, token, room });
});

export default router;
