/**
 * Internet Archive item resolver.
 *
 * Archive.org links reaching the hunter are frequently wrong in one of three
 * ways: the item identifier does not exist at all (invented by a model), the
 * item exists but the conventional `<identifier>_djvu.txt` OCR file does not,
 * or the link points at a viewer/details page that is not downloadable.
 *
 * This module answers one question against the Archive itself: "which file
 * that this item really has should we download?". It never guesses a
 * filename — every URL it returns was listed by the item's own metadata — and
 * it reports a precise reason when no such file exists.
 *
 * All lookups go through archive.org only (host-pinned, robots-checked,
 * rate-limited to the source's configured request rate).
 */

import { robotsAllowsUrl } from "./robots.js";

export const ARCHIVE_HOST = "archive.org";

/** User agent used when no caller supplies one. */
const DEFAULT_AGENT =
  "ReligiousMythologyResourceHunter/0.2 (archive item resolver; rights-aware research collector)";

/** Conservative default matching the Internet Archive registry entry. */
const DEFAULT_REQUESTS_PER_SECOND = 0.25;

export type ArchiveFailureReason =
  | "not_an_archive_url"
  | "no_identifier"
  | "item_not_found"
  | "item_restricted"
  | "no_text_file"
  | "no_confident_match"
  | "lookup_failed";

/** Plain-language explanation shown to editors for each failure reason. */
export const ARCHIVE_FAILURE_MESSAGES: Record<ArchiveFailureReason, string> = {
  not_an_archive_url: "This link is not an archive.org link, so it cannot be repaired here.",
  no_identifier: "No Internet Archive item identifier could be read from this link.",
  item_not_found: "The Internet Archive has no item with this identifier.",
  item_restricted:
    "The Internet Archive item is lending-restricted or dark: its text files are not downloadable.",
  no_text_file: "The Internet Archive item has no downloadable text file.",
  no_confident_match:
    "Searching the Internet Archive catalog by title and author found no confident match.",
  lookup_failed: "The Internet Archive could not be reached to check this item.",
};

/** A file listed by the Archive's item metadata endpoint. */
interface ArchiveFileEntry {
  name?: string;
  format?: string;
  size?: string | number;
  private?: string | boolean;
  source?: string;
}

/** Licence/catalog metadata copied from the resolved item itself. */
export interface ArchiveItemMetadata {
  identifier: string;
  title: string | null;
  creator: string | null;
  date: string | null;
  year: number | null;
  language: string | null;
  licenseUrl: string | null;
  possibleCopyrightStatus: string | null;
}

export interface ArchiveResolution {
  ok: true;
  identifier: string;
  /** Authorized /download/ URL of a file the item really has (encoded). */
  downloadUrl: string;
  /** The item's human-facing page on the Archive. */
  itemUrl: string;
  fileName: string;
  /** Candidate `format` value for the chosen file. */
  format: "txt" | "epub" | "pdf" | "html" | "xml";
  /** True when the identifier was recovered through a catalog search. */
  viaSearch: boolean;
  item: ArchiveItemMetadata;
}

export interface ArchiveResolutionFailure {
  ok: false;
  reason: ArchiveFailureReason;
  detail: string;
  /** Identifier we tried, when one could be read from the URL. */
  identifier: string | null;
  /** Item page for the identifier we tried, when there is one. */
  itemUrl: string | null;
}

export type ArchiveResolveResult = ArchiveResolution | ArchiveResolutionFailure;

export interface ArchiveLookupOptions {
  fetchImpl?: typeof fetch;
  userAgent?: string;
  /** Source's configured rate limit (requests per second). */
  requestsPerSecond?: number;
  /** Skip files bigger than this (policy.maximum_file_bytes). */
  maxBytes?: number;
}

// ---------------------------------------------------------------------------
// Rate limiting (shared across every caller in the process)
// ---------------------------------------------------------------------------

let lastArchiveRequest = 0;

async function throttle(requestsPerSecond: number): Promise<void> {
  const interval = 1000 / (requestsPerSecond > 0 ? requestsPerSecond : DEFAULT_REQUESTS_PER_SECOND);
  const now = performance.now();
  const remaining = interval - (now - lastArchiveRequest);
  if (lastArchiveRequest > 0 && remaining > 0) {
    await new Promise((resolve) => setTimeout(resolve, Math.min(remaining, 60_000)));
  }
  lastArchiveRequest = performance.now();
}

