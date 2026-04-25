"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { apiFetch } from "@/lib/api";
import type { Agent, AgentType } from "@/lib/types";

export default function NewAgentPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [type, setType] = useState<AgentType>("SINGLE");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const res = await apiFetch("/agents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), type }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "Failed to create agent");
      setPending(false);
      return;
    }

    const { agent } = (await res.json()) as { agent: Agent };
    router.push(`/dashboard/agents/${agent.id}`);
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-2xl px-8 py-10">
      <nav className="text-xs text-muted-2">
        <Link href="/dashboard/agents" className="hover:text-foreground">
          Agents
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-foreground">New</span>
      </nav>

      <div className="mt-4 border-b border-border pb-5">
        <h1 className="text-xl font-medium tracking-tight">New agent</h1>
        <p className="mt-0.5 text-sm text-muted">
          Name the agent and pick a workflow. You can change the name later;
          the workflow is set at creation.
        </p>
      </div>

      <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-6">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium">Name</span>
          <input
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={100}
            autoFocus
            placeholder="e.g. support-bot"
            className="h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none transition focus:border-border-strong focus:ring-1 focus:ring-accent/40"
          />
        </label>

        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium">Workflow</span>
          <div className="grid gap-3 sm:grid-cols-2">
            <WorkflowCard
              label="Single prompt"
              description="One instruction handles the whole call. Fast to set up, works for most cases."
              selected={type === "SINGLE"}
              onClick={() => setType("SINGLE")}
            />
            <WorkflowCard
              label="Multi prompt"
              description="Compose multiple specialized prompts with handoffs between them."
              comingSoon
            />
          </div>
        </div>

        {error ? <p className="text-xs text-red-400">{error}</p> : null}

        <div className="flex items-center gap-3 border-t border-border pt-5">
          <button
            type="submit"
            disabled={pending || !name.trim()}
            className="inline-flex h-9 items-center rounded-md bg-foreground px-4 text-sm font-medium text-background transition hover:bg-accent-soft disabled:opacity-60"
          >
            {pending ? "Creating…" : "Create agent"}
          </button>
          <Link
            href="/dashboard/agents"
            className="inline-flex h-9 items-center rounded-md px-3 text-sm text-muted transition hover:text-foreground"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}

function WorkflowCard({
  label,
  description,
  selected = false,
  comingSoon = false,
  onClick,
}: {
  label: string;
  description: string;
  selected?: boolean;
  comingSoon?: boolean;
  onClick?: () => void;
}) {
  const base =
    "relative flex flex-col gap-1.5 rounded-md border p-3.5 text-left transition";
  const className = comingSoon
    ? `${base} cursor-not-allowed border-border bg-surface/20 opacity-60`
    : selected
      ? `${base} border-accent/60 bg-accent/5`
      : `${base} border-border bg-surface/20 hover:border-border-strong hover:bg-surface/40`;

  return (
    <button
      type="button"
      onClick={comingSoon ? undefined : onClick}
      disabled={comingSoon}
      aria-pressed={selected}
      className={className}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">{label}</span>
        {comingSoon ? (
          <span className="rounded-full border border-border bg-surface-2 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted">
            Coming soon
          </span>
        ) : selected ? (
          <span className="grid size-4 place-items-center rounded-full bg-accent text-[10px] text-background">
            ✓
          </span>
        ) : null}
      </div>
      <p className="text-xs text-muted">{description}</p>
    </button>
  );
}
