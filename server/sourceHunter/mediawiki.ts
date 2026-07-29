/**
 * MediaWiki Action API adapter for texts and Commons file metadata.
 * Faithful port of mediawiki.py.
 */

import type { ParseOptions, SourceAdapter } from "./adapters.js";
import { sourceDefaults } from "./adapters.js";
import { EntityMatcher } from "./matching.js";
import { normalizeSpace, stripHtml } from "./normalization.js";
import { chunkText } from "./plainText.js";
import { makeRecord } from "./records.js";

function pages(document: Record<string, unknown>): Record<string, unknown>[] {
  const query = document.query;
  if (!query || typeof query !== "object" || Array.isArray(query)) {
    return [];
  }
  const pagesValue = (query as Record<string, unknown>).pages;
  if (Array.isArray(pagesValue)) {
    return pagesValue.filter(
      (page): page is Record<string, unknown> =>
        !!page && typeof page === "object" && !Array.isArray(page),
    );
  }
  if (pagesValue && typeof pagesValue === "object") {
    return Object.values(pagesValue as Record<string, unknown>).filter(
      (page): page is Record<string, unknown> =>
        !!page && typeof page === "object" && !Array.isArray(page),
    );
  }
  return [];
}

function extendedMetadata(page: Record<string, unknown>): Map<string, string> {
  const result = new Map<string, string>();
  const imageInfo = page.imageinfo;
  if (!Array.isArray(imageInfo) || imageInfo.length === 0) {
    return result;
  }
  const firstInfo = imageInfo[0];
  if (!firstInfo || typeof firstInfo !== "object") {
    return result;
  }
  const meta = (firstInfo as Record<string, unknown>).extmetadata;
  if (!meta || typeof meta !== "object") {
    return result;
  }
  for (const [key, value] of Object.entries(meta as Record<string, unknown>)) {
    let raw: unknown;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const obj = value as Record<string, unknown>;
      raw = obj.value ?? obj.Value;
    } else {
      raw = value;
    }
    const clean = stripHtml(raw);
    if (clean) {
      result.set(key.toLowerCase(), clean);
    }
  }
  return result;
}

function revisionText(page: Record<string, unknown>): string {
  const revisions = page.revisions;
  if (!Array.isArray(revisions) || revisions.length === 0) {
    return "";
  }
  const revision = revisions[0];
  if (!revision || typeof revision !== "object") {
    return "";
  }
  const rev = revision as Record<string, unknown>;
  const slots = rev.slots;
  if (slots && typeof slots === "object" && !Array.isArray(slots)) {
    const main = (slots as Record<string, unknown>).main;
    if (main && typeof main === "object" && !Array.isArray(main)) {
      const mainObj = main as Record<string, unknown>;
      return String(mainObj["*"] || mainObj.content || "");
    }
  }
  return String(rev["*"] || rev.content || "");
}

function meta(md: Map<string, string>, ...keys: string[]): string {
  for (const key of keys) {
    const value = md.get(key.toLowerCase());
    if (value) {
      return value;
    }
  }
  return "";
}

function removePrefix(value: string, prefix: string): string {
  return value.startsWith(prefix) ? value.slice(prefix.length) : value;
}

/** Adapter for the `mediawiki` source family. */
export class MediaWikiAdapter implements SourceAdapter {
  readonly sourceFamily = "mediawiki";

  parseSample(payload: Buffer, options: ParseOptions): Record<string, unknown>[] {
    const { source, entities } = options;
    const document = JSON.parse(payload.toString("utf-8"));
    if (!document || typeof document !== "object" || Array.isArray(document)) {
      throw new Error("MediaWiki response must be a JSON object");
    }
    const defaults = sourceDefaults(source);
    const matcher = new EntityMatcher(entities);
    const records: Record<string, unknown>[] = [];
    for (const page of pages(document as Record<string, unknown>)) {
      const title = normalizeSpace(page.title) || "Untitled";
      const pageId = String(page.pageid || title);
      const url = normalizeSpace(page.fullurl);
      const md = extendedMetadata(page);
      const isFile = Boolean(page.imageinfo) || Number(page.ns ?? 0) === 6;
      if (isFile) {
        const description =
          meta(md, "imagedescription", "description", "objectname") || stripHtml(page.extract);
        const creator = meta(md, "artist", "author", "credit", "creator");
        const date = meta(md, "dateTimeOriginal", "date", "created");
        const medium = meta(md, "medium", "technique");
        const classification = meta(md, "objecttype", "mime", "mediatype");
        const evidenceText = normalizeSpace(
          [title, description, Array.from(md.values()).join(" ")].join(" "),
        );
        const excerptParts = [`"${removePrefix(title, "File:")}"`];
        if (creator) excerptParts.push(`— ${creator}`);
        if (date) excerptParts.push(date);
        if (medium) excerptParts.push(medium);
        if (classification) excerptParts.push(classification);
        if (description) excerptParts.push(description);
        const excerpt =
          excerptParts.filter((p) => p).map((p) => p.replace(/[ .]+$/, "")).join(". ") + ".";
        for (const match of matcher.find(evidenceText)) {
          records.push(
            makeRecord(match.entity, match.alias, {
              recordType: "museum_object",
              sourceWork: String(defaults.source_work || `${source.name} file description`),
              sourceAuthor: String(defaults.source_author || source.name),
              translator: null,
              corpus: String(defaults.corpus ?? "museum"),
              origin: String(defaults.origin ?? "museum_catalog_modern"),
              locator: pageId,
              excerpt,
              optional: {
                url: url || String(source.endpoint_url),
                artwork_title: removePrefix(title, "File:"),
                artwork_date: date,
                artwork_medium: medium,
                artwork_classification: classification,
                match_confidence: title.toLowerCase().includes(match.alias.toLowerCase())
                  ? "high"
                  : "medium",
              },
            }),
          );
        }
        continue;
      }

      let extract = stripHtml(page.extract);
      if (!extract) {
        extract = normalizeSpace(revisionText(page));
      }
      const chunks = chunkText(extract, {
        maxWords: Number(defaults.max_words ?? 260),
        overlapWords: Number(defaults.overlap_words ?? 35),
      });
      chunks.forEach((excerpt, i) => {
        for (const match of matcher.find(excerpt)) {
          const optional: Record<string, unknown> = url ? { url } : {};
          records.push(
            makeRecord(match.entity, match.alias, {
              recordType: String(defaults.record_type ?? "text_excerpt"),
              sourceWork: String(defaults.source_work || title),
              sourceAuthor: String(defaults.source_author ?? source.name),
              translator: defaults.translator as string | null | undefined,
              corpus: String(defaults.corpus ?? "wikisource"),
              origin: String(defaults.origin ?? "primary_source"),
              locator: `${pageId}#chunk-${i + 1}`,
              excerpt,
              optional,
            }),
          );
        }
      });
    }
    return records;
  }
}
