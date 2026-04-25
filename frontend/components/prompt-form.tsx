"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AutosaveIndicator } from "@/components/autosave-indicator";
import { apiFetch } from "@/lib/api";
import { useAutosave } from "@/lib/use-autosave";
import type { Agent } from "@/lib/types";

type PromptKey =
  | "firstMessage"
  | "objective"
  | "responseGuidelines"
  | "conversationScript";

type PromptValues = Record<PromptKey, string>;

type Field = {
  key: PromptKey;
  label: string;
  hint: string;
  placeholder: string;
  rows: number;
};

const FIELDS: Field[] = [
  {
    key: "firstMessage",
    label: "First message",
    hint: "The exact line the agent speaks when the call connects.",
    placeholder: "Hey, this is Timbre — what can I help you with today?",
    rows: 2,
  },
  {
    key: "objective",
    label: "Objective",
    hint: "What this agent is ultimately trying to accomplish on the call.",
    placeholder:
      "Qualify the caller as a support case, a sales lead, or a wrong number — and route accordingly.",
    rows: 6,
  },
  {
    key: "responseGuidelines",
    label: "Response guidelines",
    hint: "Tone, format, and boundaries. How the agent should speak.",
    placeholder:
      "Keep responses under two sentences. Never promise refunds. Always confirm the caller's name before looking up their account.",
    rows: 10,
  },
  {
    key: "conversationScript",
    label: "Conversation script",
    hint: "Optional step-by-step flow. Leave blank to let the agent improvise.",
    placeholder:
      "1. Greet and ask what they need.\n2. If support: collect order number.\n3. If sales: book a 15-minute slot.\n4. Thank them and end the call.",
    rows: 14,
  },
];

function fromAgent(agent: Agent): PromptValues {
  return {
    firstMessage: agent.firstMessage ?? "",
    objective: agent.objective ?? "",
    responseGuidelines: agent.responseGuidelines ?? "",
    conversationScript: agent.conversationScript ?? "",
  };
}

function shallowEqual(a: PromptValues, b: PromptValues) {
  return (
    a.firstMessage === b.firstMessage &&
    a.objective === b.objective &&
    a.responseGuidelines === b.responseGuidelines &&
    a.conversationScript === b.conversationScript
  );
}

export function PromptForm({ agent }: { agent: Agent }) {
  const router = useRouter();
  const [values, setValues] = useState<PromptValues>(() => fromAgent(agent));

  const baseline = fromAgent(agent);

  const { status, error } = useAutosave({
    value: values,
    baseline,
    isEqual: shallowEqual,
    save: async (v) => {
      const payload: Record<string, string | null> = {};
      for (const { key } of FIELDS) {
        const val = v[key];
        payload[key] = val.trim() === "" ? null : val;
      }
      const res = await apiFetch(`/agents/${agent.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Failed to save");
      }
      router.refresh();
    },
  });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-end">
        <AutosaveIndicator status={status} error={error} />
      </div>
      {FIELDS.map((f) => (
        <label key={f.key} className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-foreground">{f.label}</span>
          <span className="text-xs text-muted-2">{f.hint}</span>
          <textarea
            value={values[f.key]}
            onChange={(e) =>
              setValues((v) => ({ ...v, [f.key]: e.target.value }))
            }
            rows={f.rows}
            placeholder={f.placeholder}
            className="mt-1 rounded-md border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-border-strong focus:ring-1 focus:ring-accent/40"
          />
        </label>
      ))}
    </div>
  );
}
