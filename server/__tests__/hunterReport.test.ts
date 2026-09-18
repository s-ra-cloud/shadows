import { describe, expect, it } from "vitest";
import {
  buildCorpusListReport,
  classifyChange,
  coverageOf,
  groupBlockers,
  isCorpusListRun,
  FIX_CLASS_ROUTING,
  type ReportBlockerRow,
  type ReportRunRow,
} from "../hunterReport";

type Item = { title: string; author?: string | null; status: string; blockers?: { reason: string; detail: string; url: string | null }[] };

function run(id: number, listName: string, items: Item[], status = "completed", extra: Record<string, unknown> = {}): ReportRunRow {
  const full = items.map((item) => ({
    title: item.title,
    author: item.author ?? null,
    status: item.status,
    languages: item.status.startsWith("fetched") ? ["en"] : [],
    english: item.status === "fetched",
    edition_ids: [],
    detail: "",
    blockers: item.blockers ?? [],
  }));
  const blockedReasons = full
    .flatMap((item) => item.blockers)
    .reduce<Record<string, number>>((acc, b) => ((acc[b.reason] = (acc[b.reason] ?? 0) + 1), acc), {});
  return {
    id,
    status,
    startedAt: new Date(Date.UTC(2026, 8, id)),
    finishedAt: new Date(Date.UTC(2026, 8, id, 1)),
    error: status === "failed" ? "boom" : null,
    result:
      status === "failed"
        ? { scope: { corpusList: listName }, corpus_list: { name: listName, items: [] } }
        : { scope: { corpusList: listName }, corpus_list: { name: listName, items: full, blocked_reasons: blockedReasons }, ...extra },
  };
}

function blocker(id: number, runId: number, reason: string, sourceId: string | null, url: string | null = null): ReportBlockerRow {
  return { id, runId, sourceId, url, reason, detail: `${reason} on ${url ?? "?"}`, status: "open" };
}

describe("hunterReport helpers", () => {
  it("recognises a corpus-list run by its exact list name", () => {
    expect(isCorpusListRun(run(1, "shadows-benchmark", []), "shadows-benchmark")).toBe(true);
    expect(isCorpusListRun(run(1, "shadows-benchmark (retry)", []), "shadows-benchmark")).toBe(false);
    expect(isCorpusListRun({ result: { scope: { query: "free text" } } }, "shadows-benchmark")).toBe(false);
    expect(isCorpusListRun({ result: null }, "shadows-benchmark")).toBe(false);
  });

  it("computes coverage from fetched and fetched_locked only", () => {
    const items = ["fetched", "fetched_locked", "metadata_only", "failed", "not_found", "skipped"].map((status) => ({
      title: status,
      author: null,
      status,
      languages: [],
      detail: "",
      blockers: [],
    }));
    expect(coverageOf(items)).toBe(0.333);
    expect(coverageOf([])).toBeNull();
  });

  it("ranks status transitions", () => {
    expect(classifyChange("fetched", "not_found")).toBe("improved");
    expect(classifyChange("fetched_locked", "fetched")).toBe("regressed");
    expect(classifyChange("failed", "not_found")).toBe("unchanged");
    expect(classifyChange("fetched", null)).toBe("new");
  });

  it("groups blockers by reason and source with an owner and samples", () => {
    const groups = groupBlockers([
      blocker(1, 9, "fetch_failed", "source:multilingual-wikisource", "https://ja.wikisource.org/wiki/A"),
      blocker(2, 9, "fetch_failed", "source:multilingual-wikisource", "https://ja.wikisource.org/wiki/B"),
      blocker(3, 9, "fetch_failed", "source:multilingual-wikisource", "https://ja.wikisource.org/wiki/A"),
      blocker(4, 9, "rights_locked", "source:internet-archive"),
      blocker(5, 9, "mystery_reason", null),
    ]);
    expect(groups.map((g) => [g.reason, g.source_id, g.count, g.owner])).toEqual([
      ["fetch_failed", "source:multilingual-wikisource", 3, "code"],
      ["mystery_reason", null, 1, "unknown"],
      ["rights_locked", "source:internet-archive", 1, "rights"],
    ]);
    expect(groups[0].sample_urls).toEqual(["https://ja.wikisource.org/wiki/A", "https://ja.wikisource.org/wiki/B"]);
    expect(groups[0].sample_detail).toContain("fetch_failed");
  });

  it("routes every documented blocker reason", () => {
    for (const reason of [
      "robots_disallowed", "requires_auth", "rights_locked", "fetch_failed", "unregistered_source",
      "discovery_unsupported", "download_not_authorized", "invalid_candidate", "secondary_source", "too_large", "not_found",
    ]) {
      expect(FIX_CLASS_ROUTING[reason], reason).toBeDefined();
    }
  });
});

