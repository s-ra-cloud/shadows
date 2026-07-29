/**
 * Construction of records compatible with deity_excerpts.jsonl.
 * Faithful port of records.py.
 */

import { createHash } from "node:crypto";
import type { Entity } from "./catalog.js";
import { normalizeSpace, wordCount } from "./normalization.js";

export const COMMON_FIELDS = [
  "deity",
  "tradition",
  "gender",
  "matched_alias",
  "record_type",
  "source_work",
  "source_author",
  "translator",
  "corpus",
  "origin",
  "locator",
  "excerpt",
  "n_words",
  "id",
] as const;

export const OPTIONAL_FIELDS = [
  "url",
  "artwork_title",
  "artwork_date",
  "artwork_medium",
  "artwork_classification",
  "match_confidence",
  "excerpt_original",
  "original_language",
  "translation_method",
  "translator_note",
] as const;

/**
 * Serialize a value like Python `json.dumps(..., ensure_ascii=False,
 * sort_keys=True, separators=(",", ":"))`.
 */
export function pyJsonDumpsSorted(value: unknown): string {
  return stableStringify(value, true);
}

/**
 * Serialize a value like Python `json.dumps(..., ensure_ascii=False,
 * separators=(",", ":"))` preserving insertion order.
 */
export function pyJsonDumpsCompact(value: unknown): string {
  return stableStringify(value, false);
}

function stableStringify(value: unknown, sortKeys: boolean): string {
  if (value === null || value === undefined) {
    return "null";
  }
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    return JSON.stringify(value);
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (Array.isArray(value)) {
    return "[" + value.map((item) => stableStringify(item, sortKeys)).join(",") + "]";
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    let keys = Object.keys(obj);
    if (sortKeys) {
      keys = keys.sort();
    }
    return (
      "{" +
      keys
        .map((key) => JSON.stringify(key) + ":" + stableStringify(obj[key], sortKeys))
        .join(",") +
      "}"
    );
  }
  return "null";
}

/** Compute the stable record id ("rec" + first 16 hex of sha256 of identity). */
export function stableRecordId(record: Record<string, unknown>): string {
  const identity: Record<string, unknown> = {};
  for (const key of ["deity", "tradition", "record_type", "locator", "excerpt"]) {
    identity[key] = record[key] ?? null;
  }
  const payload = pyJsonDumpsSorted(identity);
  const digest = createHash("sha256").update(payload, "utf-8").digest("hex");
  return "rec" + digest.slice(0, 16);
}

export interface MakeRecordOptions {
  recordType: string;
  sourceWork: string;
  sourceAuthor: string;
  translator: string | null | undefined;
  corpus: string;
  origin: string;
  locator: string;
  excerpt: string;
  optional?: Record<string, unknown>;
}

/** Build a canonical resource record from an entity and matched alias. */
export function makeRecord(
  entity: Entity,
  matchedAlias: string,
  options: MakeRecordOptions,
): Record<string, unknown> {
  const cleanExcerpt = normalizeSpace(options.excerpt);
  const record: Record<string, unknown> = {
    deity: entity.name,
    tradition: entity.tradition,
    gender: entity.gender,
    matched_alias: normalizeSpace(matchedAlias),
    record_type: options.recordType,
    source_work: normalizeSpace(options.sourceWork),
    source_author: normalizeSpace(options.sourceAuthor),
    translator: options.translator ? normalizeSpace(options.translator) : null,
    corpus: normalizeSpace(options.corpus),
    origin: normalizeSpace(options.origin),
    locator: normalizeSpace(options.locator),
    excerpt: cleanExcerpt,
    n_words: wordCount(cleanExcerpt),
  };
  const optionalSet = new Set<string>(OPTIONAL_FIELDS);
  for (const [key, value] of Object.entries(options.optional ?? {})) {
    if (!optionalSet.has(key) || value === null || value === undefined) {
      continue;
    }
    record[key] = normalizeSpace(value);
  }
  record.id = stableRecordId(record);
  return record;
}
