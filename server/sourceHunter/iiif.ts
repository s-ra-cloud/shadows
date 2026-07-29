/**
 * IIIF Presentation 2.x/3.x manifest adapter.
 * Faithful port of iiif.py.
 */

import type { ParseOptions, SourceAdapter } from "./adapters.js";
import { sourceDefaults } from "./adapters.js";
import { EntityMatcher } from "./matching.js";
import { normalizeSpace, stripHtml } from "./normalization.js";
import { makeRecord } from "./records.js";

/** Extract plain text from an IIIF language-map / string / array value. */
export function languageText(value: unknown): string {
  if (typeof value === "string") {
    return stripHtml(value);
  }
  if (Array.isArray(value)) {
    return normalizeSpace(
      value
        .map((item) => languageText(item))
        .filter((item) => item)
        .join(" "),
    );
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if ("@value" in obj) {
      return stripHtml(obj["@value"]);
    }
    const parts: string[] = [];
    for (const [key, item] of Object.entries(obj)) {
      if (key.startsWith("@")) {
        continue;
      }
      const itemText = languageText(item);
      if (itemText) {
        parts.push(itemText);
      }
    }
    return normalizeSpace(parts.join(" "));
  }
  return "";
}

function metadata(manifest: Record<string, unknown>): Map<string, string> {
  const result = new Map<string, string>();
  const items = manifest.metadata;
  if (Array.isArray(items)) {
    for (const item of items) {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        continue;
      }
      const obj = item as Record<string, unknown>;
      const label = languageText(obj.label).toLowerCase();
      const value = languageText(obj.value);
      if (label && value) {
        result.set(label, value);
      }
    }
  }
  return result;
}

function metadataValue(md: Map<string, string>, ...names: string[]): string {
  for (const name of names) {
    const nameKey = name.toLowerCase();
    for (const [key, value] of Array.from(md.entries())) {
      if (key === nameKey || key.includes(nameKey)) {
        return value;
      }
    }
  }
  return "";
}

function linkedUrl(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    return String(obj.id || obj["@id"] || "");
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const url = linkedUrl(item);
      if (url) {
        return url;
      }
    }
  }
  return "";
}

function agentLabel(value: unknown): string {
  if (typeof value === "string") {
    return stripHtml(value);
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    return languageText(obj.label || obj.name);
  }
  if (Array.isArray(value)) {
    return normalizeSpace(
      value
        .map((item) => agentLabel(item))
        .filter((item) => item)
        .join(" "),
    );
  }
  return "";
}

/** Adapter for the `iiif` source family. */
export class IiifAdapter implements SourceAdapter {
  readonly sourceFamily = "iiif";

  parseSample(payload: Buffer, options: ParseOptions): Record<string, unknown>[] {
    const { source, entities } = options;
    const manifest = JSON.parse(payload.toString("utf-8"));
    if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
      throw new Error("IIIF manifest must be a JSON object");
    }
    const m = manifest as Record<string, unknown>;
    const defaults = sourceDefaults(source);
    const md = metadata(m);
    const title =
      languageText(m.label) || metadataValue(md, "title", "object name") || "Untitled";
    const description =
      languageText(m.summary || m.description) || metadataValue(md, "description");
    const creator = metadataValue(md, "creator", "artist", "maker", "author");
    const date = metadataValue(md, "date", "created");
    const medium = metadataValue(md, "medium", "material", "technique", "format");
    const classification = metadataValue(md, "classification", "object type", "type");
    const provider = agentLabel(m.provider || m.attribution);
    const institution = defaults.source_author
      ? String(defaults.source_author)
      : provider || String(source.name);
    const parts = [`"${title}"`];
    if (creator) parts.push(`— ${creator}`);
    if (date) parts.push(date);
    if (medium) parts.push(medium);
    if (classification) parts.push(classification);
    if (description) parts.push(description);
    if (institution) parts.push(institution);
    const excerpt = parts.filter((p) => p).map((p) => p.replace(/[ .]+$/, "")).join(". ") + ".";
    const matcher = new EntityMatcher(entities);
    const matches = matcher.find([title, description, Array.from(md.values()).join(" ")].join(" "));
    const manifestId = String(m.id || m["@id"] || "");
    const url =
      linkedUrl(m.homepage) || linkedUrl(m.related) || manifestId || String(source.endpoint_url);
    const records: Record<string, unknown>[] = [];
    for (const match of matches) {
      const confidence = title.toLowerCase().includes(match.alias.toLowerCase())
        ? "high"
        : "medium";
      records.push(
        makeRecord(match.entity, match.alias, {
          recordType: "museum_object",
          sourceWork: String(defaults.source_work || `${source.name} collection record`),
          sourceAuthor: institution,
          translator: null,
          corpus: String(defaults.corpus ?? "museum"),
          origin: String(defaults.origin ?? "museum_catalog_modern"),
          locator: manifestId || url,
          excerpt,
          optional: {
            url,
            artwork_title: title,
            artwork_date: date,
            artwork_medium: medium,
            artwork_classification: classification,
            match_confidence: confidence,
          },
        }),
      );
    }
    return records;
  }
}
