import { zValidator } from "@hono/zod-validator";
import { and, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { db } from "../config/database";
import {
  agentTools,
  agents,
  mcpServers,
} from "../db/schema";
import { requireAuth } from "../middleware/auth";
import { syncDispatchRulesForAgent } from "../telephony/dispatch-rules";
import { decryptJson, encryptJson } from "../telephony/encrypt";

const router = new Hono();

router.use("*", requireAuth);

// ---------- helpers ----------

async function ownsAgent(userSub: string, agentId: string): Promise<boolean> {
  const [row] = await db
    .select()
    .from(agents)
    .where(and(eq(agents.id, agentId), eq(agents.userId, userSub)));
  return !!row;
}

function redactMcp(row: typeof mcpServers.$inferSelect) {
  const { headers, ...rest } = row;
  return { ...rest, hasHeaders: headers != null && headers.length > 0 };
}

function redactTool(row: typeof agentTools.$inferSelect) {
  const { headers, ...rest } = row;
  return { ...rest, hasHeaders: headers != null && headers.length > 0 };
}

function syncAfterChange(agentId: string) {
  void syncDispatchRulesForAgent(agentId).catch((err) => {
    console.warn("syncDispatchRulesForAgent failed", { agentId, err });
  });
}

// ---------- MCP servers ----------

const headersSchema = z.record(z.string(), z.string()).optional();

const createMcpSchema = z.object({
  label: z.string().trim().min(1).max(100),
  url: z.string().url(),
  transport: z.enum(["auto", "http", "sse"]).default("auto"),
  headers: headersSchema,
  enabled: z.boolean().default(true),
});

const updateMcpSchema = z
  .object({
    label: z.string().trim().min(1).max(100).optional(),
    url: z.string().url().optional(),
    transport: z.enum(["auto", "http", "sse"]).optional(),
    headers: headersSchema.nullable(),
    enabled: z.boolean().optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: "at least one field is required",
  });

router.get("/agents/:agentId/mcp-servers", async (c) => {
  const user = c.get("user");
  const agentId = c.req.param("agentId");
  if (!(await ownsAgent(user.sub, agentId))) {
    return c.json({ error: "not found" }, 404);
  }
  const rows = await db
    .select()
    .from(mcpServers)
    .where(eq(mcpServers.agentId, agentId))
    .orderBy(desc(mcpServers.createdAt));
  return c.json({ servers: rows.map(redactMcp) });
});

router.post(
  "/agents/:agentId/mcp-servers",
  zValidator("json", createMcpSchema),
  async (c) => {
    const user = c.get("user");
    const agentId = c.req.param("agentId");
    if (!(await ownsAgent(user.sub, agentId))) {
      return c.json({ error: "not found" }, 404);
    }
    const body = c.req.valid("json");
    const [row] = await db
      .insert(mcpServers)
      .values({
        userId: user.sub,
        agentId,
        label: body.label,
        url: body.url,
        transport: body.transport,
        headers: body.headers ? encryptJson(body.headers) : null,
        enabled: body.enabled,
      })
      .returning();
    syncAfterChange(agentId);
    return c.json({ server: redactMcp(row!) }, 201);
  },
);

router.patch(
  "/mcp-servers/:id",
  zValidator("json", updateMcpSchema),
  async (c) => {
    const user = c.get("user");
    const id = c.req.param("id");
    const body = c.req.valid("json");

    const patch: Partial<typeof mcpServers.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (body.label !== undefined) patch.label = body.label;
    if (body.url !== undefined) patch.url = body.url;
    if (body.transport !== undefined) patch.transport = body.transport;
    if (body.headers !== undefined) {
      patch.headers = body.headers ? encryptJson(body.headers) : null;
    }
    if (body.enabled !== undefined) patch.enabled = body.enabled;

    const [row] = await db
      .update(mcpServers)
      .set(patch)
      .where(and(eq(mcpServers.id, id), eq(mcpServers.userId, user.sub)))
      .returning();
    if (!row) return c.json({ error: "not found" }, 404);
    syncAfterChange(row.agentId);
    return c.json({ server: redactMcp(row) });
  },
);

router.delete("/mcp-servers/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const [row] = await db
    .delete(mcpServers)
    .where(and(eq(mcpServers.id, id), eq(mcpServers.userId, user.sub)))
    .returning();
  if (!row) return c.json({ error: "not found" }, 404);
  syncAfterChange(row.agentId);
  return c.json({ ok: true });
});

// ---------- Tools ----------

const jsonStringSchema = z
  .string()
  .refine(
    (v) => {
      try {
        JSON.parse(v);
        return true;
      } catch {
        return false;
      }
    },
    { message: "must be valid JSON" },
  );

