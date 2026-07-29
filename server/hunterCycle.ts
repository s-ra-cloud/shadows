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
import type { Candidate, Policy } from "./sourceHunter/rights";

export const CYCLE_USER_AGENT =
  "ReligiousMythologyResourceHunter/0.2 (hunting cycle; rights-aware research collector)";

export interface BlockerInput {
  sourceId?: string | null;
  url?: string | null;
  reason: string;
  detail?: string | null;
  workId?: string | null;
  editionId?: string | null;
}

export interface CycleStore {
  /** edition_ids already present, to avoid duplicate candidates. */
  existingEditionIds(): Promise<Set<string>>;
  insertCandidate(candidate: Candidate): Promise<void>;
  addBlocker(blocker: BlockerInput): Promise<void>;
  /** Live progress snapshot (persisted so the UI can poll). */
  updateProgress(progress: Record<string, unknown>): Promise<void>;
  /** Mirror downloaded corpus records into the corpus table. */
  mirrorCorpusRecords(records: Record<string, unknown>[]): Promise<void>;
}

export interface CycleScope {
  query: string;
  limit?: number;
  useAi?: boolean;
  /** Optional world region the editor scoped this cycle to (map launches). */
  region?: { id: string; label: string };
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
  /** Override registry crawling (tests). */
  registryDiscover?: (
    scope: CycleScope,
    registrySources: Record<string, unknown>[],
    report: (blocker: BlockerInput) => Promise<void>,
  ) => Promise<DiscoveredLead[]>;
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

async function discoverWikisource(
  scope: CycleScope,
  source: Record<string, unknown>,
  fetchImpl: typeof fetch,
): Promise<DiscoveredLead[]> {
  const limit = Math.min(scope.limit ?? 10, 25);
  const searchUrl =
    "https://wikisource.org/w/api.php?action=query&list=search&format=json&srlimit=" +
    limit +
    "&srsearch=" +
    encodeURIComponent(scope.query);
  const doc = await fetchJson(searchUrl, (source.allowed_hosts as string[]) ?? ["wikisource.org"], fetchImpl);
  const hits =
    (((doc.query as Record<string, unknown>) ?? {}).search as Record<string, unknown>[]) ?? [];
  return hits.map((hit) => {
    const title = String(hit.title ?? "Untitled");
    const pageId = String(hit.pageid ?? slug(title));
    const textUrl =
      "https://wikisource.org/w/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&format=json&titles=" +
      encodeURIComponent(title);
    const candidate: Candidate = {
      work_id: `work:${slug(title)}`,
      edition_id: `edition:wikisource-${pageId}`,
      title,
      author: null,
      translator: null,
      source_id: String(source.source_id),
      language: "und",
      language_role: "unknown",
      format: "json",
      text_url: textUrl,
      rights: {
        status_claim: "unknown",
        basis: "source_statement",
        statement:
          "Wikisource hosts public-domain and freely licensed texts; this page's licence has not been verified.",
        rights_url: "https://wikisource.org/wiki/Wikisource:Copyright_policy",
      },
      access: { download_allowed: true, requires_auth: false },
    };
    return {
      candidate,
      origin: "registry_crawl" as const,
      originDetail: `Wikisource search: ${title}`,
    };
  });
}

async function discoverInternetArchive(
  scope: CycleScope,
  source: Record<string, unknown>,
  fetchImpl: typeof fetch,
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
  return docs
    .filter((item) => item.identifier)
    .map((item) => {
      const identifier = String(item.identifier);
      const title = String(item.title ?? identifier);
      const licenseUrl = item.licenseurl ? String(item.licenseurl) : null;
      const language = item.language
        ? String(Array.isArray(item.language) ? item.language[0] : item.language)
            .toLowerCase()
            .slice(0, 3)
        : "und";
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
        format: "txt",
        text_url: `https://archive.org/download/${identifier}/${identifier}_djvu.txt`,
        rights: {
          status_claim: "unknown",
          basis: "source_statement",
          statement: licenseUrl
            ? `Internet Archive item licence: ${licenseUrl}`
            : "Internet Archive item; no explicit licence statement found in catalog metadata.",
          license_url: licenseUrl,
          rights_url: `https://archive.org/details/${identifier}`,
        },
        access: { download_allowed: true, requires_auth: false },
      };
      return {
        candidate,
        origin: "registry_crawl" as const,
        originDetail: `Internet Archive search: ${identifier}`,
      };
    });
}

const DISCOVERY_STRATEGIES: Record<
  string,
  (
    scope: CycleScope,
    source: Record<string, unknown>,
    fetchImpl: typeof fetch,
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
      leads.push(...(await strategy(scope, source, fetchImpl)));
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
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
          "You are a research librarian locating COMPLETE digitized primary texts (religious/mythological sources). " +
          "Return strict JSON: {\"leads\":[{\"title\",\"author\",\"url\",\"language\" (ISO 639), \"rights_statement\",\"license_url\",\"confidence\" (high|medium|low)}]}. " +
          "Every url must be a direct https link to the full text (plain text, XML or HTML), not a search page. " +
          `Prefer these trusted hosts when possible: ${hosts.join(", ")}. ` +
          "Only include rights statements you are confident about; otherwise say \"unknown\".",
      },
      {
        role: "user",
        content: `Find up to ${limit} complete-text editions relevant to: ${scope.query}${
          scope.region ? ` (mythological region: ${scope.region.label})` : ""
        }`,
      },
    ],
  });
  const text = completion.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(text) as { leads?: AiLead[] };
  return Array.isArray(parsed.leads) ? parsed.leads : [];
}

function matchRegistrySource(
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

function aiLeadToLead(
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
    const reason = /maximum_file_bytes|exceeds maximum/i.test(error) ? "too_large" : "fetch_failed";
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
  const leads: DiscoveredLead[] = await registryDiscover;

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
          leads.push(aiLeadToLead(lead, source));
        } catch (e) {
          await report({
            reason: "invalid_candidate",
            url: lead.url,
            detail: `AI lead rejected: ${e instanceof Error ? e.message : String(e)}`,
          });
        }
      }
    } catch (e) {
      await report({
        reason: "fetch_failed",
        detail: `AI lead discovery failed: ${e instanceof Error ? e.message : String(e)}`,
      });
    }
  }

  // Phase 3: create candidates (skip duplicates, validate everything).
  await store.updateProgress({ phase: "creating_candidates", discovered: leads.length });
  const existing = await store.existingEditionIds();
  const created: DiscoveredLead[] = [];
  let duplicates = 0;
  let invalid = 0;
  for (const lead of leads) {
    const editionId = String(lead.candidate.edition_id);
    if (existing.has(editionId)) {
      duplicates += 1;
      continue;
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
  if (created.length > 0) {
    records = await collectFulltexts(
      created.map((lead) => lead.candidate),
      policy,
      registry,
      corpusRoot,
      { selectionMode: "all", userAgent: CYCLE_USER_AGENT, robotsCheck },
    );
    await store.mirrorCorpusRecords(records);
  }

  // Phase 5: derive blockers from download outcomes.
  for (const record of records) {
    const blocker = blockerFromRecord(record);
    if (blocker) {
      await report(blocker);
    }
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

function summaryLite(summary: CycleSummary): Record<string, unknown> {
  const { entries, ...rest } = summary;
  void entries;
  return rest as unknown as Record<string, unknown>;
}
