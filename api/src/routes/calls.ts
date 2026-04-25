import { zValidator } from "@hono/zod-validator";
import { and, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { db } from "../config/database";
import { agents, callLogs } from "../db/schema";
import { env } from "../env";
import { requireAuth } from "../middleware/auth";

const router = new Hono();

// ==========================================================================
// Internal write (called by the agent runtime via shared secret)
// ==========================================================================

const transcriptItemSchema = z.object({
  role: z.enum(["user", "agent"]),
  text: z.string(),
  ts: z.number().optional(),
});

const internalWriteSchema = z.object({
  agentId: z.string().uuid(),
  mode: z.string().min(1).max(40),
  room: z.string().min(1).max(200),
  callerIdentity: z.string().max(200).nullable().optional(),
  startedAt: z.string().datetime({ offset: true }),
  endedAt: z.string().datetime({ offset: true }),
  durationSeconds: z.number().int().min(0),
  transcript: z.array(transcriptItemSchema).max(2000),
});

router.post(
  "/internal/calls",
  zValidator("json", internalWriteSchema),
  async (c) => {
    const auth = c.req.header("authorization") ?? c.req.header("Authorization");
    if (
      !auth ||
      !auth.startsWith("Bearer ") ||
      auth.slice("Bearer ".length).trim() !== env.INTERNAL_API_KEY
    ) {
      return c.json({ error: "unauthorized" }, 401);
    }

    const body = c.req.valid("json");

    const [agent] = await db
      .select()
      .from(agents)
      .where(eq(agents.id, body.agentId));
    if (!agent) return c.json({ error: "agent not found" }, 404);

    const [row] = await db
      .insert(callLogs)
      .values({
        userId: agent.userId,
        agentId: agent.id,
        mode: body.mode,
        room: body.room,
        callerIdentity: body.callerIdentity ?? null,
        startedAt: new Date(body.startedAt),
        endedAt: new Date(body.endedAt),
        durationSeconds: body.durationSeconds,
        transcript: JSON.stringify(body.transcript),
      })
      .returning();

    return c.json({ call: { id: row!.id } }, 201);
  },
);

// ==========================================================================
// User-facing endpoints (auth required)
// ==========================================================================

router.use("/calls", requireAuth);
router.use("/calls/*", requireAuth);

router.get("/calls", async (c) => {
  const user = c.get("user");
  const agentIdFilter = c.req.query("agentId");

  const whereExpr = agentIdFilter
    ? and(eq(callLogs.userId, user.sub), eq(callLogs.agentId, agentIdFilter))
    : eq(callLogs.userId, user.sub);

  const rows = await db
    .select()
    .from(callLogs)
    .where(whereExpr)
    .orderBy(desc(callLogs.startedAt));

  // Don't ship the full transcript on the list endpoint — keeps payloads small.
  return c.json({
    calls: rows.slice(0, 100).map((r) => ({
      id: r.id,
      agentId: r.agentId,
      mode: r.mode,
      room: r.room,
      callerIdentity: r.callerIdentity,
      startedAt: r.startedAt,
      endedAt: r.endedAt,
      durationSeconds: r.durationSeconds,
      messageCount: countMessages(r.transcript),
      createdAt: r.createdAt,
    })),
  });
});

router.get("/calls/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const [row] = await db
    .select()
    .from(callLogs)
    .where(and(eq(callLogs.id, id), eq(callLogs.userId, user.sub)));
  if (!row) return c.json({ error: "not found" }, 404);

  let transcript: unknown = [];
  try {
    transcript = JSON.parse(row.transcript);
  } catch {
    transcript = [];
  }

  return c.json({
    call: {
      id: row.id,
      agentId: row.agentId,
      mode: row.mode,
      room: row.room,
      callerIdentity: row.callerIdentity,
      startedAt: row.startedAt,
      endedAt: row.endedAt,
      durationSeconds: row.durationSeconds,
      transcript,
      createdAt: row.createdAt,
    },
  });
});

function countMessages(transcript: string): number {
  try {
    const v = JSON.parse(transcript);
    return Array.isArray(v) ? v.length : 0;
  } catch {
    return 0;
  }
}

export default router;
