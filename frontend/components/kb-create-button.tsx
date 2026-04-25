"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiFetch } from "@/lib/api";
import type { KnowledgeBase } from "@/lib/types";

export function CreateKbButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!name.trim() || busy) return;
    setBusy(true);
    setError(null);
    const res = await apiFetch("/knowledge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "Failed to create");
      setBusy(false);
      return;
    }
    const body = (await res.json()) as { knowledgeBase: KnowledgeBase };
    setOpen(false);
    setName("");
    setBusy(false);
    router.push(`/dashboard/knowledge/${body.knowledgeBase.id}`);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-9 items-center rounded-md bg-foreground px-3.5 text-sm font-medium text-background transition hover:bg-accent-soft"
      >
        New knowledge base
      </button>
      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="mx-4 w-full max-w-md rounded-lg border border-border bg-surface p-5 shadow-xl">
            <h2 className="text-sm font-medium">New knowledge base</h2>
            <input
              autoFocus
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void submit();
              }}
              placeholder="Product docs"
              className="mt-3 h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-border-strong"
            />
            {error ? (
              <p className="mt-2 text-xs text-red-400">{error}</p>
            ) : null}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-9 items-center rounded-md border border-border-strong px-3 text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={busy || !name.trim()}
                className="inline-flex h-9 items-center rounded-md bg-accent px-3 text-xs font-medium text-background transition hover:bg-accent-soft disabled:opacity-50"
              >
                {busy ? "Creating…" : "Create"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