const toolNameField = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, "must be a valid identifier");
const toolDescriptionField = z.string().trim().min(1).max(500);
const toolMethodField = z.enum(["GET", "POST", "PATCH", "PUT", "DELETE"]);
const toolUrlField = z.string().min(1).max(2000);

const createToolSchema = z
  .object({
    phase: z.enum(["PRE", "ON", "POST"]),
    name: toolNameField,
    description: toolDescriptionField,
    method: toolMethodField,
    url: toolUrlField,
    headers: headersSchema,
    bodyTemplate: z.string().max(10_000).nullable().optional(),
    parameters: jsonStringSchema.nullable().optional(),
    enabled: z.boolean().default(true),
  })
  .refine(
    (v) => v.phase !== "ON" || (v.parameters != null && v.parameters !== ""),
    { message: "on-call tools must include a JSON-Schema parameters object" },
  );

const updateToolSchema = z
  .object({
    name: toolNameField.optional(),
    description: toolDescriptionField.optional(),
    method: toolMethodField.optional(),
    url: toolUrlField.optional(),
    headers: headersSchema.nullable(),
    bodyTemplate: z.string().max(10_000).nullable().optional(),
    parameters: jsonStringSchema.nullable().optional(),
    enabled: z.boolean().optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: "at least one field is required",
  });

router.get("/agents/:agentId/tools", async (c) => {
  const user = c.get("user");
  const agentId = c.req.param("agentId");
  const phase = c.req.query("phase");
  if (!(await ownsAgent(user.sub, agentId))) {
    return c.json({ error: "not found" }, 404);
  }
  const whereExpr =
    phase && (phase === "PRE" || phase === "ON" || phase === "POST")
      ? and(eq(agentTools.agentId, agentId), eq(agentTools.phase, phase))
      : eq(agentTools.agentId, agentId);
  const rows = await db
    .select()
    .from(agentTools)
    .where(whereExpr)
    .orderBy(desc(agentTools.createdAt));
  return c.json({ tools: rows.map(redactTool) });
});

router.post(
  "/agents/:agentId/tools",
  zValidator("json", createToolSchema),
  async (c) => {
    const user = c.get("user");
    const agentId = c.req.param("agentId");
    if (!(await ownsAgent(user.sub, agentId))) {
      return c.json({ error: "not found" }, 404);
    }
    const body = c.req.valid("json");
    const [row] = await db
      .insert(agentTools)
      .values({
        userId: user.sub,
        agentId,
        phase: body.phase,
        name: body.name,
        description: body.description,
        method: body.method,
        url: body.url,
        headers: body.headers ? encryptJson(body.headers) : null,
        bodyTemplate: body.bodyTemplate ?? null,
        parameters: body.parameters ?? null,
        enabled: body.enabled,
      })
      .returning();
    syncAfterChange(agentId);
    return c.json({ tool: redactTool(row!) }, 201);
  },
);

router.patch("/tools/:id", zValidator("json", updateToolSchema), async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const body = c.req.valid("json");

  const patch: Partial<typeof agentTools.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (body.name !== undefined) patch.name = body.name;
  if (body.description !== undefined) patch.description = body.description;
  if (body.method !== undefined) patch.method = body.method;
  if (body.url !== undefined) patch.url = body.url;
  if (body.headers !== undefined) {
    patch.headers = body.headers ? encryptJson(body.headers) : null;
  }
  if (body.bodyTemplate !== undefined) patch.bodyTemplate = body.bodyTemplate;
  if (body.parameters !== undefined) patch.parameters = body.parameters;
  if (body.enabled !== undefined) patch.enabled = body.enabled;

  const [row] = await db
    .update(agentTools)
    .set(patch)
    .where(and(eq(agentTools.id, id), eq(agentTools.userId, user.sub)))
    .returning();
  if (!row) return c.json({ error: "not found" }, 404);
  syncAfterChange(row.agentId);
  return c.json({ tool: redactTool(row) });
});

router.delete("/tools/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const [row] = await db
    .delete(agentTools)
    .where(and(eq(agentTools.id, id), eq(agentTools.userId, user.sub)))
    .returning();
  if (!row) return c.json({ error: "not found" }, 404);
  syncAfterChange(row.agentId);
  return c.json({ ok: true });
});

// Helper: decrypt a stored headers blob for use inside dispatch metadata.
export function decryptHeaders(blob: string | null): Record<string, string> | null {
  if (!blob) return null;
  try {
    return decryptJson<Record<string, string>>(blob);
  } catch {
    return null;
  }
}

export default router;
