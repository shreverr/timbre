"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  KeyValueEditor,
  pairsToRecord,
} from "@/components/key-value-editor";
import { apiFetch } from "@/lib/api";
import type { McpTransport } from "@/lib/types";

type Pair = { key: string; value: string };

export function McpServerModal({
  agentId,
  onClose,
  onSaved,
}: {
  agentId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [transport, setTransport] = useState<McpTransport>("auto");
  const [headers, setHeaders] = useState<Pair[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    const headerObj = pairsToRecord(headers);
    const res = await apiFetch(`/agents/${agentId}/mcp-servers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label: label.trim(),
        url: url.trim(),
        transport,
        headers: Object.keys(headerObj).length > 0 ? headerObj : undefined,
      }),
    });
    setPending(false);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "Failed to add MCP server");
      return;
    }
    onSaved();
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="mx-4 flex w-full max-w-lg flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-2xl shadow-black/60">
        <header className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-accent">
              MCP server
            </p>
            <h2 className="mt-0.5 text-sm font-medium">Connect MCP server</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex size-7 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-foreground"
            aria-label="Close"
          >
            ✕
          </button>
        </header>

        <form onSubmit={onSubmit} className="flex flex-col gap-4 px-5 py-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium">Label</span>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              required
              placeholder="My CRM"
              className="h-10 rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-border-strong"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium">URL</span>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
              type="url"
              placeholder="https://api.example.com/mcp"
              className="h-10 rounded-md border border-border bg-background px-3 font-mono text-xs outline-none focus:border-border-strong"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium">Transport</span>
            <select
              value={transport}
              onChange={(e) => setTransport(e.target.value as McpTransport)}
              className="h-10 rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-border-strong"
            >
              <option value="auto">Auto (from URL)</option>
              <option value="http">Streaming HTTP</option>
              <option value="sse">Server-Sent Events</option>
            </select>
          </label>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium">Headers</span>
            <span className="text-xs text-muted-2">
              Used for authentication. Stored encrypted.
            </span>
            <KeyValueEditor pairs={headers} onChange={setHeaders} />
          </div>

          {error ? <p className="text-xs text-red-400">{error}</p> : null}

          <div className="mt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 items-center rounded-md px-3 text-sm text-muted transition hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending || !label.trim() || !url.trim()}
              className="inline-flex h-9 items-center rounded-md bg-foreground px-4 text-sm font-medium text-background transition hover:bg-accent-soft disabled:opacity-60"
            >
              {pending ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
