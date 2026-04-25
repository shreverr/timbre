"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  KeyValueEditor,
  pairsToRecord,
} from "@/components/key-value-editor";
import { apiFetch } from "@/lib/api";
import type { HttpMethod, ToolPhase } from "@/lib/types";

type Pair = { key: string; value: string };

const METHODS: HttpMethod[] = ["GET", "POST", "PATCH", "PUT", "DELETE"];

const PHASE_DESCRIPTIONS: Record<ToolPhase, string> = {
  PRE: "Fires once after dispatch, before the call starts. Output is appended to the agent's instructions as pre-call context.",
  ON: "Available to the agent as a callable tool during the conversation. The LLM decides when to invoke it.",
  POST: "Fires once after the call ends, with transcript and duration available as template variables.",
};

const PHASE_VARS: Record<ToolPhase, string> = {
  PRE: "Available vars: {{agent_id}}, {{agent_name}}, {{room}}",
  ON: "Available vars: any parameter you define in the JSON Schema below",
  POST: "Available vars: {{agent_id}}, {{agent_name}}, {{room}}, {{duration_seconds}}",
};

const DEFAULT_PARAMS_TEMPLATES: Array<{ label: string; schema: string }> = [
  { label: "No args", schema: `{\n  "type": "object",\n  "properties": {}\n}` },
  {
    label: "Single string",
    schema: `{\n  "type": "object",\n  "properties": {\n    "query": { "type": "string", "description": "…" }\n  },\n  "required": ["query"]\n}`,
  },
  {
    label: "Email lookup",
    schema: `{\n  "type": "object",\n  "properties": {\n    "email": { "type": "string", "description": "Email to look up" }\n  },\n  "required": ["email"]\n}`,
  },
];

export function ToolModal({
  agentId,
  phase,
  onClose,
  onSaved,
}: {
  agentId: string;
  phase: ToolPhase;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [method, setMethod] = useState<HttpMethod>("GET");
  const [url, setUrl] = useState("");
  const [headers, setHeaders] = useState<Pair[]>([]);
  const [bodyTemplate, setBodyTemplate] = useState("");
  const [parameters, setParameters] = useState(
    phase === "ON" ? DEFAULT_PARAMS_TEMPLATES[0]!.schema : "",
  );
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
    const res = await apiFetch(`/agents/${agentId}/tools`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phase,
        name: name.trim(),
        description: description.trim(),
        method,
        url: url.trim(),
        headers: Object.keys(headerObj).length > 0 ? headerObj : undefined,
        bodyTemplate: bodyTemplate.trim() || null,
        parameters: phase === "ON" ? parameters : null,
      }),
    });
    setPending(false);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "Failed to save tool");
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
      <div className="mx-4 flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-2xl shadow-black/60">
        <header className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-accent">
              {phase === "PRE"
                ? "Pre-call tool"
                : phase === "ON"
                  ? "On-call tool"
                  : "Post-call tool"}
            </p>
            <h2 className="mt-0.5 text-sm font-medium">Add HTTP tool</h2>
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

        <form
          onSubmit={onSubmit}
          className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-4"
        >
          <p className="text-xs text-muted">{PHASE_DESCRIPTIONS[phase]}</p>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium">Name</span>
            <span className="text-[11px] text-muted-2">
              Identifier (letters, digits, underscores). Shown to the LLM for
              on-call tools.
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="lookup_user"
              className="h-10 rounded-md border border-border bg-background px-3 font-mono text-sm outline-none focus:border-border-strong"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium">Description</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              rows={2}
              placeholder="What this tool does and when the agent should use it."
              className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-border-strong"
            />
          </label>

          <div className="flex gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium">Method</span>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as HttpMethod)}
                className="h-10 rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-border-strong"
              >
                {METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-1 flex-col gap-1.5">
              <span className="text-xs font-medium">URL</span>
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                required
                placeholder="https://api.example.com/users/{{email}}"
                className="h-10 rounded-md border border-border bg-background px-3 font-mono text-xs outline-none focus:border-border-strong"
              />
            </label>
          </div>

          <p className="text-[11px] text-muted-2">{PHASE_VARS[phase]}</p>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium">Headers</span>
            <KeyValueEditor pairs={headers} onChange={setHeaders} />
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium">Body template (optional)</span>
            <textarea
              value={bodyTemplate}
              onChange={(e) => setBodyTemplate(e.target.value)}
              rows={4}
              placeholder={`{"email": "{{email}}"}`}
              className="rounded-md border border-border bg-background px-3 py-2 font-mono text-xs outline-none focus:border-border-strong"
            />
          </label>

          {phase === "ON" ? (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium">
                  Parameters (JSON Schema)
                </span>
                <div className="flex gap-1.5">
                  {DEFAULT_PARAMS_TEMPLATES.map((t) => (
                    <button
                      key={t.label}
                      type="button"
                      onClick={() => setParameters(t.schema)}
                      className="rounded border border-border bg-surface-2 px-2 py-0.5 text-[10px] text-muted hover:bg-surface hover:text-foreground"
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <textarea
                value={parameters}
                onChange={(e) => setParameters(e.target.value)}
                rows={8}
                required
                className="rounded-md border border-border bg-background px-3 py-2 font-mono text-xs outline-none focus:border-border-strong"
              />
              <span className="text-[11px] text-muted-2">
                The LLM fills these in when calling the tool. Supports standard
                JSON Schema.
              </span>
            </div>
          ) : null}

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
              disabled={pending || !name.trim() || !url.trim()}
              className="inline-flex h-9 items-center rounded-md bg-foreground px-4 text-sm font-medium text-background transition hover:bg-accent-soft disabled:opacity-60"
            >
              {pending ? "Saving…" : "Save tool"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
