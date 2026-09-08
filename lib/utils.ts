import "server-only";
import crypto from "crypto";

/**
 * Compute a SHA-256 hash of a Buffer (PDF file content).
 * Used to detect duplicate documents and avoid re-embedding.
 */
export function computeHash(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

/**
 * Generate a unique session ID (UUID v4).
 */
export function generateSessionId(): string {
  return crypto.randomUUID();
}

/**
 * Generate a unique vector ID for a chunk.
 * Format: {docHash}_{pageNumber}_{chunkIndex}
 */
export function buildChunkId(
  docHash: string,
  pageNumber: number,
  chunkIndex: number
): string {
  return `${docHash}_p${pageNumber}_c${chunkIndex}`;
}

/**
 * Clean extracted PDF text by removing excessive whitespace,
 * control characters, and normalizing line endings.
 */
export function cleanText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[^\S\n]+/g, " ") // collapse horizontal whitespace
    .replace(/\n{3,}/g, "\n\n") // max 2 consecutive newlines
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "") // strip control chars
    .trim();
}

/**
 * Truncate text to a max number of characters, appending "…" if truncated.
 */
export function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars - 1) + "…";
}

/**
 * Sleep for a given number of milliseconds (useful for rate limiting).
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Chunk an array into batches of a given size.
 */
export function batchArray<T>(arr: T[], batchSize: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < arr.length; i += batchSize) {
    batches.push(arr.slice(i, i + batchSize));
  }
  return batches;
}

/**
 * Remove raw citations blocks or leaked JSON citation payloads from text.
 */
export function stripCitations(text: string): string {
  if (!text) return "";
  return text
    .replace(/```citations[\s\S]*?```/gi, "")
    .replace(/```json[\s\S]*?```/gi, (m) => (m.includes("filename") ? "" : m))
    .replace(/(?:\r?\n|^)\s*(?:citations?|sources?)\s*:?\s*(\[|\{)[\s\S]*$/gi, "")
    .replace(/(?:\r?\n|^)\s*\[\s*\{\s*"filename"[\s\S]*$/gi, "")
    .replace(/\bcitations\s*[\r\n\s]*\[\s*\{[\s\S]*$/gi, "")
    .replace(/\[\s*\{\s*"filename"[\s\S]*$/gi, "")
    .trim();
}

