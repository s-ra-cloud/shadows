/**
 * TEI P5 XML adapter for primary and translated texts.
 * Faithful port of tei.py.
 */

import type { ParseOptions, SourceAdapter } from "./adapters.js";
import { sourceDefaults } from "./adapters.js";
import { EntityMatcher } from "./matching.js";
import { normalizeSpace } from "./normalization.js";
import { makeRecord } from "./records.js";
import { iterElements, itertext, localName, parseXml, type XmlElement } from "./xmlDom.js";

function elementText(element: XmlElement | null | undefined): string {
  if (!element) {
    return "";
  }
  return normalizeSpace(itertext(element));
}

function firstDescendant(parent: XmlElement | null | undefined, names: Set<string>): XmlElement | null {
  if (!parent) {
    return null;
  }
  for (const element of iterElements(parent)) {
    if (names.has(localName(element)) && elementText(element)) {
      return element;
    }
  }
  return null;
}

function translator(titleStmt: XmlElement | null): string {
  if (!titleStmt) {
    return "";
  }
  const direct = firstDescendant(titleStmt, new Set(["translator"]));
  if (direct) {
    return elementText(direct);
  }
  for (const response of iterElements(titleStmt)) {
    if (localName(response) !== "respStmt") {
      continue;
    }
    if (elementText(response).toLowerCase().includes("translat")) {
      const name = firstDescendant(response, new Set(["name", "persName"]));
      return elementText(name);
    }
  }
  return "";
}

function passages(root: XmlElement): Array<[string, string, string]> {
  const body = firstDescendant(root, new Set(["body"]));
  if (!body) {
    return [];
  }
  let candidates: XmlElement[] = [];
  for (const element of iterElements(body)) {
    if (["p", "ab"].includes(localName(element)) && elementText(element)) {
      candidates.push(element);
    }
  }
  if (candidates.length === 0) {
    for (const element of iterElements(body)) {
      if (localName(element) === "l" && elementText(element)) {
        candidates.push(element);
      }
    }
  }
  if (candidates.length === 0) {
    candidates = [body];
  }
  const result: Array<[string, string, string]> = [];
  candidates.forEach((element, i) => {
    const nativeId = element.attrib["xml:id"] || element.attrib.n || String(i + 1);
    const language = element.attrib["xml:lang"] || "";
    result.push([nativeId, language, elementText(element)]);
  });
  return result;
}

/** Adapter for the `tei` source family. */
export class TeiAdapter implements SourceAdapter {
  readonly sourceFamily = "tei";

  parseSample(payload: Buffer, options: ParseOptions): Record<string, unknown>[] {
    const { source, entities } = options;
    const root = parseXml(payload);
    const defaults = sourceDefaults(source);
    const titleStmt = firstDescendant(root, new Set(["titleStmt"]));
    const title = elementText(firstDescendant(titleStmt, new Set(["title"])));
    const author = elementText(firstDescendant(titleStmt, new Set(["author"])));
    const translatorName = translator(titleStmt);
    const matcher = new EntityMatcher(entities);
    const baseLocator = String(defaults.locator || source.endpoint_url || "");
    const records: Record<string, unknown>[] = [];
    for (const [nativeId, language, excerpt] of passages(root)) {
      const optional: Record<string, unknown> = {};
      if (language && defaults.translation_method) {
        optional.original_language = language;
        optional.translation_method = defaults.translation_method;
      }
      if (defaults.translator_note) {
        optional.translator_note = defaults.translator_note;
      }
      const translatorValue =
        "translator" in defaults
          ? (defaults.translator as string | null | undefined)
          : translatorName || null;
      for (const match of matcher.find(excerpt)) {
        records.push(
          makeRecord(match.entity, match.alias, {
            recordType: String(defaults.record_type ?? "text_excerpt"),
            sourceWork: String(defaults.source_work || title || source.name),
            sourceAuthor: String(defaults.source_author || author || "Unknown"),
            translator: translatorValue,
            corpus: String(defaults.corpus ?? "unknown"),
            origin: String(defaults.origin ?? "primary_source"),
            locator: `${baseLocator}#${nativeId}`,
            excerpt,
            optional,
          }),
        );
      }
    }
    return records;
  }
}
