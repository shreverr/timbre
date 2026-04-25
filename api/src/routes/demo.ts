import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { AccessToken, AgentDispatchClient } from "livekit-server-sdk";
import { db } from "../config/database";
import { agents } from "../db/schema";
import { env } from "../env";
import { buildAgentMetadata } from "../telephony/dispatch-rules";

/**
 * Public demo endpoint for the landing page.
 *
 * Issues a short-lived LiveKit token without auth so any visitor can talk to
 * the demo agent. Picks `DEMO_AGENT_ID` if set, otherwise the first agent in
 * the system with a voice configured. Per-IP rate limiting prevents trivial
 * abuse; LiveKit minutes are still on the operator.
 */

const router = new Hono();

const MAX_CONCURRENT_PER_IP = 2;
const MAX_PER_IP_PER_HOUR = 10;
const HOUR_MS = 60 * 60 * 1000;
const CALL_TTL_MS = 10 * 60 * 1000;

type DemoCall = { ip: string; startedAt: number; endsAt: number };
const calls: DemoCall[] = [];

function gc(now: number) {
  let i = 0;
  while (i < calls.length) {
    if (calls[i]!.startedAt < now - HOUR_MS && calls[i]!.endsAt < now) {
      calls.splice(i, 1);
    } else {
      i++;
    }
  }
}

function clientIp(c: import("hono").Context): string {
  return (
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ||
    c.req.header("x-real-ip") ||
    "0.0.0.0"
  );
}

async function pickDemoAgent() {
  if (env.DEMO_AGENT_ID) {
    const [row] = await db
      .select()
      .from(agents)
      .where(eq(agents.id, env.DEMO_AGENT_ID));
    if (row) return row;
  }
  // Fallback: first agent with a voice configured.
  const all = await db.select().from(agents);
  return all.find((a) => !!a.voiceId) ?? null;
}

router.post("/demo/token", async (c) => {
  const now = Date.now();
  gc(now);

  const ip = clientIp(c);
  const ipCalls = calls.filter((x) => x.ip === ip);
  const concurrent = ipCalls.filter((x) => x.endsAt > now).length;
  if (concurrent >= MAX_CONCURRENT_PER_IP) {
    return c.json({ error: "concurrent_limit" }, 429);
  }
  const recent = ipCalls.filter((x) => x.startedAt > now - HOUR_MS).length;
  if (recent >= MAX_PER_IP_PER_HOUR) {
    return c.json({ error: "hourly_limit" }, 429);
  }

  const agent = await pickDemoAgent();
  if (!agent) {
    return c.json({ error: "demo_unavailable" }, 503);
  }
  if (!agent.voiceId) {
    return c.json({ error: "demo_voice_missing" }, 503);
  }

  const room = `demo-${agent.id}-${randomBytes(4).toString("hex")}`;

  const baseMetadata = await buildAgentMetadata(agent);
  let metadata = baseMetadata;
  try {
    const parsed = JSON.parse(baseMetadata);
    parsed.mode = "demo";
    metadata = JSON.stringify(parsed);
  } catch {
    // leave as-is
  }

  const dispatchClient = new AgentDispatchClient(
    env.LIVEKIT_URL,
    env.LIVEKIT_API_KEY,
    env.LIVEKIT_API_SECRET,
  );
  try {
    await dispatchClient.createDispatch(room, "agent", { metadata });
  } catch (err) {
    console.error("demo dispatch failed", err);
    return c.json({ error: "dispatch_failed" }, 502);
  }

  const at = new AccessToken(env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET, {
    identity: `demo-${randomBytes(4).toString("hex")}`,
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

  calls.push({ ip, startedAt: now, endsAt: now + CALL_TTL_MS });

  return c.json({
    url: env.LIVEKIT_URL,
    token,
    room,
    agentName: agent.name,
  });
});

export default router;
