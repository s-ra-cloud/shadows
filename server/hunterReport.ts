/**
 * Read-only progress report over corpus-list runs.
 *
 * Pure functions over stored `hunter_runs` and `hunter_blockers` rows: no
 * database access here, so the report shape is unit-testable and the route
 * is a thin wrapper. Built for the benchmark list, but any corpus list
 * name works.
 */

export type ItemStatus =
  | "fetched"
  | "fetched_locked"
  | "metadata_only"
  | "failed"
  | "not_found"
  | "skipped";

/**
 * Who can act on a blocker reason. `code` is a bug or missing feature the
 * hunter's own code can fix; `adapter` needs a new discovery strategy;
 * `policy` is a trusted-source or robots decision for an editor; `rights`
 * is an editorial rights review and never a code change.
 */
export const FIX_CLASS_ROUTING: Record<string, "code" | "adapter" | "policy" | "rights"> = {
  not_found: "code",
  fetch_failed: "code",
  invalid_candidate: "code",
  secondary_source: "code",
  too_large: "code",
  discovery_unsupported: "adapter",
  unregistered_source: "policy",
  download_not_authorized: "policy",
  robots_disallowed: "policy",
  requires_auth: "policy",
  rights_locked: "rights",
};

const STATUS_RANK: Record<ItemStatus, number> = {
  fetched: 4,
  fetched_locked: 3,
  metadata_only: 2,
  failed: 1,
  not_found: 1,
  skipped: 0,
};

export interface ReportRunRow {
  id: number;
  status: string;
  startedAt: Date | string | null;
  finishedAt: Date | string | null;
  result: unknown;
  error: string | null;
}

export interface ReportBlockerRow {
  id: number;
  runId: number | null;
  sourceId: string | null;
  url: string | null;
  reason: string;
  detail: string | null;
  status: string;
}

export interface ReportRun {
  run_id: number;
  status: string;
  started_at: string | null;
  finished_at: string | null;
  error: string | null;
  total: number;
  fetched: number;
  fetched_locked: number;
  metadata_only: number;
  failed: number;
  not_found: number;
  skipped: number;
  /** (fetched + fetched_locked) / total, 0..1, null when the run has no items. */
  coverage: number | null;
  blocked_reasons: Record<string, number>;
}

export type ItemChange = "improved" | "regressed" | "unchanged" | "new";

export interface ReportItem {
  title: string;
  author: string | null;
  status: ItemStatus | string;
  previous_status: ItemStatus | string | null;
  change: ItemChange;
  languages: string[];
  detail: string;
  blockers: { reason: string; detail: string; url: string | null }[];
}

export interface ReportBlockerGroup {
  reason: string;
  source_id: string | null;
  owner: "code" | "adapter" | "policy" | "rights" | "unknown";
  count: number;
  sample_urls: string[];
  sample_detail: string | null;
}

export interface CorpusListReport {
  list: string;
  generated_at: string;
  runs: ReportRun[];
  latest: {
    run_id: number;
    coverage: number | null;
    previous_run_id: number | null;
    coverage_delta: number | null;
    improved: number;
    regressed: number;
    items: ReportItem[];
  } | null;
  /** Blockers recorded on the latest run, largest bucket first. */
  blockers: ReportBlockerGroup[];
  routing: typeof FIX_CLASS_ROUTING;
}

type StoredItem = {
  title: string;
  author: string | null;
  status: string;
  languages: string[];
  detail: string;
  blockers: { reason: string; detail: string; url: string | null }[];
};

function corpusListOf(result: unknown): Record<string, unknown> | null {
  if (!result || typeof result !== "object") return null;
  const corpusList = (result as Record<string, unknown>).corpus_list;
  return corpusList && typeof corpusList === "object" ? (corpusList as Record<string, unknown>) : null;
}

/** True when the stored run is a corpus-list cycle for `listName` (exactly; retries are named differently). */
export function isCorpusListRun(row: Pick<ReportRunRow, "result">, listName: string): boolean {
  const corpusList = corpusListOf(row.result);
  return !!corpusList && String(corpusList.name ?? "") === listName;
}

function itemsOf(result: unknown): StoredItem[] {
  const corpusList = corpusListOf(result);
  const raw = corpusList && Array.isArray(corpusList.items) ? (corpusList.items as Record<string, unknown>[]) : [];
  return raw.map((item) => ({
    title: String(item.title ?? ""),
    author: item.author == null ? null : String(item.author),
    status: String(item.status ?? "skipped"),
    languages: Array.isArray(item.languages) ? item.languages.map(String) : [],
    detail: String(item.detail ?? ""),
    blockers: Array.isArray(item.blockers)
      ? (item.blockers as Record<string, unknown>[]).map((b) => ({
          reason: String(b.reason ?? ""),
          detail: String(b.detail ?? ""),
          url: b.url == null ? null : String(b.url),
        }))
      : [],
  }));
}

function itemKey(item: { title: string; author: string | null }): string {
  return `${item.title.trim().toLowerCase()}|${(item.author ?? "").trim().toLowerCase()}`;
}

