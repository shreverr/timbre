/**
 * Extract plain text from an uploaded document. Backed by LangChain's
 * WebPDFLoader for PDFs (memory-efficient page-streaming) and a plain
 * UTF-8 decode for text/markdown.
 */

export const SUPPORTED_MIME = new Set([
  "application/pdf",
  "text/plain",
  "text/markdown",
]);

const MAX_TOTAL_CHARS = 1_500_000;

export async function extractText(
  buffer: Uint8Array,
  mimeType: string,
): Promise<string> {
  if (mimeType === "text/plain" || mimeType === "text/markdown") {
    const text = new TextDecoder("utf-8").decode(buffer);
    return text.length > MAX_TOTAL_CHARS
      ? text.slice(0, MAX_TOTAL_CHARS)
      : text;
  }
  if (mimeType === "application/pdf") {
    return await extractPdf(buffer);
  }
  throw new Error(`Unsupported mime type: ${mimeType}`);
}

async function extractPdf(buffer: Uint8Array): Promise<string> {
  const { WebPDFLoader } = await import(
    "@langchain/community/document_loaders/web/pdf"
  );
  const blob = new Blob([new Uint8Array(buffer)], {
    type: "application/pdf",
  });
  // splitPages: true returns one Document per page; we join them. This keeps
  // peak memory bounded by the largest single page rather than the whole doc.
  const loader = new WebPDFLoader(blob, { splitPages: true });
  const docs = await loader.load();

  const parts: string[] = [];
  let total = 0;
  for (const d of docs) {
    const piece = (d.pageContent ?? "").trim();
    if (!piece) continue;
    parts.push(piece);
    total += piece.length;
    if (total >= MAX_TOTAL_CHARS) {
      console.warn("[text-extract] PDF char cap hit", {
        total,
        cap: MAX_TOTAL_CHARS,
        pages: parts.length,
      });
      break;
    }
  }
  return parts.join("\n\n");
}
