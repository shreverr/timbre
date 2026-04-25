import Link from "next/link";
import { notFound } from "next/navigation";
import { KbDetail } from "@/components/kb-detail";
import { serverApiFetch } from "@/lib/api-server";
import type { KnowledgeBase } from "@/lib/types";

export default async function KnowledgeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const res = await serverApiFetch(`/knowledge/${id}`);
  if (res.status === 404) notFound();
  if (!res.ok) {
    return (
      <div className="mx-auto max-w-4xl px-8 py-10">
        <p className="text-sm text-red-400">Failed to load knowledge base.</p>
      </div>
    );
  }
  const body = (await res.json()) as { knowledgeBase: KnowledgeBase };

  return (
    <div className="mx-auto max-w-4xl px-8 py-10">
      <nav className="text-xs text-muted-2">
        <Link href="/dashboard/knowledge" className="hover:text-foreground">
          Knowledge
        </Link>
        <span className="mx-1.5">/</span>
        <span className="truncate text-foreground">
          {body.knowledgeBase.name}
        </span>
      </nav>

      <header className="mt-4 border-b border-border pb-5">
        <h1 className="truncate text-xl font-medium tracking-tight">
          {body.knowledgeBase.name}
        </h1>
      </header>

      <div className="mt-6">
        <KbDetail initial={body.knowledgeBase} />
      </div>
    </div>
  );
}
