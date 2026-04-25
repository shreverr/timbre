import Link from "next/link";
import { notFound } from "next/navigation";
import { serverApiFetch } from "@/lib/api-server";
import type { Agent, CallLog } from "@/lib/types";

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s === 0 ? `${m}m` : `${m}m ${s}s`;
}

function formatAbsolute(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

async function fetchAgent(id: string): Promise<Agent | null> {
  const res = await serverApiFetch(`/agents/${id}`);
  if (!res.ok) return null;
  const body = (await res.json()) as { agent: Agent };
  return body.agent;
}

export default async function CallDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const res = await serverApiFetch(`/calls/${id}`);
  if (res.status === 404) notFound();
  if (!res.ok) {
    return (
      <div className="mx-auto max-w-3xl px-8 py-10">
        <p className="text-sm text-red-400">Failed to load call.</p>
      </div>
    );
  }
  const { call } = (await res.json()) as { call: CallLog };
  const agent = await fetchAgent(call.agentId);

  return (
    <div className="mx-auto max-w-3xl px-8 py-10">
      <nav className="text-xs text-muted-2">
        <Link href="/dashboard/calls" className="hover:text-foreground">
          Calls
        </Link>
        <span className="mx-1.5">/</span>
        <span className="truncate text-foreground">
          {agent?.name ?? "Call"}
        </span>
      </nav>

      <header className="mt-4 border-b border-border pb-5">
        <h1 className="text-xl font-medium tracking-tight">
          {agent?.name ?? "Call"}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
          <span className="rounded-full bg-surface-2 px-2 py-0.5 uppercase tracking-wider">
            {call.mode}
          </span>
          <span>{formatAbsolute(call.startedAt)}</span>
          <span className="font-mono">·</span>
          <span>{formatDuration(call.durationSeconds)}</span>
          <span className="font-mono">·</span>
          <span className="font-mono">{call.room}</span>
        </div>
      </header>

      <section className="mt-6">
        {call.transcript.length === 0 ? (
          <p className="rounded-md border border-border bg-surface/20 px-4 py-6 text-center text-sm text-muted">
            No transcript captured for this call.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {call.transcript.map((t, i) => (
              <li
                key={i}
                className={
                  t.role === "user" ? "flex justify-end" : "flex justify-start"
                }
              >
                <div
                  className={
                    t.role === "user"
                      ? "max-w-[80%] rounded-lg rounded-tr-sm bg-foreground/90 px-3.5 py-2.5 text-sm text-background"
                      : "max-w-[80%] rounded-lg rounded-tl-sm border border-border bg-surface/40 px-3.5 py-2.5 text-sm text-foreground"
                  }
                >
                  <div className="mb-0.5 text-[10px] uppercase tracking-wider opacity-60">
                    {t.role === "user"
                      ? "Visitor"
                      : agent?.name ?? "Agent"}
                  </div>
                  <p className="whitespace-pre-wrap">{cleanText(t.text)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function cleanText(text: string): string {
  return text
    .replace(/<[^>]+>/g, "")
    .replace(/\[(?:laughter|laughs?|sigh|pause)\]/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}
