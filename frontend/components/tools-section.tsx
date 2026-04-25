"use client";

import { useCallback, useEffect, useState } from "react";
import { McpServerModal } from "@/components/mcp-server-modal";
import { ToolModal } from "@/components/tool-modal";
import { apiFetch } from "@/lib/api";
import type { AgentTool, McpServer, ToolPhase } from "@/lib/types";

const PHASE_LABELS: Record<ToolPhase, string> = {
  PRE: "Pre-call",
  ON: "On-call",
  POST: "Post-call",
};

const PHASE_HINTS: Record<ToolPhase, string> = {
  PRE: "Runs before the call starts. Output gets appended to the agent's context.",
  ON: "Exposed to the LLM as callable tools during the conversation.",
  POST: "Runs after the call ends, with transcript and duration available.",
};

export function ToolsSection({ agentId }: { agentId: string }) {
  const [servers, setServers] = useState<McpServer[]>([]);
  const [tools, setTools] = useState<AgentTool[]>([]);
  const [mcpOpen, setMcpOpen] = useState(false);
  const [toolPhase, setToolPhase] = useState<ToolPhase | null>(null);

  const load = useCallback(async () => {
    const [mcpRes, toolsRes] = await Promise.all([
      apiFetch(`/agents/${agentId}/mcp-servers`),
      apiFetch(`/agents/${agentId}/tools`),
    ]);
    if (mcpRes.ok) {
      const body = (await mcpRes.json()) as { servers: McpServer[] };
      setServers(body.servers);
    }
    if (toolsRes.ok) {
      const body = (await toolsRes.json()) as { tools: AgentTool[] };
      setTools(body.tools);
    }
  }, [agentId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function deleteMcp(id: string) {
    if (!confirm("Remove this MCP server?")) return;
    const res = await apiFetch(`/mcp-servers/${id}`, { method: "DELETE" });
    if (res.ok) void load();
  }

  async function deleteTool(id: string) {
    if (!confirm("Delete this tool?")) return;
    const res = await apiFetch(`/tools/${id}`, { method: "DELETE" });
    if (res.ok) void load();
  }

  const toolsByPhase = {
    PRE: tools.filter((t) => t.phase === "PRE"),
    ON: tools.filter((t) => t.phase === "ON"),
    POST: tools.filter((t) => t.phase === "POST"),
  };

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-lg border border-border bg-surface/20 p-5">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-medium">MCP servers</h2>
            <p className="mt-0.5 text-xs text-muted">
              Connect your organization&apos;s MCP servers. Their tools are
              automatically available to the agent during calls.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setMcpOpen(true)}
            className="inline-flex h-8 items-center rounded-md border border-border-strong px-3 text-xs font-medium transition hover:bg-surface-2"
          >
            Connect server
          </button>
        </header>
        <div className="mt-4">
          {servers.length === 0 ? (
            <p className="text-xs text-muted-2">No MCP servers connected.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {servers.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between rounded-md border border-border bg-background/40 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{s.label}</div>
                    <div className="truncate font-mono text-[11px] text-muted-2">
                      {s.url}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-muted-2">
                    <span className="uppercase">{s.transport}</span>
                    {s.hasHeaders ? (
                      <span className="rounded-full border border-border bg-surface-2 px-1.5 py-0.5">
                        auth
                      </span>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => deleteMcp(s.id)}
                      className="text-muted hover:text-red-400"
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {(Object.keys(PHASE_LABELS) as ToolPhase[]).map((phase) => (
        <section
          key={phase}
          className="rounded-lg border border-border bg-surface/20 p-5"
        >
          <header className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-medium">{PHASE_LABELS[phase]} tools</h2>
              <p className="mt-0.5 text-xs text-muted">{PHASE_HINTS[phase]}</p>
            </div>
            <button
              type="button"
              onClick={() => setToolPhase(phase)}
              className="inline-flex h-8 items-center rounded-md border border-border-strong px-3 text-xs font-medium transition hover:bg-surface-2"
            >
              Add tool
            </button>
          </header>
          <div className="mt-4">
            {toolsByPhase[phase].length === 0 ? (
              <p className="text-xs text-muted-2">
                No {PHASE_LABELS[phase].toLowerCase()} tools yet.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {toolsByPhase[phase].map((t) => (
                  <li
                    key={t.id}
                    className="flex items-center justify-between rounded-md border border-border bg-background/40 px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className="font-mono text-sm font-medium">
                          {t.name}
                        </span>
                        <span className="rounded border border-border bg-surface-2 px-1.5 py-0.5 text-[10px] text-muted-2">
                          {t.method}
                        </span>
                      </div>
                      <div className="mt-0.5 truncate text-xs text-muted">
                        {t.description}
                      </div>
                      <div className="truncate font-mono text-[10px] text-muted-2">
                        {t.url}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => deleteTool(t.id)}
                      className="text-xs text-muted hover:text-red-400"
                    >
                      Delete
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      ))}

      {mcpOpen ? (
        <McpServerModal
          agentId={agentId}
          onClose={() => setMcpOpen(false)}
          onSaved={() => void load()}
        />
      ) : null}
      {toolPhase ? (
        <ToolModal
          agentId={agentId}
          phase={toolPhase}
          onClose={() => setToolPhase(null)}
          onSaved={() => void load()}
        />
      ) : null}
    </div>
  );
}
