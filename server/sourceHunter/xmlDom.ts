/**
 * Minimal XML DOM built on fast-xml-parser that mimics the subset of
 * Python's xml.etree.ElementTree used by the TEI and OAI-DC adapters:
 * local-name access, document-order `iter()`, `itertext()`, and attributes.
 */

import { XMLParser } from "fast-xml-parser";

/** A parsed XML element node. */
export interface XmlElement {
  /** Fully-qualified tag (may include a `{namespace}` prefix like ElementTree). */
  tag: string;
  attrib: Record<string, string>;
  children: XmlElement[];
  /** Ordered child nodes: elements interleaved with text fragments. */
  content: Array<XmlElement | string>;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  preserveOrder: true,
  trimValues: false,
  parseTagValue: false,
  parseAttributeValue: false,
  processEntities: true,
  htmlEntities: true,
  ignoreDeclaration: true,
  ignorePiTags: true,
});

interface RawNode {
  [key: string]: unknown;
  ":@"?: Record<string, string>;
}

// ElementTree represents namespaced names as "{uri}local". fast-xml-parser gives
// us prefixed names (e.g. "oai_dc:dc" or "dc:title"). For the adapters we only
// need the local name, so we keep the raw tag but expose a localName helper that
// splits on both "}" and ":".

function buildElement(name: string, node: RawNode): XmlElement {
  const attrib: Record<string, string> = {};
  const rawAttrs = node[":@"];
  if (rawAttrs && typeof rawAttrs === "object") {
    for (const [k, v] of Object.entries(rawAttrs)) {
      const key = k.startsWith("@_") ? k.slice(2) : k;
      attrib[key] = String(v);
    }
  }
  const children: XmlElement[] = [];
  const content: Array<XmlElement | string> = [];
  const kids = node[name];
  if (Array.isArray(kids)) {
    for (const kid of kids as RawNode[]) {
      if ("#text" in kid) {
        content.push(String(kid["#text"]));
        continue;
      }
      const childName = Object.keys(kid).find((key) => key !== ":@");
      if (childName === undefined) {
        continue;
      }
      const childEl = buildElement(childName, kid);
      children.push(childEl);
      content.push(childEl);
    }
  }
  return { tag: name, attrib, children, content };
}

/** Parse an XML payload into a single root element. */
export function parseXml(payload: Buffer | string): XmlElement {
  const text = typeof payload === "string" ? payload : payload.toString("utf-8");
  const parsed = parser.parse(text) as RawNode[];
  for (const node of parsed) {
    const name = Object.keys(node).find((key) => key !== ":@");
    if (name !== undefined) {
      return buildElement(name, node);
    }
  }
  throw new Error("XML document has no root element");
}

/** Local name (drops `{ns}` and `prefix:` parts) matching ElementTree `_local`. */
export function localName(element: XmlElement): string {
  const noNs = element.tag.includes("}") ? element.tag.split("}").pop()! : element.tag;
  return noNs.includes(":") ? noNs.split(":").pop()! : noNs;
}

/** Elements and all descendants in document order (like `.iter()`), as an array. */
export function iterElements(element: XmlElement): XmlElement[] {
  const out: XmlElement[] = [element];
  for (let i = 0; i < element.children.length; i += 1) {
    const nested = iterElements(element.children[i]);
    for (let j = 0; j < nested.length; j += 1) {
      out.push(nested[j]);
    }
  }
  return out;
}

/** Concatenated text of an element and its descendants (like `.itertext()`). */
export function itertext(element: XmlElement): string {
  let out = "";
  for (let i = 0; i < element.content.length; i += 1) {
    const item = element.content[i];
    if (typeof item === "string") {
      out += item;
    } else {
      out += itertext(item);
    }
  }
  return out;
}
