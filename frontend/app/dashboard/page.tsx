import Link from "next/link";
import { serverApiFetch } from "@/lib/api-server";
import { createClient } from "@/lib/supabase/server";
import type { Agent, CallLogSummary } from "@/lib/types";

const MODE_LABEL: Record<string, string> = {
  test: "Test",
  embed: "Embed",
  demo: "Demo",
  phone: "Phone",
  outbound: "Outbound",
};

const MODE_COLOR: Record<string, string> = {
  test: "bg-sky-500",
  embed: "bg-emerald-500",
  demo: "bg-amber-500",
  phone: "bg-violet-500",
  outbound: "bg-rose-500",
};

function startOfDayUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function daysAgo(n: number): Date {
  const d = startOfDayUtc(new Date());
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return s === 0 ? `${m}m` : `${m}m ${s}s`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm === 0 ? `${h}h` : `${h}h ${rm}m`;
}

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return "just now";
  if (diff < 60 * 60_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 24 * 60 * 60_000) return `${Math.floor(diff / (60 * 60_000))}h ago`;
  return `${Math.floor(diff / (24 * 60 * 60_000))}d ago`;
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [agentsRes, callsRes] = await Promise.all([
    serverApiFetch("/agents"),
    serverApiFetch("/calls"),
  ]);
  const agents: Agent[] = agentsRes.ok
    ? ((await agentsRes.json()) as { agents: Agent[] }).agents
    : [];
  const calls: CallLogSummary[] = callsRes.ok
    ? ((await callsRes.json()) as { calls: CallLogSummary[] }).calls
    : [];

  const agentById = new Map(agents.map((a) => [a.id, a]));

  // 30-day window for the headline stats; 7-day window for the bar chart.
  const cutoff30 = daysAgo(30).getTime();
  const callsLast30 = calls.filter(
    (c) => new Date(c.startedAt).getTime() >= cutoff30,
  );
  const totalSeconds30 = callsLast30.reduce(
    (s, c) => s + c.durationSeconds,
    0,
  );
  const avgSeconds = callsLast30.length
    ? Math.round(totalSeconds30 / callsLast30.length)
    : 0;

  // 7-day daily counts.
  const days: { day: Date; count: number; minutes: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    days.push({ day: daysAgo(i), count: 0, minutes: 0 });
  }
  for (const c of calls) {
    const t = new Date(c.startedAt).getTime();
    for (const bucket of days) {
      const end = bucket.day.getTime() + 24 * 60 * 60_000;
      if (t >= bucket.day.getTime() && t < end) {
        bucket.count++;
        bucket.minutes += c.durationSeconds / 60;
        break;
      }
    }
  }
  const maxDayCount = Math.max(1, ...days.map((d) => d.count));

  // Mode breakdown for the 30-day window.
  const modeCounts = new Map<string, number>();
  for (const c of callsLast30) {
    modeCounts.set(c.mode, (modeCounts.get(c.mode) ?? 0) + 1);
  }
  const modeRows = [...modeCounts.entries()]
    .map(([mode, count]) => ({ mode, count }))
    .sort((a, b) => b.count - a.count);

  // Top 5 agents by 30-day call count.
  const agentCounts = new Map<string, number>();
  const agentMinutes = new Map<string, number>();
  for (const c of callsLast30) {
    agentCounts.set(c.agentId, (agentCounts.get(c.agentId) ?? 0) + 1);
    agentMinutes.set(
      c.agentId,
      (agentMinutes.get(c.agentId) ?? 0) + c.durationSeconds / 60,
    );
  }
  const topAgents = [...agentCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id, count]) => ({
      agent: agentById.get(id),
      id,
      count,
      minutes: agentMinutes.get(id) ?? 0,
    }));

  const recentCalls = calls.slice(0, 5);

  return (
    <div className="mx-auto max-w-5xl px-8 py-10">
      <PageHeader
        title="Overview"
        subtitle={`Welcome back${user?.email ? `, ${user.email}` : ""}.`}
      />

      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Agents" value={agents.length} />
        <StatCard label="Calls (30d)" value={callsLast30.length} />
        <StatCard
          label="Minutes (30d)"
          value={(totalSeconds30 / 60).toFixed(1)}
        />
        <StatCard
          label="Avg duration"
          value={callsLast30.length ? formatDuration(avgSeconds) : "—"}
        />
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Panel title="Activity" subtitle="Calls per day, last 7 days">
          {calls.length === 0 ? (
            <EmptyHint>
              No calls yet — start a test call from an agent or talk to an
              embedded widget.
            </EmptyHint>
          ) : (
            <DailyBars days={days} max={maxDayCount} />
          )}
        </Panel>

        <Panel title="By mode" subtitle="Last 30 days">
          {modeRows.length === 0 ? (
            <EmptyHint>No calls yet.</EmptyHint>
          ) : (
            <ModeBreakdown rows={modeRows} total={callsLast30.length} />
          )}
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="Top agents" subtitle="Most-used in the last 30 days">
          {topAgents.length === 0 ? (
            <EmptyHint>
              No call data yet. Once your agents take calls, the busiest
              ones will surface here.
            </EmptyHint>
          ) : (
            <ul className="flex flex-col">
              {topAgents.map((row, i) => (
                <li
                  key={row.id}
                  className="flex items-center gap-3 border-b border-border py-3 last:border-b-0"
                >
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-surface-2 text-[11px] font-medium text-muted">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    {row.agent ? (
                      <Link
                        href={`/dashboard/agents/${row.id}`}
                        className="truncate text-sm font-medium hover:text-accent"
                      >
                        {row.agent.name}
                      </Link>
                    ) : (
                      <span className="truncate text-sm text-muted">
                        Deleted agent
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-muted">
                    {row.count} {row.count === 1 ? "call" : "calls"}
                  </span>
                  <span className="font-mono text-[11px] text-muted-2">
                    {row.minutes.toFixed(1)}m
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title="Recent calls"
          subtitle="Latest activity"
          action={
            <Link
              href="/dashboard/calls"
              className="text-xs text-muted hover:text-foreground"
            >
              View all →
            </Link>
          }
        >
          {recentCalls.length === 0 ? (
            <EmptyHint>No calls yet.</EmptyHint>
          ) : (
            <ul className="flex flex-col">
              {recentCalls.map((c) => {
                const agent = agentById.get(c.agentId);
                return (
                  <li
                    key={c.id}
                    className="border-b border-border last:border-b-0"
                  >
                    <Link
                      href={`/dashboard/calls/${c.id}`}
                      className="flex items-center gap-3 py-3 transition hover:text-foreground"
                    >
                      <span
                        className={`size-1.5 shrink-0 rounded-full ${MODE_COLOR[c.mode] ?? "bg-muted-2"}`}
                      />
                      <span className="min-w-0 flex-1 truncate text-sm">
                        {agent?.name ?? "Unknown agent"}
                      </span>
                      <span className="text-[10px] uppercase tracking-wider text-muted-2">
                        {MODE_LABEL[c.mode] ?? c.mode}
                      </span>
                      <span className="font-mono text-xs text-muted">
                        {formatDuration(c.durationSeconds)}
                      </span>
                      <span className="w-16 text-right text-[11px] text-muted-2">
                        {formatRelative(c.startedAt)}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}

function PageHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex items-end justify-between gap-4 border-b border-border pb-5">
      <div>
        <h1 className="text-xl font-medium tracking-tight">{title}</h1>
        {subtitle ? (
          <p className="mt-0.5 text-sm text-muted">{subtitle}</p>
        ) : null}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface/40 px-4 py-3.5">
      <div className="text-xs text-muted-2">{label}</div>
      <div className="mt-1.5 font-serif text-3xl italic tracking-tight text-foreground">
        {value}
      </div>
    </div>
  );
}

function Panel({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-surface/20 p-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium">{title}</h2>
          {subtitle ? (
            <p className="mt-0.5 text-xs text-muted-2">{subtitle}</p>
          ) : null}
        </div>
        {action}
      </header>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-md border border-dashed border-border bg-background/30 px-4 py-6 text-center text-xs text-muted">
      {children}
    </p>
  );
}

function DailyBars({
  days,
  max,
}: {
  days: { day: Date; count: number; minutes: number }[];
  max: number;
}) {
  return (
    <div className="flex h-32 items-end gap-1.5">
      {days.map((d) => {
        const ratio = max > 0 ? d.count / max : 0;
        const heightPct = Math.max(ratio * 100, d.count > 0 ? 6 : 2);
        const isToday =
          d.day.toDateString() === startOfDayUtc(new Date()).toDateString();
        return (
          <div
            key={d.day.toISOString()}
            className="group relative flex min-w-0 flex-1 flex-col items-center justify-end"
          >
            <div className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-background px-1.5 py-0.5 text-[10px] text-muted opacity-0 ring-1 ring-border transition-opacity group-hover:opacity-100">
              {d.count} calls · {d.minutes.toFixed(1)}m
            </div>
            <div
              className={
                isToday
                  ? "w-full rounded-t-sm bg-accent transition-all"
                  : "w-full rounded-t-sm bg-accent/40 transition-all group-hover:bg-accent/70"
              }
              style={{ height: `${heightPct}%` }}
            />
            <div className="mt-1.5 text-[10px] text-muted-2">
              {d.day.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 1)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ModeBreakdown({
  rows,
  total,
}: {
  rows: { mode: string; count: number }[];
  total: number;
}) {
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((r) => {
        const pct = total > 0 ? Math.round((r.count / total) * 100) : 0;
        const color = MODE_COLOR[r.mode] ?? "bg-muted-2";
        return (
          <li key={r.mode}>
            <div className="flex items-baseline justify-between text-xs">
              <span className="text-foreground">
                {MODE_LABEL[r.mode] ?? r.mode}
              </span>
              <span className="text-muted-2">
                {r.count} <span className="opacity-60">· {pct}%</span>
              </span>
            </div>
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-2">
              <div
                className={`h-full ${color}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
