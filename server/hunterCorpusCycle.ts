/**
 * Corpus-list hunting cycles.
 *
 * The second way of feeding the hunter: instead of a free-form search scope,
 * the editor uploads a list of specific sources (the "corpus list"). The
 * cycle hunts each listed work in turn — complete and in English whenever
 * possible, otherwise in a language the AI can reliably translate — and the
 * run ends with a per-item report of what was fetched and what was not.
 *
 * Each item reuses the full standard cycle machinery (registry crawl, AI lead
 * discovery, primary/secondary screening, rights pipeline, blockers), scoped
 * to that one work and with "preferred" download selection so planCandidates
 * applies the English-first / AI-translatable-fallback ranking.
 */

import {
  runHuntingCycle,
  matchRegistrySource,
  aiLeadToLead,
  type CycleOptions,
  type CycleScope,
  type CycleStore,
  type CycleSummary,
  type DiscoveredLead,
} from "./hunterCycle";
import type { CorpusList, CorpusListItem } from "./hunterCorpusList";
import type { Policy } from "./sourceHunter/rights.js";

export type CorpusItemStatus =
  | "fetched" // at least one edition downloaded to the public partition
  | "fetched_locked" // downloaded, but only to the locked research partition
  | "metadata_only" // found but the source does not permit automated download
  | "failed" // download attempted and failed
  | "not_found"; // discovery produced no usable candidate

/** A blocker recorded while hunting one corpus-list item. */
export interface CorpusItemBlocker {
  reason: string;
  detail: string;
  url: string | null;
}

/** Cap on blockers kept per item (the run's blocker log keeps everything). */
const MAX_ITEM_BLOCKERS = 8;

export interface CorpusItemOutcome {
  title: string;
  author: string | null;
  status: CorpusItemStatus;
  /** Languages of the fetched files (empty unless fetched/fetched_locked). */
  languages: string[];
  /** True when an English edition was fetched. */
  english: boolean;
  /** edition_ids of fetched files (for linking to the corpus). */
  edition_ids: string[];
  /** Human-readable note (why not fetched, or what fallback was used). */
  detail: string;
  /** Why downloads were blocked/failed for this item (empty when fetched cleanly). */
  blockers: CorpusItemBlocker[];
}

export interface CorpusCycleResult {
  corpus_list: {
    name: string;
    total: number;
    fetched: number;
    fetched_locked: number;
    metadata_only: number;
    failed: number;
    not_found: number;
    /** Count of blockers per reason across all items (why downloads were blocked). */
    blocked_reasons: Record<string, number>;
    items: CorpusItemOutcome[];
    /**
     * The original uploaded list items, parallel to `items[]`.
     * Preserved so the retry endpoint can reconstruct the exact input
     * (including url and language) for each non-fetched item.
     */
    original_items: CorpusListItem[];
  };
  /** Aggregated standard-cycle counters across all items. */
  summary: Omit<CycleSummary, "scope" | "entries" | "discovery"> & {
    entries: Record<string, unknown>[];
    discovery: CycleSummary["discovery"];
  };
}

export interface CorpusCycleOptions {
  list: CorpusList;
  policy: Policy;
  registry: Record<string, unknown>;
  corpusRoot: string;
  store: CycleStore;
  useAi?: boolean;
  /** Per-item discovery cap (default 5 — the cycle targets one work). */
  limitPerItem?: number;
  /** Test seams forwarded to runHuntingCycle. */
  cycleOverrides?: Partial<
    Pick<CycleOptions, "fetchImpl" | "robotsCheck" | "aiDiscover" | "aiScreen" | "registryDiscover">
  >;
}

const FETCHED_STATUSES = new Set(["downloaded", "already_present"]);

