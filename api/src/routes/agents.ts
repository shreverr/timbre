import { zValidator } from "@hono/zod-validator";
import { and, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import {
  AccessToken,
  AgentDispatchClient,
  SipClient,
} from "livekit-server-sdk";
import { z } from "zod";
import { db } from "../config/database";
import { agents, phoneNumbers, telephonyProviders } from "../db/schema";
import { env } from "../env";
import { requireAuth } from "../middleware/auth";
import {
  buildAgentMetadata,
  syncDispatchRulesForAgent,
} from "../telephony/dispatch-rules";

const languageSchema = z
  .string()
  .trim()
  .regex(/^(multi|[a-z]{2})$/, "language must be 'multi' or ISO-639-1 (e.g. 'en')");

const createSchema = z.object({
  name: z.string().trim().min(1, "name is required").max(100),
  type: z.enum(["SINGLE", "MULTI"]).default("SINGLE"),
  language: languageSchema.default("multi"),
});

const updateSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    voiceId: z.string().trim().min(1).nullable().optional(),
    language: languageSchema.optional(),
    firstMessage: z.string().nullable().optional(),
    objective: z.string().nullable().optional(),
    responseGuidelines: z.string().nullable().optional(),
    conversationScript: z.string().nullable().optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: "at least one field is required",
  });

const agentsRouter = new Hono();

agentsRouter.use("*", requireAuth);

agentsRouter.get("/", async (c) => {
  const user = c.get("user");
  const rows = await db
    .select()
    .from(agents)
    .where(eq(agents.userId, user.sub))
    .orderBy(desc(agents.createdAt));
  return c.json({ agents: rows });
});

agentsRouter.post("/", zValidator("json", createSchema), async (c) => {
  const user = c.get("user");
  const { name, type, language } = c.req.valid("json");
  const [row] = await db
    .insert(agents)
    .values({ userId: user.sub, name, type, language })
    .returning();
  return c.json({ agent: row }, 201);
});

agentsRouter.get("/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const [row] = await db
    .select()
    .from(agents)
    .where(and(eq(agents.id, id), eq(agents.userId, user.sub)));
  if (!row) return c.json({ error: "not found" }, 404);
  return c.json({ agent: row });
});

agentsRouter.patch("/:id", zValidator("json", updateSchema), async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const body = c.req.valid("json");

  const patch: Partial<typeof agents.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (body.name !== undefined) patch.name = body.name;
  if (body.voiceId !== undefined) patch.voiceId = body.voiceId;
  if (body.language !== undefined) patch.language = body.language;
  if (body.firstMessage !== undefined) patch.firstMessage = body.firstMessage;
  if (body.objective !== undefined) patch.objective = body.objective;
  if (body.responseGuidelines !== undefined)
    patch.responseGuidelines = body.responseGuidelines;
  if (body.conversationScript !== undefined)
    patch.conversationScript = body.conversationScript;

  const [row] = await db
    .update(agents)
    .set(patch)
    .where(and(eq(agents.id, id), eq(agents.userId, user.sub)))
    .returning();
  if (!row) return c.json({ error: "not found" }, 404);

  // Fire-and-forget: keep inbound dispatch rules in sync with latest agent
  // config. Failures are logged; we don't let them fail the PATCH.
  void syncDispatchRulesForAgent(row.id).catch((err) => {
    console.warn("syncDispatchRulesForAgent failed", { id: row.id, err });
  });

  return c.json({ agent: row });
});

const callSchema = z.object({
  to: z.string().trim().regex(/^\+[1-9]\d{6,14}$/, "must be E.164"),
  fromPhoneNumberId: z.string().uuid().optional(),
});

agentsRouter.post("/:id/call", zValidator("json", callSchema), async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const { to, fromPhoneNumberId } = c.req.valid("json");

  const [agent] = await db
    .select()
    .from(agents)
    .where(and(eq(agents.id, id), eq(agents.userId, user.sub)));
  if (!agent) return c.json({ error: "not found" }, 404);

  // Resolve the outgoing number + provider.
  const numberQuery = fromPhoneNumberId
    ? and(
        eq(phoneNumbers.id, fromPhoneNumberId),
        eq(phoneNumbers.userId, user.sub),
      )
    : and(
        eq(phoneNumbers.agentId, id),
        eq(phoneNumbers.userId, user.sub),
      );
  const candidates = await db.select().from(phoneNumbers).where(numberQuery);
  const number = candidates[0];
  if (!number) {
    return c.json(
      { error: "Assign a phone number to this agent first." },
      400,
    );
  }

  const [provider] = await db
    .select()
    .from(telephonyProviders)
    .where(
      and(
        eq(telephonyProviders.id, number.providerId),
        eq(telephonyProviders.userId, user.sub),
      ),
    );
  if (!provider?.livekitOutboundTrunkId) {
    return c.json({ error: "Provider outbound trunk missing." }, 400);
  }

  const roomName = `call-${agent.id}-${crypto.randomUUID().slice(0, 8)}`;
  const metadata = await buildAgentMetadata(agent);

  const dispatchClient = new AgentDispatchClient(
    env.LIVEKIT_URL,
    env.LIVEKIT_API_KEY,
    env.LIVEKIT_API_SECRET,
  );
  try {
    await dispatchClient.createDispatch(roomName, "agent", { metadata });
  } catch (err) {
    console.error("agent dispatch failed", err);
    return c.json({ error: "dispatch_failed" }, 502);
  }

  const sipClient = new SipClient(
    env.LIVEKIT_URL,
    env.LIVEKIT_API_KEY,
    env.LIVEKIT_API_SECRET,
  );
  try {
    const participant = await sipClient.createSipParticipant(
      provider.livekitOutboundTrunkId,
      to,
      roomName,
      {
        participantIdentity: `sip-${crypto.randomUUID().slice(0, 8)}`,
        participantName: "Caller",
        fromNumber: number.e164,
      },
    );
    return c.json({
      roomName,
      callSid: participant.sipCallId,
    });
  } catch (err) {
    console.error("createSipParticipant failed", err);
    return c.json({ error: "outbound_call_failed" }, 502);
  }
});

agentsRouter.post("/:id/test-call", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");

  const [row] = await db
    .select()
    .from(agents)
    .where(and(eq(agents.id, id), eq(agents.userId, user.sub)));
  if (!row) return c.json({ error: "not found" }, 404);
  if (!row.voiceId) {
    return c.json({ error: "Select a voice before starting a test call." }, 400);
  }

  const roomName = `test-${row.id}-${crypto.randomUUID().slice(0, 8)}`;

  const metadata = await buildAgentMetadata(row);

  const at = new AccessToken(env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET, {
    identity: user.sub,
    name: typeof user.email === "string" ? user.email : undefined,
    ttl: "10m",
  });
  at.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });
  const token = await at.toJwt();

  const dispatchClient = new AgentDispatchClient(
    env.LIVEKIT_URL,
    env.LIVEKIT_API_KEY,
    env.LIVEKIT_API_SECRET,
  );
  try {
    await dispatchClient.createDispatch(roomName, "agent", { metadata });
  } catch (err) {
    console.error("agent dispatch failed", err);
    return c.json({ error: "dispatch_failed" }, 502);
  }

  return c.json({ url: env.LIVEKIT_URL, token, roomName });
});

agentsRouter.delete("/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const [row] = await db
    .delete(agents)
    .where(and(eq(agents.id, id), eq(agents.userId, user.sub)))
    .returning();
  if (!row) return c.json({ error: "not found" }, 404);
  return c.json({ ok: true });
});

export default agentsRouter;
