/**
 * Hunting cycles: autonomous source discovery + automatic collection.
 *
 * A cycle (launched by an editor) does four things:
 *   1. crawls the trusted full-text source registries for candidate editions
 *      matching the cycle scope,
 *   2. asks the AI (OpenAI) for additional leads, validated against the
 *      candidate schema and mapped onto registered sources,
 *   3. automatically plans + downloads everything retrievable — cleared texts
 *      to the public partition, everything else to the locked partition,
 *   4. records every blocker (robots, auth walls, rights locks, fetch
 *      failures, unregistered hosts...) in a persistent ledger.
 *
 * The engine is storage-agnostic: all persistence goes through a CycleStore,
 * so tests can run it fully in memory.
 */

import OpenAI from "openai";
import { promises as fs } from "node:fs";
import * as path from "node:path";
import { slug } from "./sourceHunter/normalization";
import { collectFulltexts, type RobotsCheck } from "./sourceHunter/fulltext";
import { validateCandidate, FullTextValidationError } from "./sourceHunter/fulltextValidation";
import { robotsAllowsUrl } from "./sourceHunter/robots";
import {
  isArchiveUrl,
  repairArchiveUrl,
  resolveArchiveItem,
  type ArchiveResolution,
} from "./sourceHunter/archiveResolver";
import {
  applyArchiveResolution,
  isRepairableArchiveFailure,
  repairArchiveDownload,
} from "./sourceHunter/archiveRepair";
import type { Candidate, Policy } from "./sourceHunter/rights";
import { cleanErrorText } from "./errorText";

/** Max extra download passes when the preferred edition is blocked. */
const MAX_FALLBACK_PASSES = 3;

/** download_status values that mean a file was actually fetched. */
const FETCHED_DOWNLOAD_STATUSES = new Set(["downloaded", "already_present"]);

export const CYCLE_USER_AGENT =
  "ReligiousMythologyResourceHunter/0.2 (hunting cycle; rights-aware research collector)";

export interface BlockerInput {
  sourceId?: string | null;
  url?: string | null;
  reason: string;
  detail?: string | null;
  workId?: string | null;
  editionId?: string | null;
  /** Download URL confirmed against the source (supersedes `url`). */
  resolvedUrl?: string | null;
  /** Human-facing page for the item on the source. */
  itemUrl?: string | null;
  /** Automatic repair state: "in_progress" | "repaired" | "not_repairable". */
  repairState?: string | null;
  /** Plain-language outcome of the automatic repair attempt. */
  repairDetail?: string | null;
}

export interface CycleStore {
  /** edition_ids already present, to avoid duplicate candidates. */
  existingEditionIds(): Promise<Set<string>>;
  insertCandidate(candidate: Candidate): Promise<void>;
  /**
   * Optional: persist a corrected candidate (same edition_id, new text_url or
   * rights evidence) after an automatic repair. Stores that omit it simply
   * keep the original candidate row.
   */
  updateCandidate?(candidate: Candidate): Promise<void>;
  addBlocker(blocker: BlockerInput): Promise<void>;
  /** Live progress snapshot (persisted so the UI can poll). */
  updateProgress(progress: Record<string, unknown>): Promise<void>;
  /** Mirror downloaded corpus records into the corpus table. */
  mirrorCorpusRecords(records: Record<string, unknown>[]): Promise<void>;
  /**
   * Optional persistent cache of AI screening verdicts, keyed by
   * screenCacheKey(title). Stores that implement both methods make screening
   * verdicts survive across cycles so recurring leads cost nothing.
   */
  getScreenVerdicts?(keys: string[]): Promise<Map<string, AiScreenVerdict>>;
  saveScreenVerdicts?(
    entries: { key: string; title: string; verdict: AiScreenVerdict }[],
  ): Promise<void>;
}

export interface CycleScope {
  query: string;
  limit?: number;
  useAi?: boolean;
  /** Optional world region the editor scoped this cycle to (map launches). */
  region?: { id: string; label: string };
  /** True when `region` was inferred from text rather than editor-chosen. */
  regionInferred?: boolean;
  /** Name of the uploaded corpus list this cycle was launched from. */
  corpusList?: string;
  /**
   * Set when the cycle hunts ONE specific work from an uploaded corpus list.
   * Discovery is told to find editions of exactly this work: complete and in
   * English when possible, otherwise in one of `preferredLanguages`.
   */
  targetWork?: { title: string; author?: string | null; language?: string | null };
  /** Fallback languages (ISO 639), most reliably AI-translatable first. */
  preferredLanguages?: string[];
}

export interface DiscoveredLead {
  candidate: Candidate;
  origin: "registry_crawl" | "ai_search";
  originDetail: string;
}

export interface CycleSummary {
  scope: CycleScope;
  discovered: number;
  created: number;
  duplicates: number;
  invalid: number;
  /** Leads skipped because they look like secondary literature, not original texts. */
  secondary: number;
  downloaded_public: number;
  downloaded_locked: number;
  metadata_only: number;
  failed: number;
  blockers: number;
  entries: Record<string, unknown>[];
  discovery: { origin: string; originDetail: string; edition_id: string; title: string }[];
}

export interface CycleOptions {
  scope: CycleScope;
  policy: Policy;
  registry: Record<string, unknown>;
  corpusRoot: string;
  store: CycleStore;
  fetchImpl?: typeof fetch;
  robotsCheck?: RobotsCheck;
  /** Override AI lead discovery (tests). Return raw leads. */
  aiDiscover?: (scope: CycleScope, registrySources: Record<string, unknown>[]) => Promise<AiLead[]>;
  /** Override AI primary/secondary screening (tests). */
  aiScreen?: AiScreen;
  /** Override registry crawling (tests). */
  registryDiscover?: (
    scope: CycleScope,
    registrySources: Record<string, unknown>[],
    report: (blocker: BlockerInput) => Promise<void>,
  ) => Promise<DiscoveredLead[]>;
  /**
   * Download selection: "all" (default — every authorized new candidate) or
   * "preferred" (planCandidates picks English first, then AI-translatable
   * fallbacks — used by corpus-list cycles).
   */
  selectionMode?: "preferred" | "all";
  /** Extra leads injected ahead of discovery (e.g. a URL given in a corpus list). */
  extraLeads?: DiscoveredLead[];
  /**
   * Directory for on-disk discovery caches (Gutenberg catalogue, Perseus tree
   * listings). Defaults to `<cwd>/data/hunter-cache`. Tests should pass a
   * temp dir so cached responses never leak across test runs.
   */
  cacheDir?: string;
  /**
   * Fixed inter-request delay (ms) applied to every HTTP call within automated
   * discovery, overriding the per-source `requests_per_second` registry value.
   * Set to 0 in tests to bypass rate-limiting. Omit to let each source's
   * registry setting determine the delay (1000 / requests_per_second).
   */
  discoveryDelayMs?: number;
}

export interface AiLead {
  title: string;
  author?: string | null;
  url: string;
  language?: string;
  rights_statement?: string;
  license_url?: string | null;
  confidence?: string;
}

function sources(registry: Record<string, unknown>): Record<string, unknown>[] {
  return (registry.sources as Record<string, unknown>[]) ?? [];
}

function hostAllowed(url: string, allowedHosts: string[]): boolean {
  let host: string;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    host = parsed.hostname.toLowerCase();
  } catch {
    return false;
  }
  return allowedHosts.some((h) => host === h.toLowerCase() || host.endsWith("." + h.toLowerCase()));
}

/**
 * Discovery fetch pinned to `allowedHosts`. Redirects are followed manually so
 * every hop is re-validated against the host allow-list AND robots.txt —
 * a redirect can never take discovery traffic off the trusted hosts.
 */