// ---------------------------------------------------------------------------
// URL parsing
// ---------------------------------------------------------------------------

/** True when `url` is an https archive.org URL. */
export function isArchiveUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    const host = parsed.hostname.toLowerCase();
    return host === ARCHIVE_HOST || host.endsWith("." + ARCHIVE_HOST);
  } catch {
    return false;
  }
}

/**
 * Read the item identifier out of any archive.org URL shape the hunter meets:
 * `/details/<id>`, `/details/<id>/page/n7/mode/2up`, `/download/<id>/<file>`,
 * `/stream/<id>/...`, `/read/<id>`, `/embed/<id>`, `/metadata/<id>`,
 * `/compress/<id>`, `/serve/<id>/...` and the regional node form
 * `/<n>/items/<id>/<file>`. Returns null when there is no identifier.
 */
export function archiveIdentifierFromUrl(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const segments = parsed.pathname.split("/").filter(Boolean).map(decodeSegment);
  if (segments.length === 0) return null;
  const itemsIndex = segments.indexOf("items");
  if (itemsIndex >= 0 && segments[itemsIndex + 1]) {
    return segments[itemsIndex + 1];
  }
  const PATHS = new Set([
    "details",
    "download",
    "stream",
    "read",
    "embed",
    "metadata",
    "compress",
    "serve",
    "fullscreen",
  ]);
  if (PATHS.has(segments[0]) && segments[1]) {
    return segments[1];
  }
  return null;
}

function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/** The Archive's own item page for an identifier. */
export function archiveItemUrl(identifier: string): string {
  return `https://archive.org/details/${encodeURIComponent(identifier)}`;
}

/**
 * Authorized download URL for one file of an item. Real Archive filenames
 * contain spaces, ampersands and apostrophes, so every component is encoded —
 * the result still starts with `/download/`, satisfying the source's allowed
 * path prefix.
 */
export function archiveDownloadUrl(identifier: string, fileName: string): string {
  return `https://archive.org/download/${encodeURIComponent(identifier)}/${encodeURIComponent(
    fileName,
  )}`;
}

// ---------------------------------------------------------------------------
// File selection
// ---------------------------------------------------------------------------

/**
 * Derivative and packaging files that are never a readable edition:
 * catalog sidecars, coordinate dumps, compressed blobs and DRM containers.
 */
const EXCLUDED_SUFFIXES = [
  "_meta.xml",
  "_files.xml",
  "_marc.xml",
  "_metasource.xml",
  "_scandata.xml",
  "_dc.xml",
  "_djvu.xml",
  "_events.xml",
  "_reviews.xml",
  "_page_numbers.json",
  "_hocr.html",
  "_chocr.html",
  "_lcp.epub",
  "_encrypted.pdf",
  "_archive.torrent",
  ".gz",
  ".zip",
  ".tar",
  ".sqlite",
];

/** Preference order: plain OCR text first, then the other formats we extract. */
const FORMAT_PREFERENCE: { extensions: string[]; format: ArchiveResolution["format"] }[] = [
  { extensions: [".txt", ".text"], format: "txt" },
  { extensions: [".epub"], format: "epub" },
  { extensions: [".pdf"], format: "pdf" },
  { extensions: [".html", ".htm"], format: "html" },
  { extensions: [".xml"], format: "xml" },
];

interface ChosenFile {
  name: string;
  format: ArchiveResolution["format"];
  rank: number;
  size: number;
}

function isPrivate(file: ArchiveFileEntry): boolean {
  return file.private === true || String(file.private ?? "").toLowerCase() === "true";
}

/**
 * Pick the best readable file an item actually has. Returns null when the item
 * lists no usable text file; `restrictedOnly` is true when the only usable
 * files are marked private (lending-restricted items).
 */
export function selectArchiveFile(
  files: ArchiveFileEntry[],
  options: { maxBytes?: number } = {},
): { file: ChosenFile | null; restrictedOnly: boolean } {
  let best: ChosenFile | null = null;
  let restrictedOnly = false;
  for (const entry of files) {
    const name = String(entry.name ?? "");
    if (!name) continue;
    const lower = name.toLowerCase();
    if (EXCLUDED_SUFFIXES.some((suffix) => lower.endsWith(suffix))) continue;
    const match = FORMAT_PREFERENCE.findIndex((pref) =>
      pref.extensions.some((ext) => lower.endsWith(ext)),
    );
    if (match === -1) continue;
    if (isPrivate(entry)) {
      restrictedOnly = true;
      continue;
    }
    const size = Number(entry.size ?? 0) || 0;
    if (options.maxBytes && size > options.maxBytes) continue;
    const chosen: ChosenFile = {
      name,
      format: FORMAT_PREFERENCE[match].format,
      rank: match,
      size,
    };
    if (!best || chosen.rank < best.rank || (chosen.rank === best.rank && chosen.size > best.size)) {
      best = chosen;
    }
  }
  return { file: best, restrictedOnly: restrictedOnly && best === null };
}

