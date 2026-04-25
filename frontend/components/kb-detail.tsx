"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { AutosaveIndicator } from "@/components/autosave-indicator";
import { apiFetch } from "@/lib/api";
import type { KbDocument, KnowledgeBase } from "@/lib/types";
import { useAutosave } from "@/lib/use-autosave";

const ACCEPT_TYPES = ".pdf,.txt,.md,application/pdf,text/plain,text/markdown";

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

type Fields = { name: string; toolDescription: string };

function fieldsEqual(a: Fields, b: Fields) {
  return a.name === b.name && a.toolDescription === b.toolDescription;
}

export function KbDetail({ initial }: { initial: KnowledgeBase }) {
  const router = useRouter();
  const [kb, setKb] = useState<KnowledgeBase>(initial);
  const [docs, setDocs] = useState<KbDocument[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const refresh = useCallback(async () => {
    const res = await apiFetch(`/knowledge/${kb.id}`);
    if (!res.ok) return;
    const body = (await res.json()) as {
      knowledgeBase: KnowledgeBase;
      documents: KbDocument[];
    };
    setKb(body.knowledgeBase);
    setDocs(body.documents);
  }, [kb.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Poll while any document is processing.
  useEffect(() => {
    if (!docs.some((d) => d.status === "processing")) return;
    const t = setInterval(() => void refresh(), 3000);
    return () => clearInterval(t);
  }, [docs, refresh]);

  // Editable fields with autosave.
  const [fields, setFields] = useState<Fields>(() => ({
    name: initial.name,
    toolDescription: initial.toolDescription ?? "",
  }));
  const baseline: Fields = {
    name: kb.name,
    toolDescription: kb.toolDescription ?? "",
  };

  const { status, error } = useAutosave({
    value: fields,
    baseline,
    isEqual: fieldsEqual,
    delay: 600,
    save: async (v) => {
      const res = await apiFetch(`/knowledge/${kb.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: v.name.trim(),
          toolDescription: v.toolDescription.trim() || null,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(body?.error ?? "Save failed");
      }
      const body = (await res.json()) as { knowledgeBase: KnowledgeBase };
      setKb(body.knowledgeBase);
    },
  });

  async function uploadFiles(files: FileList | null) {
    console.log("[kb-upload] uploadFiles called", {
      count: files?.length ?? 0,
    });
    if (!files || files.length === 0) return;
    setUploading(true);
    setUploadError(null);
    try {
      for (const file of Array.from(files)) {
        console.log("[kb-upload] sending", {
          name: file.name,
          size: file.size,
          type: file.type,
        });
        const form = new FormData();
        form.append("file", file);
        const res = await apiFetch(`/knowledge/${kb.id}/documents`, {
          method: "POST",
          body: form,
        });
        console.log("[kb-upload] response", {
          status: res.status,
          ok: res.ok,
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as
            | { error?: string }
            | null;
          const msg = body?.error ?? `Upload failed (${res.status}): ${file.name}`;
          console.error("[kb-upload] FAILED", msg);
          setUploadError(msg);
          break;
        }
        const body = (await res.json().catch(() => null)) as
          | { document?: { id: string; status: string } }
          | null;
        console.log("[kb-upload] accepted", body?.document);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[kb-upload] threw", msg);
      setUploadError(msg);
    }
    setUploading(false);
    console.log("[kb-upload] refreshing list");
    void refresh();
  }

  async function deleteDoc(id: string) {
    if (!confirm("Delete this document and its chunks?")) return;
    const res = await apiFetch(`/documents/${id}`, { method: "DELETE" });
    if (res.ok) void refresh();
  }

  async function deleteKb() {
    if (
      !confirm(
        "Delete this knowledge base, its documents, and all attachments?",
      )
    ) {
      return;
    }
    const res = await apiFetch(`/knowledge/${kb.id}`, { method: "DELETE" });
    if (res.ok) router.push("/dashboard/knowledge");
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-lg border border-border bg-surface/20 p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">Settings</h2>
          <AutosaveIndicator status={status} error={error} />
        </div>
        <div className="mt-4 flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium">Name</span>
            <input
              type="text"
              value={fields.name}
              onChange={(e) =>
                setFields((f) => ({ ...f, name: e.target.value }))
              }
              className="h-10 rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-border-strong"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium">Tool description</span>
            <span className="text-xs text-muted-2">
              Optional override for the LLM&rsquo;s `search_knowledge_base`
              tool. Helps the model decide when to call it.
            </span>
            <textarea
              rows={3}
              value={fields.toolDescription}
              onChange={(e) =>
                setFields((f) => ({ ...f, toolDescription: e.target.value }))
              }
              placeholder="Search the Acme product documentation for installation, troubleshooting, and API questions."
              className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-border-strong"
            />
          </label>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-surface/20 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-medium">Documents</h2>
            <p className="mt-0.5 text-xs text-muted">
              PDF, plain text, and Markdown. Up to 20 MB per file. The
              original file is discarded after extraction.
            </p>
          </div>
        </div>

        <div
          className="mt-4 flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border bg-background/30 px-4 py-8 text-center transition hover:border-border-strong"
          onDragOver={(e) => {
            e.preventDefault();
          }}
          onDrop={(e) => {
            e.preventDefault();
            void uploadFiles(e.dataTransfer.files);
          }}
        >
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPT_TYPES}
            className="hidden"
            onChange={(e) => void uploadFiles(e.target.files)}
          />
          <p className="text-sm text-muted">
            Drag &amp; drop documents, or{" "}
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="text-accent hover:underline"
              disabled={uploading}
            >
              browse
            </button>
            .
          </p>
          {uploading ? (
            <p className="text-xs text-muted-2">Uploading…</p>
          ) : null}
          {uploadError ? (
            <p className="text-xs text-red-400">{uploadError}</p>
          ) : null}
        </div>

        {docs.length > 0 ? (
          <ul className="mt-4 flex flex-col">
            {docs.map((d) => (
              <li
                key={d.id}
                className="grid grid-cols-12 items-center gap-3 border-b border-border py-3 last:border-b-0"
              >
                <div className="col-span-5 min-w-0">
                  <div className="truncate text-sm font-medium">{d.name}</div>
                  <div className="mt-0.5 text-[11px] text-muted-2">
                    {formatBytes(d.sizeBytes)} · {d.mimeType}
                  </div>
                </div>
                <div className="col-span-2 text-xs text-muted">
                  {d.chunkCount}{" "}
                  {d.chunkCount === 1 ? "chunk" : "chunks"}
                </div>
                <div className="col-span-3">
                  <StatusPill status={d.status} message={d.errorMessage} />
                </div>
                <div className="col-span-2 text-right">
                  <button
                    type="button"
                    onClick={() => deleteDoc(d.id)}
                    className="text-xs text-muted hover:text-red-400"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="rounded-lg border border-border bg-surface/20 p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Delete knowledge base</p>
            <p className="mt-0.5 text-xs text-muted">
              Removes this KB, all its documents and chunks, and detaches it
              from any agent.
            </p>
          </div>
          <button
            type="button"
            onClick={deleteKb}
            className="inline-flex h-9 items-center rounded-md border border-red-500/30 px-3.5 text-xs text-red-300 transition hover:bg-red-500/10"
          >
            Delete
          </button>
        </div>
      </section>
    </div>
  );
}

function StatusPill({
  status,
  message,
}: {
  status: KbDocument["status"];
  message: string | null;
}) {
  if (status === "ready") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400">
        <span className="size-1.5 rounded-full bg-emerald-400" />
        Ready
      </span>
    );
  }
  if (status === "processing") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted">
        <span className="size-1.5 animate-pulse rounded-full bg-muted-2" />
        Processing
      </span>
    );
  }
  return (
    <span
      title={message ?? "Failed"}
      className="inline-flex items-center gap-1.5 text-xs text-red-400"
    >
      <span className="size-1.5 rounded-full bg-red-400" />
      Failed
    </span>
  );
}
