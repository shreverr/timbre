"use client";

import { useCallback, useEffect, useState } from "react";
import { AutosaveIndicator } from "@/components/autosave-indicator";
import { apiFetch } from "@/lib/api";
import type {
  EmbedButtonShape,
  EmbedConfig,
  EmbedPosition,
} from "@/lib/types";
import { useAutosave } from "@/lib/use-autosave";

const POSITIONS: { value: EmbedPosition; label: string }[] = [
  { value: "bottom-right", label: "Bottom right" },
  { value: "bottom-left", label: "Bottom left" },
  { value: "top-right", label: "Top right" },
  { value: "top-left", label: "Top left" },
];

const SHAPES: { value: EmbedButtonShape; label: string }[] = [
  { value: "circle", label: "Circle" },
  { value: "pill", label: "Pill" },
];

type EditableFields = {
  enabled: boolean;
  allowedOrigins: string[];
  buttonLabel: string;
  buttonShape: EmbedButtonShape;
  buttonIconSvg: string;
  accentColor: string;
  position: EmbedPosition;
  greetingText: string;
  maxConcurrent: number;
  dailyCallQuota: number;
};

function toEditable(c: EmbedConfig): EditableFields {
  return {
    enabled: c.enabled,
    allowedOrigins: c.allowedOrigins.slice(),
    buttonLabel: c.buttonLabel ?? "",
    buttonShape: c.buttonShape,
    buttonIconSvg: c.buttonIconSvg ?? "",
    accentColor: c.accentColor,
    position: c.position,
    greetingText: c.greetingText ?? "",
    maxConcurrent: c.maxConcurrent,
    dailyCallQuota: c.dailyCallQuota,
  };
}

function fieldsEqual(a: EditableFields, b: EditableFields): boolean {
  return (
    a.enabled === b.enabled &&
    a.buttonLabel === b.buttonLabel &&
    a.buttonShape === b.buttonShape &&
    a.buttonIconSvg === b.buttonIconSvg &&
    a.accentColor === b.accentColor &&
    a.position === b.position &&
    a.greetingText === b.greetingText &&
    a.maxConcurrent === b.maxConcurrent &&
    a.dailyCallQuota === b.dailyCallQuota &&
    a.allowedOrigins.length === b.allowedOrigins.length &&
    a.allowedOrigins.every((v, i) => v === b.allowedOrigins[i])
  );
}

export function EmbedSection({ agentId }: { agentId: string }) {
  const [config, setConfig] = useState<EmbedConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [originDraft, setOriginDraft] = useState("");
  const [snippetCopied, setSnippetCopied] = useState(false);
  const [keyCopied, setKeyCopied] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const res = await apiFetch(`/agents/${agentId}/embed`);
    if (res.status === 404) {
      setConfig(null);
    } else if (res.ok) {
      const body = (await res.json()) as { embed: EmbedConfig };
      setConfig(body.embed);
    }
    setLoading(false);
  }, [agentId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function enableEmbed() {
    setCreating(true);
    const res = await apiFetch(`/agents/${agentId}/embed`, { method: "POST" });
    if (res.ok) {
      const body = (await res.json()) as { embed: EmbedConfig };
      setConfig(body.embed);
    }
    setCreating(false);
  }

  async function disableEmbed() {
    if (!confirm("Disable the embed and revoke its public key?")) return;
    const res = await apiFetch(`/agents/${agentId}/embed`, { method: "DELETE" });
    if (res.ok) setConfig(null);
  }

  async function rotateKey() {
    if (!confirm("Rotate the public key? The current snippet will stop working.")) return;
    const res = await apiFetch(`/agents/${agentId}/embed/rotate-key`, {
      method: "POST",
    });
    if (res.ok) {
      const body = (await res.json()) as { embed: EmbedConfig };
      setConfig(body.embed);
    }
  }

  if (loading) {
    return <p className="text-xs text-muted">Loading…</p>;
  }

  if (!config) {
    return (
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted">
          Embed a voice widget on your website. Visitors connect over WebRTC,
          no telephony involved.
        </p>
        <button
          type="button"
          onClick={enableEmbed}
          disabled={creating}
          className="inline-flex h-8 items-center rounded-md bg-accent px-3 text-xs font-medium text-background transition hover:bg-accent-soft disabled:opacity-50"
        >
          {creating ? "Enabling…" : "Enable embed"}
        </button>
      </div>
    );
  }

  return (
    <EmbedEditor
      config={config}
      agentId={agentId}
      onUpdated={setConfig}
      onDisable={disableEmbed}
      onRotateKey={rotateKey}
      originDraft={originDraft}
      setOriginDraft={setOriginDraft}
      snippetCopied={snippetCopied}
      setSnippetCopied={setSnippetCopied}
      keyCopied={keyCopied}
      setKeyCopied={setKeyCopied}
    />
  );
}

