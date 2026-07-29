/**
 * Adapter orchestration, deduplication, JSONL output, and provenance.
 * Faithful port of pipeline.py.
 */

import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import * as path from "node:path";
import type { SourceAdapter, SourceDefinition } from "./adapters.js";
import { runSample } from "./adapters.js";
import type { Entity } from "./catalog.js";
import { IiifAdapter } from "./iiif.js";
import { LegacyJsonlAdapter } from "./legacyJsonl.js";
import { MediaWikiAdapter } from "./mediawiki.js";
import { OaiDcAdapter } from "./oaiDc.js";
import { PlainTextAdapter } from "./plainText.js";
import { TeiAdapter } from "./tei.js";
import { iterJsonl, validateRecords } from "./validation.js";
import { pyJsonDumpsCompact, pyJsonDumpsSorted } from "./records.js";
import { coerceAssessedAt, isoFormat } from "./dateUtil.js";

const ADAPTERS: Record<string, () => SourceAdapter> = {
  iiif: () => new IiifAdapter(),
  legacy_jsonl: () => new LegacyJsonlAdapter(),
  mediawiki: () => new MediaWikiAdapter(),
  oai_dc: () => new OaiDcAdapter(),
  plain_text: () => new PlainTextAdapter(),
  tei: () => new TeiAdapter(),
};

/** Instantiate the adapter registered for a source family. */
export function adapterFor(sourceFamily: string): SourceAdapter {
  const factory = ADAPTERS[sourceFamily];
  if (!factory) {
    throw new Error(`no adapter registered for source family '${sourceFamily}'`);
  }
  return factory();
}

function fingerprint(record: Record<string, unknown>): string {
  const value: Record<string, unknown> = {};
  for (const key of Object.keys(record)) {
    if (key !== "id") {
      value[key] = record[key];
    }
  }
  return pyJsonDumpsSorted(value);
}

/** Remove records that share an id-independent fingerprint. */
export function deduplicateRecords(
  records: Iterable<Record<string, unknown>>,
): Record<string, unknown>[] {
  const result: Record<string, unknown>[] = [];
  const seen = new Set<string>();
  for (const record of Array.from(records)) {
    const fp = fingerprint(record);
    if (seen.has(fp)) {
      continue;
    }
    seen.add(fp);
    result.push({ ...record });
  }
  return result;
}

/** Reassign deterministic sequential ids (rec000000, ...). */
export function assignSequentialIds(
  records: Iterable<Record<string, unknown>>,
): Record<string, unknown>[] {
  return Array.from(records, (record, index) => ({
    ...record,
    id: `rec${String(index).padStart(6, "0")}`,
  }));
}

/** Deduplicate, optionally reindex, and validate records. */
export function prepareRecords(
  records: Iterable<Record<string, unknown>>,
  options: { sequentialIds?: boolean } = {},
): Record<string, unknown>[] {
  const sequentialIds = options.sequentialIds ?? true;
  let result = deduplicateRecords(records);
  if (sequentialIds) {
    result = assignSequentialIds(result);
  }
  validateRecords(result);
  return result;
}

/** Parse a payload using the adapter selected by the source family. */
export function parsePayload(
  payload: Buffer,
  options: { source: SourceDefinition; entities: Iterable<Entity>; retrievedAt?: string | Date },
): Record<string, unknown>[] {
  const adapter = adapterFor(String(options.source.source_family));
  return runSample(
    adapter,
    options.source,
    payload,
    options.entities,
    coerceAssessedAt(options.retrievedAt),
  );
}

/** Write records to a JSONL file (compact separators, unicode preserved). */
export async function writeJsonl(
  filePath: string,
  records: Iterable<Record<string, unknown>>,
): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const lines: string[] = [];
  for (const record of Array.from(records)) {
    lines.push(pyJsonDumpsCompact(record));
  }
  const payload = lines.length > 0 ? lines.join("\n") + "\n" : "";
  await fs.writeFile(filePath, payload, "utf-8");
}

/** Merge multiple JSONL inputs into a prepared output file. */
export async function mergeJsonl(
  inputs: string[],
  output: string,
  options: { sequentialIds?: boolean } = {},
): Promise<Record<string, unknown>[]> {
  const records: Record<string, unknown>[] = [];
  for (const p of inputs) {
    records.push(...(await iterJsonl(p)));
  }
  const result = prepareRecords(records, { sequentialIds: options.sequentialIds ?? true });
  await writeJsonl(output, result);
  return result;
}

/** Compute the `sha256:...` checksum used across the corpus. */
export function payloadChecksum(payload: Buffer): string {
  return "sha256:" + createHash("sha256").update(payload).digest("hex");
}

/** Write a provenance sidecar document (indent=2, trailing newline). */
export async function writeProvenance(
  filePath: string,
  options: {
    source: SourceDefinition;
    retrievedAt: string | Date;
    payload: Buffer;
    recordCount: number;
    inputReference: string;
    mediaType?: string | null;
  },
): Promise<void> {
  const access = (options.source.access as Record<string, unknown>) ?? {};
  const document = {
    schema_version: "1.0.0",
    source_id: options.source.source_id,
    source_name: options.source.name,
    source_family: options.source.source_family,
    input_reference: options.inputReference,
    retrieved_at: isoFormat(coerceAssessedAt(options.retrievedAt)),
    payload_checksum: payloadChecksum(options.payload),
    payload_bytes: options.payload.length,
    media_type: options.mediaType ?? null,
    record_count: options.recordCount,
    rights: {
      license: access.license ?? null,
      terms_url: access.terms_url ?? null,
      reuse_notes: access.reuse_notes ?? null,
    },
  };
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(document, null, 2) + "\n", "utf-8");
}
