/**
 * Religious & Mythology Resource Hunter — TypeScript port (v0.2.0).
 *
 * Public API surface. All emitted JSON preserves the snake_case field names of
 * the Python tool so candidates, plans, corpus records, provenance and
 * verification reports are structurally byte-compatible.
 */

import { promises as fs } from "node:fs";
import { fileURLToPath } from "node:url";
import * as path from "node:path";
import { validatePolicy } from "./fulltextValidation.js";
import type { Policy } from "./rights.js";

export const VERSION = "0.2.0";

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));

/** Absolute path to the bundled data directory (config/schemas/sources/examples). */
export const DATA_DIR = path.join(MODULE_DIR, "data");

/**
 * Load and validate the bundled default collection policy from
 * `server/sourceHunter/data/config/collection-policy.json`.
 * @returns the parsed, validated policy object.
 */
export async function loadDefaultPolicy(): Promise<Policy> {
  const policyPath = path.join(DATA_DIR, "config", "collection-policy.json");
  const policy = JSON.parse(await fs.readFile(policyPath, "utf-8"));
  validatePolicy(policy);
  return policy;
}

// --- normalization ---
// normalizeSpace(value: unknown): string
// stripHtml(value: unknown): string
// unescapeHtml(value: string): string
// wordCount(value: string): number
// normalizedLookup(value: string): string
// slug(value: string): string
export {
  normalizeSpace,
  stripHtml,
  unescapeHtml,
  wordCount,
  normalizedLookup,
  slug,
} from "./normalization.js";

// --- catalog ---
// entityFromMapping(item): Entity
// entitiesFromDocument(document): Entity[]
// entitiesFromJsonlText(text, source?): Entity[]
// entitiesFromJsonl(filePath): Promise<Entity[]>
// mergeEntities(entities): Entity[]
// loadCatalog(filePath): Promise<Entity[]>
// catalogDocument(entities): Record<string, unknown>
// writeCatalog(filePath, entities): Promise<void>
export type { Entity } from "./catalog.js";
export {
  entityFromMapping,
  entitiesFromDocument,
  entitiesFromJsonlText,
  entitiesFromJsonl,
  mergeEntities,
  loadCatalog,
  catalogDocument,
  writeCatalog,
} from "./catalog.js";

// --- matching ---
// class EntityMatcher { constructor(entities); find(text): EntityMatch[] }
export type { EntityMatch } from "./matching.js";
export { EntityMatcher } from "./matching.js";

// --- records ---
// stableRecordId(record): string
// makeRecord(entity, matchedAlias, options): Record<string, unknown>
// pyJsonDumpsSorted(value): string ; pyJsonDumpsCompact(value): string
export type { MakeRecordOptions } from "./records.js";
export {
  COMMON_FIELDS,
  OPTIONAL_FIELDS,
  stableRecordId,
  makeRecord,
  pyJsonDumpsSorted,
  pyJsonDumpsCompact,
} from "./records.js";

// --- validation ---
// validateRecord(record): void ; validateRecords(records): number
// isHttpUrl(value): boolean ; validateSourceRegistry(registry): void
// loadRegistry(path): Promise<...> ; selectSource(registry, id): ...
// iterJsonl(path) / iterJsonlText(text) ; validateJsonl(path)
export {
  RecordValidationError,
  RECORD_TYPES,
  SOURCE_FAMILIES,
  isHttpUrl,
  validateRecord,
  validateRecords,
  iterJsonl,
  iterJsonlText,
  validateJsonl,
  validateSourceRegistry,
  loadRegistry,
  selectSource,
} from "./validation.js";

// --- adapters ---
// sourceDefaults(source): Record ; runSample(adapter, source, payload, entities, retrievedAt)
export type { SourceAdapter, SourceDefinition, ParseOptions } from "./adapters.js";
export { sourceDefaults, runSample } from "./adapters.js";

// --- parsers ---
export { PlainTextAdapter, chunkText } from "./plainText.js";
export { LegacyJsonlAdapter } from "./legacyJsonl.js";
export { TeiAdapter } from "./tei.js";
export { OaiDcAdapter } from "./oaiDc.js";
export { IiifAdapter, languageText } from "./iiif.js";
export { MediaWikiAdapter } from "./mediawiki.js";
export { parseXml, localName, iterElements, itertext } from "./xmlDom.js";
export type { XmlElement } from "./xmlDom.js";

// --- pipeline ---
// adapterFor(family): SourceAdapter
// deduplicateRecords / assignSequentialIds / prepareRecords
// parsePayload(payload, {source, entities, retrievedAt?})
// writeJsonl(path, records) ; mergeJsonl(inputs, output, {sequentialIds?})
// payloadChecksum(payload) ; writeProvenance(path, {...})
export {
  adapterFor,
  deduplicateRecords,
  assignSequentialIds,
  prepareRecords,
  parsePayload,
  writeJsonl,
  mergeJsonl,
  payloadChecksum,
  writeProvenance,
} from "./pipeline.js";

// --- rights ---
// assessRights(candidate, policy, {embeddedNotice?, assessedAt?}): RightsAssessment
// extractEmbeddedNotice(payload, fileFormat): string
export type { Candidate, Policy, RightsAssessment } from "./rights.js";
export { assessRights, extractEmbeddedNotice } from "./rights.js";

// --- planning ---
// planCandidates(candidates, policy, {assessedAt?}): CandidatePlan[]
export type { CandidatePlan, PlanSelection } from "./planning.js";
export { planCandidates } from "./planning.js";

// --- fetch ---
// fetchPayload(url, source, {userAgent?, timeout?, maxBytes?}): Promise<FetchResult>
// readLocalPayload(localPath, {baseDir?, maxBytes?}): Promise<FetchResult>
export type { FetchResult } from "./fetch.js";
export { DEFAULT_USER_AGENT as FETCH_USER_AGENT, fetchPayload, readLocalPayload, guessContentType } from "./fetch.js";

// --- fulltext validation & sources ---
export {
  FullTextValidationError,
  validateCandidate,
  validatePolicy,
  loadPolicy,
  iterCandidatesText,
  loadCandidates,
} from "./fulltextValidation.js";
// Note: `validatePolicy` above is the canonical export; the local
// `loadDefaultPolicy` uses the same implementation.
export type { FullTextSource } from "./fulltextSources.js";
export {
  PermissionErrorLike,
  validateFulltextRegistry,
  loadFulltextRegistry,
  selectFulltextSource,
  validateCandidateAccess,
  validateRemoteUrl,
} from "./fulltextSources.js";

// --- fulltext download & verify ---
// collectFulltexts(candidates, policy, registry, corpusRoot, {assessedAt?, selectionMode?, userAgent?})
// verifyCorpus(corpusRoot): Promise<CorpusCounts>
// writeCorpusManifest / iterCorpusManifest
export type { CorpusCounts, ManualDetermination } from "./fulltext.js";
export {
  collectFulltexts,
  verifyCorpus,
  writeCorpusManifest,
  iterCorpusManifest,
  promoteLockedFile,
} from "./fulltext.js";

// --- date utilities ---
export { coerceAssessedAt, isoFormat } from "./dateUtil.js";
