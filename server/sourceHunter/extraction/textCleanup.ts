/**
 * Heuristic cleanup for messy plain-text transcriptions (typically OCR text
 * from archive.org): drops page furniture, fixes hyphenation, unwraps hard
 * line breaks and produces readable Markdown paragraphs.
 */

/** Lines that are just page numbers or number-with-dashes furniture. */
const PAGE_NUMBER = /^\s*[-–—[\]()\s]*\d{1,4}[-–—[\]()\s]*$/;

/** Detect whether a text looks hard-wrapped OCR output. */
export function looksLikeOcrTranscription(text: string): boolean {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 40) return false;
  const wrapped = lines.filter((l) => {
    const t = l.trim();
    return t.length > 35 && t.length < 90 && !/[.!?:;"”』]$/.test(t);
  });
  return wrapped.length / lines.length > 0.4;
}

export function cleanupTranscription(text: string): string {
  const rawLines = text.replace(/\t/g, " ").split(/\r?\n/);

  // Running headers: identical short lines repeated many times.
  const counts = new Map<string, number>();
  for (const line of rawLines) {
    const t = line.trim();
    if (t && t.length < 70) counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  const runningHeaders = new Set(
    Array.from(counts.entries())
      .filter(([, n]) => n >= 5)
      .map(([t]) => t),
  );

  const lines = rawLines
    .map((l) => l.trim())
    .filter((t) => !PAGE_NUMBER.test(t))
    .filter((t) => !runningHeaders.has(t) || t === "");

  // Rebuild paragraphs: blank line = paragraph break; otherwise unwrap.
  const paragraphs: string[] = [];
  let current = "";
  const push = () => {
    if (current.trim()) paragraphs.push(current.trim());
    current = "";
  };
  for (const line of lines) {
    if (!line) {
      push();
      continue;
    }
    if (!current) {
      current = line;
    } else if (/[a-zA-Z]-$/.test(current) && /^[a-z]/.test(line)) {
      // OCR hyphenation at a line break.
      current = current.replace(/-$/, "") + line;
    } else {
      current += " " + line;
    }
  }
  push();

  return paragraphs
    .map((p) => p.replace(/\s{2,}/g, " "))
    .join("\n\n")
    .trim();
}