export async function fetchJson(
  url: string,
  allowedHosts: string[],
  fetchImpl: typeof fetch,
): Promise<Record<string, unknown>> {
  let current = url;
  for (let hop = 0; hop < 5; hop += 1) {
    if (!hostAllowed(current, allowedHosts)) {
      throw new Error(`discovery URL left the allowed hosts: ${current}`);
    }
    const robots = await robotsAllowsUrl(current, CYCLE_USER_AGENT, { fetchImpl });
    if (!robots.allowed) {
      throw new Error(`robots_disallowed: ${robots.reason}`);
    }
    const response = await fetchImpl(current, {
      headers: { "User-Agent": CYCLE_USER_AGENT, Accept: "application/json" },
      redirect: "manual",
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new Error(`redirect without location (${response.status})`);
      current = new URL(location, current).toString();
      continue;
    }
    if (!response.ok) {
      throw new Error(`discovery fetch failed (${response.status})`);
    }
    return (await response.json()) as Record<string, unknown>;
  }
  throw new Error("too many redirects during discovery fetch");
}

/**
 * Like fetchJson but returns the raw text body. Used for HTML index pages
 * (Sacred Text Archive) and CSV catalogue feeds (Gutenberg). Applies the same
 * host allow-list, robots-check and redirect guard as fetchJson.
 */
export async function fetchText(
  url: string,
  allowedHosts: string[],
  fetchImpl: typeof fetch,
): Promise<string> {
  let current = url;
  for (let hop = 0; hop < 5; hop += 1) {
    if (!hostAllowed(current, allowedHosts)) {
      throw new Error(`discovery URL left the allowed hosts: ${current}`);
    }
    const robots = await robotsAllowsUrl(current, CYCLE_USER_AGENT, { fetchImpl });
    if (!robots.allowed) {
      throw new Error(`robots_disallowed: ${robots.reason}`);
    }
    const response = await fetchImpl(current, {
      headers: {
        "User-Agent": CYCLE_USER_AGENT,
        Accept: "text/html, text/plain, text/csv, */*",
      },
      redirect: "manual",
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new Error(`redirect without location (${response.status})`);
      current = new URL(location, current).toString();
      continue;
    }
    if (!response.ok) {
      throw new Error(`discovery fetch failed (${response.status})`);
    }
    return await response.text();
  }
  throw new Error("too many redirects during discovery fetch");
}

// ---------------------------------------------------------------------------
// On-disk discovery cache (catalogue feeds, GitHub tree listings)
// ---------------------------------------------------------------------------

interface DiskCacheEntry {
  fetchedAt: number;
  content: string;
}

/**
 * Read a cached text blob from disk if it exists and is younger than
 * `maxAgeMs`. Returns null on any error or expiry.
 */
async function readDiskCache(filePath: string, maxAgeMs: number): Promise<string | null> {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    const entry = JSON.parse(raw) as DiskCacheEntry;
    if (Date.now() - entry.fetchedAt > maxAgeMs) return null;
    return entry.content;
  } catch {
    return null;
  }
}

/**
 * Write a text blob to the on-disk cache. Creates parent directories as
 * needed. Never throws — cache writes are best-effort and must not fail
 * discovery.
 */
async function writeDiskCache(filePath: string, content: string): Promise<void> {
  try {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const entry: DiskCacheEntry = { fetchedAt: Date.now(), content };
    await fs.writeFile(filePath, JSON.stringify(entry), "utf-8");
  } catch {
    // Intentionally swallowed: cache writes are best-effort.
  }
}

// ---------------------------------------------------------------------------
// Registry crawling strategies
// ---------------------------------------------------------------------------

/**
 * Wikisource discovery runs on Wikimedia's public Core REST API
 * (api.wikimedia.org), never on `wikisource.org/w/api.php`: that origin's
 * robots.txt disallows `/w/`, so the robots gate refuses every legacy search
 * and every legacy content fetch. The Core REST API is the officially
 * supported public alternative and is robots-permitted.
 *
 * It serves per-language wikis only — the multilingual `mul` project is not
 * available here — so a language wiki is always chosen explicitly.
 */
export const WIKIMEDIA_API_HOST = "api.wikimedia.org";
const WIKISOURCE_API_BASE = `https://${WIKIMEDIA_API_HOST}/core/v1/wikisource/`;
const DEFAULT_WIKI_LANGUAGE = "en";

/** Language wikis with a real Wikisource we are willing to search. */
const WIKISOURCE_LANGUAGES = new Set([
  "ar", "bn", "cs", "cy", "da", "de", "el", "en", "es", "fa", "fi", "fr", "ga",
  "he", "hi", "hu", "hy", "id", "is", "it", "ja", "ko", "la", "nl", "no", "pl",
  "pt", "ro", "ru", "sa", "sv", "ta", "th", "tr", "uk", "vi", "zh",
]);

/** ISO codes with no wiki of their own, mapped to the wiki that hosts them. */
const WIKISOURCE_LANGUAGE_ALIASES: Record<string, string> = {
  grc: "el", // Ancient Greek texts live on the Greek Wikisource
  non: "is", // Old Norse texts live on the Icelandic Wikisource
  nb: "no",
  nn: "no",
  "pt-br": "pt",
  "zh-hans": "zh",
  "zh-hant": "zh",
};

/** Mythological region -> the language wiki most likely to hold its originals. */
const REGION_WIKI_LANGUAGE: Record<string, string> = {
  japan: "ja",
  china: "zh",
  india: "sa",
  greece: "el",
  rome: "la",
  persia: "fa",
  slavic: "ru",
  norse: "is",
  celtic: "ga",
  mesoamerica: "es",
  andes: "es",
  "southeast-asia": "id",
};

function normalizeWikiLanguage(code: string | null | undefined): string | null {
  if (!code) return null;
  const normalized = String(code).trim().toLowerCase();
  const resolved = WIKISOURCE_LANGUAGE_ALIASES[normalized] ?? normalized.split(/[-_]/)[0];
  return WIKISOURCE_LANGUAGES.has(resolved) ? resolved : null;
}

/** Language implied by the script the query/title is written in, if any. */
function scriptLanguage(text: string): string | null {
  if (/[\u3040-\u30ff]/.test(text)) return "ja"; // kana
  if (/[\uac00-\ud7af]/.test(text)) return "ko"; // hangul
  if (/[\u0400-\u04ff]/.test(text)) return "ru"; // cyrillic
  if (/[\u0590-\u05ff]/.test(text)) return "he";
  if (/[\u0600-\u06ff]/.test(text)) return "ar";
  if (/[\u0370-\u03ff\u1f00-\u1fff]/.test(text)) return "el";
  if (/[\u0900-\u097f]/.test(text)) return "sa"; // devanagari
  if (/[\u4e00-\u9fff]/.test(text)) return "zh"; // Han without kana/hangul
  return null;
}

/**
 * Which Wikisource language wikis to search for a cycle scope: the original
 * language implied by the scope (explicit hint, then script, then region),
 * plus English — which carries the translations — always last.
 */
export function wikisourceWikiLanguages(scope: CycleScope): string[] {
  const regionLanguage = scope.region ? (REGION_WIKI_LANGUAGE[scope.region.id] ?? null) : null;
  let script = scriptLanguage(`${scope.targetWork?.title ?? ""} ${scope.query ?? ""}`);
  // Han characters alone do not distinguish Chinese from Japanese/Korean
  // originals; the region hint breaks the tie when there is one.
  if (script === "zh" && (regionLanguage === "ja" || regionLanguage === "ko")) {
    script = regionLanguage;
  }
  const original =
    normalizeWikiLanguage(scope.targetWork?.language) ??
    normalizeWikiLanguage(script) ??
    normalizeWikiLanguage(regionLanguage);
  return original && original !== DEFAULT_WIKI_LANGUAGE
    ? [original, DEFAULT_WIKI_LANGUAGE]
    : [DEFAULT_WIKI_LANGUAGE];
}

async function discoverWikisource(
  scope: CycleScope,
  source: Record<string, unknown>,
  fetchImpl: typeof fetch,
): Promise<DiscoveredLead[]> {
  const allowedHosts = (source.allowed_hosts as string[]) ?? [WIKIMEDIA_API_HOST];
  const limit = Math.min(scope.limit ?? 10, 25);
  const languages = wikisourceWikiLanguages(scope);
  const perLanguage = Math.max(1, Math.ceil(limit / languages.length));
  const leads: DiscoveredLead[] = [];
  const seen = new Set<string>();
  const failures: string[] = [];

  for (const language of languages) {
    const searchUrl =
      `${WIKISOURCE_API_BASE}${language}/search/page?limit=${perLanguage}&q=` +
      encodeURIComponent(scope.query);
    let doc: Record<string, unknown>;
    try {
      doc = await fetchJson(searchUrl, allowedHosts, fetchImpl);
    } catch (e) {
      // One unreachable wiki must not sink the others; only a total failure
      // is reported as a blocker (below).
      failures.push(e instanceof Error ? e.message : String(e));
      continue;
    }
    const pages = (doc.pages as Record<string, unknown>[]) ?? [];
    for (const page of pages) {
      const title = String(page.title ?? page.key ?? "Untitled");
      // `key` is the URL-safe page key the page endpoint expects.
      const key = String(page.key ?? title);
      const pageId = String(page.id ?? slug(title));
      const editionId = `edition:wikisource-${language}-${pageId}`;
      if (seen.has(editionId)) continue;
      seen.add(editionId);
      const candidate: Candidate = {
        work_id: `work:${slug(title)}`,
        edition_id: editionId,
        title,
        author: null,
        translator: null,
        source_id: String(source.source_id),
        language,
        language_role: "unknown",
        format: "json",
        text_url: `${WIKISOURCE_API_BASE}${language}/page/${encodeURIComponent(key)}`,
        rights: {
          status_claim: "unknown",
          basis: "source_statement",
          statement:
            "Wikisource hosts public-domain and freely licensed texts; this page's licence has not been verified.",
          rights_url: "https://wikisource.org/wiki/Wikisource:Copyright_policy",
        },
        access: { download_allowed: true, requires_auth: false },
      };
      leads.push({
        candidate,
        origin: "registry_crawl" as const,
        originDetail: `Wikisource search (${language}.wikisource): ${title}`,
      });
    }
  }

  if (leads.length === 0 && failures.length > 0) {
    // Keep the first raw message first so the caller can still classify it
    // (e.g. a "robots_disallowed: ..." prefix).
    throw new Error(failures.join(" | "));
  }
  return leads.slice(0, limit);
}

/**
 * Internet Archive discovery.
 *
 * The catalog search gives identifiers, not files. Every hit is confirmed
 * against the item's own file list before it becomes a candidate, so the
 * stored `text_url` always points at a file the item really has (the
 * conventional `<identifier>_djvu.txt` is frequently absent). Items with no
 * downloadable text — dark, lending-restricted, or image-only — are recorded
 * in the ledger instead of being turned into candidates that cannot download.
 */
async function discoverInternetArchive(
  scope: CycleScope,
  source: Record<string, unknown>,
  fetchImpl: typeof fetch,
  report: (blocker: BlockerInput) => Promise<void>,
): Promise<DiscoveredLead[]> {
  const limit = Math.min(scope.limit ?? 10, 25);
  const searchUrl =
    "https://archive.org/advancedsearch.php?output=json&rows=" +
    limit +
    "&fl%5B%5D=identifier&fl%5B%5D=title&fl%5B%5D=creator&fl%5B%5D=language&fl%5B%5D=licenseurl" +
    "&q=" +
    encodeURIComponent(`(${scope.query}) AND mediatype:texts`);
  const doc = await fetchJson(searchUrl, (source.allowed_hosts as string[]) ?? ["archive.org"], fetchImpl);
  const docs =
    (((doc.response as Record<string, unknown>) ?? {}).docs as Record<string, unknown>[]) ?? [];
  const lookupOptions = {
    fetchImpl,
    userAgent: CYCLE_USER_AGENT,
    requestsPerSecond: Number(source.requests_per_second) || undefined,
  };
  const leads: DiscoveredLead[] = [];
  for (const item of docs) {
    if (!item.identifier) continue;
    const identifier = String(item.identifier);
    const title = String(item.title ?? identifier);
    const language = item.language
      ? String(Array.isArray(item.language) ? item.language[0] : item.language)
          .toLowerCase()
          .slice(0, 3)
      : "und";
    const resolved = await resolveArchiveItem(identifier, lookupOptions);
    if (!resolved.ok) {
      await report({
        sourceId: String(source.source_id),
        reason: "fetch_failed",
        url: resolved.itemUrl,
        itemUrl: resolved.itemUrl,
        repairState: "not_repairable",
        repairDetail: resolved.detail,
        detail: `Internet Archive search hit "${title}" skipped: ${resolved.detail}`,
      });
      continue;
    }
    const candidate: Candidate = {
      work_id: `work:${slug(title)}`,
      edition_id: `edition:internet-archive-${slug(identifier)}`,
      title,
      author: item.creator
        ? String(Array.isArray(item.creator) ? item.creator[0] : item.creator)
        : null,
      translator: null,
      source_id: String(source.source_id),
      language,
      language_role: "unknown",
      format: resolved.format,
      text_url: resolved.downloadUrl,
      rights: {},
      access: { download_allowed: true, requires_auth: false },
    };
    leads.push({
      // Licence evidence comes from the resolved item's own catalog metadata.
      candidate: applyArchiveResolution(candidate, resolved),
      origin: "registry_crawl" as const,
      originDetail: `Internet Archive search: ${identifier} (${resolved.fileName})`,
    });
  }
  return leads;
}

// ---------------------------------------------------------------------------
// Project Gutenberg discovery
// ---------------------------------------------------------------------------

/** Robots-permitted catalogue feed URL (`/cache/epub/feeds/` is allowed). */
export const GUTENBERG_CATALOG_URL =
  "https://www.gutenberg.org/cache/epub/feeds/pg_catalog.csv";
const GUTENBERG_CATALOG_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

interface GutenbergEntry {
  id: string;
  title: string;
  language: string;
  authors: string;
}

/**
 * RFC-4180-compliant CSV parser that handles quoted fields spanning multiple
 * lines (present in the live Gutenberg catalogue feed). Operates on the full
 * text as a character stream rather than splitting by newline first, so
 * embedded newlines inside double-quoted values are preserved correctly.
 *
 * Columns (0-based):
 *   0 Text#  1 Type  2 Issued  3 Title  4 Language  5 Authors  …
 */
export function parseGutenbergCatalog(csv: string): GutenbergEntry[] {
  const entries: GutenbergEntry[] = [];
  let pos = 0;
  const len = csv.length;
  let skipFirst = true; // skip the header record

  while (pos < len) {
    // Parse one complete record (may span multiple physical lines).
    const fields: string[] = [];

    recordLoop: while (pos < len) {
      let field = "";

      if (csv[pos] === '"') {
        // Quoted field: consume until a closing (unescaped) quote.
        pos++; // skip opening quote
        while (pos < len) {
          if (csv[pos] === '"') {
            pos++;
            if (pos < len && csv[pos] === '"') {
              // Escaped double-quote inside quoted value.
              field += '"';
              pos++;
            } else {
              // Closing quote — field ends here.
              break;
            }
          } else {
            field += csv[pos++];
          }
        }
      } else {
        // Unquoted field: read until comma or record terminator.
        while (pos < len && csv[pos] !== "," && csv[pos] !== "\r" && csv[pos] !== "\n") {
          field += csv[pos++];
        }
      }

      fields.push(field);

      if (pos >= len) break recordLoop;

      if (csv[pos] === ",") {
        pos++; // delimiter → next field in this record
      } else {
        // Record terminator (\r\n or \n).
        if (csv[pos] === "\r") pos++;
        if (pos < len && csv[pos] === "\n") pos++;
        break recordLoop;
      }
    }

    if (fields.length === 0) continue;

    if (skipFirst) {
      skipFirst = false;
      continue; // drop header
    }

    if (fields.length < 6) continue;
    if ((fields[1] ?? "").trim() !== "Text") continue;

    entries.push({
      id: (fields[0] ?? "").trim(),
      title: (fields[3] ?? "").trim(),
      language: (fields[4] ?? "").trim(),
      authors: (fields[5] ?? "").trim(),
    });
  }

  return entries;
}

/** Lowercase word tokens longer than 2 characters for fuzzy matching. */
function queryTokens(query: string): string[] {
  return query
    .toLowerCase()
    .split(/\W+/)
    .filter((t) => t.length > 2);
}

function scoreGutenbergEntry(entry: GutenbergEntry, tokens: string[]): number {
  const haystack = `${entry.title} ${entry.authors}`.toLowerCase();
  return tokens.reduce((n, t) => n + (haystack.includes(t) ? 1 : 0), 0);
}

async function discoverGutenberg(
  scope: CycleScope,
  source: Record<string, unknown>,
  fetchImpl: typeof fetch,
  report: (blocker: BlockerInput) => Promise<void>,
  cacheDir: string,
): Promise<DiscoveredLead[]> {
  const limit = Math.min(scope.limit ?? 10, 25);
  const allowedHosts = (source.allowed_hosts as string[]) ?? ["gutenberg.org"];
  const cacheFile = path.join(cacheDir, "gutenberg-catalog.json");

  let csv = await readDiskCache(cacheFile, GUTENBERG_CATALOG_MAX_AGE_MS);
  if (!csv) {
    csv = await fetchText(GUTENBERG_CATALOG_URL, allowedHosts, fetchImpl);
    await writeDiskCache(cacheFile, csv);
  }

  const entries = parseGutenbergCatalog(csv);
  const query = scope.targetWork
    ? `${scope.targetWork.title} ${scope.targetWork.author ?? ""}`.trim()
    : scope.query;
  const tokens = queryTokens(query);

  if (tokens.length === 0) return [];

  const matched = entries
    .map((e) => ({ e, score: scoreGutenbergEntry(e, tokens) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  if (matched.length === 0) {
    await report({
      sourceId: String(source.source_id),
      reason: "discovery_unsupported",
      detail:
        `${source.name}: searched the Gutenberg catalogue` +
        ` (${entries.length.toLocaleString()} texts), no title matched "${query}".`,
    });
    return [];
  }

  return matched.map(({ e }) => {
    const downloadUrl = `https://www.gutenberg.org/cache/epub/${e.id}/pg${e.id}.txt`;
    const candidate: Candidate = {
      work_id: `work:${slug(e.title)}`,
      edition_id: `edition:gutenberg-${e.id}`,
      title: e.title,
      author: e.authors || null,
      translator: null,
      source_id: String(source.source_id),
      language: e.language || "und",
      language_role: "unknown",
      format: "txt",
      text_url: downloadUrl,
      rights: {
        status_claim: "unknown",
        basis: "source_statement",
        statement:
          "Project Gutenberg texts are in the public domain in the U.S.; the ebook copyright notice must be checked.",
        rights_url: `https://www.gutenberg.org/ebooks/${e.id}`,
      },
      access: { download_allowed: true, requires_auth: false },
    };
    return {
      candidate,
      origin: "registry_crawl" as const,
      originDetail: `Project Gutenberg catalogue: ebook ${e.id} — ${e.title}`,
    };
  });
}

// ---------------------------------------------------------------------------
// Perseus Digital Library GitHub corpora discovery
// ---------------------------------------------------------------------------

/**
 * Public corpora searched for primary texts.
 *
 * Greek and Latin are hosted by PerseusDL; the Arabic CTS corpus is hosted
 * by the Alpheios Project (`alpheios-project/cts-texts-arabicLit`).
 *
 * No public Sanskrit CTS corpus is available on GitHub as of this writing.
 * Sanskrit texts can be discovered via Wikisource (sa.wikisource.org) and
 * Sacred Texts Archive instead.
 */
export const PERSEUS_REPOS: Array<{ owner: string; repo: string; label: string; language: string }> = [
  { owner: "PerseusDL", repo: "canonical-greekLit", label: "Greek", language: "grc" },
  { owner: "PerseusDL", repo: "canonical-latinLit", label: "Latin", language: "la" },
  { owner: "alpheios-project", repo: "cts-texts-arabicLit", label: "Arabic", language: "ar" },
];
const PERSEUS_TREE_MAX_AGE_MS = 60 * 60 * 1000; // 1 hour

/**
 * TLG / PHI urn-prefix → { title, author } for common mythology texts.
 * Covers the works most likely to be requested in a religious-mythology
 * research context; the strategy also matches file-path tokens for any work
 * not listed here.
 */
export const PERSEUS_WORK_TITLES: Record<string, { title: string; author: string }> = {
  // Homer
  "tlg0012.tlg001": { title: "Iliad", author: "Homer" },
  "tlg0012.tlg002": { title: "Odyssey", author: "Homer" },
  // Hesiod
  "tlg0020.tlg001": { title: "Theogony", author: "Hesiod" },
  "tlg0020.tlg002": { title: "Works and Days", author: "Hesiod" },
  "tlg0020.tlg003": { title: "Shield of Heracles", author: "Hesiod" },
  // Homeric Hymns
  "tlg0013.tlg001": { title: "Homeric Hymns", author: "Anonymous" },
  // Aeschylus
  "tlg0085.tlg001": { title: "Agamemnon", author: "Aeschylus" },
  "tlg0085.tlg002": { title: "Libation Bearers", author: "Aeschylus" },
  "tlg0085.tlg003": { title: "Eumenides", author: "Aeschylus" },
  "tlg0085.tlg004": { title: "Persians", author: "Aeschylus" },
  "tlg0085.tlg005": { title: "Seven Against Thebes", author: "Aeschylus" },
  "tlg0085.tlg006": { title: "Prometheus Bound", author: "Aeschylus" },
  "tlg0085.tlg007": { title: "Suppliant Women", author: "Aeschylus" },
  // Sophocles
  "tlg0011.tlg001": { title: "Ajax", author: "Sophocles" },
  "tlg0011.tlg002": { title: "Electra", author: "Sophocles" },
  "tlg0011.tlg003": { title: "Oedipus at Colonus", author: "Sophocles" },
  "tlg0011.tlg004": { title: "Oedipus Tyrannus", author: "Sophocles" },
  "tlg0011.tlg005": { title: "Philoctetes", author: "Sophocles" },
  "tlg0011.tlg006": { title: "Trachiniae", author: "Sophocles" },
  "tlg0011.tlg007": { title: "Antigone", author: "Sophocles" },
  // Euripides
  "tlg0006.tlg001": { title: "Alcestis", author: "Euripides" },
  "tlg0006.tlg002": { title: "Andromache", author: "Euripides" },
  "tlg0006.tlg003": { title: "Bacchae", author: "Euripides" },
  "tlg0006.tlg004": { title: "Cyclops", author: "Euripides" },
  "tlg0006.tlg005": { title: "Electra", author: "Euripides" },
  "tlg0006.tlg006": { title: "Hecuba", author: "Euripides" },
  "tlg0006.tlg007": { title: "Helen", author: "Euripides" },
  "tlg0006.tlg008": { title: "Heraclidae", author: "Euripides" },
  "tlg0006.tlg009": { title: "Heracles", author: "Euripides" },
  "tlg0006.tlg010": { title: "Hippolytus", author: "Euripides" },
  "tlg0006.tlg011": { title: "Ion", author: "Euripides" },
  "tlg0006.tlg012": { title: "Iphigenia at Aulis", author: "Euripides" },
  "tlg0006.tlg013": { title: "Iphigenia in Tauris", author: "Euripides" },
  "tlg0006.tlg014": { title: "Medea", author: "Euripides" },
  "tlg0006.tlg015": { title: "Orestes", author: "Euripides" },
  "tlg0006.tlg016": { title: "Phoenician Women", author: "Euripides" },
  "tlg0006.tlg017": { title: "Rhesus", author: "Euripides" },
  "tlg0006.tlg018": { title: "Suppliant Women (Euripides)", author: "Euripides" },
  "tlg0006.tlg019": { title: "Trojan Women", author: "Euripides" },
  // Apollodorus
  "tlg0548.tlg001": { title: "Library (Bibliotheca)", author: "Apollodorus" },
  // Pausanias
  "tlg0525.tlg001": { title: "Description of Greece", author: "Pausanias" },
  // Pindar
  "tlg0033.tlg001": { title: "Olympian Odes", author: "Pindar" },
  "tlg0033.tlg002": { title: "Pythian Odes", author: "Pindar" },
  "tlg0033.tlg003": { title: "Nemean Odes", author: "Pindar" },
  "tlg0033.tlg004": { title: "Isthmian Odes", author: "Pindar" },
  // Plutarch
  "tlg0007.tlg001": { title: "Parallel Lives", author: "Plutarch" },
  "tlg0007.tlg002": { title: "Moralia", author: "Plutarch" },
  // Herodotus
  "tlg0016.tlg001": { title: "Histories", author: "Herodotus" },
  // Plato
  "tlg0059.tlg001": { title: "Timaeus", author: "Plato" },
  "tlg0059.tlg022": { title: "Republic", author: "Plato" },
  // Virgil
  "phi0690.phi001": { title: "Eclogues", author: "Virgil" },
  "phi0690.phi002": { title: "Georgics", author: "Virgil" },
  "phi0690.phi003": { title: "Aeneid", author: "Virgil" },
  // Ovid
  "phi0959.phi001": { title: "Amores", author: "Ovid" },
  "phi0959.phi004": { title: "Fasti", author: "Ovid" },
  "phi0959.phi006": { title: "Metamorphoses", author: "Ovid" },
  // Lucretius
  "phi0550.phi001": { title: "De Rerum Natura", author: "Lucretius" },
  // Livy
  "phi0914.phi001": { title: "Ab Urbe Condita", author: "Livy" },
  // Cicero
  "phi0474.phi034": { title: "De Natura Deorum", author: "Cicero" },
  "phi0474.phi040": { title: "De Divinatione", author: "Cicero" },
  // Apuleius
  "phi0806.phi001": { title: "Metamorphoses (The Golden Ass)", author: "Apuleius" },

  // Arabic — alpheios-project/cts-texts-arabicLit CTS namespace prefixes.
  // The CTS URN scheme here is <namespace>.<work>, e.g. perseus201001.perseus0001.
  // Titles are taken directly from each work's __cts__.xml in the Alpheios repository.
  // Arabian Nights (4 volumes) — CTS group: arabicLit:perseus201001
  "perseus201001.perseus0001": { title: "Arabian Nights (Volume 1)", author: "Anonymous" },
  "perseus201001.perseus0002": { title: "Arabian Nights (Volume 2)", author: "Anonymous" },
  "perseus201001.perseus0003": { title: "Arabian Nights (Volume 3)", author: "Anonymous" },
  "perseus201001.perseus0004": { title: "Arabian Nights (Volume 4)", author: "Anonymous" },
  // al-Aghani (12 volumes) — CTS group: arabicLit:perseus201002
  "perseus201002.perseus0001": { title: "al-Aghani (Volume 1)", author: "Abu al-Faraj al-Isfahani" },
  "perseus201002.perseus0002": { title: "al-Aghani (Volume 2)", author: "Abu al-Faraj al-Isfahani" },
  "perseus201002.perseus0003": { title: "al-Aghani (Volume 3)", author: "Abu al-Faraj al-Isfahani" },
  "perseus201002.perseus0004": { title: "al-Aghani (Volume 4)", author: "Abu al-Faraj al-Isfahani" },
  "perseus201002.perseus0005": { title: "al-Aghani (Volume 5)", author: "Abu al-Faraj al-Isfahani" },
  "perseus201002.perseus0006": { title: "al-Aghani (Volume 6)", author: "Abu al-Faraj al-Isfahani" },
  "perseus201002.perseus0007": { title: "al-Aghani (Volume 7)", author: "Abu al-Faraj al-Isfahani" },
  "perseus201002.perseus0008": { title: "al-Aghani (Volume 8)", author: "Abu al-Faraj al-Isfahani" },
  "perseus201002.perseus0009": { title: "al-Aghani (Volume 9)", author: "Abu al-Faraj al-Isfahani" },
  "perseus201002.perseus0010": { title: "al-Aghani (Volume 10)", author: "Abu al-Faraj al-Isfahani" },
  "perseus201002.perseus0011": { title: "al-Aghani (Volume 11)", author: "Abu al-Faraj al-Isfahani" },
  "perseus201002.perseus0012": { title: "al-Aghani (Volume 12)", author: "Abu al-Faraj al-Isfahani" },
  // Miscellaneous Arabic texts — CTS group: arabicLit:perseus201003
  "perseus201003.perseus0001": { title: "Voyages D'Ibn Batutah (Volume 4)", author: "Ibn Battuta" },
  "perseus201003.perseus0002": { title: "Selection From The Annals Of Tabari", author: "al-Tabari" },
  "perseus201003.perseus0003": { title: "Selections from Arabic geographical literature", author: "Various" },
  "perseus201003.perseus0004": { title: "Arabic Reading Lessons", author: "Various" },
  "perseus201003.perseus0005": { title: "The Autobiography Of The Constantinopolitan Story-Teller", author: "Anonymous" },
};

async function discoverPerseus(
  scope: CycleScope,
  source: Record<string, unknown>,
  fetchImpl: typeof fetch,
  report: (blocker: BlockerInput) => Promise<void>,
  cacheDir: string,
): Promise<DiscoveredLead[]> {
  const limit = Math.min(scope.limit ?? 10, 25);
  const allowedHosts = (source.allowed_hosts as string[]) ?? [
    "api.github.com",
    "raw.githubusercontent.com",
  ];

  const query = scope.targetWork
    ? `${scope.targetWork.title} ${scope.targetWork.author ?? ""}`.trim()
    : scope.query;
  const tokens = queryTokens(query);
  if (tokens.length === 0) return [];

  const leads: DiscoveredLead[] = [];
  const seen = new Set<string>();

  for (const { owner, repo, label, language } of PERSEUS_REPOS) {
    if (leads.length >= limit) break;

    const cacheFile = path.join(cacheDir, `perseus-${repo}-tree.json`);
    let treeJson = await readDiskCache(cacheFile, PERSEUS_TREE_MAX_AGE_MS);
    if (!treeJson) {
      const treeUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/HEAD?recursive=1`;
      try {
        const treeData = await fetchJson(treeUrl, allowedHosts, fetchImpl);
        treeJson = JSON.stringify(treeData);
        await writeDiskCache(cacheFile, treeJson);
      } catch (e) {
        const msg = cleanErrorText(e);
        const isRateLimit = msg.includes("403") || msg.toLowerCase().includes("rate limit");
        await report({
          sourceId: String(source.source_id),
          reason: "fetch_failed",
          detail: isRateLimit
            ? `${source.name}: GitHub API rate limit reached while listing the ${label} corpus; retry after an hour.`
            : `${source.name}: could not list ${label} corpus from GitHub: ${msg}`,
        });
        continue;
      }
    }

    const treeData = JSON.parse(treeJson) as { tree?: { path: string; type: string }[] };
    const xmlFiles = (treeData.tree ?? []).filter(
      (f) =>
        f.type === "blob" &&
        f.path.startsWith("data/") &&
        f.path.endsWith(".xml") &&
        !f.path.includes("__cts__"),
    );

    for (const file of xmlFiles) {
      if (leads.length >= limit) break;
      const basename = path.basename(file.path, ".xml");
      // Extract the author.work URN prefix, e.g. "tlg0012.tlg001" or "perseus201001.perseus0001".
      const urnMatch = /^([a-z]+\d*\.[a-z]+\d*)/i.exec(basename);
      const urnPrefix = urnMatch?.[1] ?? "";
      const meta = PERSEUS_WORK_TITLES[urnPrefix];

      const haystack = meta
        ? `${meta.title} ${meta.author} ${basename}`.toLowerCase()
        : basename.toLowerCase();
      const score = tokens.reduce((n, t) => n + (haystack.includes(t) ? 1 : 0), 0);
      if (score === 0) continue;

      const editionId = `edition:perseus-${basename}`;
      if (seen.has(editionId)) continue;
      seen.add(editionId);

      const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/master/${file.path}`;
      const candidate: Candidate = {
        work_id: `work:${slug(meta?.title ?? basename)}`,
        edition_id: editionId,
        title: meta?.title ?? basename,
        author: meta?.author ?? null,
        translator: null,
        source_id: String(source.source_id),
        language,
        language_role: "unknown",
        format: "tei_xml",
        text_url: rawUrl,
        rights: {
          status_claim: "unknown",
          basis: "source_statement",
          statement:
            "Rights vary by repository, edition, and translation; check the file and repository metadata.",
          rights_url: `https://github.com/${owner}/${repo}/blob/master/${file.path}`,
        },
        access: { download_allowed: true, requires_auth: false },
      };
      leads.push({
        candidate,
        origin: "registry_crawl" as const,
        originDetail: `Perseus ${label} corpus: ${file.path}${meta ? ` (${meta.title})` : ""}`,
      });
    }
  }

  if (leads.length === 0) {
    await report({
      sourceId: String(source.source_id),
      reason: "discovery_unsupported",
      detail:
        `${source.name}: searched the canonical Greek, Latin, and Arabic corpora,` +
        ` no file matched "${query}".`,
    });
  }

  return leads;
}

// ---------------------------------------------------------------------------
// Internet Sacred Text Archive discovery
// ---------------------------------------------------------------------------

const SACRED_TEXTS_BASE = "https://sacred-texts.com";
const SACRED_TEXTS_MAX_AGE_MS = 12 * 60 * 60 * 1000; // 12 hours

/**
 * Maps domain-specific query keywords to the tradition path they live under on
 * sacred-texts.com. This bridges the gap between work-title tokens ("rig",
 * "veda") and tradition labels ("Hinduism") that share no words — without this
 * table, label-only scoring would miss whole sections of the site.
 *
 * Each path prefix matches the tradition directory (e.g. "/hin/" for Hinduism).
 * Keywords are compared against query tokens using substring matching in both
 * directions so partial tokens like "veda" also match "vedanta".
 */
const SACRED_TEXTS_KEYWORD_TRADITIONS: Array<{ keywords: string[]; path: string }> = [
  {
    keywords: [
      "hindu", "veda", "rigveda", "rig", "upanishad", "mahabharata", "ramayana",
      "gita", "bhagavad", "vedic", "atharva", "sama", "yajur", "purana",
      "brahman", "brahma", "brahmana", "sanskrit", "vedanta",
    ],
    path: "/hin/",
  },
  {
    keywords: [
      "buddhist", "buddhism", "tripitaka", "pali", "dhamma", "dharma",
      "tibetan", "sutra", "zen", "buddha", "dhammapada",
    ],
    path: "/bud/",
  },
  { keywords: ["jain", "jainism", "jaina"], path: "/jain/" },
  { keywords: ["shinto", "kojiki", "nihon", "nihongi", "japanese", "nihonshoki"], path: "/shi/" },
  {
    keywords: ["egypt", "egyptian", "pharaoh", "osiris", "isis", "amun", "amon", "ra", "horus"],
    path: "/egy/",
  },
  { keywords: ["christian", "bible", "jesus", "gospel", "testament", "church"], path: "/chr/" },
  { keywords: ["islam", "quran", "koran", "muslim", "sufi", "hadith", "arabic"], path: "/isl/" },
  { keywords: ["jewish", "judaism", "talmud", "torah", "kabbalah", "hebraic", "hebrew"], path: "/jud/" },
  { keywords: ["zoroastrian", "avesta", "zend", "parsi", "zardusht", "gathas"], path: "/zoro/" },
  { keywords: ["confucian", "confucius", "analects", "chinese", "china", "mencius"], path: "/cfu/" },
  { keywords: ["taoist", "taoism", "tao", "laozi", "laotse", "chuang"], path: "/tao/" },
  { keywords: ["celtic", "arthurian", "druid", "irish", "gaelic", "welsh", "mabinogion"], path: "/ance/" },
  { keywords: ["norse", "viking", "edda", "odin", "thor", "nordic", "eddic", "volsunga"], path: "/neu/" },
  {
    keywords: [
      "greek", "roman", "latin", "classical", "olympian", "homer", "iliad",
      "odyssey", "hesiod", "theogony", "plutarch",
    ],
    path: "/cla/",
  },
  {
    keywords: ["mesopotamian", "sumerian", "babylonian", "akkadian", "gilgamesh", "assyrian"],
    path: "/ane/",
  },
  { keywords: ["native", "american", "maya", "aztec", "inca", "indigenous", "navajo"], path: "/nam/" },
  { keywords: ["african", "yoruba", "bantu"], path: "/afr/" },
  { keywords: ["gnostic", "gnosticism", "hermetic", "hermes", "nag", "pistis", "sophia"], path: "/gno/" },
];

/**
 * Score how well a Sacred Texts tradition link matches the query, combining:
 * 1. Label-text scoring — how many query tokens appear in the tradition label.
 * 2. Keyword-table scoring — explicit mapping from work-domain keywords to the
 *    tradition path, so "rig veda" → Hindu ("/hin/") even though "Hinduism"
 *    contains neither "rig" nor "veda".
 */
function scoreTraditionLink(link: { href: string; text: string }, tokens: string[]): number {
  // Score against the human-readable label.
  let score = tokens.reduce((n, t) => n + (link.text.toLowerCase().includes(t) ? 1 : 0), 0);

  // Score via the keyword table using the tradition's URL path.
  try {
    const pathname = new URL(link.href).pathname;
    for (const entry of SACRED_TEXTS_KEYWORD_TRADITIONS) {
      if (!pathname.startsWith(entry.path)) continue;
      const kwMatch = entry.keywords.some((kw) =>
        tokens.some((t) => kw === t || kw.startsWith(t) || t.startsWith(kw)),
      );
      if (kwMatch) {
        score += 2; // keyword match outweighs label scoring
        break;
      }
    }
  } catch {
    // ignore URL parse errors
  }

  return score;
}

/**
 * Extract hrefs and their link text from an HTML page, resolved to absolute
 * URLs on the same host. Returns only same-host links.
 */
function extractSacredTextsLinks(
  html: string,
  pageUrl: string,
): Array<{ href: string; text: string }> {
  const base = new URL(pageUrl);
  const results: Array<{ href: string; text: string }> = [];
  const re = /<a\s[^>]*?\bhref="([^"#?]+)"[^>]*>([^<]{2,100})<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const raw = m[1].trim();
    const text = m[2].replace(/\s+/g, " ").replace(/&[a-z#\d]+;/g, " ").trim();
    if (!text || !raw) continue;
    try {
      const abs = new URL(raw, base).toString();
      if (new URL(abs).hostname !== base.hostname) continue;
      results.push({ href: abs, text });
    } catch {
      // ignore unparseable URLs
    }
  }
  return results;
}

function scoreSacredTextsMatch(text: string, tokens: string[]): number {
  const lower = text.toLowerCase();
  return tokens.reduce((n, t) => n + (lower.includes(t) ? 1 : 0), 0);
}

async function discoverSacredTexts(
  scope: CycleScope,
  source: Record<string, unknown>,
  fetchImpl: typeof fetch,
  report: (blocker: BlockerInput) => Promise<void>,
  cacheDir: string,
): Promise<DiscoveredLead[]> {
  const limit = Math.min(scope.limit ?? 10, 25);
  const allowedHosts = (source.allowed_hosts as string[]) ?? ["sacred-texts.com"];

  const query = scope.targetWork
    ? `${scope.targetWork.title} ${scope.targetWork.author ?? ""}`.trim()
    : scope.query;
  const tokens = queryTokens(query);
  if (tokens.length === 0) return [];

  // Step 1: fetch the main index to discover tradition links.
  const mainCacheFile = path.join(cacheDir, "sacred-texts-main.json");
  let mainHtml = await readDiskCache(mainCacheFile, SACRED_TEXTS_MAX_AGE_MS);
  if (!mainHtml) {
    mainHtml = await fetchText(`${SACRED_TEXTS_BASE}/`, allowedHosts, fetchImpl);
    await writeDiskCache(mainCacheFile, mainHtml);
  }

  // Tradition index pages look like /hin/index.htm, /bud/index.htm …
  const mainLinks = extractSacredTextsLinks(mainHtml, `${SACRED_TEXTS_BASE}/`);
  const traditionLinks = mainLinks.filter(({ href }) => {
    try {
      const { pathname } = new URL(href);
      return /^\/[a-z]+\/(index\.htm?)?$/i.test(pathname);
    } catch {
      return false;
    }
  });

  // Score traditions by both label text and the keyword-to-tradition table.
  const scoredTraditions = traditionLinks
    .map((link) => ({ ...link, score: scoreTraditionLink(link, tokens) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  // If no tradition scored, walk the first five as a broad attempt.
  const traditionsToFetch =
    scoredTraditions.length > 0 ? scoredTraditions : traditionLinks.slice(0, 5);

  const leads: DiscoveredLead[] = [];
  const seen = new Set<string>();

  for (const tradition of traditionsToFetch) {
    if (leads.length >= limit) break;
    // Ensure we land on the index page, not just the directory root.
    const indexHref = tradition.href.endsWith("/")
      ? `${tradition.href}index.htm`
      : tradition.href;

    const tradSlug = slug(tradition.text || new URL(indexHref).pathname);
    const tradCacheFile = path.join(cacheDir, `sacred-texts-trad-${tradSlug}.json`);
    let tradHtml = await readDiskCache(tradCacheFile, SACRED_TEXTS_MAX_AGE_MS);
    if (!tradHtml) {
      try {
        tradHtml = await fetchText(indexHref, allowedHosts, fetchImpl);
        await writeDiskCache(tradCacheFile, tradHtml);
      } catch {
        continue; // One failing tradition must not abort the others.
      }
    }

    const workLinks = extractSacredTextsLinks(tradHtml, indexHref).filter(({ href }) => {
      try {
        return /\.htm?$/i.test(new URL(href).pathname);
      } catch {
        return false;
      }
    });

    for (const work of workLinks) {
      if (leads.length >= limit) break;
      const score = scoreSacredTextsMatch(work.text, tokens);
      if (score === 0) continue;
      const editionId = `edition:sacred-texts-${slug(work.text)}-${slug(tradition.text)}`;
      if (seen.has(editionId)) continue;
      seen.add(editionId);

      const candidate: Candidate = {
        work_id: `work:${slug(work.text)}`,
        edition_id: editionId,
        title: work.text,
        author: null,
        translator: null,
        source_id: String(source.source_id),
        language: "en",
        language_role: "unknown",
        format: "html",
        text_url: work.href,
        rights: {
          status_claim: "unknown",
          basis: "source_statement",
          statement:
            "Sacred Texts hosts public-domain and freely licensed texts; the copyright note on each text's page must be checked.",
          rights_url: work.href,
        },
        access: { download_allowed: true, requires_auth: false },
      };
      leads.push({
        candidate,
        origin: "registry_crawl" as const,
        originDetail: `Internet Sacred Text Archive (${tradition.text}): ${work.text}`,
      });
    }
  }

  if (leads.length === 0) {
    await report({
      sourceId: String(source.source_id),
      reason: "discovery_unsupported",
      detail:
        `${source.name}: searched tradition index pages,` +
        ` no work title matched "${query}".`,
    });
  }

  return leads;
}

// ---------------------------------------------------------------------------
// Strategy registry
// ---------------------------------------------------------------------------

type DiscoveryStrategy = (
  scope: CycleScope,
  source: Record<string, unknown>,
  fetchImpl: typeof fetch,
  report: (blocker: BlockerInput) => Promise<void>,
  cacheDir: string,
) => Promise<DiscoveredLead[]>;

const DISCOVERY_STRATEGIES: Record<string, DiscoveryStrategy> = {
  // Existing strategies wrapped to accept the extra cacheDir parameter.
  "source:multilingual-wikisource": (s, src, f, _r, _cd) => discoverWikisource(s, src, f),
  "source:internet-archive": (s, src, f, r, _cd) => discoverInternetArchive(s, src, f, r),
  // New strategies.
  "source:project-gutenberg": discoverGutenberg,
  "source:perseus-github": discoverPerseus,
  // NOTE: discoverSacredTexts is implemented but not registered here because
  // sacred-texts.com is currently behind Cloudflare and returns HTTP 403 to
  // all automated requests. The source is marked manual_only in the registry
  // so that cycles report a specific blocker rather than the generic fallback.
  // Re-register when machine-readable access is confirmed.
};

/**
 * Wrap `fetchImpl` so that consecutive calls wait at least `delayMs` ms
 * between them, honouring the source's configured `requests_per_second` limit.
 * Pass `delayMs = 0` to bypass rate-limiting (used in tests).
 */
function makeRateLimitedFetch(fetchImpl: typeof fetch, delayMs: number): typeof fetch {
  if (delayMs <= 0) return fetchImpl;
  let lastCallMs = 0;
  return (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    const now = Date.now();
    const wait = delayMs - (now - lastCallMs);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastCallMs = Date.now();
    return fetchImpl(input, init);
  }) as typeof fetch;
}

async function defaultRegistryDiscover(
  scope: CycleScope,
  registrySources: Record<string, unknown>[],
  report: (blocker: BlockerInput) => Promise<void>,
  fetchImpl: typeof fetch,
  cacheDir: string,
  discoveryDelayMs?: number,
): Promise<DiscoveredLead[]> {
  const leads: DiscoveredLead[] = [];
  for (const source of registrySources) {
    const sourceId = String(source.source_id);
    if (source.local_only) continue;
    if (!source.automated_download_allowed) {
      await report({
        sourceId,
        reason: "download_not_authorized",
        detail: `${source.name}: registry does not authorize automated download; skipped during cycle.`,
      });
      continue;
    }

    // A registry-level manual_only declaration takes priority over any strategy
    // in DISCOVERY_STRATEGIES. This lets a source be dormant when its endpoint
    // is temporarily or permanently inaccessible (e.g. Cloudflare block) while
    // keeping the implementation code for when access is restored.
    const discovery = source.discovery as Record<string, unknown> | undefined;
    if (discovery?.kind === "manual_only") {
      await report({
        sourceId,
        reason: "discovery_unsupported",
        detail:
          `${source.name}: automated discovery is not available` +
          ` (${String(discovery.reason ?? "no machine-readable catalogue found")})` +
          `; add candidates manually.`,
      });
      continue;
    }

    const strategy = DISCOVERY_STRATEGIES[sourceId];
    if (!strategy) {
      await report({
        sourceId,
        reason: "discovery_unsupported",
        detail: `${source.name}: no automated discovery strategy for this source yet; add candidates manually.`,
      });
      continue;
    }

    // Compute per-source delay: explicit override wins, else derive from the
    // registry's requests_per_second (minimum 100 ms floor to prevent hammering).
    const rps = Number((source.requests_per_second as unknown) ?? 1) || 1;
    const delayMs = discoveryDelayMs ?? Math.max(100, Math.round(1000 / rps));
    const throttledFetch = makeRateLimitedFetch(fetchImpl, delayMs);

    try {
      leads.push(...(await strategy(scope, source, throttledFetch, report, cacheDir)));
    } catch (e) {
      const message = cleanErrorText(e);
      await report({
        sourceId,
        reason: message.startsWith("robots_disallowed") ? "robots_disallowed" : "fetch_failed",
        detail: `${source.name}: discovery failed: ${message}`,
      });
    }
  }
  return leads;
}

// ---------------------------------------------------------------------------
// AI lead discovery
// ---------------------------------------------------------------------------

async function defaultAiDiscover(
  scope: CycleScope,
  registrySources: Record<string, unknown>[],
): Promise<AiLead[]> {
  const client = new OpenAI({
    apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
    baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  });
  const hosts = registrySources
    .filter((s) => !s.local_only && s.automated_download_allowed)
    .flatMap((s) => (s.allowed_hosts as string[]) ?? []);
  const limit = Math.min(scope.limit ?? 10, 15);
  const completion = await client.chat.completions.create({
    model: process.env.HUNTER_AI_MODEL || "gpt-5",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You are a research librarian locating COMPLETE digitized PRIMARY sources only: the original texts themselves " +
          "(ancient/traditional religious or mythological works) or direct translations of them. " +
          "NEVER return secondary literature: no modern commentaries, studies, histories, encyclopedias, dictionaries, " +
          "handbooks, companions, introductions, textbooks, retellings, or compilations about the texts. " +
          "Return strict JSON: {\"leads\":[{\"title\",\"author\",\"url\",\"language\" (ISO 639), \"rights_statement\",\"license_url\",\"confidence\" (high|medium|low)}]}. " +
          "Every url must be a direct https link to the full text (plain text, XML or HTML), not a search page. " +
          `Prefer these trusted hosts when possible: ${hosts.join(", ")}. ` +
          "Only include rights statements you are confident about; otherwise say \"unknown\".",
      },
      {
        role: "user",
        content: scope.targetWork
          ? `Find up to ${limit} complete-text editions of EXACTLY THIS WORK: "${scope.targetWork.title}"${
              scope.targetWork.author ? ` by ${scope.targetWork.author}` : ""
            }${scope.targetWork.language ? ` (original language hint: ${scope.targetWork.language})` : ""}. ` +
            `Strongly prefer a COMPLETE edition in ENGLISH. If no complete English edition is available, ` +
            `return complete editions in these languages instead (most reliably machine-translatable first): ${
              (scope.preferredLanguages ?? []).join(", ") || "any"
            }. Do not return other works, excerpts or partial texts when a complete edition exists.`
          : `Find up to ${limit} complete-text editions relevant to: ${scope.query}${
              scope.region ? ` (mythological region: ${scope.region.label})` : ""
            }`,
      },
    ],
  });
  const text = completion.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(text) as { leads?: AiLead[] };
  return Array.isArray(parsed.leads) ? parsed.leads : [];
}

// ---------------------------------------------------------------------------
// AI primary/secondary screening
// ---------------------------------------------------------------------------

export interface AiScreenVerdict {
  classification: "primary" | "secondary";
  justification: string;
}

/**
 * Classify discovered leads as primary sources vs secondary literature.
 * Must return a verdict per input lead, aligned by index; leads without a
 * usable verdict fall back to the keyword heuristic.
 */
export type AiScreen = (
  leads: { title: string; author: string | null }[],
  scope: CycleScope,
) => Promise<(AiScreenVerdict | null)[]>;

const defaultAiScreen: AiScreen = async (leads, scope) => {
  const client = new OpenAI({
    apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
    baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  });
  const completion = await client.chat.completions.create({
    model: process.env.HUNTER_AI_MODEL || "gpt-5",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You classify book/edition titles for a collector of PRIMARY religious and mythological sources. " +
          "PRIMARY means the original text itself or a direct translation of it (e.g. \"The Poetic Edda\", \"Enuma Elish\"). " +
          "SECONDARY means modern scholarship ABOUT the texts: encyclopedias, dictionaries, commentaries, histories, " +
          "handbooks, companions, introductions, studies, retellings, textbooks, compilations of scholarship. " +
          'Return strict JSON: {"verdicts":[{"index":<number matching the input>,"classification":"primary"|"secondary","justification":"<one short sentence>"}]}. ' +
          "Provide exactly one verdict per input item.",
      },
      {
        role: "user",
        content:
          `Search topic: ${scope.query}\nClassify each item:\n` +
          leads
            .map((l, i) => `${i}. ${l.title}${l.author ? ` — ${l.author}` : ""}`)
            .join("\n"),
      },
    ],
  });
  const text = completion.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(text) as {
    verdicts?: { index?: number; classification?: string; justification?: string }[];
  };
  const verdicts: (AiScreenVerdict | null)[] = leads.map(() => null);
  for (const v of parsed.verdicts ?? []) {
    const i = Number(v?.index);
    if (!Number.isInteger(i) || i < 0 || i >= leads.length) continue;
    if (v.classification !== "primary" && v.classification !== "secondary") continue;
    verdicts[i] = {
      classification: v.classification,
      justification: String(v.justification || "").trim() || "No justification given.",
    };
  }
  return verdicts;
};

/** Leads per AI screening request; keeps prompts small and failures isolated. */
export const SCREEN_CHUNK_SIZE = 30;

/**
 * Normalized cache key for a screening verdict: the same title in different
 * capitalization/punctuation (a very common recurrence across catalogs) maps
 * to one cached verdict.
 */
export function screenCacheKey(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** Persistent verdict cache used by screenLeads (backed by the CycleStore). */
export interface ScreenVerdictCache {
  get(keys: string[]): Promise<Map<string, AiScreenVerdict>>;
  set(entries: { key: string; title: string; verdict: AiScreenVerdict }[]): Promise<void>;
}

/**
 * Markers that flag a title as secondary literature so unambiguously that AI
 * screening is skipped for it (the heuristic verdict stands). Weaker markers
 * (e.g. "history of") still go to the model, which may overrule them.
 */
const CONFIDENT_SECONDARY_MARKERS = [
  "encyclopedia", "encyclopaedia", "dictionary", "handbook", "textbook",
  "who s who", "atlas of", "grand bible",
];

/** Marker matched when the heuristic is confident the title is secondary, else null. */
export function confidentlySecondary(title: string): string | null {
  const marker = looksLikeSecondarySource(title);
  return marker && CONFIDENT_SECONDARY_MARKERS.includes(marker) ? marker : null;
}

/**
 * Run AI primary/secondary screening in chunks of SCREEN_CHUNK_SIZE.
 * - Leads the heuristic confidently flags as secondary are never sent to the
 *   model (their verdict stays null, so the heuristic blocks them downstream).
 * - When a verdict cache is provided, titles classified in past cycles reuse
 *   the cached verdict — only never-seen titles are sent to the model — and
 *   fresh verdicts are persisted back to the cache. Cache failures are
 *   reported as blockers but never fail screening (the model still runs).
 * - Each chunk fails independently: a failed request reports one blocker and
 *   leaves null verdicts (heuristic fallback) for just that chunk's leads.
 */
export async function screenLeads(
  leads: { title: string; author: string | null }[],
  scope: CycleScope,
  aiScreen: AiScreen,
  report: (blocker: BlockerInput) => Promise<void>,
  cache?: ScreenVerdictCache,
): Promise<(AiScreenVerdict | null)[]> {
  const verdicts: (AiScreenVerdict | null)[] = leads.map(() => null);
  let pendingIndexes: number[] = [];
  for (let i = 0; i < leads.length; i += 1) {
    if (!confidentlySecondary(leads[i].title)) pendingIndexes.push(i);
  }

  // Reuse verdicts persisted by earlier cycles; only misses go to the model.
  if (cache && pendingIndexes.length > 0) {
    try {
      const cached = await cache.get(pendingIndexes.map((i) => screenCacheKey(leads[i].title)));
      pendingIndexes = pendingIndexes.filter((i) => {
        const hit = cached.get(screenCacheKey(leads[i].title));
        if (!hit) return true;
        verdicts[i] = hit;
        return false;
      });
    } catch (e) {
      await report({
        reason: "fetch_failed",
        detail: `Screening verdict cache lookup failed: ${cleanErrorText(e)}. All ${pendingIndexes.length} lead(s) will be screened by the model.`,
      });
    }
  }

  for (let start = 0; start < pendingIndexes.length; start += SCREEN_CHUNK_SIZE) {
    const chunkIndexes = pendingIndexes.slice(start, start + SCREEN_CHUNK_SIZE);
    const chunkLeads = chunkIndexes.map((i) => leads[i]);
    try {
      const chunkVerdicts = await aiScreen(chunkLeads, scope);
      if (Array.isArray(chunkVerdicts)) {
        const fresh: { key: string; title: string; verdict: AiScreenVerdict }[] = [];
        for (let j = 0; j < chunkIndexes.length; j += 1) {
          const verdict = chunkVerdicts[j] ?? null;
          verdicts[chunkIndexes[j]] = verdict;
          if (verdict) {
            fresh.push({
              key: screenCacheKey(chunkLeads[j].title),
              title: chunkLeads[j].title,
              verdict,
            });
          }
        }
        if (cache && fresh.length > 0) {
          try {
            await cache.set(fresh);
          } catch (e) {
            await report({
              reason: "fetch_failed",
              detail: `Screening verdict cache write failed: ${cleanErrorText(e)}. Verdicts were still applied to this cycle.`,
            });
          }
        }
      }
    } catch (e) {
      await report({
        reason: "fetch_failed",
        detail: `AI primary/secondary screening failed: ${cleanErrorText(e)}. Falling back to the keyword heuristic for ${chunkLeads.length} lead(s) in this batch.`,
      });
    }
  }
  return verdicts;
}

export function matchRegistrySource(
  url: string,
  registrySources: Record<string, unknown>[],
): Record<string, unknown> | null {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
  for (const source of registrySources) {
    if (source.local_only) continue;
    const allowed = ((source.allowed_hosts as string[]) ?? []).map((h) => h.toLowerCase());
    if (allowed.some((h) => host === h || host.endsWith("." + h))) {
      return source;
    }
  }
  return null;
}

const FORMAT_BY_EXT: Record<string, string> = {
  ".txt": "txt",
  ".xml": "xml",
  ".html": "html",
  ".htm": "html",
  ".epub": "epub",
  ".pdf": "pdf",
  ".json": "json",
};

function guessFormat(url: string): string {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    for (const [ext, format] of Object.entries(FORMAT_BY_EXT)) {
      if (pathname.endsWith(ext)) return format;
    }
  } catch {
    /* fall through */
  }
  return "html";
}

export function aiLeadToLead(
  lead: AiLead,
  source: Record<string, unknown>,
): DiscoveredLead {
  const title = String(lead.title || "Untitled").trim() || "Untitled";
  const candidate: Candidate = {
    work_id: `work:${slug(title)}`,
    edition_id: `edition:ai-${slug(title)}-${slug(new URL(lead.url).pathname).slice(0, 40) || "root"}`,
    title,
    author: lead.author ? String(lead.author) : null,
    translator: null,
    source_id: String(source.source_id),
    language: (lead.language || "und").toLowerCase().slice(0, 3) || "und",
    language_role: "unknown",
    format: guessFormat(lead.url),
    text_url: lead.url,
    rights: {
      status_claim: "unknown",
      basis: "source_statement",
      // IMPORTANT: the AI's claimed rights are unverified, so they must NOT go
      // into statement/license/license_url — the rights engine treats those as
      // evidence and an invented "CC BY" claim could unlock publication.
      // Publication can only be unlocked by evidence embedded in the actual
      // downloaded text (extractEmbeddedNotice) or an editor's review.
      statement: `AI-suggested lead (confidence: ${lead.confidence || "unknown"}); rights evidence pending verification.`,
      ai_claimed_statement: lead.rights_statement || "unknown",
      ai_claimed_license_url: lead.license_url || null,
    },
    access: { download_allowed: true, requires_auth: false },
  };
  return {
    candidate,
    origin: "ai_search",
    originDetail: `AI lead (${lead.confidence || "unknown"} confidence): ${lead.url}`,
  };
}

// ---------------------------------------------------------------------------
// Blocker derivation from download records
// ---------------------------------------------------------------------------

export function blockerFromRecord(record: Record<string, unknown>): BlockerInput | null {
  const status = String(record.download_status ?? "");
  const error = String(record.error ?? "");
  const base = {
    sourceId: String(record.source_id ?? "") || null,
    url: String(record.source_reference ?? "") || null,
    workId: String(record.work_id ?? "") || null,
    editionId: String(record.edition_id ?? "") || null,
  };
  if (status === "metadata_only") {
    let reason = "download_not_authorized";
    if (/robots/i.test(error)) reason = "robots_disallowed";
    else if (/auth/i.test(error)) reason = "requires_auth";
    return { ...base, reason, detail: error || "metadata-only: download not permitted" };
  }
  if (status === "failed") {
    let reason = "fetch_failed";
    if (/maximum_file_bytes|exceeds maximum/i.test(error)) reason = "too_large";
    else if (/robots/i.test(error)) reason = "robots_disallowed";
    else if (/auth/i.test(error)) reason = "requires_auth";
    return { ...base, reason, detail: error || "download failed" };
  }
  if (status === "downloaded" || status === "already_present") {
    const file = record.file as Record<string, unknown> | null;
    if (file?.locked) {
      const rights = (record.rights ?? {}) as Record<string, unknown>;
      return {
        ...base,
        reason: "rights_locked",
        detail: `Downloaded to locked partition (status: ${rights.status ?? "unknown"}); not publishable without rights review.`,
      };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// The cycle itself
// ---------------------------------------------------------------------------

/**
 * Confirm an archive.org lead against the item's real file list before it is
 * stored as a candidate, replacing its URL, format and licence evidence with
 * the resolved item's own. Non-Archive leads pass straight through.
 *
 * Returns null when the item cannot be downloaded — a blocker carrying the
 * precise reason has been recorded by then.
 */
async function verifyArchiveLead(
  lead: DiscoveredLead,
  context: {
    source: Record<string, unknown>;
    policy: Policy;
    fetchImpl: typeof fetch;
    report: (blocker: BlockerInput) => Promise<void>;
    describe: (detail: string) => string;
  },
): Promise<DiscoveredLead | null> {
  const url = String(lead.candidate?.text_url ?? "");
  if (!isArchiveUrl(url)) return lead;
  const resolved = await repairArchiveUrl(
    {
      url,
      title: lead.candidate?.title ? String(lead.candidate.title) : null,
      author: lead.candidate?.author ? String(lead.candidate.author) : null,
    },
    {
      fetchImpl: context.fetchImpl,
      userAgent: CYCLE_USER_AGENT,
      requestsPerSecond: Number(context.source.requests_per_second) || undefined,
      maxBytes: Number(context.policy.maximum_file_bytes) || undefined,
    },
  );
  if (!resolved.ok) {
    await context.report({
      sourceId: String(context.source.source_id),
      reason: "download_not_authorized",
      url,
      itemUrl: resolved.itemUrl,
      repairState: "not_repairable",
      repairDetail: resolved.detail,
      detail: context.describe(resolved.detail),
    });
    return null;
  }
  // Licence evidence is replaced by the resolved item's own catalog metadata;
  // any model's claims stay in their ai_claimed_* keys.
  return {
    ...lead,
    candidate: applyArchiveResolution(lead.candidate, resolved),
    originDetail: `${lead.originDetail} — verified Archive file: ${resolved.fileName}`,
  };
}

export async function runHuntingCycle(options: CycleOptions): Promise<CycleSummary> {
  const { scope, policy, registry, corpusRoot, store } = options;
  const fetchImpl = options.fetchImpl ?? fetch;
  const cacheDir = options.cacheDir ?? path.join(process.cwd(), "data", "hunter-cache");
  const registrySources = sources(registry);
  let blockerCount = 0;
  const report = async (blocker: BlockerInput) => {
    blockerCount += 1;
    await store.addBlocker(blocker);
  };

  // Phase 1: crawl trusted registries.
  await store.updateProgress({ phase: "discovering_registry", query: scope.query, region: scope.region });
  const registryDiscover = options.registryDiscover
    ? options.registryDiscover(scope, registrySources, report)
    : defaultRegistryDiscover(scope, registrySources, report, fetchImpl, cacheDir, options.discoveryDelayMs);
  // Leads the caller supplied (corpus-list URLs an editor typed) are checked
  // against the Archive exactly like discovered ones: an unverified archive.org
  // URL must never become a candidate.
  const leads: DiscoveredLead[] = [];
  for (const lead of options.extraLeads ?? []) {
    const source = matchRegistrySource(String(lead.candidate?.text_url ?? ""), registrySources);
    const verified = source
      ? await verifyArchiveLead(lead, {
          source,
          policy,
          fetchImpl,
          report,
          describe: (detail) =>
            `The supplied URL for "${lead.candidate?.title ?? "this text"}" points at an Internet Archive item that cannot be downloaded. ${detail}`,
        })
      : lead;
    if (verified) leads.push(verified);
  }
  leads.push(...(await registryDiscover));

  // Phase 2: AI lead discovery.
  if (scope.useAi !== false) {
    await store.updateProgress({ phase: "discovering_ai", query: scope.query, region: scope.region });
    try {
      const aiLeads = await (options.aiDiscover ?? defaultAiDiscover)(scope, registrySources);
      for (const lead of aiLeads) {
        if (!lead?.url || typeof lead.url !== "string" || !lead.url.startsWith("https://")) {
          await report({
            reason: "invalid_candidate",
            url: typeof lead?.url === "string" ? lead.url : null,
            detail: `AI lead rejected: missing or non-https URL (${lead?.title ?? "untitled"})`,
          });
          continue;
        }
        const source = matchRegistrySource(lead.url, registrySources);
        if (!source) {
          await report({
            reason: "unregistered_source",
            url: lead.url,
            detail: `AI lead "${lead.title}" points at a host that is not in the trusted source registry. Add the source to the registry to allow downloads.`,
          });
          continue;
        }
        if (!source.automated_download_allowed) {
          await report({
            sourceId: String(source.source_id),
            reason: "download_not_authorized",
            url: lead.url,
            detail: `AI lead "${lead.title}": source does not authorize automated download.`,
          });
          continue;
        }
        try {
          const discovered = aiLeadToLead(lead, source);
          // Archive.org leads are the ones models most often invent: confirm
          // the item and its file before the URL is stored as a candidate.
          const verified = await verifyArchiveLead(discovered, {
            source,
            policy,
            fetchImpl,
            report,
            describe: (detail) =>
              `AI lead "${lead.title}" points at an Internet Archive item that cannot be downloaded. ${detail}`,
          });
          if (!verified) continue;
          leads.push(verified);
        } catch (e) {
          await report({
            reason: "invalid_candidate",
            url: lead.url,
            detail: `AI lead rejected: ${cleanErrorText(e)}`,
          });
        }
      }
    } catch (e) {
      await report({
        reason: "fetch_failed",
        detail: `AI lead discovery failed: ${cleanErrorText(e)}`,
      });
    }
  }

  // Phase 3: create candidates (skip duplicates, validate everything).
  await store.updateProgress({ phase: "creating_candidates", discovered: leads.length });
  const existing = await store.existingEditionIds();

  // AI second opinion on primary vs secondary (heuristic remains the
  // fallback for non-AI cycles and for leads the model fails to classify).
  let aiVerdicts: (AiScreenVerdict | null)[] = leads.map(() => null);
  if (scope.useAi !== false && leads.length > 0) {
    await store.updateProgress({ phase: "screening_leads", discovered: leads.length });
    aiVerdicts = await screenLeads(
      leads.map((lead) => ({
        title: String(lead.candidate.title ?? ""),
        author: lead.candidate.author ? String(lead.candidate.author) : null,
      })),
      scope,
      options.aiScreen ?? defaultAiScreen,
      report,
      store.getScreenVerdicts && store.saveScreenVerdicts
        ? {
            get: (keys) => store.getScreenVerdicts!(keys),
            set: (entries) => store.saveScreenVerdicts!(entries),
          }
        : undefined,
    );
  }

  const created: DiscoveredLead[] = [];
  let duplicates = 0;
  let invalid = 0;
  let secondary = 0;
  for (let index = 0; index < leads.length; index += 1) {
    const lead = leads[index];
    const editionId = String(lead.candidate.edition_id);
    if (existing.has(editionId)) {
      duplicates += 1;
      continue;
    }
    const verdict = aiVerdicts[index];
    if (verdict) {
      // The model's verdict supersedes the keyword heuristic in both
      // directions: secondary verdicts block, primary verdicts pass through
      // even when the title contains an unlucky marker word.
      if (verdict.classification === "secondary") {
        secondary += 1;
        await report({
          reason: "secondary_source",
          url: String(lead.candidate.text_url ?? "") || null,
          editionId,
          detail: `Skipped as a secondary source (AI screening): ${verdict.justification} The hunter only collects original texts and their direct translations. Add it manually via Candidates if it really is a primary source.`,
        });
        continue;
      }
    } else {
      const secondaryMarker = looksLikeSecondarySource(
        String(lead.candidate.title ?? ""),
      );
      if (secondaryMarker) {
        secondary += 1;
        await report({
          reason: "secondary_source",
          url: String(lead.candidate.text_url ?? "") || null,
          editionId,
          detail: `Skipped as a secondary source (matched "${secondaryMarker}"): the hunter only collects original texts and their direct translations. Add it manually via Candidates if it really is a primary source.`,
        });
        continue;
      }
    }
    try {
      validateCandidate(lead.candidate);
    } catch (e) {
      invalid += 1;
      await report({
        reason: "invalid_candidate",
        url: String(lead.candidate.text_url ?? "") || null,
        editionId,
        detail: `Candidate failed validation: ${
          e instanceof FullTextValidationError ? e.message : String(e)
        }`,
      });
      continue;
    }
    await store.insertCandidate(lead.candidate);
    existing.add(editionId);
    created.push(lead);
  }

  // Phase 4: plan + download the cycle's candidates automatically.
  await store.updateProgress({ phase: "downloading", created: created.length });
  const robotsCheck: RobotsCheck =
    options.robotsCheck ??
    (async (url) => robotsAllowsUrl(url, CYCLE_USER_AGENT, { fetchImpl }));
  let records: Record<string, unknown>[] = [];
  /** Automatic Archive repair outcomes, by edition_id (one attempt each). */
  const archiveRepairs = new Map<string, Awaited<ReturnType<typeof repairArchiveDownload>>>();
  if (created.length > 0) {
    records = await collectFulltexts(
      created.map((lead) => lead.candidate),
      policy,
      registry,
      corpusRoot,
      {
        selectionMode: options.selectionMode ?? "all",
        userAgent: CYCLE_USER_AGENT,
        robotsCheck,
        fetchImpl,
      },
    );

    // Automatic fallback: in "preferred" mode only the top-ranked edition per
    // work is attempted. When that download is blocked (robots.txt, manual-
    // only source, fetch error…) the other discovered editions were never
    // tried — so re-plan among the untried candidates and attempt the next
    // best, until something is fetched or the pool is exhausted.
    if ((options.selectionMode ?? "all") === "preferred") {
      for (let pass = 1; pass <= MAX_FALLBACK_PASSES; pass += 1) {
        const fetchedWorks = new Set(
          records
            .filter((r) => FETCHED_DOWNLOAD_STATUSES.has(String(r.download_status)) && r.file)
            .map((r) => String(r.work_id)),
        );
        const attemptedEditions = new Set(
          records
            .filter((r) => String(r.download_status) !== "not_selected")
            .map((r) => String(r.edition_id)),
        );
        const blockedWorks = new Set(
          records
            .filter(
              (r) =>
                String(r.download_status) !== "not_selected" &&
                !fetchedWorks.has(String(r.work_id)),
            )
            .map((r) => String(r.work_id)),
        );
        const remaining = created
          .map((lead) => lead.candidate)
          .filter(
            (c) =>
              blockedWorks.has(String(c.work_id)) &&
              !attemptedEditions.has(String(c.edition_id)),
          );
        if (remaining.length === 0) break;

        await store.updateProgress({
          phase: "downloading_fallback",
          fallback_pass: pass,
          remaining_candidates: remaining.length,
        });
        const fallbackRecords = await collectFulltexts(remaining, policy, registry, corpusRoot, {
          selectionMode: "preferred",
          userAgent: CYCLE_USER_AGENT,
          robotsCheck,
          fetchImpl,
        });
        // Replace the stale "not_selected" placeholders for editions that
        // this pass attempted (or re-planned); keep everything else.
        const fallbackByEdition = new Map(
          fallbackRecords.map((r) => [String(r.edition_id), r] as const),
        );
        records = records
          .filter((r) => !fallbackByEdition.has(String(r.edition_id)))
          .concat(fallbackRecords);
      }
    }

    // Phase 4b: repair blocked Internet Archive downloads automatically.
    // A refused path, an untrusted redirect or a 404 means the URL was wrong,
    // not that the text is unavailable: resolve the item's real file and
    // retry the download once (through the same rights pipeline).
    for (let index = 0; index < records.length; index += 1) {
      const record = records[index];
      if (!isRepairableArchiveFailure(record)) continue;
      const editionId = String(record.edition_id ?? "");
      const lead = created.find((l) => String(l.candidate.edition_id) === editionId);
      if (!lead) continue;
      await store.updateProgress({ phase: "repairing_archive_links", edition_id: editionId });
      const outcome = await repairArchiveDownload(lead.candidate, {
        policy,
        registry,
        corpusRoot,
        userAgent: CYCLE_USER_AGENT,
        fetchImpl,
        robotsCheck,
      });
      archiveRepairs.set(editionId, outcome);
      if (outcome.candidate) {
        lead.candidate = outcome.candidate;
        await store.updateCandidate?.(outcome.candidate);
      }
      if (outcome.record) records[index] = outcome.record;
    }

    await store.mirrorCorpusRecords(records);
  }

  // Phase 5: derive blockers from download outcomes.
  for (const record of records) {
    const blocker = blockerFromRecord(record);
    if (!blocker) continue;
    const repair = archiveRepairs.get(String(record.edition_id ?? ""));
    if (repair) {
      blocker.resolvedUrl = repair.resolvedUrl;
      blocker.itemUrl = repair.itemUrl;
      blocker.repairState = repair.repaired ? "repaired" : "not_repairable";
      blocker.repairDetail = repair.detail;
      blocker.detail = `${blocker.detail ?? ""} — ${repair.detail}`.trim();
    }
    await report(blocker);
  }

  const files = records
    .map((r) => r.file as Record<string, unknown> | null)
    .filter((f): f is Record<string, unknown> => !!f);
  const summary: CycleSummary = {
    scope,
    discovered: leads.length,
    created: created.length,
    duplicates,
    invalid,
    secondary,
    downloaded_public: files.filter((f) => !f.locked).length,
    downloaded_locked: files.filter((f) => f.locked).length,
    metadata_only: records.filter((r) => r.download_status === "metadata_only").length,
    failed: records.filter((r) => r.download_status === "failed").length,
    blockers: blockerCount,
    entries: records,
    discovery: created.map((lead) => ({
      origin: lead.origin,
      originDetail: lead.originDetail,
      edition_id: String(lead.candidate.edition_id),
      title: String(lead.candidate.title),
    })),
  };
  await store.updateProgress({ phase: "completed", ...summaryLite(summary) });
  return summary;
}

/**
 * Heuristic screen for secondary literature. The hunter only collects
 * ORIGINAL sources (the texts themselves and direct translations); modern
 * scholarship ABOUT the texts is skipped and surfaced as a blocker so an
 * editor can override by adding the candidate manually.
 * Returns the matched marker, or null when the title looks primary.
 */
export function looksLikeSecondarySource(title: string): string | null {
  const t = ` ${title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()} `;
  const markers = [
    "encyclopedia", "encyclopaedia", "dictionary", "handbook", "companion to",
    "introduction to", "guide to", "a study", "studies in", "study of",
    "commentary on", "commentaries", "history of", "essays", "lectures",
    "textbook", "reader s", "anthology of criticism", "the ancient world",
    "civilization", "archaeology", "retold", "retelling", "stories from",
    "myths and legends of", "compilation", "grand bible", "survey of",
    "analysis", "interpretation of", "critical edition of scholarship",
    "who s who", "atlas of", "chronology",
  ];
  for (const marker of markers) {
    if (t.includes(` ${marker} `) || t.includes(marker)) return marker;
  }
  return null;
}

function summaryLite(summary: CycleSummary): Record<string, unknown> {
  const { entries, ...rest } = summary;
  void entries;
  return rest as unknown as Record<string, unknown>;
}
