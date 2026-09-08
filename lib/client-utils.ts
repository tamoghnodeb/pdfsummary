/**
 * Format file size in human-readable form.
 * Safe for use in client and server components.
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Truncate text to a max number of characters, appending "…" if truncated.
 * Safe for use in client and server components.
 */
export function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars - 1) + "…";
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