function EmbedEditor({
  config,
  agentId,
  onUpdated,
  onDisable,
  onRotateKey,
  originDraft,
  setOriginDraft,
  snippetCopied,
  setSnippetCopied,
  keyCopied,
  setKeyCopied,
}: {
  config: EmbedConfig;
  agentId: string;
  onUpdated: (c: EmbedConfig) => void;
  onDisable: () => void;
  onRotateKey: () => void;
  originDraft: string;
  setOriginDraft: (v: string) => void;
  snippetCopied: boolean;
  setSnippetCopied: (v: boolean) => void;
  keyCopied: boolean;
  setKeyCopied: (v: boolean) => void;
}) {
  const [fields, setFields] = useState<EditableFields>(() => toEditable(config));
  const [baseline, setBaseline] = useState<EditableFields>(() => toEditable(config));

  // If the parent updates the config from outside (e.g. rotate-key), reset.
  useEffect(() => {
    setFields(toEditable(config));
    setBaseline(toEditable(config));
  }, [config]);

  const { status, error } = useAutosave({
    value: fields,
    baseline,
    isEqual: fieldsEqual,
    delay: 600,
    save: async (v) => {
      const res = await apiFetch(`/agents/${agentId}/embed`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: v.enabled,
          allowedOrigins: v.allowedOrigins,
          buttonLabel: v.buttonLabel || null,
          buttonShape: v.buttonShape,
          buttonIconSvg: v.buttonIconSvg || null,
          accentColor: v.accentColor,
          position: v.position,
          greetingText: v.greetingText || null,
          maxConcurrent: v.maxConcurrent,
          dailyCallQuota: v.dailyCallQuota,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(body?.error ?? "Save failed");
      }
      const body = (await res.json()) as { embed: EmbedConfig };
      setBaseline(toEditable(body.embed));
      onUpdated(body.embed);
    },
  });

  function patch(p: Partial<EditableFields>) {
    setFields((f) => ({ ...f, ...p }));
  }

  function addOrigin() {
    const trimmed = originDraft.trim();
    if (!trimmed) return;
    try {
      const u = new URL(trimmed);
      const origin = `${u.protocol}//${u.host}`;
      if (fields.allowedOrigins.includes(origin)) {
        setOriginDraft("");
        return;
      }
      patch({ allowedOrigins: [...fields.allowedOrigins, origin] });
      setOriginDraft("");
    } catch {
      // ignore — let the UI hint the user
    }
  }

  function removeOrigin(o: string) {
    patch({ allowedOrigins: fields.allowedOrigins.filter((x) => x !== o) });
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";
  const widgetBase =
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const snippet = `<script src="${widgetBase}/embed.js" data-key="${config.publicKey}" async></script>`;

  async function copy(text: string, target: "snippet" | "key") {
    try {
      await navigator.clipboard.writeText(text);
      if (target === "snippet") {
        setSnippetCopied(true);
        setTimeout(() => setSnippetCopied(false), 2000);
      } else {
        setKeyCopied(true);
        setTimeout(() => setKeyCopied(false), 2000);
      }
    } catch {
      // ignore
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={fields.enabled}
            onChange={(e) => patch({ enabled: e.target.checked })}
            className="size-4 rounded border-border bg-background"
          />
          <span className="font-medium">Embed enabled</span>
          <span className="text-xs text-muted-2">
            {fields.enabled ? "Active" : "Disabled — token endpoint will return 404."}
          </span>
        </label>
        <div className="flex items-center gap-3">
          <AutosaveIndicator status={status} error={error} />
          <button
            type="button"
            onClick={onDisable}
            className="text-xs text-muted hover:text-red-400"
          >
            Remove embed
          </button>
        </div>
      </div>

      {/* Public key */}
      <div>
        <Label>Public key</Label>
        <div className="mt-1.5 flex items-center gap-2">
          <code className="flex-1 truncate rounded-md border border-border bg-background px-3 py-2 font-mono text-xs">
            {config.publicKey}
          </code>
          <button
            type="button"
            onClick={() => copy(config.publicKey, "key")}
            className="inline-flex h-9 items-center rounded-md border border-border-strong px-3 text-xs transition hover:bg-surface-2"
          >
            {keyCopied ? "Copied" : "Copy"}
          </button>
          <button
            type="button"
            onClick={onRotateKey}
            className="inline-flex h-9 items-center rounded-md border border-border-strong px-3 text-xs transition hover:bg-surface-2"
          >
            Rotate
          </button>
        </div>
      </div>

      {/* Allowed origins */}
      <div>
        <Label>Allowed origins</Label>
        <p className="mt-1 text-xs text-muted-2">
          Visitors must load the widget from one of these origins. Match
          scheme + host + port exactly.
        </p>
        <div className="mt-2 flex gap-2">
          <input
            type="text"
            value={originDraft}
            onChange={(e) => setOriginDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addOrigin();
              }
            }}
            placeholder="https://acme.com"
            className="h-9 flex-1 rounded-md border border-border bg-background px-2.5 text-sm outline-none focus:border-border-strong"
          />
          <button
            type="button"
            onClick={addOrigin}
            className="inline-flex h-9 items-center rounded-md border border-border-strong px-3 text-xs transition hover:bg-surface-2"
          >
            Add
          </button>
        </div>
        {fields.allowedOrigins.length === 0 ? (
          <p className="mt-2 text-xs text-amber-400/80">
            No origins yet — token requests will be rejected.
          </p>
        ) : (
          <ul className="mt-2 flex flex-wrap gap-2">
            {fields.allowedOrigins.map((o) => (
              <li
                key={o}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 font-mono text-xs"
              >
                {o}
                <button
                  type="button"
                  onClick={() => removeOrigin(o)}
                  className="text-muted-2 hover:text-red-400"
                  aria-label={`Remove ${o}`}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Theme grid */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Button label</Label>
          <input
            type="text"
            value={fields.buttonLabel}
            onChange={(e) => patch({ buttonLabel: e.target.value })}
            placeholder="Talk to AI"
            className="mt-1.5 h-9 w-full rounded-md border border-border bg-background px-2.5 text-sm outline-none focus:border-border-strong"
          />
        </div>
        <div>
          <Label>Accent color</Label>
          <div className="mt-1.5 flex items-center gap-2">
            <input
              type="color"
              value={fields.accentColor}
              onChange={(e) => patch({ accentColor: e.target.value })}
              className="size-9 cursor-pointer rounded border border-border bg-background"
            />
            <code className="font-mono text-xs text-muted">
              {fields.accentColor}
            </code>
          </div>
        </div>
        <div>
          <Label>Button shape</Label>
          <select
            value={fields.buttonShape}
            onChange={(e) =>
              patch({ buttonShape: e.target.value as EmbedButtonShape })
            }
            className="mt-1.5 h-9 w-full rounded-md border border-border bg-background px-2.5 text-sm outline-none focus:border-border-strong"
          >
            {SHAPES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label>Position</Label>
          <select
            value={fields.position}
            onChange={(e) =>
              patch({ position: e.target.value as EmbedPosition })
            }
            className="mt-1.5 h-9 w-full rounded-md border border-border bg-background px-2.5 text-sm outline-none focus:border-border-strong"
          >
            {POSITIONS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <Label>Greeting text</Label>
        <p className="mt-1 text-xs text-muted-2">
          Shown in the widget popup before the visitor connects.
        </p>
        <textarea
          rows={3}
          value={fields.greetingText}
          onChange={(e) => patch({ greetingText: e.target.value })}
          placeholder="Hi! Click below to talk to our AI assistant."
          className="mt-1.5 w-full rounded-md border border-border bg-background px-2.5 py-2 text-sm outline-none focus:border-border-strong"
        />
      </div>

      <div>
        <Label>Custom button SVG (optional)</Label>
        <p className="mt-1 text-xs text-muted-2">
          Paste an inline SVG. Only basic shapes are allowed; scripts and event
          handlers are stripped server-side.
        </p>
        <textarea
          rows={4}
          value={fields.buttonIconSvg}
          onChange={(e) => patch({ buttonIconSvg: e.target.value })}
          placeholder='<svg viewBox="0 0 24 24"><path d="..." fill="currentColor"/></svg>'
          className="mt-1.5 w-full rounded-md border border-border bg-background px-2.5 py-2 font-mono text-xs outline-none focus:border-border-strong"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Max concurrent calls</Label>
          <input
            type="number"
            min={1}
            max={1000}
            value={fields.maxConcurrent}
            onChange={(e) =>
              patch({ maxConcurrent: Math.max(1, Number(e.target.value) || 1) })
            }
            className="mt-1.5 h-9 w-full rounded-md border border-border bg-background px-2.5 text-sm outline-none focus:border-border-strong"
          />
        </div>
        <div>
          <Label>Daily call quota (UTC)</Label>
          <input
            type="number"
            min={1}
            max={100000}
            value={fields.dailyCallQuota}
            onChange={(e) =>
              patch({ dailyCallQuota: Math.max(1, Number(e.target.value) || 1) })
            }
            className="mt-1.5 h-9 w-full rounded-md border border-border bg-background px-2.5 text-sm outline-none focus:border-border-strong"
          />
        </div>
      </div>

      {/* Snippet */}
      <div>
        <Label>Embed snippet</Label>
        <p className="mt-1 text-xs text-muted-2">
          Drop this on any allowed origin to install the widget.
        </p>
        <div className="mt-1.5 flex items-stretch gap-2">
          <code className="flex-1 overflow-x-auto rounded-md border border-border bg-background px-3 py-2 font-mono text-xs">
            {snippet}
          </code>
          <button
            type="button"
            onClick={() => copy(snippet, "snippet")}
            className="inline-flex h-auto items-center rounded-md border border-border-strong px-3 text-xs transition hover:bg-surface-2"
          >
            {snippetCopied ? "Copied" : "Copy"}
          </button>
        </div>
        <p className="mt-2 text-[11px] text-muted-2">
          API base: <code className="font-mono">{apiUrl}</code>
        </p>
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-xs font-medium uppercase tracking-wide text-muted">
      {children}
    </span>
  );
}
