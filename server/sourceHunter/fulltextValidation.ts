/**
 * Validation and loading for full-text candidates and collection policy.
 * Faithful port of fulltext_validation.py.
 */

import { promises as fs } from "node:fs";
import * as path from "node:path";
import { isHttpUrl } from "./validation.js";
import type { Candidate, Policy } from "./rights.js";

export class FullTextValidationError extends Error {}

const LANGUAGE_ROLES = new Set(["original", "translation", "parallel", "unknown"]);
const RIGHTS_CLAIMS = new Set(["public_domain", "open_license", "copyrighted", "unknown"]);
const FORMATS = new Set(["txt", "tei_xml", "xml", "html", "epub", "pdf", "json"]);

function sortedQuoted(values: Iterable<string>): string {
  return `[${Array.from(values).sort().map((v) => `'${v}'`).join(", ")}]`;
}

/** Validate one full-text candidate; throws FullTextValidationError. */
export function validateCandidate(candidate: Candidate): void {
  const required = [
    "work_id",
    "edition_id",
    "title",
    "author",
    "source_id",
    "language",
    "language_role",
    "format",
    "rights",
    "access",
  ];
  const keys = new Set(Object.keys(candidate));
  const missing = required.filter((r) => !keys.has(r));
  if (missing.length > 0) {
    throw new FullTextValidationError(`candidate is missing fields: ${sortedQuoted(missing)}`);
  }
  for (const field of ["work_id", "edition_id", "source_id"]) {
    const value = candidate[field];
    if (typeof value !== "string" || !/^[a-z][a-z0-9_-]*:.+$/.test(value)) {
      throw new FullTextValidationError(`invalid ${field}: ${JSON.stringify(value)}`);
    }
  }
  for (const field of ["title", "language"]) {
    if (typeof candidate[field] !== "string" || !(candidate[field] as string).trim()) {
      throw new FullTextValidationError(`${field} must be a non-empty string`);
    }
  }
  if (candidate.author !== null && typeof candidate.author !== "string") {
    throw new FullTextValidationError("author must be a string or null");
  }
  if (
    candidate.translator !== null &&
    candidate.translator !== undefined &&
    typeof candidate.translator !== "string"
  ) {
    throw new FullTextValidationError("translator must be a string or null");
  }
  if (!LANGUAGE_ROLES.has(candidate.language_role as string)) {
    throw new FullTextValidationError("unsupported language_role");
  }
  if (!FORMATS.has(candidate.format as string)) {
    throw new FullTextValidationError("unsupported full-text format");
  }
  if (!candidate.text_url && !candidate.local_path) {
    throw new FullTextValidationError("candidate needs text_url or local_path");
  }
  if (candidate.text_url && !isHttpUrl(candidate.text_url)) {
    throw new FullTextValidationError("text_url must be HTTP(S)");
  }
  if (candidate.metadata_url && !isHttpUrl(candidate.metadata_url)) {
    throw new FullTextValidationError("metadata_url must be HTTP(S)");
  }
  for (const yearField of ["publication_year", "copyright_author_death_year"]) {
    const year = candidate[yearField];
    if (
      year !== null &&
      year !== undefined &&
      (typeof year !== "number" || !Number.isInteger(year) || year < 1 || year > 9999)
    ) {
      throw new FullTextValidationError(`invalid ${yearField}`);
    }
  }

  const rights = candidate.rights;
  if (!rights || typeof rights !== "object" || Array.isArray(rights)) {
    throw new FullTextValidationError("rights must be an object");
  }
  const r = rights as Record<string, unknown>;
  if (!RIGHTS_CLAIMS.has((r.status_claim ?? "unknown") as string)) {
    throw new FullTextValidationError("unsupported rights status_claim");
  }
  const territories = r.territories ?? [];
  if (
    !Array.isArray(territories) ||
    territories.some((item) => typeof item !== "string" || !item.trim())
  ) {
    throw new FullTextValidationError("rights territories must be strings");
  }
  for (const urlField of ["license_url", "rights_url"]) {
    if (r[urlField] && !isHttpUrl(r[urlField])) {
      throw new FullTextValidationError(`invalid rights ${urlField}`);
    }
  }

  const access = candidate.access;
  if (!access || typeof access !== "object" || Array.isArray(access)) {
    throw new FullTextValidationError("access must be an object");
  }
  const a = access as Record<string, unknown>;
  if (typeof a.download_allowed !== "boolean") {
    throw new FullTextValidationError("access.download_allowed must be boolean");
  }
  if (a.requires_auth !== undefined && typeof a.requires_auth !== "boolean") {
    throw new FullTextValidationError("access.requires_auth must be boolean");
  }
}