// ---------------------------------------------------------------------------
// Archive HTTP access (host-pinned, robots-checked, rate-limited)
// ---------------------------------------------------------------------------

async function fetchArchiveJson(
  url: string,
  options: ArchiveLookupOptions,
): Promise<Record<string, unknown>> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const userAgent = options.userAgent ?? DEFAULT_AGENT;
  let current = url;
  for (let hop = 0; hop < 4; hop += 1) {
    if (!isArchiveUrl(current)) {
      throw new Error(`Archive lookup left archive.org: ${current}`);
    }
    const robots = await robotsAllowsUrl(current, userAgent, { fetchImpl });
    if (!robots.allowed) {
      throw new Error(`robots policy disallows the Archive lookup: ${robots.reason}`);
    }
    await throttle(options.requestsPerSecond ?? DEFAULT_REQUESTS_PER_SECOND);
    const response = await fetchImpl(current, {
      headers: { "User-Agent": userAgent, Accept: "application/json" },
      redirect: "manual",
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new Error(`redirect without location (${response.status})`);
      current = new URL(location, current).toString();
      continue;
    }
    if (!response.ok) {
      throw new Error(`Archive lookup failed (${response.status})`);
    }
    const value = (await response.json()) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("Archive lookup returned an unexpected payload");
    }
    return value as Record<string, unknown>;
  }
  throw new Error("too many redirects during the Archive lookup");
}

function itemMetadata(identifier: string, doc: Record<string, unknown>): ArchiveItemMetadata {
  const meta = (doc.metadata ?? {}) as Record<string, unknown>;
  const first = (value: unknown): string | null => {
    if (Array.isArray(value)) return value.length > 0 ? String(value[0]) : null;
    if (value === null || value === undefined || value === "") return null;
    return String(value);
  };
  const date = first(meta.date) ?? first(meta.year) ?? null;
  const yearMatch = date ? date.match(/\d{4}/) : null;
  return {
    identifier: first(meta.identifier) ?? identifier,
    title: first(meta.title),
    creator: first(meta.creator),
    date,
    year: yearMatch ? Number(yearMatch[0]) : null,
    language: first(meta.language),
    licenseUrl: first(meta.licenseurl),
    possibleCopyrightStatus: first(meta["possible-copyright-status"]),
  };
}

function failure(
  reason: ArchiveFailureReason,
  identifier: string | null,
  extra?: string,
): ArchiveResolutionFailure {
  const base = ARCHIVE_FAILURE_MESSAGES[reason];
  return {
    ok: false,
    reason,
    detail: extra ? `${base} ${extra}` : base,
    identifier,
    itemUrl: identifier ? archiveItemUrl(identifier) : null,
  };
}

/**
 * Look one item up through the Archive's item-metadata endpoint and return the
 * download URL of the best readable file it really has.
 */
export async function resolveArchiveItem(
  identifier: string,
  options: ArchiveLookupOptions = {},
  meta: { viaSearch?: boolean } = {},
): Promise<ArchiveResolveResult> {
  const id = identifier.trim();
  if (!id) return failure("no_identifier", null);
  let doc: Record<string, unknown>;
  try {
    doc = await fetchArchiveJson(
      `https://archive.org/metadata/${encodeURIComponent(id)}`,
      options,
    );
  } catch (e) {
    return failure("lookup_failed", id, e instanceof Error ? e.message : String(e));
  }
  // A missing item returns an empty object, not a 404.
  if (Object.keys(doc).length === 0 || !doc.metadata) {
    return failure("item_not_found", id, `Identifier: ${id}.`);
  }
  const item = itemMetadata(id, doc);
  const metaBlock = (doc.metadata ?? {}) as Record<string, unknown>;
  if (doc.is_dark === true || metaBlock.is_dark === true) {
    return failure("item_restricted", id, "The item is dark (withdrawn from public access).");
  }
  const files = Array.isArray(doc.files) ? (doc.files as ArchiveFileEntry[]) : [];
  const { file, restrictedOnly } = selectArchiveFile(files, { maxBytes: options.maxBytes });
  if (!file) {
    const lendingRestricted =
      restrictedOnly || String(metaBlock["access-restricted-item"] ?? "").toLowerCase() === "true";
    return lendingRestricted
      ? failure("item_restricted", id, "Its text files are marked private (borrow only).")
      : failure("no_text_file", id, `Identifier: ${id}.`);
  }
  return {
    ok: true,
    identifier: id,
    downloadUrl: archiveDownloadUrl(id, file.name),
    itemUrl: archiveItemUrl(id),
    fileName: file.name,
    format: file.format,
    viaSearch: meta.viaSearch === true,
    item,
  };
}

