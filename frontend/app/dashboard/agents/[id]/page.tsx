import Link from "next/link";
import { notFound } from "next/navigation";
import { AgentKnowledgeSection } from "@/components/agent-knowledge-section";
import { AgentTabsNav, type AgentTab } from "@/components/agent-tabs-nav";
import { CallButton } from "@/components/call-button";
import { DeleteAgentButton } from "@/components/delete-agent-button";
import { EditAgentForm } from "@/components/edit-agent-form";
import { EmbedSection } from "@/components/embed-section";
import { PromptForm } from "@/components/prompt-form";
import { TestCallButton } from "@/components/test-call-button";
import { ToolsSection } from "@/components/tools-section";
import { VoicePicker } from "@/components/voice-picker";
import { serverApiFetch } from "@/lib/api-server";
import type { Agent, Voice } from "@/lib/types";

const TAB_IDS = [
  "general",
  "prompt",
  "voice",
  "knowledge",
  "tools",
  "embed",
  "phone",
] as const;
type TabId = (typeof TAB_IDS)[number];

function isTab(s: unknown): s is TabId {
  return typeof s === "string" && (TAB_IDS as readonly string[]).includes(s);
}

async function fetchVoice(id: string): Promise<Voice | null> {
  const res = await serverApiFetch(`/voices/${encodeURIComponent(id)}`);
  if (!res.ok) return null;
  const body = (await res.json()) as { voice: Voice };
  return body.voice;
}

export default async function AgentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;

  const res = await serverApiFetch(`/agents/${id}`);
  if (res.status === 404) notFound();
  if (!res.ok) {
    return (
      <div className="mx-auto max-w-4xl px-8 py-10">
        <p className="text-sm text-red-400">Failed to load agent.</p>
      </div>
    );
  }

  const { agent } = (await res.json()) as { agent: Agent };
  const voice = agent.voiceId ? await fetchVoice(agent.voiceId) : null;

  // Tab list — drop "prompt" for MULTI agents (their flow isn't built yet).
  const tabs: AgentTab[] = [
    { id: "general", label: "General" },
    ...(agent.type === "SINGLE"
      ? [{ id: "prompt", label: "Prompt" }]
      : []),
    { id: "voice", label: "Voice" },
    { id: "knowledge", label: "Knowledge" },
    { id: "tools", label: "Tools" },
    { id: "embed", label: "Embed" },
    { id: "phone", label: "Phone" },
  ];

  const requested = isTab(sp.tab) ? sp.tab : null;
  const fallback: TabId = agent.type === "SINGLE" ? "prompt" : "voice";
  const tab: TabId =
    requested && tabs.some((t) => t.id === requested) ? requested : fallback;

  return (
    <div className="mx-auto max-w-4xl px-8 py-10">
      <nav className="text-xs text-muted-2">
        <Link href="/dashboard/agents" className="hover:text-foreground">
          Agents
        </Link>
        <span className="mx-1.5">/</span>
        <span className="truncate text-foreground">{agent.name}</span>
      </nav>

      <header className="mt-4 flex items-end justify-between gap-4 pb-5">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-medium tracking-tight">
            {agent.name}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
            <span>
              {agent.type === "SINGLE"
                ? "Single prompt agent"
                : "Multi prompt agent"}
            </span>
            <Dot />
            <StatusChip ok={!!voice} okText={voice ? voice.name : "Voice"} fallback="No voice" />
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <CallButton agent={agent} />
          <TestCallButton agent={agent} />
        </div>
      </header>

      <div className="sticky top-0 z-10 -mx-2 border-b border-border bg-background/90 px-2 py-2 backdrop-blur">
        <AgentTabsNav tabs={tabs} active={tab} />
      </div>

      <div className="mt-6">
        {tab === "general" ? (
          <Panel title="General" description="Name and language settings.">
            <EditAgentForm agent={agent} />
            <Divider />
            <DangerRow agentId={agent.id} />
          </Panel>
        ) : null}

        {tab === "prompt" && agent.type === "SINGLE" ? (
          <Panel
            title="Prompt"
            description="How this agent greets callers, what it tries to accomplish, and how it should respond."
          >
            <PromptForm agent={agent} />
          </Panel>
        ) : null}

        {tab === "voice" ? (
          <Panel
            title="Voice"
            description="The Cartesia voice this agent uses to speak."
            right={
              <VoicePicker
                agentId={agent.id}
                currentVoiceId={agent.voiceId}
                currentVoiceName={voice?.name}
              />
            }
          >
            <div className="rounded-md border border-border bg-background/40 px-4 py-3.5">
              {voice ? (
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-medium text-foreground">
                      {voice.name}
                    </span>
                    <span className="text-[11px] uppercase tracking-wider text-muted-2">
                      {voice.language}
                      {voice.gender
                        ? ` · ${voice.gender.replace("_", " ")}`
                        : ""}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-muted">
                    {voice.description}
                  </p>
                </div>
              ) : agent.voiceId ? (
                <p className="text-sm text-muted">Voice details unavailable.</p>
              ) : (
                <p className="text-sm text-muted">
                  No voice selected yet. Pick one to make this agent speak.
                </p>
              )}
            </div>
          </Panel>
        ) : null}

        {tab === "knowledge" ? (
          <Panel
            title="Knowledge"
            description="Attach knowledge bases. The agent gets a `search_knowledge_base` tool the LLM can call when it needs facts."
          >
            <AgentKnowledgeSection agentId={agent.id} />
          </Panel>
        ) : null}

        {tab === "tools" ? (
          <Panel
            title="Tools & integrations"
            description="MCP servers and HTTP hooks for each call phase."
          >
            <ToolsSection agentId={agent.id} />
          </Panel>
        ) : null}

        {tab === "embed" ? (
          <Panel
            title="Embed"
            description="Drop a voice widget onto your website. Visitors connect over WebRTC — no telephony involved."
          >
            <EmbedSection agentId={agent.id} />
          </Panel>
        ) : null}

        {tab === "phone" ? (
          <Panel
            title="Phone"
            description="Inbound and outbound calling via your own SIP / Twilio trunk."
          >
            <ComingSoon
              title="Telephony is coming soon"
              body="Bring-your-own-trunk routing and outbound dialing aren't generally available yet. In the meantime, your agent works end-to-end via the in-dashboard test call and the Embed widget."
            />
          </Panel>
        ) : null}
      </div>
    </div>
  );
}

