/**
 * OAI-PMH Dublin Core adapter for museum and library descriptions.
 * Faithful port of oai_dc.py.
 */

import type { ParseOptions, SourceAdapter } from "./adapters.js";
import { sourceDefaults } from "./adapters.js";
import { EntityMatcher } from "./matching.js";
import { normalizeSpace } from "./normalization.js";
import { makeRecord } from "./records.js";
import { iterElements, itertext, localName, parseXml, type XmlElement } from "./xmlDom.js";

function metadataElement(record: XmlElement): XmlElement | null {
  for (const element of iterElements(record)) {
    if (localName(element) === "metadata") {
      return element;
    }
  }
  return null;
}

function collectValues(metadata: XmlElement): Map<string, string[]> {
  const values = new Map<string, string[]>();
  for (const element of iterElements(metadata)) {
    if (element === metadata) {
      continue;
    }
    const value = normalizeSpace(itertext(element));
    if (value) {
      const key = localName(element).toLowerCase();
      const bucket = values.get(key) ?? [];
      bucket.push(value);
      values.set(key, bucket);
    }
  }
  return values;
}

function first(values: Map<string, string[]>, key: string): string {
  const items = values.get(key) ?? [];
  return items.length > 0 ? items[0] : "";
}

function recordIdentifier(record: XmlElement): string {
  for (const element of iterElements(record)) {
    if (localName(element) === "header") {
      for (const child of iterElements(element)) {
        if (localName(child) === "identifier") {
          return normalizeSpace(itertext(child));
        }
      }
    }
  }
  return "";
}

/** Adapter for the `oai_dc` source family. */
export class OaiDcAdapter implements SourceAdapter {
  readonly sourceFamily = "oai_dc";

  parseSample(payload: Buffer, options: ParseOptions): Record<string, unknown>[] {
    const { source, entities } = options;
    const root = parseXml(payload);
    const defaults = sourceDefaults(source);
    const matcher = new EntityMatcher(entities);
    const records: Record<string, unknown>[] = [];
    let candidates: XmlElement[] = [];
    for (const element of iterElements(root)) {
      if (localName(element) === "record") {
        candidates.push(element);
      }
    }
    if (localName(root) === "record") {
      candidates = [root];
    }
    for (const sourceRecord of candidates) {
      const metaEl = metadataElement(sourceRecord);
      if (!metaEl) {
        continue;
      }
      const values = collectValues(metaEl);
      const title = first(values, "title") || "Untitled";
      const descriptions = values.get("description") ?? [];
      const subjects = values.get("subject") ?? [];
      const creators = values.get("creator") ?? [];
      const dates = values.get("date") ?? [];
      const formats = values.get("format") ?? [];
      const types = values.get("type") ?? [];
      const identifiers = values.get("identifier") ?? [];
      const sourceNativeId = recordIdentifier(sourceRecord);
      const url =
        identifiers.find((id) => id.startsWith("http://") || id.startsWith("https://")) ??
        String(source.endpoint_url);
      const evidenceText = normalizeSpace([title, ...descriptions, ...subjects].join(" "));
      const matches = matcher.find(evidenceText);
      const recordType = String(defaults.record_type ?? "museum_object");
      const creator = creators.join("; ");
      const date = dates.join("; ");
      const medium = formats.join("; ");
      const classification = types.join("; ");
      let excerpt: string;
      if (recordType === "museum_object") {
        const parts = [`"${title}"`];
        if (creator) parts.push(`— ${creator}`);
        if (date) parts.push(date);
        if (medium) parts.push(medium);
        if (classification) parts.push(classification);
        parts.push(...descriptions);
        excerpt = parts.filter((p) => p).map((p) => p.replace(/[ .]+$/, "")).join(". ") + ".";
      } else {
        excerpt = evidenceText;
      }
      for (const match of matches) {
        let optional: Record<string, unknown> = {};
        if (recordType === "museum_object") {
          optional = {
            url,
            artwork_title: title,
            artwork_date: date,
            artwork_medium: medium,
            artwork_classification: classification,
            match_confidence: title.toLowerCase().includes(match.alias.toLowerCase())
              ? "high"
              : "medium",
          };
        } else if (url) {
          optional.url = url;
        }
        records.push(
          makeRecord(match.entity, match.alias, {
            recordType,
            sourceWork: String(defaults.source_work || `${source.name} collection record`),
            sourceAuthor: String(defaults.source_author || source.name),
            translator: defaults.translator as string | null | undefined,
            corpus: String(defaults.corpus ?? "museum"),
            origin: String(defaults.origin ?? "museum_catalog_modern"),
            locator: sourceNativeId || url,
            excerpt,
            optional,
          }),
        );
      }
    }
    return records;
  }
}