// ---------------------------------------------------------------------------
// Catalog search fallback
// ---------------------------------------------------------------------------

const STOPWORDS = new Set([
  "the", "a", "an", "of", "and", "or", "on", "in", "to", "with", "from", "for",
  "by", "its", "his", "her", "their", "de", "la", "le", "el", "vol",
  "edition", "trans", "translated", "translation",
]);

function tokens(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter((token) => token && !STOPWORDS.has(token));
}

/** Dice coefficient over token sets (0 when either side is empty). */
export function tokenSimilarity(left: string | null, right: string | null): number {
  const a = new Set(tokens(left));
  const b = new Set(tokens(right));
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  a.forEach((token) => {
    if (b.has(token)) shared += 1;
  });
  return (2 * shared) / (a.size + b.size);
}

export interface ArchiveSearchTarget {
  title: string | null;
  author?: string | null;
  year?: number | null;
}

interface SearchDoc {
  identifier: string;
  title: string | null;
  creator: string | null;
  year: number | null;
  volume: number | null;
}

/**
 * Length of the longest run of tokens the two titles share in the same order,
 * and how many of those tokens are distinctive (not short filler words).
 *
 * Catalog titles carry subtitles the candidate title never has ("… : with
 * fragments of the Jerusalem targum"), and candidate titles carry volume and
 * format qualifiers the catalog never has. Set overlap punishes both; a long
 * shared run of the work's actual name survives them.
 */
function longestTitleRun(left: string | null, right: string | null): { length: number; distinctive: number } {
  const a = tokens(left);
  const b = tokens(right);
  let best = { length: 0, distinctive: 0 };
  for (let i = 0; i < a.length; i += 1) {
    for (let j = 0; j < b.length; j += 1) {
      let run = 0;
      let distinctive = 0;
      while (i + run < a.length && j + run < b.length && a[i + run] === b[j + run]) {
        if (a[i + run].length >= 5) distinctive += 1;
        run += 1;
      }
      if (run > best.length) best = { length: run, distinctive };
    }
  }
  return best;
}

/** A shared run this long, carrying real words, names one and the same work. */
function namesSameWork(left: string | null, right: string | null): boolean {
  const run = longestTitleRun(left, right);
  return run.length >= 4 && run.distinctive >= 2;
}

const ROMAN: Record<string, number> = {
  i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10,
};

/** Volume/part number stated in a title, if any ("Vol. II", "part 3", "v.2"). */
function volumeNumber(title: string | null): number | null {
  if (!title) return null;
  const match = /\b(?:vol|volume|v|pt|part|bk|book)\.?\s*([0-9]{1,2}|[ivx]{1,4})\b/i.exec(title);
  if (!match) return null;
  const raw = match[1].toLowerCase();
  if (/^[0-9]+$/.test(raw)) return Number(raw);
  return ROMAN[raw] ?? null;
}

/**
 * Which volume a catalog result is: the item's own volume field first, then a
 * volume stated in its title, then the Archive's `…0002…` identifier habit.
 */
function docVolumeNumber(doc: SearchDoc): number | null {
  if (doc.volume !== null && doc.volume > 0) return doc.volume;
  const fromTitle = volumeNumber(doc.title);
  if (fromTitle !== null) return fromTitle;
  const match = /[a-z](\d{4})[a-z_]/.exec(doc.identifier);
  if (!match) return null;
  const parsed = Number(match[1]);
  return parsed >= 1 && parsed <= 20 ? parsed : null;
}

/**
 * Score one catalog result against what we were looking for: title similarity
 * dominates, with small adjustments for a matching author and year.
 */
