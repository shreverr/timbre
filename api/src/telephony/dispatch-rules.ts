import { RoomAgentDispatch, RoomConfiguration } from "@livekit/protocol";
import { SipClient } from "livekit-server-sdk";
import { and, eq } from "drizzle-orm";
import { db } from "../config/database";
import {
  agentKnowledgeBases,
  agentTools,
  agents,
  knowledgeBases,
  mcpServers,
  phoneNumbers,
  telephonyProviders,
} from "../db/schema";
import { env } from "../env";
import { getVoiceInfo } from "../lib/voice-info";
import { decryptJson } from "./encrypt";
import { getDriver } from "./index";
import type { ProviderCredentials } from "./drivers/base";

let sipClient: SipClient | null = null;
function getSipClient(): SipClient {
  if (!sipClient) {
    sipClient = new SipClient(
      env.LIVEKIT_URL,
      env.LIVEKIT_API_KEY,
      env.LIVEKIT_API_SECRET,
    );
  }
  return sipClient;
}

type AgentRow = typeof agents.$inferSelect;
type PhoneNumberRow = typeof phoneNumbers.$inferSelect;
type ProviderRow = typeof telephonyProviders.$inferSelect;

function decryptHeaders(blob: string | null): Record<string, string> | null {
  if (!blob) return null;
  try {
    return decryptJson<Record<string, string>>(blob);
  } catch {
    return null;
  }
}

export async function buildAgentMetadata(agent: AgentRow): Promise<string> {
  const [servers, tools, voiceInfo, kbLinks] = await Promise.all([
    db
      .select()
      .from(mcpServers)
      .where(
        and(eq(mcpServers.agentId, agent.id), eq(mcpServers.enabled, true)),
      ),
    db
      .select()
      .from(agentTools)
      .where(
        and(eq(agentTools.agentId, agent.id), eq(agentTools.enabled, true)),
      ),
    agent.voiceId ? getVoiceInfo(agent.voiceId) : Promise.resolve(null),
    db
      .select()
      .from(agentKnowledgeBases)
      .where(eq(agentKnowledgeBases.agentId, agent.id)),
  ]);

  const kbIds = kbLinks.map((l) => l.knowledgeBaseId);
  const kbRows = kbIds.length
    ? await db
        .select()
        .from(knowledgeBases)
        .where(eq(knowledgeBases.userId, agent.userId))
    : [];
  const kbSet = new Set(kbIds);
  const kbOut = kbRows
    .filter((k) => kbSet.has(k.id))
    .map((k) => ({
      id: k.id,
      name: k.name,
      toolDescription: k.toolDescription,
    }));

  const mcpOut = servers.map((s) => ({
    id: s.id,
    label: s.label,
    url: s.url,
    transport: s.transport,
    headers: decryptHeaders(s.headers),
  }));

  const pre: unknown[] = [];
  const on: unknown[] = [];
  const post: unknown[] = [];
  for (const t of tools) {
    const base = {
      id: t.id,
      name: t.name,
      description: t.description,
      method: t.method,
      url: t.url,
      headers: decryptHeaders(t.headers),
      bodyTemplate: t.bodyTemplate,
    };
    if (t.phase === "PRE") pre.push(base);
    else if (t.phase === "POST") post.push(base);
    else on.push({ ...base, parameters: t.parameters });
  }

  return JSON.stringify({
    agentId: agent.id,
    name: agent.name,
    voiceId: agent.voiceId,
    voiceGender: voiceInfo?.gender ?? null,
    voiceName: voiceInfo?.name ?? null,
    language: agent.language,
    firstMessage: agent.firstMessage,
    objective: agent.objective,
    responseGuidelines: agent.responseGuidelines,
    conversationScript: agent.conversationScript,
    mcpServers: mcpOut,
    knowledgeBases: kbOut,
    tools: { pre, on, post },
  });
}

