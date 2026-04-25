/**
 * Split text into chunks for embedding. Uses LangChain's
 * RecursiveCharacterTextSplitter, which respects paragraph / sentence /
 * word boundaries in that order.
 */

import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

const CHUNK_SIZE = 800;
const CHUNK_OVERLAP = 100;

let splitter: RecursiveCharacterTextSplitter | null = null;
function getSplitter() {
  if (!splitter) {
    splitter = new RecursiveCharacterTextSplitter({
      chunkSize: CHUNK_SIZE,
      chunkOverlap: CHUNK_OVERLAP,
    });
  }
  return splitter;
}

export async function chunk(text: string): Promise<string[]> {
  const cleaned = text.replace(/\r\n/g, "\n").trim();
  if (!cleaned) return [];
  const out = await getSplitter().splitText(cleaned);
  return out.filter((p) => p.trim().length > 0);
}