export function scoreArchiveCandidate(target: ArchiveSearchTarget, doc: SearchDoc): number {
  const overlap = tokenSimilarity(target.title, doc.title);
  const run = longestTitleRun(target.title, doc.title);
  // A long shared run is strong evidence on its own, but never as strong as a
  // title that matches outright.
  const runScore = run.length >= 4 && run.distinctive >= 2 ? 0.8 : 0;
  const titleScore = Math.max(overlap, runScore);
  let score = titleScore * 0.85;
  const authorScore = tokenSimilarity(target.author ?? null, doc.creator);
  if (target.author && doc.creator) {
    score += authorScore * 0.15;
  } else {
    // Nothing to compare: keep the title's own weight instead of penalising.
    score += titleScore * 0.15 * 0.5;
  }
  if (target.year && doc.year) {
    if (target.year === doc.year) score += 0.1;
    else if (Math.abs(target.year - doc.year) > 5) score -= 0.1;
  }
  // Volume II of a work is not volume I of it, however alike the titles read.
  const wantedVolume = volumeNumber(target.title);
  if (wantedVolume !== null) {
    const docVolume = docVolumeNumber(doc);
    if (docVolume === null) score -= 0.05; // volume unstated: mildly weaker evidence
    else if (docVolume === wantedVolume) score += 0.1;
    else score -= 0.35;
  }
  return Math.max(0, Math.min(1, score));
}

/** Minimum score for a result to be considered a match at all. */
const ACCEPT_SCORE = 0.62;
/** A rival within this distance of the leader makes the result ambiguous… */
const RIVAL_MARGIN = 0.05;
/** …unless the two titles are near-identical (different scans of one work). */
const SAME_WORK_SIMILARITY = 0.7;
/** Words too generic to narrow a catalog search on their own. */
const GENERIC_TITLE_WORDS = new Set([
  "text", "texts", "complete", "english", "original", "full", "works", "work",
  "new", "old", "part", "book", "books", "volume", "volumes", "selected",
]);

/**
 * Search the Archive catalog by title/author and return the identifier of a
 * clearly confident match. Two comparably-scored results for *different* works
 * are refused as ambiguous; two scans of the same work are not.
 */
export async function searchArchiveForItem(
  target: ArchiveSearchTarget,
  options: ArchiveLookupOptions = {},
): Promise<{ ok: true; identifier: string; score: number } | ArchiveResolutionFailure> {
  const titleTokens = Array.from(new Set(tokens(target.title)));
  if (titleTokens.length === 0) {
    return failure("no_confident_match", null, "The candidate has no usable title to search for.");
  }
  const authorTokens = Array.from(new Set(tokens(target.author))).slice(0, 4);
  // The catalog ANDs the words inside title:(…). A candidate title carrying
  // qualifiers the catalog never uses ("complete text", "Vol. II") therefore
  // matches nothing, so fall back to its most distinctive words.
  const queries = [
    `title:(${titleTokens.join(" ")})` +
      (authorTokens.length > 0 ? ` AND creator:(${authorTokens.join(" ")})` : "") +
      " AND mediatype:texts",
  ];
  const distinctive = titleTokens
    .filter((token) => token.length >= 4 && !GENERIC_TITLE_WORDS.has(token))
    .slice(0, 4);
  const looser = `title:(${distinctive.join(" ")}) AND mediatype:texts`;
  if (distinctive.length >= 1 && !queries.includes(looser)) queries.push(looser);

  const rows: Record<string, unknown>[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < queries.length; i += 1) {
    const searchUrl =
      "https://archive.org/advancedsearch.php?output=json&rows=10" +
      "&fl%5B%5D=identifier&fl%5B%5D=title&fl%5B%5D=creator&fl%5B%5D=year&fl%5B%5D=volume" +
      "&fl%5B%5D=licenseurl" +
      "&q=" +
      encodeURIComponent(queries[i]);
    let doc: Record<string, unknown>;
    try {
      doc = await fetchArchiveJson(searchUrl, options);
    } catch (e) {
      if (rows.length === 0 && i === queries.length - 1) {
        return failure("lookup_failed", null, e instanceof Error ? e.message : String(e));
      }
      continue;
    }
    const found =
      (((doc.response as Record<string, unknown>) ?? {}).docs as Record<string, unknown>[]) ?? [];
    found.forEach((row) => {
      const id = row.identifier ? String(row.identifier) : "";
      if (!id || seen.has(id)) return;
      seen.add(id);
      rows.push(row);
    });
  }
  const scored = rows
    .filter((row) => row.identifier)
    .map((row) => {
      const parsed: SearchDoc = {
        identifier: String(row.identifier),
        title: row.title ? String(Array.isArray(row.title) ? row.title[0] : row.title) : null,
        creator: row.creator
          ? String(Array.isArray(row.creator) ? row.creator[0] : row.creator)
          : null,
        year: row.year ? Number(Array.isArray(row.year) ? row.year[0] : row.year) || null : null,
        volume: row.volume
          ? Number(Array.isArray(row.volume) ? row.volume[0] : row.volume) || null
          : null,
      };
      return { doc: parsed, score: scoreArchiveCandidate(target, parsed) };
    })
    .sort((a, b) => b.score - a.score);

  const best = scored[0];
  if (!best || best.score < ACCEPT_SCORE) {
    return failure(
      "no_confident_match",
      null,
      `Best catalog result scored ${(best?.score ?? 0).toFixed(2)}, below the confidence threshold.`,
    );
  }
  const rival = scored[1];
  if (
    rival &&
    best.score - rival.score < RIVAL_MARGIN &&
    tokenSimilarity(best.doc.title, rival.doc.title) < SAME_WORK_SIMILARITY &&
    !namesSameWork(best.doc.title, rival.doc.title)
  ) {
    return failure(
      "no_confident_match",
      null,
      `Two different works matched equally well ("${best.doc.title}" and "${rival.doc.title}"); refusing to guess.`,
    );
  }
  return { ok: true, identifier: best.doc.identifier, score: best.score };
}

