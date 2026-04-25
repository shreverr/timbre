import Link from "next/link";
import { CreateKbButton } from "@/components/kb-create-button";
import { serverApiFetch } from "@/lib/api-server";
import type { KnowledgeBase } from "@/lib/types";

async function fetchKbs(): Promise<KnowledgeBase[]> {
  const res = await serverApiFetch("/knowledge");
  if (!res.ok) return [];
  const body = (await res.json()) as { knowledgeBases: KnowledgeBase[] };
  return body.knowledgeBases;
}

export default async function KnowledgePage() {
  const kbs = await fetchKbs();

  return (
    <div className="mx-auto max-w-5xl px-8 py-10">
      <header className="flex items-end justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-xl font-medium tracking-tight">Knowledge</h1>
          <p className="mt-1 text-sm text-muted">
            Upload PDFs, text, or markdown. Attach a knowledge base to any
            agent — they&rsquo;ll get a `search_knowledge_base` tool the LLM
            calls when it needs facts.
          </p>
        </div>
        <CreateKbButton />
      </header>

      {kbs.length === 0 ? (
        <div className="mt-10 rounded-lg border border-dashed border-border bg-surface/20 px-6 py-12 text-center">
          <p className="text-sm text-muted">
            No knowledge bases yet. Create one and upload documents to start
            grounding your agents in your own content.
          </p>
        </div>
      ) : (
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {kbs.map((kb) => (
            <li key={kb.id}>
              <Link
                href={`/dashboard/knowledge/${kb.id}`}
                className="block rounded-lg border border-border bg-surface/40 px-4 py-3.5 transition hover:border-border-strong hover:bg-surface"
              >
                <div className="text-sm font-medium">{kb.name}</div>
                {kb.toolDescription ? (
                  <p className="mt-1 line-clamp-2 text-xs text-muted">
                    {kb.toolDescription}
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-muted-2">
                    No tool description
                  </p>
                )}
                <div className="mt-2 text-[11px] text-muted-2">
                  Created {new Date(kb.createdAt).toLocaleDateString()}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
