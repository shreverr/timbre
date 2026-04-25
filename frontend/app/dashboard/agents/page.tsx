import Link from "next/link";
import { DeleteAgentButton } from "@/components/delete-agent-button";
import { serverApiFetch } from "@/lib/api-server";
import type { Agent } from "@/lib/types";

export default async function AgentsPage() {
  const res = await serverApiFetch("/agents");
  if (!res.ok) {
    return (
      <div className="mx-auto max-w-5xl px-8 py-10">
        <PageHeader title="Agents" />
        <p className="mt-6 text-sm text-red-400">Failed to load agents.</p>
      </div>
    );
  }

  const { agents } = (await res.json()) as { agents: Agent[] };

  return (
    <div className="mx-auto max-w-5xl px-8 py-10">
      <PageHeader
        title="Agents"
        subtitle="Voice agents that take and make calls."
        right={
          <Link
            href="/dashboard/agents/new"
            className="inline-flex h-9 items-center rounded-md bg-foreground px-3.5 text-sm font-medium text-background transition hover:bg-accent-soft"
          >
            New agent
          </Link>
        }
      />

      {agents.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="mt-6 overflow-hidden rounded-lg border border-border">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-surface/40 text-xs text-muted-2">
              <tr>
                <th className="px-4 py-2.5 font-medium">Name</th>
                <th className="px-4 py-2.5 font-medium">Workflow</th>
                <th className="px-4 py-2.5 font-medium">Created</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {agents.map((a) => (
                <tr key={a.id} className="transition hover:bg-surface/30">
                  <td className="px-4 py-3">
                    <Link
                      href={`/dashboard/agents/${a.id}`}
                      className="font-medium text-foreground hover:text-accent"
                    >
                      {a.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted">
                    <WorkflowBadge type={a.type} />
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {new Date(a.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <DeleteAgentButton id={a.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PageHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-4 border-b border-border pb-5">
      <div>
        <h1 className="text-xl font-medium tracking-tight">{title}</h1>
        {subtitle ? (
          <p className="mt-0.5 text-sm text-muted">{subtitle}</p>
        ) : null}
      </div>
      {right ? <div className="flex items-center gap-2">{right}</div> : null}
    </div>
  );
}

function WorkflowBadge({ type }: { type: Agent["type"] }) {
  const label = type === "SINGLE" ? "Single prompt" : "Multi prompt";
  return (
    <span className="inline-flex items-center rounded-full border border-border bg-surface/40 px-2 py-0.5 text-[11px] text-muted">
      {label}
    </span>
  );
}

function EmptyState() {
  return (
    <div className="mt-8 rounded-lg border border-dashed border-border bg-surface/20 py-14 text-center">
      <div className="mx-auto grid size-10 place-items-center rounded-full bg-accent/10 text-accent">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <rect
            x="3"
            y="5.5"
            width="12"
            height="8"
            rx="2.5"
            stroke="currentColor"
            strokeWidth="1.4"
          />
          <circle cx="7" cy="9.5" r="1" fill="currentColor" />
          <circle cx="11" cy="9.5" r="1" fill="currentColor" />
          <path
            d="M9 3V5.5"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <h2 className="mt-4 text-sm font-medium">No agents yet</h2>
      <p className="mt-1 text-xs text-muted">
        Create your first agent to answer calls or dial out to leads.
      </p>
      <Link
        href="/dashboard/agents/new"
        className="mt-5 inline-flex h-9 items-center rounded-md bg-foreground px-4 text-sm font-medium text-background transition hover:bg-accent-soft"
      >
        Create agent
      </Link>
    </div>
  );
}
