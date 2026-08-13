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

const DISCOVERY_STRATEGIES: Record<
  string,
  (
    scope: CycleScope,
    source: Record<string, unknown>,
    fetchImpl: typeof fetch,
    report: (blocker: BlockerInput) => Promise<void>,
  ) => Promise<DiscoveredLead[]>
> = {
  "source:multilingual-wikisource": discoverWikisource,
  "source:internet-archive": discoverInternetArchive,
};

async function defaultRegistryDiscover(
  scope: CycleScope,
  registrySources: Record<string, unknown>[],
  report: (blocker: BlockerInput) => Promise<void>,
  fetchImpl: typeof fetch,
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
    const strategy = DISCOVERY_STRATEGIES[sourceId];
    if (!strategy) {
      await report({
        sourceId,
        reason: "discovery_unsupported",
        detail: `${source.name}: no automated discovery strategy for this source yet; add candidates manually.`,
      });
      continue;
    }
    try {
      leads.push(...(await strategy(scope, source, fetchImpl, report)));
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
    : defaultRegistryDiscover(scope, registrySources, report, fetchImpl);
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
