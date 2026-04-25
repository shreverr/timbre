"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AutosaveIndicator } from "@/components/autosave-indicator";
import { apiFetch } from "@/lib/api";
import { LANGUAGES } from "@/lib/languages";
import { useAutosave } from "@/lib/use-autosave";
import type { Agent } from "@/lib/types";

type Values = { name: string; language: string };

function isEqual(a: Values, b: Values) {
  return a.name === b.name && a.language === b.language;
}

export function EditAgentForm({ agent }: { agent: Agent }) {
  const router = useRouter();
  const [values, setValues] = useState<Values>({
    name: agent.name,
    language: agent.language,
  });

  const baseline: Values = { name: agent.name, language: agent.language };

  const { status, error } = useAutosave({
    value: values,
    baseline,
    isEqual,
    validate: (v) => {
      const name = v.name.trim();
      if (name.length === 0) return "Name is required";
      if (name.length > 100) return "Max 100 characters";
      return null;
    },
    save: async (v) => {
      const res = await apiFetch(`/agents/${agent.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: v.name.trim(),
          language: v.language,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Failed to save");
      }
      router.refresh();
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-end">
        <AutosaveIndicator status={status} error={error} />
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium">Name</span>
        <input
          name="name"
          value={values.name}
          onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
          maxLength={100}
          className="h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none transition focus:border-border-strong focus:ring-1 focus:ring-accent/40"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium">Language</span>
        <span className="text-xs text-muted-2">
          Used for speech-to-text. Multilingual auto-detects the caller&rsquo;s
          language.
        </span>
        <select
          value={values.language}
          onChange={(e) =>
            setValues((v) => ({ ...v, language: e.target.value }))
          }
          className="h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none transition focus:border-border-strong focus:ring-1 focus:ring-accent/40"
        >
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
