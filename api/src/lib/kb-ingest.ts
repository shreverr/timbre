/**
 * Orchestrates the document → chunks → embeddings → DB pipeline. Called by
 * the upload route as fire-and-forget; status updates flow through the
 * `kbDocuments` row.
 */

import { eq } from "drizzle-orm";
import { db } from "../config/database";
import { kbChunks, kbDocuments } from "../db/schema";
import { chunk } from "./chunker";
import { embed } from "./embeddings";
import { extractText } from "./text-extract";

export async function ingestDocument(
  documentId: string,
  data: Uint8Array,
  mimeType: string,
): Promise<void> {
  const t0 = Date.now();
  console.log("[kb-ingest] start", {
    documentId,
    mimeType,
    bytes: data.byteLength,
  });
  try {
    const text = await extractText(data, mimeType);
    console.log("[kb-ingest] extracted", {
      documentId,
      chars: text.length,
      preview: text.slice(0, 120).replace(/\s+/g, " "),
    });
    if (!text.trim()) {
      throw new Error("Document is empty after extraction");
    }
    const pieces = await chunk(text);
    console.log("[kb-ingest] chunked", {
      documentId,
      chunks: pieces.length,
      avgChars:
        pieces.length === 0
          ? 0
          : Math.round(
              pieces.reduce((s, p) => s + p.length, 0) / pieces.length,
            ),
    });
    if (pieces.length === 0) {
      throw new Error("No chunks produced");
    }

    const tEmbed = Date.now();
    const vectors = await embed(pieces);
    console.log("[kb-ingest] embedded", {
      documentId,
      vectors: vectors.length,
      ms: Date.now() - tEmbed,
    });
    if (vectors.length !== pieces.length) {
      throw new Error(
        `Embedding count mismatch (${vectors.length} vs ${pieces.length})`,
      );
    }

    const [doc] = await db
      .select()
      .from(kbDocuments)
      .where(eq(kbDocuments.id, documentId));
    if (!doc) {
      throw new Error("Document row missing during ingest");
    }

    await db.insert(kbChunks).values(
      pieces.map((p, i) => ({
        documentId,
        knowledgeBaseId: doc.knowledgeBaseId,
        text: p,
        position: i,
        embedding: vectors[i]!,
      })),
    );

    await db
      .update(kbDocuments)
      .set({
        status: "ready",
        chunkCount: pieces.length,
        errorMessage: null,
        updatedAt: new Date(),
      })
      .where(eq(kbDocuments.id, documentId));

    console.log("[kb-ingest] ready", {
      documentId,
      chunks: pieces.length,
      totalMs: Date.now() - t0,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[kb-ingest] FAILED", {
      documentId,
      err: msg,
      totalMs: Date.now() - t0,
    });
    try {
      await db
        .update(kbDocuments)
        .set({
          status: "failed",
          errorMessage: msg.slice(0, 500),
          updatedAt: new Date(),
        })
        .where(eq(kbDocuments.id, documentId));
    } catch (innerErr) {
      console.error("[kb-ingest] status update failed", innerErr);
    }
  }
}