// ---------------------------------------------------------------------------
// The public entry point
// ---------------------------------------------------------------------------

/**
 * Resolve any archive.org link into a download URL that really exists.
 *
 * 1. read the identifier out of the link and check it against the Archive;
 * 2. when the item does not exist (or has no readable file), search the
 *    catalog by title/author and resolve a confidently matching item instead.
 *
 * Never guesses a filename and never returns an unverified URL.
 */
/**
 * Words an Archive identifier spells out, used as a last-resort search title.
 * Scan identifiers ("targumsofonkelo02etheuoft") are unsplittable runs of
 * letters and yield nothing usable; hyphenated ones read as a title.
 */
function titleFromIdentifier(identifier: string): string | null {
  const words = identifier
    .replace(/[_-]+/g, " ")
    .replace(/\b\d{2,}\b/g, " ")
    .trim()
    .split(/\s+/)
    .filter((word) => word.length >= 2);
  return words.length >= 2 ? words.join(" ") : null;
}

export async function repairArchiveUrl(
  target: { url?: string | null; title?: string | null; author?: string | null; year?: number | null },
  options: ArchiveLookupOptions = {},
): Promise<ArchiveResolveResult> {
  const url = target.url ? String(target.url) : "";
  if (url && !isArchiveUrl(url)) {
    return failure("not_an_archive_url", null);
  }
  const identifier = url ? archiveIdentifierFromUrl(url) : null;
  let direct: ArchiveResolveResult | null = null;
  if (identifier) {
    direct = await resolveArchiveItem(identifier, options);
    if (direct.ok) return direct;
    // Restricted or unreachable items are not recoverable by searching for a
    // different scan — report exactly what the Archive said.
    if (direct.reason === "item_restricted" || direct.reason === "lookup_failed") {
      return direct;
    }
  }
  // A blocker with no candidate behind it has no title to search on; the
  // identifier itself usually spells the work out ("words-of-christ-by-…").
  const searchTitle =
    (target.title ?? "").trim() || (identifier ? titleFromIdentifier(identifier) : null);
  const search = await searchArchiveForItem(
    { title: searchTitle, author: target.author ?? null, year: target.year ?? null },
    options,
  );
  if (!search.ok) {
    // Keep the original identifier's context when we had one.
    return {
      ...search,
      identifier: identifier ?? search.identifier,
      itemUrl: identifier ? archiveItemUrl(identifier) : search.itemUrl,
      detail: direct
        ? `${direct.detail} ${search.detail}`
        : search.detail,
    };
  }
  const resolved = await resolveArchiveItem(search.identifier, options, { viaSearch: true });
  if (!resolved.ok && direct) {
    return { ...resolved, detail: `${direct.detail} ${resolved.detail}` };
  }
  return resolved;
}
