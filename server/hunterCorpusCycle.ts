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
import { cleanErrorText, truncateText, MAX_DETAIL_TEXT } from "./errorText";

export type CorpusItemStatus =
  | "fetched" // at least one edition downloaded to the public partition
  | "fetched_locked" // downloaded, but only to the locked research partition
  | "metadata_only" // found but the source does not permit automated download
  | "failed" // download attempted and failed
  | "not_found" // discovery produced no usable candidate
  | "skipped"; // cycle was stopped before this item was processed

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
    skipped: number;
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
  /**
   * Called before each item. When it returns true the loop exits immediately
   * and all remaining items are recorded as "skipped". The run still completes
   * successfully so the partial report is preserved.
   */
  shouldStop?: () => boolean;
  /** Test seams forwarded to runHuntingCycle. */
  cycleOverrides?: Partial<
    Pick<CycleOptions, "fetchImpl" | "robotsCheck" | "aiDiscover" | "aiScreen" | "registryDiscover">
  >;
}

const FETCHED_STATUSES = new Set(["downloaded", "already_present"]);

export const INTERRUPTED_ITEM_DETAIL =
  "The server restarted before this item was processed. Use Retry missing to hunt it.";

/**
 * Turn the progress snapshot of a corpus-list run that never finished (the
 * process died mid-list) into the same per-item report a completed run
 * stores, so the outcomes of the items that did run are not lost. Items the
 * run never reached are recorded as "skipped". Returns null when the stored
 * result already has a report or carries no corpus-list progress.
 */
export function salvageInterruptedCorpusResult(
  result: unknown,
): Record<string, unknown> | null {
  if (!result || typeof result !== "object") return null;
  const stored = result as Record<string, unknown>;
  if (stored.corpus_list && typeof stored.corpus_list === "object") return null;
  const progress = stored.progress as Record<string, unknown> | undefined;
  if (!progress || typeof progress !== "object") return null;
  const name = typeof progress.corpus_list === "string" ? progress.corpus_list : "";
  if (!name || !Array.isArray(progress.items)) return null;

  const outcomes = [...(progress.items as CorpusItemOutcome[])];
  const originals = Array.isArray(progress.original_items)
    ? (progress.original_items as CorpusListItem[])
    : [];
  for (const item of originals.slice(outcomes.length)) {
    outcomes.push({
      title: item.title,
      author: item.author ?? null,
      status: "skipped",
      languages: [],
      english: false,
      edition_ids: [],
      detail: INTERRUPTED_ITEM_DETAIL,
      blockers: [],
    });
  }
  const total = Math.max(
    outcomes.length,
    typeof progress.item_total === "number" ? progress.item_total : 0,
  );
  const corpusList: CorpusCycleResult["corpus_list"] = {
    name,
    total,
    fetched: outcomes.filter((o) => o.status === "fetched").length,
    fetched_locked: outcomes.filter((o) => o.status === "fetched_locked").length,
    metadata_only: outcomes.filter((o) => o.status === "metadata_only").length,
    failed: outcomes.filter((o) => o.status === "failed").length,
    not_found: outcomes.filter((o) => o.status === "not_found").length,
    // Items the progress snapshot never named still count as skipped.
    skipped: outcomes.filter((o) => o.status === "skipped").length + (total - outcomes.length),
    blocked_reasons: outcomes
      .flatMap((o) => o.blockers ?? [])
      .reduce<Record<string, number>>((acc, b) => {
        acc[b.reason] = (acc[b.reason] ?? 0) + 1;
        return acc;
      }, {}),
    items: outcomes,
    original_items: originals,
  };
  return { ...stored, corpus_list: corpusList, interrupted: true };
}

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
  let stopped = false;

  /**
   * Source-level blockers (a source with no discovery strategy, a source that
   * forbids automated download...) repeat identically for every item of the
   * list. They are recorded once per run so a nine-item list does not produce
   * nine copies of the same entry.
   */
  const seenSourceBlockers = new Set<string>();
  const sourceBlockerKey = (b: Record<string, unknown>): string | null => {
    const sourceId = b.sourceId ? String(b.sourceId) : "";
    // Only whole-source problems dedupe: anything tied to one URL, work or
    // edition is item-specific and always kept.
    if (!sourceId || b.url || b.workId || b.editionId) return null;
    return `${sourceId}|${String(b.reason ?? "")}|${String(b.detail ?? "")}`;
  };

  for (let index = 0; index < list.items.length; index += 1) {
    const item = list.items[index];

    // Check stop signal before starting this item.
    if (options.shouldStop?.()) {
      stopped = true;
      // Mark this and all remaining items as skipped.
      for (let rem = index; rem < list.items.length; rem += 1) {
        const remItem = list.items[rem];
        outcomes.push({
          title: remItem.title,
          author: remItem.author ?? null,
          status: "skipped",
          languages: [],
          english: false,
          edition_ids: [],
          detail: "Cycle was stopped by an editor before this item was processed.",
          blockers: [],
        });
      }
      break;
    }

    // `original_items` rides along on every progress write so an interrupted
    // run can still be salvaged into a per-item report (see
    // salvageInterruptedCorpusResult) and retried.
    await store.updateProgress({
      phase: "corpus_item",
      corpus_list: list.name,
      item_index: index + 1,
      item_total: list.items.length,
      current_title: item.title,
      items: outcomes,
      original_items: list.items,
    });

    const itemBlockers: CorpusItemBlocker[] = [];
    /** Source-level blockers suppressed for this item (already reported). */
    let suppressed = 0;
    const recordItemBlocker = (b: Record<string, unknown>) => {
      if (itemBlockers.length < MAX_ITEM_BLOCKERS) {
        itemBlockers.push({
          reason: String(b.reason ?? "unknown"),
          // Item blockers are written back into the run-progress payload, so
          // their text must be capped — otherwise one long error is copied
          // into every later progress write and the run record grows without
          // limit across the list.
          detail: truncateText(String(b.detail ?? ""), MAX_DETAIL_TEXT),
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
      addBlocker: async (b) => {
        const record = b as unknown as Record<string, unknown>;
        const key = sourceBlockerKey(record);
        if (key) {
          if (seenSourceBlockers.has(key)) {
            suppressed += 1;
            return;
          }
          seenSourceBlockers.add(key);
        }
        recordItemBlocker(record);
        await store.addBlocker(b);
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
          original_items: list.items,
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
      // The cause is cleaned here (driver noise stripped, length capped) so a
      // failure never carries a previous progress payload into the next one.
      const message = cleanErrorText(e, MAX_DETAIL_TEXT);
      const blocker = {
        reason: "fetch_failed",
        detail: truncateText(`Corpus-list item "${item.title}" failed: ${message}`, MAX_DETAIL_TEXT),
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
        detail: truncateText(`Cycle error: ${message}`, MAX_DETAIL_TEXT),
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
    totals.blockers += Math.max(0, summary.blockers - suppressed);
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
      skipped: outcomes.filter((o) => o.status === "skipped").length,
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
    phase: stopped ? "stopped" : "completed",
    corpus_list: { ...result.corpus_list, items: outcomes },
    ...totals,
  });
  return result;
}
