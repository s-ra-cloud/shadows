/**
 * Adapter for UTF-8 plain-text transcriptions.
 * Faithful port of plain_text.py.
 */

import type { ParseOptions, SourceAdapter } from "./adapters.js";
import { sourceDefaults } from "./adapters.js";
import { EntityMatcher } from "./matching.js";
import { normalizeSpace } from "./normalization.js";
import { makeRecord } from "./records.js";

/** Split prose into bounded, paragraph-aware evidence excerpts. */
export function chunkText(
  text: string,
  options: { maxWords?: number; overlapWords?: number } = {},
): string[] {
  const maxWords = options.maxWords ?? 260;
  const overlapWords = options.overlapWords ?? 35;
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((part) => normalizeSpace(part))
    .filter((part) => part.length > 0);
  const chunks: string[] = [];
  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).filter((w) => w.length > 0);
    if (words.length <= maxWords) {
      chunks.push(paragraph);
      continue;
    }
    const step = Math.max(1, maxWords - overlapWords);
    for (let start = 0; start < words.length; start += step) {
      const chunk = words.slice(start, start + maxWords);
      if (chunk.length === 0) {
        break;
      }
      chunks.push(chunk.join(" "));
      if (start + maxWords >= words.length) {
        break;
      }
    }
  }
  return chunks;
}

const OPTIONAL_KEYS = [
  "excerpt_original",
  "original_language",
  "translation_method",
  "translator_note",
  "url",
];

/** Adapter for the `plain_text` source family. */
export class PlainTextAdapter implements SourceAdapter {
  readonly sourceFamily = "plain_text";

  parseSample(payload: Buffer, options: ParseOptions): Record<string, unknown>[] {
    const { source, entities } = options;
    const defaults = sourceDefaults(source);
    const encoding = String(defaults.encoding ?? "utf-8");
    const text = payload.toString(encoding as BufferEncoding);
    const matcher = new EntityMatcher(entities);
    const maxWords = Number(defaults.max_words ?? 260);
    const overlapWords = Number(defaults.overlap_words ?? 35);
    const baseLocator = String(defaults.locator || source.endpoint_url || "");
    const optionalDefaults: Record<string, unknown> = {};
    for (const key of OPTIONAL_KEYS) {
      if (key in defaults) {
        optionalDefaults[key] = defaults[key];
      }
    }
    const records: Record<string, unknown>[] = [];
    const chunks = chunkText(text, { maxWords, overlapWords });
    chunks.forEach((excerpt, i) => {
      const locator = `${baseLocator}#chunk-${i + 1}`;
      for (const match of matcher.find(excerpt)) {
        records.push(
          makeRecord(match.entity, match.alias, {
            recordType: String(defaults.record_type ?? "text_excerpt"),
            sourceWork: String(defaults.source_work || source.name),
            sourceAuthor: String(defaults.source_author ?? "Unknown"),
            translator: defaults.translator as string | null | undefined,
            corpus: String(defaults.corpus ?? "unknown"),
            origin: String(defaults.origin ?? "primary_source"),
            locator,
            excerpt,
            optional: optionalDefaults,
          }),
        );
      }
    });
    return records;
  }
}
