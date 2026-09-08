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
 * Remove raw citations blocks or leaked JSON citation payloads from text,
 * including unclosed or in-flight streaming markdown blocks.
 */
export function stripCitations(text: string): string {
  if (!text) return "";
  return text
    // Matches ```citations whether closed by ``` or unclosed/streaming to end of string ($)
    .replace(/```\s*citations[\s\S]*?(?:```|$)/gi, "")
    // Matches ```json with citation payload whether closed or unclosed
    .replace(/```\s*json\s*\[\s*\{[\s\S]*?(?:```|$)/gi, "")
    // Matches any code block containing filenames
    .replace(/```[\s\S]*?"filename"[\s\S]*?(?:```|$)/gi, "")
    // Matches any line starting with citations: [ or sources: [
    .replace(/(?:\r?\n|^)\s*(?:citations?|sources?)\s*:?\s*(?:\[|\{)[\s\S]*$/gi, "")
    // Matches unclosed array of objects [{"filename": ...
    .replace(/(?:\r?\n|^|\s)\[\s*\{\s*"?filename"?[\s\S]*$/gi, "")
    // Matches word citations followed by [
    .replace(/\bcitations\s*[\r\n\s]*\[\s*\{[\s\S]*$/gi, "")
    .replace(/\[\s*\{\s*"filename"[\s\S]*$/gi, "")
    .trim();
}