function iso(value: Date | string | null): string | null {
  if (value == null) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

function count(items: StoredItem[], status: ItemStatus): number {
  return items.filter((item) => item.status === status).length;
}

export function coverageOf(items: StoredItem[]): number | null {
  if (items.length === 0) return null;
  const hit = count(items, "fetched") + count(items, "fetched_locked");
  return Math.round((hit / items.length) * 1000) / 1000;
}

export function summarizeRun(row: ReportRunRow): ReportRun {
  const items = itemsOf(row.result);
  const corpusList = corpusListOf(row.result);
  const blockedReasons =
    corpusList && corpusList.blocked_reasons && typeof corpusList.blocked_reasons === "object"
      ? (corpusList.blocked_reasons as Record<string, number>)
      : {};
  return {
    run_id: row.id,
    status: row.status,
    started_at: iso(row.startedAt),
    finished_at: iso(row.finishedAt),
    error: row.error,
    total: items.length,
    fetched: count(items, "fetched"),
    fetched_locked: count(items, "fetched_locked"),
    metadata_only: count(items, "metadata_only"),
    failed: count(items, "failed"),
    not_found: count(items, "not_found"),
    skipped: count(items, "skipped"),
    coverage: coverageOf(items),
    blocked_reasons: blockedReasons,
  };
}

export function classifyChange(current: string, previous: string | null): ItemChange {
  if (previous == null) return "new";
  const now = STATUS_RANK[current as ItemStatus] ?? 0;
  const before = STATUS_RANK[previous as ItemStatus] ?? 0;
  if (now > before) return "improved";
  if (now < before) return "regressed";
  return "unchanged";
}

export function diffItems(current: ReportRunRow, previous: ReportRunRow | null): ReportItem[] {
  const before = new Map<string, StoredItem>();
  if (previous) for (const item of itemsOf(previous.result)) before.set(itemKey(item), item);
  return itemsOf(current.result).map((item) => {
    const prior = before.get(itemKey(item)) ?? null;
    return {
      title: item.title,
      author: item.author,
      status: item.status,
      previous_status: prior?.status ?? null,
      change: classifyChange(item.status, prior?.status ?? null),
      languages: item.languages,
      detail: item.detail,
      blockers: item.blockers,
    };
  });
}

export function groupBlockers(rows: ReportBlockerRow[]): ReportBlockerGroup[] {
  const groups = new Map<string, ReportBlockerGroup>();
  for (const row of rows) {
    const key = `${row.reason}|${row.sourceId ?? ""}`;
    let group = groups.get(key);
    if (!group) {
      group = {
        reason: row.reason,
        source_id: row.sourceId,
        owner: FIX_CLASS_ROUTING[row.reason] ?? "unknown",
        count: 0,
        sample_urls: [],
        sample_detail: null,
      };
      groups.set(key, group);
    }
    group.count += 1;
    if (row.url && group.sample_urls.length < 3 && !group.sample_urls.includes(row.url)) {
      group.sample_urls.push(row.url);
    }
    if (!group.sample_detail && row.detail) group.sample_detail = row.detail.slice(0, 300);
  }
  return Array.from(groups.values()).sort(
    (a, b) => b.count - a.count || a.reason.localeCompare(b.reason) || String(a.source_id).localeCompare(String(b.source_id)),
  );
}

/**
 * Build the report for one corpus list.
 *
 * `runs` may contain any runs (they are filtered by list name here) in any
 * order; the newest `limit` matching runs are reported. `blockers` should
 * hold the rows for the latest matching run (extra rows are ignored).
 */
export function buildCorpusListReport(input: {
  listName: string;
  runs: ReportRunRow[];
  blockers: ReportBlockerRow[];
  limit?: number;
  now?: Date;
}): CorpusListReport {
  const limit = Math.max(1, Math.min(input.limit ?? 5, 50));
  const matching = input.runs
    .filter((row) => isCorpusListRun(row, input.listName))
    .sort((a, b) => b.id - a.id);
  const completed = matching.filter((row) => row.status === "completed");
  const latest = completed[0] ?? null;
  const previous = completed[1] ?? null;
  const runs = matching.slice(0, limit).map(summarizeRun);

  let latestBlock: CorpusListReport["latest"] = null;
  if (latest) {
    const items = diffItems(latest, previous);
    const coverage = coverageOf(itemsOf(latest.result));
    const previousCoverage = previous ? coverageOf(itemsOf(previous.result)) : null;
    latestBlock = {
      run_id: latest.id,
      coverage,
      previous_run_id: previous?.id ?? null,
      coverage_delta:
        coverage != null && previousCoverage != null
          ? Math.round((coverage - previousCoverage) * 1000) / 1000
          : null,
      improved: items.filter((item) => item.change === "improved").length,
      regressed: items.filter((item) => item.change === "regressed").length,
      items,
    };
  }

  return {
    list: input.listName,
    generated_at: (input.now ?? new Date()).toISOString(),
    runs,
    latest: latestBlock,
    blockers: latest ? groupBlockers(input.blockers.filter((row) => row.runId === latest.id)) : [],
    routing: FIX_CLASS_ROUTING,
  };
}
