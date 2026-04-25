import Link from "next/link";
import { serverApiFetch } from "@/lib/api-server";
import type { Agent, CallLogSummary } from "@/lib/types";

const MODE_LABELS: Record<string, string> = {
  test: "Test call",
  embed: "Web embed",
  demo: "Landing demo",
  phone: "Phone",
  outbound: "Outbound",
};

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s === 0 ? `${m}m` : `${m}m ${s}s`;
}

function formatRelativeOrAbsolute(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return "just now";
  if (diff < 60 * 60_000) return `${Math.floor(diff / 60_000)} min ago`;
  if (diff < 24 * 60 * 60_000) return `${Math.floor(diff / (60 * 60_000))} h ago`;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function fetchCalls(): Promise<CallLogSummary[]> {
  const res = await serverApiFetch("/calls");
  if (!res.ok) return [];
  const body = (await res.json()) as { calls: CallLogSummary[] };
  return body.calls;
}

async function fetchAgentMap(): Promise<Map<string, Agent>> {
  const res = await serverApiFetch("/agents");
  if (!res.ok) return new Map();
  const body = (await res.json()) as { agents: Agent[] };
  return new Map(body.agents.map((a) => [a.id, a]));
}

export default async function CallsPage() {
  const [calls, agents] = await Promise.all([fetchCalls(), fetchAgentMap()]);

  return (
    <div className="mx-auto max-w-5xl px-8 py-10">
      <header className="border-b border-border pb-5">
        <h1 className="text-xl font-medium tracking-tight">Calls</h1>
        <p className="mt-1 text-sm text-muted">
          Every call answered by your agents — across the landing demo, web
          embeds, and the in-dashboard test call.
        </p>
      </header>

      {calls.length === 0 ? (
        <div className="mt-10 rounded-lg border border-dashed border-border bg-surface/20 px-6 py-12 text-center">
          <p className="text-sm text-muted">
            No calls yet. Start a test call from an agent or talk to your
            embed widget — they&rsquo;ll show up here with the full transcript.
          </p>
        </div>
      ) : (
        <ul className="mt-6 flex flex-col">
          {calls.map((c) => {
            const agent = agents.get(c.agentId);
            return (
              <li key={c.id} className="border-b border-border last:border-b-0">
                <Link
                  href={`/dashboard/calls/${c.id}`}
                  className="grid grid-cols-12 items-center gap-3 px-3 py-3.5 transition hover:bg-surface-2/40"
                >
                  <div className="col-span-4 min-w-0">
                    <div className="truncate text-sm font-medium">
                      {agent?.name ?? "Unknown agent"}
                    </div>
                    <div className="mt-0.5 truncate text-xs text-muted-2">
                      {c.callerIdentity ?? c.room}
                    </div>
                  </div>
                  <div className="col-span-2">
                    <ModeChip mode={c.mode} />
                  </div>
                  <div className="col-span-2 text-xs text-muted">
                    {c.messageCount} {c.messageCount === 1 ? "turn" : "turns"}
                  </div>
                  <div className="col-span-2 font-mono text-xs text-muted">
                    {formatDuration(c.durationSeconds)}
                  </div>
                  <div className="col-span-2 text-right text-xs text-muted-2">
                    {formatRelativeOrAbsolute(c.startedAt)}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function ModeChip({ mode }: { mode: string }) {
  const label = MODE_LABELS[mode] ?? mode;
  const isDemo = mode === "demo";
  const isEmbed = mode === "embed";
  const isTest = mode === "test";
  const cls = isDemo
    ? "bg-amber-500/15 text-amber-400"
    : isEmbed
      ? "bg-emerald-500/15 text-emerald-400"
      : isTest
        ? "bg-sky-500/15 text-sky-400"
        : "bg-surface-2 text-muted";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${cls}`}
    >
      {label}
    </span>
  );
}