async function deleteRuleSafe(ruleId: string) {
  try {
    await getSipClient().deleteSipDispatchRule(ruleId);
  } catch (err) {
    console.warn("failed to delete SIP dispatch rule", { ruleId, err });
  }
}

async function deleteInboundTrunkSafe(trunkId: string) {
  try {
    await getSipClient().deleteSipTrunk(trunkId);
  } catch (err) {
    console.warn("failed to delete SIP inbound trunk", { trunkId, err });
  }
}

/**
 * Reconciles the LiveKit inbound trunk + dispatch rule for a single phone
 * number. Deletes any existing pair, and if the number is assigned, provisions
 * a fresh trunk (allowed for this one number) plus a rule that dispatches the
 * agent with a snapshot of its current config.
 */
export async function syncDispatchRuleForNumber(number: PhoneNumberRow) {
  const client = getSipClient();

  // Teardown: rule first, then trunk (LiveKit rejects deleting a trunk that
  // still has a rule attached).
  if (number.dispatchRuleId) {
    await deleteRuleSafe(number.dispatchRuleId);
  }
  if (number.livekitInboundTrunkId) {
    await deleteInboundTrunkSafe(number.livekitInboundTrunkId);
  }
  if (number.dispatchRuleId || number.livekitInboundTrunkId) {
    await db
      .update(phoneNumbers)
      .set({
        dispatchRuleId: null,
        livekitInboundTrunkId: null,
        updatedAt: new Date(),
      })
      .where(eq(phoneNumbers.id, number.id));
  }

  if (!number.agentId) return; // unassigned

  const [agent] = await db
    .select()
    .from(agents)
    .where(
      and(eq(agents.id, number.agentId), eq(agents.userId, number.userId)),
    );
  if (!agent) return;

  const [provider] = await db
    .select()
    .from(telephonyProviders)
    .where(
      and(
        eq(telephonyProviders.id, number.providerId),
        eq(telephonyProviders.userId, number.userId),
      ),
    );
  if (!provider) return;

  // Decrypt the provider's credentials so we can authenticate the inbound
  // trunk to whatever SIP service will be originating to LiveKit.
  const creds = decryptJson<ProviderCredentials>(provider.credentials);
  const driver = getDriver(provider.type);
  const { trunkId } = await driver.createInboundTrunk({
    name: `timbre-inbound-${number.id}`,
    creds,
    numbers: [number.e164],
  });

  const metadata = await buildAgentMetadata(agent);
  const rule = await client.createSipDispatchRule(
    { type: "individual", roomPrefix: "call-" },
    {
      name: `timbre-${number.id}`,
      trunkIds: [trunkId],
      roomConfig: new RoomConfiguration({
        agents: [
          new RoomAgentDispatch({
            agentName: "agent",
            metadata,
          }),
        ],
      }),
    },
  );

  await db
    .update(phoneNumbers)
    .set({
      livekitInboundTrunkId: trunkId,
      dispatchRuleId: rule.sipDispatchRuleId,
      updatedAt: new Date(),
    })
    .where(eq(phoneNumbers.id, number.id));
}

/** Sync every number pointing at this agent (used after agent PATCH). */
export async function syncDispatchRulesForAgent(agentId: string) {
  const rows = await db
    .select()
    .from(phoneNumbers)
    .where(eq(phoneNumbers.agentId, agentId));
  await Promise.allSettled(rows.map((n) => syncDispatchRuleForNumber(n)));
}

/** Tear down a number's LiveKit resources without re-creating them (used on delete). */
export async function teardownNumber(number: PhoneNumberRow) {
  if (number.dispatchRuleId) {
    await deleteRuleSafe(number.dispatchRuleId);
  }
  if (number.livekitInboundTrunkId) {
    await deleteInboundTrunkSafe(number.livekitInboundTrunkId);
  }
}

export type { AgentRow, PhoneNumberRow, ProviderRow };
