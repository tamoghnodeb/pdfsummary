import "server-only";

// Polyfill for DOMMatrix which is required by pdfjs-dist in Node environments
if (typeof globalThis.DOMMatrix === "undefined") {
  globalThis.DOMMatrix = class DOMMatrix {
    constructor() {}
  } as any;
}

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
 * Uses pdf-parse (which bundles its own pdfjs-dist) — works on Vercel
 * without any web worker configuration.
 */
export async function extractTextFromPDF(
  buffer: Buffer
): Promise<PageContent[]> {
  // pdf-parse bundles its own pdfjs-dist; no worker setup needed
  const { PDFParse } = await import("pdf-parse");

  const pages: PageContent[] = [];

  try {
    const parser = new PDFParse({
      data: new Uint8Array(buffer),
      useWorkerFetch: false,
      isEvalSupported: false,
      useSystemFonts: true,
      disableFontFace: true,
    } as any);

    // getText() returns { pages: Array<{text: string, num: number}>, text: string }
    const result = await (parser as any).getText({});

    const rawPages: Array<{ text: string; num: number }> = result.pages ?? [];

    for (const rawPage of rawPages) {
      const cleaned = cleanText(rawPage.text ?? "");
      if (cleaned.length > 10) {
        pages.push({ pageNumber: rawPage.num, text: cleaned });
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