describe("buildCorpusListReport", () => {
  const LIST = "shadows-benchmark";

  it("returns an empty report when no run matches", () => {
    const report = buildCorpusListReport({ listName: LIST, runs: [run(1, "other-list", [])], blockers: [] });
    expect(report.list).toBe(LIST);
    expect(report.runs).toEqual([]);
    expect(report.latest).toBeNull();
    expect(report.blockers).toEqual([]);
    expect(report.routing).toBe(FIX_CLASS_ROUTING);
  });

  it("reports runs newest first with coverage, and diffs the latest against the previous completed run", () => {
    const older = run(10, LIST, [
      { title: "Kojiki", author: "Chamberlain", status: "not_found" },
      { title: "Poetic Edda", author: "Bellows", status: "fetched" },
      { title: "The Baal Cycle", status: "not_found" },
      { title: "Theogony", author: "Hesiod", status: "fetched" },
    ]);
    const retry = run(11, `${LIST} (retry)`, [{ title: "Kojiki", author: "Chamberlain", status: "fetched" }]);
    const failed = run(12, LIST, [], "failed");
    const latest = run(13, LIST, [
      { title: "Kojiki", author: "Chamberlain", status: "fetched", blockers: [] },
      { title: "Poetic Edda", author: "Bellows", status: "fetched_locked" },
      { title: "The Baal Cycle", status: "not_found", blockers: [{ reason: "not_found", detail: "nothing", url: null }] },
      { title: "Theogony", author: "Hesiod", status: "fetched" },
      { title: "Heimskringla", author: "Snorri Sturluson", status: "failed" },
    ]);
    const report = buildCorpusListReport({
      listName: LIST,
      runs: [older, retry, failed, latest],
      blockers: [
        blocker(1, 13, "not_found", "source:multilingual-wikisource", "https://en.wikisource.org/wiki/Baal"),
        blocker(2, 13, "fetch_failed", "source:project-gutenberg", "https://www.gutenberg.org/ebooks/598"),
        blocker(3, 10, "fetch_failed", "source:project-gutenberg"), // older run: ignored
      ],
      limit: 2,
      now: new Date("2026-09-17T10:00:00Z"),
    });

    // The retry run is a different list; the failed run is listed but is not a baseline.
    expect(report.runs.map((r) => [r.run_id, r.status, r.coverage])).toEqual([
      [13, "completed", 0.6],
      [12, "failed", null],
    ]);
    expect(report.runs[0]).toMatchObject({ total: 5, fetched: 2, fetched_locked: 1, failed: 1, not_found: 1, skipped: 0 });
    expect(report.runs[0].blocked_reasons).toEqual({ not_found: 1 });

    expect(report.latest).toMatchObject({
      run_id: 13,
      previous_run_id: 10,
      coverage: 0.6,
      coverage_delta: 0.1,
      improved: 1,
      regressed: 1,
    });
    const byTitle = Object.fromEntries(report.latest!.items.map((item) => [item.title, item]));
    expect(byTitle["Kojiki"]).toMatchObject({ status: "fetched", previous_status: "not_found", change: "improved" });
    expect(byTitle["Poetic Edda"]).toMatchObject({ status: "fetched_locked", previous_status: "fetched", change: "regressed" });
    expect(byTitle["The Baal Cycle"]).toMatchObject({ change: "unchanged", blockers: [{ reason: "not_found", detail: "nothing", url: null }] });
    expect(byTitle["Heimskringla"]).toMatchObject({ previous_status: null, change: "new" });

    expect(report.blockers.map((g) => [g.reason, g.source_id, g.count, g.owner])).toEqual([
      ["fetch_failed", "source:project-gutenberg", 1, "code"],
      ["not_found", "source:multilingual-wikisource", 1, "code"],
    ]);
    expect(report.generated_at).toBe("2026-09-17T10:00:00.000Z");
  });

  it("lists a salvaged interrupted run with its partial counts but never uses it as the baseline", () => {
    const baseline = run(20, LIST, [
      { title: "Kojiki", status: "not_found" },
      { title: "Theogony", author: "Hesiod", status: "fetched" },
    ]);
    const interrupted = run(21, LIST, [
      { title: "Kojiki", status: "fetched" },
      { title: "Theogony", author: "Hesiod", status: "skipped" },
    ], "failed", {});
    // A restart-salvaged run keeps its report under a failed status.
    interrupted.result = { ...(baseline.result as object), ...(run(21, LIST, [
      { title: "Kojiki", status: "fetched" },
      { title: "Theogony", author: "Hesiod", status: "skipped" },
    ]).result as object), interrupted: true };
    const latest = run(22, LIST, [
      { title: "Kojiki", status: "fetched" },
      { title: "Theogony", author: "Hesiod", status: "fetched" },
    ]);
    const report = buildCorpusListReport({ listName: LIST, runs: [baseline, interrupted, latest], blockers: [] });
    expect(report.runs.map((r) => [r.run_id, r.status, r.interrupted, r.skipped, r.coverage])).toEqual([
      [22, "completed", false, 0, 1],
      [21, "failed", true, 1, 0.5],
      [20, "completed", false, 0, 0.5],
    ]);
    // The diff skips the interrupted run and compares 22 with 20.
    expect(report.latest).toMatchObject({ run_id: 22, previous_run_id: 20, coverage_delta: 0.5, improved: 1 });
  });

  it("marks every item new when there is no previous completed run", () => {
    const only = run(5, LIST, [{ title: "Kojiki", status: "fetched" }]);
    const report = buildCorpusListReport({ listName: LIST, runs: [only], blockers: [] });
    expect(report.latest).toMatchObject({ run_id: 5, previous_run_id: null, coverage: 1, coverage_delta: null });
    expect(report.latest!.items[0].change).toBe("new");
  });

  it("matches items by title and author, case-insensitively", () => {
    const before = run(1, LIST, [{ title: "Theogony", author: "Hesiod", status: "failed" }]);
    const after = run(2, LIST, [{ title: "theogony", author: "HESIOD", status: "fetched" }]);
    const report = buildCorpusListReport({ listName: LIST, runs: [after, before], blockers: [] });
    expect(report.latest!.items[0]).toMatchObject({ previous_status: "failed", change: "improved" });
  });
});
