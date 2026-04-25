"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { KnowledgeBase } from "@/lib/types";

export function AgentKnowledgeSection({ agentId }: { agentId: string }) {
  const [allKbs, setAllKbs] = useState<KnowledgeBase[]>([]);
  const [attached, setAttached] = useState<KnowledgeBase[]>([]);
  const [picking, setPicking] = useState(false);

  const refresh = useCallback(async () => {
    const [allRes, attachedRes] = await Promise.all([
      apiFetch("/knowledge"),
      apiFetch(`/agents/${agentId}/knowledge`),
    ]);
    if (allRes.ok) {
      const body = (await allRes.json()) as {
        knowledgeBases: KnowledgeBase[];
      };
      setAllKbs(body.knowledgeBases);
    }
    if (attachedRes.ok) {
      const body = (await attachedRes.json()) as {
        knowledgeBases: KnowledgeBase[];
      };
      setAttached(body.knowledgeBases);
    }
  }, [agentId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function attach(kbId: string) {
    setPicking(false);
    const res = await apiFetch(`/agents/${agentId}/knowledge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ knowledgeBaseId: kbId }),
    });
    if (res.ok) void refresh();
  }

  async function detach(kbId: string) {
    const res = await apiFetch(`/agents/${agentId}/knowledge/${kbId}`, {
      method: "DELETE",
    });
    if (res.ok) void refresh();
  }

  const attachedIds = new Set(attached.map((k) => k.id));
  const available = allKbs.filter((k) => !attachedIds.has(k.id));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">
          Attach knowledge bases to expose a `search_knowledge_base` tool to
          this agent.{" "}
          <Link
            href="/dashboard/knowledge"
            className="text-accent hover:underline"
          >
            Manage knowledge bases →
          </Link>
        </p>
        <div className="relative">
          <button
            type="button"
            onClick={() => setPicking((v) => !v)}
            disabled={available.length === 0}
            className="inline-flex h-8 items-center rounded-md border border-border-strong px-3 text-xs font-medium transition hover:bg-surface-2 disabled:opacity-50"
          >
            {available.length === 0 ? "Nothing to attach" : "Attach…"}
          </button>
          {picking && available.length > 0 ? (
            <div className="absolute right-0 top-9 z-10 w-64 overflow-hidden rounded-md border border-border bg-surface shadow-xl">
              <ul>
                {available.map((kb) => (
                  <li key={kb.id}>
                    <button
                      type="button"
                      onClick={() => attach(kb.id)}
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-surface-2"
                    >
                      {kb.name}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>

      {attached.length === 0 ? (
        <p className="rounded-md border border-dashed border-border bg-background/30 px-4 py-6 text-center text-xs text-muted">
          No knowledge bases attached. The agent will work without retrieval.
        </p>
      ) : (
        <ul className="flex flex-col">
          {attached.map((kb) => (
            <li
              key={kb.id}
              className="flex items-center justify-between border-b border-border py-3 last:border-b-0"
            >
              <div className="min-w-0">
                <Link
                  href={`/dashboard/knowledge/${kb.id}`}
                  className="truncate text-sm font-medium hover:text-accent"
                >
                  {kb.name}
                </Link>
                {kb.toolDescription ? (
                  <p className="mt-0.5 line-clamp-1 text-xs text-muted-2">
                    {kb.toolDescription}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => detach(kb.id)}
                className="text-xs text-muted hover:text-red-400"
              >
                Detach
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
