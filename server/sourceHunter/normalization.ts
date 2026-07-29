/**
 * Small deterministic text-normalization helpers.
 * Faithful port of normalization.py.
 */

/**
 * Return NFC text with repeated whitespace collapsed.
 * Mirrors Python `str.split()` whitespace semantics.
 */
export function normalizeSpace(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  const normalized = String(value).normalize("NFC");
  // Python str.split() with no args splits on any run of Unicode whitespace and
  // discards empty tokens.
  return normalized.split(/\s+/).filter((part) => part.length > 0).join(" ");
}

/**
 * Decode a small set of HTML entities and strip tags, returning normalized text.
 * Mirrors Python's HTMLParser-based `strip_html`.
 */
export function stripHtml(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  const unescaped = unescapeHtml(String(value));
  // Remove tags, keep character data (like HTMLParser.handle_data collecting text).
  const text = unescaped.replace(/<[^>]*>/g, " ");
  return normalizeSpace(text);
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: "\u00a0",
};

/** Decode numeric and a handful of named HTML entities. */
export function unescapeHtml(value: string): string {
  return value.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g, (match, body: string) => {
    if (body[0] === "#") {
      let code: number;
      if (body[1] === "x" || body[1] === "X") {
        code = parseInt(body.slice(2), 16);
      } else {
        code = parseInt(body.slice(1), 10);
      }
      if (Number.isFinite(code)) {
        try {
          return String.fromCodePoint(code);
        } catch {
          return match;
        }
      }
      return match;
    }
    const replacement = NAMED_ENTITIES[body.toLowerCase()];
    return replacement !== undefined ? replacement : match;
  });
}

/** Use the same whitespace-token convention as the reference JSONL. */
export function wordCount(value: string): number {
  return value.split(/\s+/).filter((part) => part.length > 0).length;
}

/** Normalize an alias for case-insensitive lookup. */
export function normalizedLookup(value: string): string {
  return normalizeSpace(value).normalize("NFKC").toLowerCase();
}

/** Create a conservative ASCII identifier component. */
export function slug(value: string): string {
  const asciiValue = value
    .normalize("NFKD")
    // Drop non-ASCII (matches Python `.encode("ascii", "ignore")`).
    .replace(/[^\x00-\x7f]/g, "");
  const result = asciiValue
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return result || "unknown";
}