function Panel({
  title,
  description,
  right,
  children,
}: {
  title: string;
  description?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-surface/20 p-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-medium tracking-tight">{title}</h2>
          {description ? (
            <p className="mt-1 text-xs text-muted">{description}</p>
          ) : null}
        </div>
        {right}
      </header>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Dot() {
  return (
    <span aria-hidden className="inline-block size-1 rounded-full bg-muted-2/60" />
  );
}

function StatusChip({
  ok,
  okText,
  fallback,
}: {
  ok: boolean;
  okText: string;
  fallback: string;
}) {
  return (
    <span
      className={
        ok
          ? "inline-flex items-center gap-1.5 text-emerald-400/90"
          : "inline-flex items-center gap-1.5 text-muted-2"
      }
    >
      <span
        className={
          ok ? "inline-block size-1.5 rounded-full bg-emerald-400" : "inline-block size-1.5 rounded-full bg-muted-2"
        }
      />
      {ok ? okText : fallback}
    </span>
  );
}

function Divider() {
  return <hr className="my-6 border-border" />;
}

function ComingSoon({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-md border border-dashed border-amber-500/30 bg-amber-500/5 px-5 py-6">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-400"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.4" />
            <path
              d="M8 4.5V8l2 1.5"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-amber-300">{title}</p>
          <p className="mt-1 text-xs text-muted">{body}</p>
        </div>
      </div>
    </div>
  );
}

function DangerRow({ agentId }: { agentId: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium">Delete agent</p>
        <p className="mt-0.5 text-xs text-muted">
          Removes this agent and detaches any phone numbers assigned to it.
        </p>
      </div>
      <DeleteAgentButton
        id={agentId}
        variant="outline"
        redirectTo="/dashboard/agents"
      />
    </div>
  );
}
