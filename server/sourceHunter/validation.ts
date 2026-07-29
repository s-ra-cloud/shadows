/**
 * Validation for the canonical JSONL record and source registry.
 * Faithful port of validation.py.
 */

import { promises as fs } from "node:fs";
import { COMMON_FIELDS, OPTIONAL_FIELDS } from "./records.js";
import { wordCount } from "./normalization.js";

export class RecordValidationError extends Error {}

export const RECORD_TYPES = new Set(["text_excerpt", "art_description", "museum_object"]);
export const SOURCE_FAMILIES = new Set([
  "iiif",
  "legacy_jsonl",
  "mediawiki",
  "oai_dc",
  "plain_text",
  "tei",
]);

/** True when value is an absolute http(s) URL with a host. */
export function isHttpUrl(value: unknown): boolean {
  if (typeof value !== "string") {
    return false;
  }
  try {
    const parsed = new URL(value);
    return (parsed.protocol === "http:" || parsed.protocol === "https:") && parsed.host.length > 0;
  } catch {
    return false;
  }
}

function sortedList(values: Iterable<string>): string[] {
  return Array.from(values).sort();
}

/** Validate one canonical resource record; throws RecordValidationError. */
export function validateRecord(record: Record<string, unknown>): void {
  const keys = new Set(Object.keys(record));
  const missing = [...COMMON_FIELDS].filter((f) => !keys.has(f));
  if (missing.length > 0) {
    throw new RecordValidationError(
      `record is missing required fields: [${sortedList(missing).map((m) => `'${m}'`).join(", ")}]`,
    );
  }
  const known = new Set<string>([...COMMON_FIELDS, ...OPTIONAL_FIELDS]);
  const unexpected = Array.from(keys).filter((k) => !known.has(k));
  if (unexpected.length > 0) {
    throw new RecordValidationError(
      `record has unexpected fields: [${sortedList(unexpected).map((m) => `'${m}'`).join(", ")}]`,
    );
  }
  for (const key of COMMON_FIELDS) {
    if (key === "translator") {
      if (record[key] !== null && typeof record[key] !== "string") {
        throw new RecordValidationError("translator must be a string or null");
      }
    } else if (key === "n_words") {
      const value = record[key];
      if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
        throw new RecordValidationError("n_words must be a non-negative integer");
      }
    } else if (typeof record[key] !== "string") {
      throw new RecordValidationError(`${key} must be a string`);
    }
  }
  for (const key of OPTIONAL_FIELDS) {
    if (keys.has(key) && typeof record[key] !== "string") {
      throw new RecordValidationError(`${key} must be a string`);
    }
  }
  if (!RECORD_TYPES.has(record.record_type as string)) {
    throw new RecordValidationError(`unsupported record_type: '${String(record.record_type)}'`);
  }
  if (!/^rec[0-9a-f]{6,32}$/.test(record.id as string)) {
    throw new RecordValidationError(
      "id must start with rec and contain 6-32 lowercase hex characters",
    );
  }
  const actualWords = wordCount(record.excerpt as string);
  if (record.n_words !== actualWords) {
    throw new RecordValidationError(`n_words is ${record.n_words}, expected ${actualWords}`);
  }
  if (keys.has("url") && record.url && !isHttpUrl(record.url)) {
    throw new RecordValidationError("url must be an absolute HTTP(S) URL");
  }
  if (record.record_type === "museum_object") {
    const needed = [
      "url",
      "artwork_title",
      "artwork_date",
      "artwork_medium",
      "artwork_classification",
      "match_confidence",
    ];
    const absent = needed.filter((n) => !keys.has(n));
    if (absent.length > 0) {
      throw new RecordValidationError(
        `museum_object is missing fields: [${sortedList(absent).map((m) => `'${m}'`).join(", ")}]`,
      );
    }
  }
}

/** Validate a sequence of records, enforcing unique ids. */
export function validateRecords(records: Iterable<Record<string, unknown>>): number {
  const seen = new Set<string>();
  let count = 0;
  let index = 0;
  for (const record of Array.from(records)) {
    index += 1;
    try {
      validateRecord(record);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new RecordValidationError(`record ${index}: ${msg}`);
    }
    if (seen.has(record.id as string)) {
      throw new RecordValidationError(`record ${index}: duplicate id '${String(record.id)}'`);
    }
    seen.add(record.id as string);
    count += 1;
  }
  return count;
}

/** Parse JSONL text into record objects. */
export function iterJsonlText(text: string, source = "<jsonl>"): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.trim()) {
      continue;
    }
    let value: unknown;
    try {
      value = JSON.parse(line);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new RecordValidationError(`${source}:${i + 1}: invalid JSON: ${msg}`);
    }
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new RecordValidationError(`${source}:${i + 1}: JSONL value must be an object`);
    }
    out.push(value as Record<string, unknown>);
  }
  return out;
}