/** Build a DiscoveredLead from a URL the editor supplied in the list. */
function leadFromListUrl(
  item: CorpusListItem,
  registrySources: Record<string, unknown>[],
): { lead?: DiscoveredLead; problem?: string; problemReason?: string } {
  if (!item.url) return {};
  const source = matchRegistrySource(item.url, registrySources);
  if (!source) {
    return {
      problemReason: "unregistered_source",
      problem: `The URL for "${item.title}" points at a host that is not in the trusted source registry; the hunter fell back to discovery.`,
    };
  }
  if (!source.automated_download_allowed) {
    return {
      problemReason: "download_not_authorized",
      problem: `The URL for "${item.title}" belongs to a source that does not authorize automated download; the hunter fell back to discovery.`,
    };
  }
  const lead = aiLeadToLead(
    {
      title: item.title,
      author: item.author ?? null,
      url: item.url,
      language: item.language ?? undefined,
      rights_statement: "unknown",
      confidence: "high",
    },
    source,
  );
  return { lead: { ...lead, origin: "registry_crawl", originDetail: `Corpus list URL: ${item.url}` } };
}

function outcomeFromSummary(
  item: CorpusListItem,
  summary: CycleSummary,
  itemBlockers: CorpusItemBlocker[],
): CorpusItemOutcome {
  const fetched = summary.entries.filter((r) => {
    const file = r.file as Record<string, unknown> | null;
    return FETCHED_STATUSES.has(String(r.download_status ?? "")) && !!file;
  });
  const publicFetched = fetched.filter((r) => !(r.file as Record<string, unknown>).locked);
  const lockedFetched = fetched.filter((r) => !!(r.file as Record<string, unknown>).locked);
  const languages = Array.from(
    new Set(fetched.map((r) => String(r.language ?? "und").toLowerCase())),
  );
  const english = languages.includes("en");
  const editionIds = fetched.map((r) => String(r.edition_id ?? "")).filter(Boolean);

  let status: CorpusItemStatus;
  let detail: string;
  if (publicFetched.length > 0) {
    status = "fetched";
    detail = english
      ? `Fetched in English (${publicFetched.length} file${publicFetched.length === 1 ? "" : "s"}).`
      : `No English edition found; fetched in: ${languages.join(", ")}.`;
  } else if (lockedFetched.length > 0) {
    status = "fetched_locked";
    detail = `Fetched to the locked research partition (${languages.join(", ") || "unknown language"}); rights review pending.`;
  } else if (summary.metadata_only > 0) {
    status = "metadata_only";
    detail = "Found, but the source does not permit automated download.";
  } else if (summary.failed > 0) {
    status = "failed";
    detail = "Download attempted but failed.";
  } else {
    status = "not_found";
    detail =
      summary.discovered === 0
        ? "Discovery found no leads for this work."
        : summary.secondary > 0 && summary.created === 0
          ? "Only secondary literature was found; no original text located."
          : "Leads were found but none produced a usable candidate.";
  }
  return {
    title: item.title,
    author: item.author ?? null,
    status,
    languages,
    english,
    edition_ids: editionIds,
    detail,
    blockers: itemBlockers,
  };
}

