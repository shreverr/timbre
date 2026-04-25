/**
 * Thin wrapper around OpenAI's embeddings API. We keep the dep surface tiny
 * by using plain `fetch` instead of the SDK.
 */

import { env } from "../env";

const MODEL = "text-embedding-3-small";
const DIM = 1536;
const BATCH = 100;

export const EMBEDDING_DIMENSIONS = DIM;

export async function embed(texts: string[]): Promise<number[][]> {
  if (!env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY not configured");
  }
  if (texts.length === 0) return [];

  console.log("[embed] start", { count: texts.length, model: MODEL });
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH) {
    const batch = texts.slice(i, i + BATCH);
    const t0 = Date.now();
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: MODEL, input: batch }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("[embed] OpenAI error", {
        status: res.status,
        detail: detail.slice(0, 300),
      });
      throw new Error(`OpenAI embeddings ${res.status}: ${detail.slice(0, 300)}`);
    }
    const body = (await res.json()) as {
      data: { embedding: number[] }[];
    };
    for (const row of body.data) out.push(row.embedding);
    console.log("[embed] batch ok", {
      batchSize: batch.length,
      ms: Date.now() - t0,
    });
  }
  console.log("[embed] done", { vectors: out.length });
  return out;
}
