"use client";

import type { Agent } from "@/lib/types";

export function CallButton({
  agent: _agent,
  disabled: _disabled,
}: {
  agent: Agent;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled
      title="Outbound calling is coming soon"
      className="inline-flex h-9 cursor-not-allowed items-center gap-1.5 rounded-md border border-border-strong bg-surface-2/40 px-3.5 text-sm font-medium text-muted opacity-70"
    >
      Call
      <span className="ml-1 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-amber-400">
        Soon
      </span>
    </button>
  );
}