export async function runCorpusListCycle(options: CorpusCycleOptions): Promise<CorpusCycleResult> {
  const { list, policy, registry, corpusRoot, store } = options;
  const registrySources = (registry.sources as Record<string, unknown>[]) ?? [];
  const preferredLanguages = (policy.ai_translatable_languages as string[]) ?? [];

  const outcomes: CorpusItemOutcome[] = [];
  const totals = {
    discovered: 0,
    created: 0,
    duplicates: 0,
    invalid: 0,
    secondary: 0,
    downloaded_public: 0,
    downloaded_locked: 0,
    metadata_only: 0,
    failed: 0,
    blockers: 0,
  };
  const allEntries: Record<string, unknown>[] = [];
  const allDiscovery: CycleSummary["discovery"] = [];

  for (let index = 0; index < list.items.length; index += 1) {
    const item = list.items[index];
    await store.updateProgress({
      phase: "corpus_item",
      corpus_list: list.name,
      item_index: index + 1,
      item_total: list.items.length,
      current_title: item.title,
      items: outcomes,
    });

    const itemBlockers: CorpusItemBlocker[] = [];
    const recordItemBlocker = (b: Record<string, unknown>) => {
      if (itemBlockers.length < MAX_ITEM_BLOCKERS) {
        itemBlockers.push({
          reason: String(b.reason ?? "unknown"),
          detail: String(b.detail ?? ""),
          url: b.url ? String(b.url) : null,
        });
      }
    };

    const { lead: urlLead, problem: urlProblem, problemReason } = leadFromListUrl(item, registrySources);
    if (urlProblem) {
      const blocker = {
        url: item.url ?? null,
        reason: problemReason ?? "unregistered_source",
        detail: urlProblem,
      };
      await store.addBlocker(blocker);
      recordItemBlocker(blocker);
      totals.blockers += 1;
    }

    const scope: CycleScope = {
      query: `"${item.title}"${item.author ? ` by ${item.author}` : ""}`,
      limit: options.limitPerItem ?? 5,
      useAi: options.useAi !== false,
      targetWork: { title: item.title, author: item.author ?? null, language: item.language ?? null },
      preferredLanguages,
    };

    // Progress updates inside the per-item cycle would clobber the corpus-level
    // progress snapshot, so they are folded into it instead.
    const itemStore: CycleStore = {
      ...store,
      existingEditionIds: () => store.existingEditionIds(),
      insertCandidate: (c) => store.insertCandidate(c),
      addBlocker: (b) => {
        recordItemBlocker(b as unknown as Record<string, unknown>);
        return store.addBlocker(b);
      },
      mirrorCorpusRecords: (r) => store.mirrorCorpusRecords(r),
      updateProgress: (progress) =>
        store.updateProgress({
          phase: "corpus_item",
          corpus_list: list.name,
          item_index: index + 1,
          item_total: list.items.length,
          current_title: item.title,
          item_phase: progress.phase,
          items: outcomes,
        }),
    };
    if (store.getScreenVerdicts) itemStore.getScreenVerdicts = (k) => store.getScreenVerdicts!(k);
    if (store.saveScreenVerdicts) itemStore.saveScreenVerdicts = (e) => store.saveScreenVerdicts!(e);

    let summary: CycleSummary;
    try {
      summary = await runHuntingCycle({
        scope,
        policy,
        registry,
        corpusRoot,
        store: itemStore,
        selectionMode: "preferred",
        ...(urlLead ? { extraLeads: [urlLead] } : {}),
        ...(options.cycleOverrides ?? {}),
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      const blocker = {
        reason: "fetch_failed",
        detail: `Corpus-list item "${item.title}" failed: ${message}`,
      };
      await store.addBlocker(blocker);
      recordItemBlocker(blocker);
      totals.blockers += 1;
      outcomes.push({
        title: item.title,
        author: item.author ?? null,
        status: "failed",
        languages: [],
        english: false,
        edition_ids: [],
        detail: `Cycle error: ${message}`,
        blockers: itemBlockers,
      });
      continue;
    }

    totals.discovered += summary.discovered;
    totals.created += summary.created;
    totals.duplicates += summary.duplicates;
    totals.invalid += summary.invalid;
    totals.secondary += summary.secondary;
    totals.downloaded_public += summary.downloaded_public;
    totals.downloaded_locked += summary.downloaded_locked;
    totals.metadata_only += summary.metadata_only;
    totals.failed += summary.failed;
    totals.blockers += summary.blockers;
    allEntries.push(...summary.entries);
    allDiscovery.push(...summary.discovery);
    outcomes.push(outcomeFromSummary(item, summary, itemBlockers));
  }

  const result: CorpusCycleResult = {
    corpus_list: {
      name: list.name,
      total: list.items.length,
      fetched: outcomes.filter((o) => o.status === "fetched").length,
      fetched_locked: outcomes.filter((o) => o.status === "fetched_locked").length,
      metadata_only: outcomes.filter((o) => o.status === "metadata_only").length,
      failed: outcomes.filter((o) => o.status === "failed").length,
      not_found: outcomes.filter((o) => o.status === "not_found").length,
      blocked_reasons: outcomes
        .flatMap((o) => o.blockers)
        .reduce<Record<string, number>>((acc, b) => {
          acc[b.reason] = (acc[b.reason] ?? 0) + 1;
          return acc;
        }, {}),
      items: outcomes,
      original_items: list.items,
    },
    summary: { ...totals, entries: allEntries, discovery: allDiscovery },
  };
  await store.updateProgress({
    phase: "completed",
    corpus_list: { ...result.corpus_list, items: outcomes },
    ...totals,
  });
  return result;
}