/** Read a JSONL file and return the parsed records. */
export async function iterJsonl(path: string): Promise<Record<string, unknown>[]> {
  const text = await fs.readFile(path, "utf-8");
  return iterJsonlText(text, path);
}

/** Validate a JSONL file, returning the number of records. */
export async function validateJsonl(path: string): Promise<number> {
  return validateRecords(await iterJsonl(path));
}

/** Validate a source registry document; throws Error on any problem. */
export function validateSourceRegistry(registry: Record<string, unknown>): void {
  if (registry.schema_version !== "1.0.0") {
    throw new Error("registry schema_version must be 1.0.0");
  }
  const sources = registry.sources;
  if (!Array.isArray(sources)) {
    throw new Error("registry sources must be an array");
  }
  const seen = new Set<string>();
  for (const source of sources) {
    if (!source || typeof source !== "object" || Array.isArray(source)) {
      throw new Error("each registry source must be an object");
    }
    const src = source as Record<string, unknown>;
    for (const field of ["source_id", "name", "source_family", "endpoint_url", "access", "rate_limit"]) {
      if (!(field in src)) {
        throw new Error(`source is missing ${field}`);
      }
    }
    const sourceId = src.source_id;
    if (typeof sourceId !== "string" || !/^source:[a-z0-9][a-z0-9_-]*$/.test(sourceId)) {
      throw new Error(`invalid source_id: ${JSON.stringify(sourceId)}`);
    }
    if (seen.has(sourceId)) {
      throw new Error(`duplicate source_id: ${sourceId}`);
    }
    seen.add(sourceId);
    if (!SOURCE_FAMILIES.has(src.source_family as string)) {
      throw new Error(`unsupported source_family: '${String(src.source_family)}'`);
    }
    if (typeof src.name !== "string" || !src.name.trim()) {
      throw new Error(`invalid source name for ${sourceId}`);
    }
    if (!isHttpUrl(src.endpoint_url)) {
      throw new Error(`invalid endpoint_url for ${sourceId}`);
    }
    const resourceTypes = src.resource_types;
    if (
      !Array.isArray(resourceTypes) ||
      resourceTypes.length === 0 ||
      resourceTypes.some((item) => !RECORD_TYPES.has(item as string))
    ) {
      throw new Error(`invalid resource_types for ${sourceId}`);
    }
    if (resourceTypes.length !== new Set(resourceTypes).size) {
      throw new Error(`duplicate resource_types for ${sourceId}`);
    }
    if ("allowed_hosts" in src) {
      const hosts = src.allowed_hosts;
      if (
        !Array.isArray(hosts) ||
        hosts.length === 0 ||
        hosts.some((h) => typeof h !== "string" || !h.trim())
      ) {
        throw new Error(`invalid allowed_hosts for ${sourceId}`);
      }
    }
    if ("defaults" in src && (typeof src.defaults !== "object" || src.defaults === null || Array.isArray(src.defaults))) {
      throw new Error(`invalid defaults for ${sourceId}`);
    }
    const access = src.access;
    if (!access || typeof access !== "object" || Array.isArray(access)) {
      throw new Error(`invalid access definition for ${sourceId}`);
    }
    const acc = access as Record<string, unknown>;
    for (const field of ["review_status", "terms_url", "robots_url", "license", "reuse_notes"]) {
      if (!(field in acc)) {
        throw new Error(`access for ${sourceId} is missing ${field}`);
      }
    }
    if (!["reviewed", "conditional", "blocked"].includes(acc.review_status as string)) {
      throw new Error(`invalid review_status for ${sourceId}`);
    }
    for (const field of ["terms_url", "robots_url"]) {
      if (!isHttpUrl(acc[field])) {
        throw new Error(`invalid ${field} for ${sourceId}`);
      }
    }
    for (const field of ["license", "reuse_notes"]) {
      if (typeof acc[field] !== "string" || !(acc[field] as string).trim()) {
        throw new Error(`invalid ${field} for ${sourceId}`);
      }
    }
    if (typeof src.rate_limit !== "object" || src.rate_limit === null || Array.isArray(src.rate_limit)) {
      throw new Error(`invalid rate limit for ${sourceId}`);
    }
    const rate = (src.rate_limit as Record<string, unknown>).requests_per_second;
    if (typeof rate !== "number" || rate <= 0) {
      throw new Error(`invalid rate limit for ${sourceId}`);
    }
  }
}

/** Load and validate a source registry from disk. */
export async function loadRegistry(path: string): Promise<Record<string, unknown>> {
  const registry = JSON.parse(await fs.readFile(path, "utf-8"));
  validateSourceRegistry(registry);
  return registry;
}

/** Select a source by id; throws if missing. */
export function selectSource(
  registry: Record<string, unknown>,
  sourceId: string,
): Record<string, unknown> {
  for (const source of registry.sources as Record<string, unknown>[]) {
    if (source.source_id === sourceId) {
      return source;
    }
  }
  throw new Error(`unknown source_id: ${sourceId}`);
}
