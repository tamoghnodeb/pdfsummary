import "server-only";
import { cleanText, buildChunkId } from "@/lib/utils";
import type { ChunkMetadata, PineconeVector } from "@/types";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PageContent {
  pageNumber: number;
  text: string;
}

export interface DocumentChunk {
  id: string;
  text: string;
  metadata: ChunkMetadata;
}

// ─── PDF Text Extraction ──────────────────────────────────────────────────────

/**
 * Extract text from a PDF buffer, page by page.
 * Uses pdfjs-dist which has proper ESM support.
 */
export async function extractTextFromPDF(
  buffer: Buffer
): Promise<PageContent[]> {
  // Dynamic import to avoid SSR/Turbopack issues
  const { getDocument, GlobalWorkerOptions } = await import("pdfjs-dist");

  // Disable the worker for Node.js server-side usage
  GlobalWorkerOptions.workerSrc = "";

  const pages: PageContent[] = [];

  try {
    // Convert Buffer to Uint8Array for pdfjs-dist
    const uint8Array = new Uint8Array(buffer);

    const pdf = await getDocument({
      data: uint8Array,
      useWorkerFetch: false,
      isEvalSupported: false,
      useSystemFonts: true,
      disableFontFace: true,
    }).promise;

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      try {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();

        // Join text items preserving spacing
        let pageText = "";
        let lastY: number | null = null;

        for (const item of textContent.items) {
          if ("str" in item) {
            // Add newline if we're on a new line (different Y position)
            if (lastY !== null && Math.abs((item as any).transform[5] - lastY) > 5) {
              pageText += "\n";
            }
            pageText += item.str;
            if ((item as any).hasEOL) pageText += "\n";
            lastY = (item as any).transform[5];
          }
        }

        const cleaned = cleanText(pageText);
        if (cleaned.length > 10) {
          pages.push({ pageNumber: pageNum, text: cleaned });
        }
      } catch (pageError) {
        console.warn(`Failed to extract page ${pageNum}:`, pageError);
        // Continue with other pages
      }
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown PDF error";
    throw new Error(`Failed to parse PDF: ${msg}`);
  }

  return pages;
}

// ─── Text Chunking ────────────────────────────────────────────────────────────

const CHUNK_SIZE = 1000; // characters
const CHUNK_OVERLAP = 200; // characters

/**
 * Split a page's text into overlapping chunks.
 * Tries to split on sentence/paragraph boundaries first.
 */
function splitTextIntoChunks(text: string): string[] {
  if (text.length <= CHUNK_SIZE) return [text];

  const chunks: string[] = [];
  const separators = ["\n\n", "\n", ". ", "! ", "? ", "; ", ", ", " ", ""];

  function splitRecursive(str: string, separatorIdx: number): string[] {
    if (str.length <= CHUNK_SIZE) return [str];
    if (separatorIdx >= separators.length) {
      // Force split at CHUNK_SIZE boundaries
      const result: string[] = [];
      for (let i = 0; i < str.length; i += CHUNK_SIZE - CHUNK_OVERLAP) {
        result.push(str.slice(i, i + CHUNK_SIZE));
      }
      return result;
    }

    const sep = separators[separatorIdx];
    if (!str.includes(sep)) {
      return splitRecursive(str, separatorIdx + 1);
    }

    const parts = str.split(sep);
    const result: string[] = [];
    let current = "";

    for (const part of parts) {
      const candidate = current ? current + sep + part : part;
      if (candidate.length > CHUNK_SIZE && current.length > 0) {
        result.push(current.trim());
        current = part;
      } else {
        current = candidate;
      }
    }
    if (current.trim()) result.push(current.trim());

    return result;
  }

  const rawChunks = splitRecursive(text, 0);

  // Apply overlap between consecutive chunks
  for (let i = 0; i < rawChunks.length; i++) {
    let chunk = rawChunks[i];
    // Prepend tail of previous chunk for overlap context
    if (i > 0 && CHUNK_OVERLAP > 0) {
      const prevTail = rawChunks[i - 1].slice(-CHUNK_OVERLAP);
      chunk = prevTail + " " + chunk;
    }
    if (chunk.trim().length > 20) {
      chunks.push(chunk.trim());
    }
  }

  return chunks.length > 0 ? chunks : rawChunks;
}

// ─── Full Document Chunking ───────────────────────────────────────────────────

/**
 * Convert extracted PDF pages into document chunks ready for embedding.
 * Each chunk preserves metadata: filename, page number, chunk index, etc.
 */
export function createDocumentChunks(
  pages: PageContent[],
  filename: string,
  sessionId: string,
  docHash: string
): DocumentChunk[] {
  const chunks: DocumentChunk[] = [];
  const totalPages = pages.length;
  const uploadedAt = new Date().toISOString();
  let globalChunkIndex = 0;

  for (const page of pages) {
    const pageChunks = splitTextIntoChunks(page.text);

    for (let i = 0; i < pageChunks.length; i++) {
      const chunkText = pageChunks[i];
      if (chunkText.trim().length < 20) continue; // skip very short chunks

      chunks.push({
        id: buildChunkId(docHash, page.pageNumber, globalChunkIndex),
        text: chunkText,
        metadata: {
          filename,
          pageNumber: page.pageNumber,
          chunkIndex: globalChunkIndex,
          sessionId,
          docHash,
          totalPages,
          uploadedAt,
        },
      });

      globalChunkIndex++;
    }
  }

  return chunks;
}

// ─── Build Pinecone Vectors ───────────────────────────────────────────────────

/**
 * Combine document chunks with their embeddings into Pinecone-ready vectors.
 */
export function buildPineconeVectors(
  chunks: DocumentChunk[],
  embeddings: number[][]
): PineconeVector[] {
  return chunks.map((chunk, i) => ({
    id: chunk.id,
    values: embeddings[i],
    metadata: {
      ...chunk.metadata,
      text: chunk.text,
    },
  }));
}