/** Validate a collection policy; throws FullTextValidationError. */
export function validatePolicy(policy: Policy): void {
  if (policy.schema_version !== "1.0.0") {
    throw new FullTextValidationError("policy schema_version must be 1.0.0");
  }
  if (typeof policy.target_jurisdiction !== "string") {
    throw new FullTextValidationError("policy target_jurisdiction is required");
  }
  const currentYear = policy.current_year;
  if (
    typeof currentYear !== "number" ||
    !Number.isInteger(currentYear) ||
    currentYear < 1900 ||
    currentYear > 9999
  ) {
    throw new FullTextValidationError("policy current_year is invalid");
  }
  for (const field of ["ai_translatable_languages", "preferred_formats"]) {
    const values = policy[field];
    if (!Array.isArray(values) || values.length === 0) {
      throw new FullTextValidationError(`policy ${field} must be an array`);
    }
    if (values.some((item) => typeof item !== "string" || !item)) {
      throw new FullTextValidationError(`policy ${field} has invalid values`);
    }
  }
  if (typeof policy.unlock_likely_public_domain !== "boolean") {
    throw new FullTextValidationError("policy unlock_likely_public_domain must be boolean");
  }
  const maximum = policy.maximum_file_bytes;
  if (typeof maximum !== "number" || !Number.isInteger(maximum) || maximum <= 0) {
    throw new FullTextValidationError("policy maximum_file_bytes must be a positive integer");
  }
}

/** Load and validate a collection policy from disk. */
export async function loadPolicy(filePath: string): Promise<Policy> {
  const policy = JSON.parse(await fs.readFile(filePath, "utf-8"));
  if (!policy || typeof policy !== "object" || Array.isArray(policy)) {
    throw new FullTextValidationError("policy must be a JSON object");
  }
  validatePolicy(policy);
  return policy;
}

/**
 * Parse candidate JSONL text. Relative local_path values are resolved against
 * `baseDir` (the directory containing the candidate file), matching Python.
 */
export function iterCandidatesText(text: string, baseDir: string, source = "<jsonl>"): Candidate[] {
  const out: Candidate[] = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.trim()) {
      continue;
    }
    let candidate: unknown;
    try {
      candidate = JSON.parse(line);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new FullTextValidationError(`${source}:${i + 1}: invalid JSON: ${msg}`);
    }
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
      throw new FullTextValidationError(`${source}:${i + 1}: candidate must be an object`);
    }
    const c = candidate as Candidate;
    validateCandidate(c);
    if (c.local_path) {
      const localPath = String(c.local_path);
      if (!path.isAbsolute(localPath)) {
        const resolved = path.resolve(baseDir, localPath);
        out.push({ ...c, local_path: resolved });
        continue;
      }
    }
    out.push(c);
  }
  return out;
}

/** Read and validate a candidate JSONL file, resolving relative local paths. */
export async function loadCandidates(filePath: string): Promise<Candidate[]> {
  const text = await fs.readFile(filePath, "utf-8");
  const candidates = iterCandidatesText(text, path.dirname(path.resolve(filePath)), filePath);
  const editionIds = candidates.map((c) => c.edition_id);
  if (editionIds.length !== new Set(editionIds).size) {
    throw new FullTextValidationError("candidate file contains duplicate edition_id");
  }
  return candidates;
}
