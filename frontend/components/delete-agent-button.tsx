"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiFetch } from "@/lib/api";

export function DeleteAgentButton({
  id,
  variant = "ghost",
  redirectTo,
}: {
  id: string;
  variant?: "ghost" | "outline";
  redirectTo?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onClick() {
    if (!confirm("Delete this agent? This can't be undone.")) return;
    setPending(true);
    const res = await apiFetch(`/agents/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setPending(false);
      alert("Failed to delete agent.");
      return;
    }
    if (redirectTo) {
      router.push(redirectTo);
    } else {
      router.refresh();
    }
  }

  const base =
    "inline-flex h-8 items-center rounded-md px-3 text-xs font-medium transition disabled:opacity-60";
  const styles =
    variant === "outline"
      ? `${base} border border-border-strong text-foreground hover:bg-surface-2`
      : `${base} text-muted hover:text-red-400`;

  return (
    <button type="button" onClick={onClick} disabled={pending} className={styles}>
      {pending ? "Deleting…" : "Delete"}
    </button>
  );
}
