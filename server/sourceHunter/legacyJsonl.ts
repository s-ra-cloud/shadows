/**
 * Lossless adapter for the reference deity_excerpts.jsonl format.
 * Faithful port of legacy_jsonl.py.
 */

import type { ParseOptions, SourceAdapter } from "./adapters.js";

/** Adapter for the `legacy_jsonl` source family (passes records through). */
export class LegacyJsonlAdapter implements SourceAdapter {
  readonly sourceFamily = "legacy_jsonl";

  parseSample(payload: Buffer, _options: ParseOptions): Record<string, unknown>[] {
    void _options;
    const records: Record<string, unknown>[] = [];
    const lines = payload.toString("utf-8").split(/\r?\n/);
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      if (!line.trim()) {
        continue;
      }
      const value = JSON.parse(line);
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new Error(`legacy JSONL line ${i + 1} is not an object`);
      }
      records.push(value as Record<string, unknown>);
    }
    return records;
  }
}
