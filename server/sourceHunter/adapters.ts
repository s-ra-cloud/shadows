/**
 * Reusable, deterministic source-adapter contract.
 * Faithful port of adapters.py.
 */

import type { Entity } from "./catalog.js";
import { validateRecord } from "./validation.js";

/** A registry source definition (loosely typed to mirror Python mappings). */
export type SourceDefinition = Record<string, unknown>;

/** Parse-time options passed to every adapter. */
export interface ParseOptions {
  source: SourceDefinition;
  entities: Iterable<Entity>;
  retrievedAt: Date;
}

/** Parse one immutable payload from a reusable source family. */
export interface SourceAdapter {
  readonly sourceFamily: string;
  parseSample(payload: Buffer, options: ParseOptions): Record<string, unknown>[];
}

/** Return the source `defaults` mapping (throws if malformed). */
export function sourceDefaults(source: SourceDefinition): Record<string, unknown> {
  const defaults = source.defaults ?? {};
  if (typeof defaults !== "object" || defaults === null || Array.isArray(defaults)) {
    throw new Error("source defaults must be an object");
  }
  return defaults as Record<string, unknown>;
}

/** Parse and validate every record at the adapter boundary. */
export function runSample(
  adapter: SourceAdapter,
  source: SourceDefinition,
  payload: Buffer,
  entities: Iterable<Entity>,
  retrievedAt: Date,
): Record<string, unknown>[] {
  if (source.source_family !== adapter.sourceFamily) {
    throw new Error(
      "source definition source_family does not match adapter source_family",
    );
  }
  const records = adapter.parseSample(payload, { source, entities, retrievedAt });
  for (const record of records) {
    validateRecord(record);
  }
  return records;
}
