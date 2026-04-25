/**
 * Vector search across one or more knowledge bases. Embeds the query, runs
 * cosine-distance ANN against the HNSW index, returns the top-k chunks
 * along with the source document name.
 */

import { cosineDistance, eq, inArray, sql } from "drizzle-orm";
import { db } from "../config/database";
import { kbChunks, kbDocuments } from "../db/schema";
import { embed } from "./embeddings";

export type KbSearchHit = {
  documentId: string;
  documentName: string;
  text: string;
  score: number;
};

export async function searchKB(
  knowledgeBaseIds: string[],
  query: string,
  k: number = 4,
): Promise<KbSearchHit[]> {
  console.log("[kb-search] request", {
    knowledgeBaseIds,
    query: query.slice(0, 100),
    k,
  });
  if (knowledgeBaseIds.length === 0) {
    console.log("[kb-search] no KB ids, returning empty");
    return [];
  }
  const trimmed = query.trim();
  if (!trimmed) {
    console.log("[kb-search] empty query, returning empty");
    return [];
  }

  const [vector] = await embed([trimmed]);
  if (!vector) {
    console.log("[kb-search] embedding returned no vector");
    return [];
  }

  const limit = Math.min(Math.max(k | 0, 1), 20);
  const distance = cosineDistance(kbChunks.embedding, vector);

  const t0 = Date.now();
  const rows = await db
    .select({
      documentId: kbChunks.documentId,
      documentName: kbDocuments.name,
      text: kbChunks.text,
      score: sql<number>`1 - (${distance})`.as("score"),
    })
    .from(kbChunks)
    .innerJoin(kbDocuments, eq(kbDocuments.id, kbChunks.documentId))
    .where(inArray(kbChunks.knowledgeBaseId, knowledgeBaseIds))
    .orderBy(distance)
    .limit(limit);

  const hits: KbSearchHit[] = rows.map((r) => ({
    documentId: String(r.documentId),
    documentName: String(r.documentName ?? ""),
    text: String(r.text ?? ""),
    score: typeof r.score === "number" ? r.score : Number(r.score ?? 0),
  }));

  console.log("[kb-search] result", {
    hits: hits.length,
    ms: Date.now() - t0,
    topScore: hits[0]?.score,
    topDoc: hits[0]?.documentName,
  });
  return hits;
}
