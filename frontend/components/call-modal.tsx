"use client";

import { useEffect, useState, type FormEvent } from "react";
import { apiFetch } from "@/lib/api";
import type { Agent } from "@/lib/types";

export function CallModal({
  agent,
  onClose,
}: {
  agent: Agent;
  onClose: () => void;
}) {
  const [to, setTo] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ roomName: string; callSid: string } | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const res = await apiFetch(`/agents/${agent.id}/call`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: to.trim() }),
    });

    setPending(false);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "Call failed");
      return;
    }
    const body = (await res.json()) as { roomName: string; callSid: string };
    setResult(body);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="mx-4 flex w-full max-w-sm flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-2xl shadow-black/60">
        <header className="border-b border-border px-5 py-3.5">
          <p className="text-[10px] uppercase tracking-[0.2em] text-accent">
            Outbound call
          </p>
          <h2 className="mt-0.5 text-sm font-medium">{agent.name}</h2>
        </header>

        <div className="px-5 py-5">
          {result ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-foreground">
                Call placed. Your phone will ring shortly.
              </p>
              <div className="rounded-md border border-border bg-background/40 p-3 font-mono text-xs text-muted break-all">
                <div>Room: {result.roomName}</div>
                <div>Call SID: {result.callSid}</div>
              </div>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="flex flex-col gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium">Destination (E.164)</span>
                <input
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  required
                  placeholder="+14155551212"
                  className="h-10 rounded-md border border-border bg-background px-3 font-mono text-sm outline-none focus:border-border-strong focus:ring-1 focus:ring-accent/40"
                />
              </label>
              {error ? <p className="text-xs text-red-400">{error}</p> : null}
              <button
                type="submit"
                disabled={pending || !to.trim()}
                className="mt-1 inline-flex h-10 items-center justify-center rounded-md bg-foreground text-sm font-medium text-background transition hover:bg-accent-soft disabled:opacity-60"
              >
                {pending ? "Placing call…" : "Call"}
              </button>
            </form>
          )}
        </div>

        <footer className="border-t border-border bg-surface/80 px-5 py-3 text-right">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 items-center rounded-md px-3 text-xs text-muted transition hover:text-foreground"
          >
            Close
          </button>
        </footer>
      </div>
    </div>
  );
}
