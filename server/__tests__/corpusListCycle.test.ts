/**
 * Corpus-list hunting cycles: parsing the uploaded list (.csv/.json/.txt) and
 * running the per-item cycle with the English-first / AI-translatable-fallback
 * behavior and the end-of-cycle fetched-vs-not report.
 */
import { describe, it, expect } from "vitest";
import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import {
  parseCorpusList,
  corpusListName,
  splitCsvLine,
  CorpusListParseError,
} from "../hunterCorpusList";
import {
  runCorpusListCycle,
  salvageInterruptedCorpusResult,
  INTERRUPTED_ITEM_DETAIL,
  type CorpusCycleOptions,
} from "../hunterCorpusCycle";
import type { CycleStore, DiscoveredLead, CycleScope } from "../hunterCycle";
import type { Candidate } from "../sourceHunter/rights.js";

// ---------------------------------------------------------------------------
// parsing
// ---------------------------------------------------------------------------

describe("corpusListName", () => {
  it("uses the base name without extension", () => {
    expect(corpusListName("Norse Myths.csv")).toBe("Norse Myths");
    expect(corpusListName("/tmp/upload/greek-hymns.json")).toBe("greek-hymns");
    expect(corpusListName("list.txt")).toBe("list");
  });
});

describe("parseCorpusList", () => {
  it("parses txt lines with optional authors and skips comments", () => {
    const list = parseCorpusList(
      "My Cycle.txt",
      "# comment\nThe Poetic Edda\nTheogony — Hesiod\nMetamorphoses - Ovid\n\n",
    );
    expect(list.name).toBe("My Cycle");
    expect(list.items).toEqual([
      { title: "The Poetic Edda" },
      { title: "Theogony", author: "Hesiod" },
      { title: "Metamorphoses", author: "Ovid" },
    ]);
  });

  it("parses csv with a header row and quoted cells", () => {
    const list = parseCorpusList(
      "greek.csv",
      'title,author,language,url\n"Iliad, The",Homer,grc,\nOdyssey,Homer,,https://example.org/od.txt\n',
    );
    expect(list.items).toEqual([
      { title: "Iliad, The", author: "Homer", language: "grc" },
      { title: "Odyssey", author: "Homer", url: "https://example.org/od.txt" },
    ]);
  });

  it("parses headerless csv as title,author", () => {
    const list = parseCorpusList("x.csv", "Enuma Elish,\nGilgamesh,Sin-leqi-unninni\n");
    expect(list.items).toEqual([
      { title: "Enuma Elish" },
      { title: "Gilgamesh", author: "Sin-leqi-unninni" },
    ]);
  });

  it("parses json arrays of strings and objects, incl. wrappers", () => {
    expect(parseCorpusList("a.json", '["Kalevala", {"title":"Edda","author":"Snorri"}]').items).toEqual([
      { title: "Kalevala" },
      { title: "Edda", author: "Snorri" },
    ]);
    expect(parseCorpusList("b.json", '{"sources":[{"name":"Rigveda"}]}').items).toEqual([
      { title: "Rigveda" },
    ]);
  });

  it("de-duplicates on title+author", () => {
    const list = parseCorpusList("d.txt", "Kalevala\nkalevala\nKalevala — Lönnrot\n");
    expect(list.items).toHaveLength(2);
  });

  it("rejects empty lists, bad json, non-https urls and unknown extensions", () => {
    expect(() => parseCorpusList("e.txt", "\n#only comments\n")).toThrow(CorpusListParseError);
    expect(() => parseCorpusList("e.json", "{nope")).toThrow(CorpusListParseError);
    expect(() =>
      parseCorpusList("e.csv", "title,url\nX,http://insecure.example/x.txt\n"),
    ).toThrow(/https/);
    expect(() => parseCorpusList("e.pdf", "x")).toThrow(/Unsupported file type/);
  });
});

describe("splitCsvLine", () => {
  it("handles quotes and embedded commas/quotes", () => {
    expect(splitCsvLine('a,"b,c","d""e"')).toEqual(["a", "b,c", 'd"e']);
  });
});

// ---------------------------------------------------------------------------
// the cycle
// ---------------------------------------------------------------------------

const POLICY = {
  schema_version: "1.0.0",
  target_jurisdiction: "US",
  current_year: 2026,
  unlock_likely_public_domain: true,
  ai_translatable_languages: ["fr", "de", "es"],
  preferred_formats: ["txt", "xml", "html"],
  maximum_file_bytes: 10_000_000,
};

const REGISTRY = {
  schema_version: "1.0.0",
  sources: [
    {
      source_id: "source:test",
      name: "Test Source",
      allowed_hosts: ["example.org"],
      automated_download_allowed: true,
      robots_mode: "target_origin",
      rate_limit_seconds: 0,
    },
    {
      source_id: "source:internet-archive",
      name: "Internet Archive",
      allowed_hosts: ["archive.org"],
      allowed_path_prefixes: ["/download/"],
      automated_download_allowed: true,
      robots_mode: "target_origin",
      requests_per_second: 1000,
      rate_limit_seconds: 0,
    },
    {
      source_id: "source:manual-only",
      name: "Manual Only Source",
      allowed_hosts: ["manual-only.example"],
      automated_download_allowed: false,
      rate_limit_seconds: 0,
    },
  ],
};

function makeCandidate(title: string, language: string, url: string): Candidate {
  return {
    work_id: `work:${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    edition_id: `edition:${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${language}`,
    title,
    author: null,
    translator: null,
    source_id: "source:test",
    language,
    language_role: language === "en" ? "translation" : "translation",
    format: "txt",
    text_url: url,
    rights: {
      status_claim: "public_domain",
      statement: "Synthetic test text dedicated to the public domain worldwide.",
      license: "Public domain",
      license_url: null,
      rights_url: null,
      territories: ["WORLDWIDE"],
      basis: "manual",
    },
    access: { download_allowed: true, requires_auth: false },
  } as unknown as Candidate;
}

function memoryStore() {
  const editionIds = new Set<string>();
  const blockers: any[] = [];
  const progress: Record<string, unknown>[] = [];
  const mirrored: Record<string, unknown>[] = [];
  const candidates: Candidate[] = [];
  const store: CycleStore = {
    async existingEditionIds() {
      return new Set(editionIds);
    },
    async insertCandidate(c) {
      editionIds.add(String(c.edition_id));
      candidates.push(c);
    },
    async addBlocker(b) {
      blockers.push(b);
    },
    async updateProgress(p) {
      progress.push(p);
    },
    async mirrorCorpusRecords(r) {
      mirrored.push(...r);
    },
  };
  return { store, blockers, progress, mirrored, candidates };
}

function fetchStub(bodies: Record<string, string>): typeof fetch {
  return (async (input: any) => {
    const url = String(input);
    const body = bodies[url];
    if (body === undefined) return new Response("not found", { status: 404 });
    return new Response(body, { status: 200, headers: { "Content-Type": "text/plain" } });
  }) as typeof fetch;
}

describe("runCorpusListCycle", () => {
  it("fetches English when available, falls back to translatable languages, and reports per item", async () => {
    const corpusRoot = await fs.mkdtemp(path.join(os.tmpdir(), "corpus-cycle-"));
    const { store, progress } = memoryStore();

    // Item 1 has an English edition; item 2 only French; item 3 finds nothing.
    const leadsByTitle: Record<string, DiscoveredLead[]> = {
      "Theogony": [
        {
          candidate: makeCandidate("Theogony", "en", "https://example.org/theogony-en.txt"),
          origin: "registry_crawl",
          originDetail: "test",
        },
        {
          candidate: makeCandidate("Theogony", "fr", "https://example.org/theogony-fr.txt"),
          origin: "registry_crawl",
          originDetail: "test",
        },
      ],
      "Chanson de Roland": [
        {
          candidate: makeCandidate("Chanson de Roland", "fr", "https://example.org/roland-fr.txt"),
          origin: "registry_crawl",
          originDetail: "test",
        },
      ],
      "Lost Fragments": [],
    };

    const result = await runCorpusListCycle({
      list: {
        name: "test-list",
        items: [
          { title: "Theogony", author: "Hesiod" },
          { title: "Chanson de Roland" },
          { title: "Lost Fragments" },
        ],
      },
      policy: POLICY as never,
      registry: REGISTRY,
      corpusRoot,
      store,
      useAi: false,
      cycleOverrides: {
        fetchImpl: fetchStub({
          "https://example.org/theogony-en.txt": "The Theogony, complete English text.",
          "https://example.org/theogony-fr.txt": "La Théogonie, texte complet.",
          "https://example.org/roland-fr.txt": "La Chanson de Roland, texte complet.",
        }),
        robotsCheck: async () => ({ allowed: true, reason: "test" }),
        registryDiscover: async (scope: CycleScope) =>
          leadsByTitle[scope.targetWork?.title ?? ""] ?? [],
      },
    });

    const [theogony, roland, lost] = result.corpus_list.items;
    expect(theogony.status).toBe("fetched");
    expect(theogony.english).toBe(true);
    expect(theogony.languages).toContain("en");
    // "preferred" selection: the French Theogony is NOT downloaded when
    // English is available.
    expect(theogony.languages).not.toContain("fr");

    expect(roland.status).toBe("fetched");
    expect(roland.english).toBe(false);
    expect(roland.languages).toEqual(["fr"]);
    expect(roland.detail).toMatch(/No English edition/);

    expect(lost.status).toBe("not_found");
    expect(lost.edition_ids).toEqual([]);

    expect(result.corpus_list.total).toBe(3);
    expect(result.corpus_list.fetched).toBe(2);
    expect(result.corpus_list.not_found).toBe(1);

    // Progress carried the corpus phase and finished with the report.
    expect(progress.some((p) => p.phase === "corpus_item")).toBe(true);
    const final = progress[progress.length - 1] as Record<string, any>;
    expect(final.phase).toBe("completed");
    expect(final.corpus_list.items).toHaveLength(3);

    await fs.rm(corpusRoot, { recursive: true, force: true });
  });

  it("automatically falls back to the next edition when the preferred one is blocked", async () => {
    const corpusRoot = await fs.mkdtemp(path.join(os.tmpdir(), "corpus-cycle-fb-"));
    const { store } = memoryStore();

    // English edition exists but its download is blocked by robots.txt;
    // the French edition is fetchable. The hunter should try English first,
    // hit the block, then automatically fetch the French one.
    const leads: DiscoveredLead[] = [
      {
        candidate: makeCandidate("Blocked Epic", "en", "https://example.org/blocked-en.txt"),
        origin: "registry_crawl",
        originDetail: "test",
      },
      {
        candidate: makeCandidate("Blocked Epic", "fr", "https://example.org/blocked-fr.txt"),
        origin: "registry_crawl",
        originDetail: "test",
      },
    ];

    const result = await runCorpusListCycle({
      list: { name: "fallback-list", items: [{ title: "Blocked Epic" }] },
      policy: POLICY as never,
      registry: REGISTRY,
      corpusRoot,
      store,
      useAi: false,
      cycleOverrides: {
        fetchImpl: fetchStub({
          "https://example.org/blocked-fr.txt": "Texte complet en français.",
        }),
        robotsCheck: async (url: string) =>
          url.includes("blocked-en")
            ? { allowed: false, reason: "robots.txt disallows" }
            : { allowed: true, reason: "test" },
        registryDiscover: async () => leads,
      },
    });

    const [item] = result.corpus_list.items;
    expect(item.status).toBe("fetched");
    expect(item.languages).toEqual(["fr"]);
    expect(item.english).toBe(false);
    // The blocked English attempt is still reported so the editor sees why.
    expect(item.blockers.some((b) => b.reason === "robots_disallowed")).toBe(true);

    await fs.rm(corpusRoot, { recursive: true, force: true });
  });

  it("checks an Internet Archive URL from the list before it becomes a candidate", async () => {
    const corpusRoot = await fs.mkdtemp(path.join(os.tmpdir(), "corpus-cycle-ia-"));
    const { store, blockers, candidates } = memoryStore();

    // The Archive answers with an empty object for items that do not exist,
    // and the real file is not the conventional <identifier>_djvu.txt.
    const metadata: Record<string, unknown> = {
      "https://archive.org/metadata/verifieditem": {
        files: [
          { name: "verifieditem_meta.xml", format: "Metadata" },
          { name: "Verified Item.txt", format: "DjVuTXT", size: "42" },
        ],
        metadata: { identifier: "verifieditem", title: "Verified Item", language: "eng" },
      },
      "https://archive.org/metadata/inventeditem": {},
    };
    const archiveFetch = (async (input: any) => {
      const url = String(input);
      if (url in metadata) {
        return new Response(JSON.stringify(metadata[url]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url.startsWith("https://archive.org/advancedsearch.php")) {
        return new Response(JSON.stringify({ response: { numFound: 0, docs: [] } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url === "https://archive.org/download/verifieditem/Verified%20Item.txt") {
        return new Response("The verified Archive text.", {
          status: 200,
          headers: { "Content-Type": "text/plain" },
        });
      }
      return new Response("not found", { status: 404 });
    }) as typeof fetch;

    const result = await runCorpusListCycle({
      list: {
        name: "archive-list",
        items: [
          // A read-online link: never downloadable as it stands.
          { title: "Verified Item", url: "https://archive.org/details/verifieditem", language: "en" },
          // An identifier that does not exist on the Archive at all.
          { title: "Invented Item", url: "https://archive.org/details/inventeditem" },
        ],
      },
      policy: POLICY as never,
      registry: REGISTRY,
      corpusRoot,
      store,
      useAi: false,
      cycleOverrides: {
        fetchImpl: archiveFetch,
        robotsCheck: async () => ({ allowed: true, reason: "test" }),
        registryDiscover: async () => [],
      },
    });

    const [verified, invented] = result.corpus_list.items;
    // Downloaded, and still through rights review: the resolved item states no
    // licence, so the text lands locked rather than public.
    expect(verified.status).toBe("fetched_locked");
    // The stored candidate carries the resolved file URL, not the viewer link.
    const stored = candidates.find((c) => String(c.title) === "Verified Item")!;
    expect(stored.text_url).toBe("https://archive.org/download/verifieditem/Verified%20Item.txt");

    // Nothing unverified was stored for the invented identifier, and the
    // editor is told why in plain language.
    expect(candidates.some((c) => String(c.text_url ?? "").includes("inventeditem"))).toBe(false);
    expect(invented.status).toBe("not_found");
    const blocker = blockers.find((b) => String(b.url ?? "").includes("inventeditem"))!;
    expect(blocker.repairState).toBe("not_repairable");
    expect(String(blocker.repairDetail)).toMatch(/no item with this identifier/i);

    await fs.rm(corpusRoot, { recursive: true, force: true });
  });

  it("uses a URL from the list directly when its host is registered, and reports unregistered hosts", async () => {
    const corpusRoot = await fs.mkdtemp(path.join(os.tmpdir(), "corpus-cycle-url-"));
    const { store, blockers } = memoryStore();

    const result = await runCorpusListCycle({
      list: {
        name: "url-list",
        items: [
          { title: "Direct Text", url: "https://example.org/direct.txt", language: "en" },
          { title: "Off Registry", url: "https://unknown-host.example/x.txt" },
          { title: "Manual Only", url: "https://manual-only.example/y.txt" },
        ],
      },
      policy: POLICY as never,
      registry: REGISTRY,
      corpusRoot,
      store,
      useAi: false,
      cycleOverrides: {
        fetchImpl: fetchStub({
          "https://example.org/direct.txt": "Complete text fetched from the list URL.",
        }),
        robotsCheck: async () => ({ allowed: true, reason: "test" }),
        registryDiscover: async () => [],
      },
    });

    const [direct, offRegistry, manualOnly] = result.corpus_list.items;
    // Each item carries its own blockers so the report can explain WHY a
    // source was blocked, and the summary rolls the reasons up — with the
    // registered-but-manual-only case kept distinct from unregistered hosts.
    expect(offRegistry.blockers.some((b) => b.reason === "unregistered_source")).toBe(true);
    expect(manualOnly.blockers.some((b) => b.reason === "download_not_authorized")).toBe(true);
    expect(result.corpus_list.blocked_reasons.unregistered_source).toBeGreaterThanOrEqual(1);
    expect(result.corpus_list.blocked_reasons.download_not_authorized).toBeGreaterThanOrEqual(1);
    // A bare URL from the list carries no verified rights evidence, so the
    // rights pipeline downloads it to the LOCKED partition pending review —
    // exactly like an AI-suggested lead. It still counts as fetched.
    expect(direct.status).toBe("fetched_locked");
    expect(offRegistry.status).toBe("not_found");
    expect(
      blockers.some((b: any) => b.reason === "unregistered_source" && /Off Registry/.test(b.detail)),
    ).toBe(true);

    await fs.rm(corpusRoot, { recursive: true, force: true });
  });

  it("reports a source-level blocker once per run instead of once per item", async () => {
    const corpusRoot = await fs.mkdtemp(path.join(os.tmpdir(), "corpus-cycle-dedupe-"));
    const { store, blockers } = memoryStore();

    // A registry where no source has a discovery strategy: every item would
    // otherwise repeat the identical "discovery_unsupported" entry.
    const registry = {
      schema_version: "1.0.0",
      sources: [
        {
          source_id: "source:no-strategy",
          name: "Strategy-less Source",
          local_only: false,
          allowed_hosts: ["no-strategy.example"],
          automated_download_allowed: true,
          robots_mode: "target_origin",
          requests_per_second: 1,
        },
        {
          source_id: "source:manual-only",
          name: "Manual Only Source",
          local_only: false,
          allowed_hosts: ["manual-only.example"],
          automated_download_allowed: false,
          robots_mode: "target_origin",
          requests_per_second: 1,
        },
      ],
    };

    const result = await runCorpusListCycle({
      list: {
        name: "shinto",
        items: [{ title: "Kojiki" }, { title: "Nihon Shoki" }, { title: "Engishiki" }],
      },
      policy: POLICY as never,
      registry,
      corpusRoot,
      store,
      useAi: false,
      cycleOverrides: { fetchImpl: fetchStub({}) },
    });

    const unsupported = (blockers as any[]).filter((b) => b.reason === "discovery_unsupported");
    const notAuthorized = (blockers as any[]).filter((b) => b.reason === "download_not_authorized");
    expect(unsupported).toHaveLength(1);
    expect(unsupported[0].sourceId).toBe("source:no-strategy");
    expect(notAuthorized).toHaveLength(1);
    // The per-item report keeps the first occurrence only, and the run totals
    // count the same single entry.
    expect(result.corpus_list.items[0].blockers).toHaveLength(2);
    expect(result.corpus_list.items[1].blockers).toHaveLength(0);
    expect(result.corpus_list.blocked_reasons.discovery_unsupported).toBe(1);
    expect(result.summary.blockers).toBe(2);

    await fs.rm(corpusRoot, { recursive: true, force: true });
  });

  it("keeps repeated item failures short: the tenth is no bigger than the first", async () => {
    const corpusRoot = await fs.mkdtemp(path.join(os.tmpdir(), "corpus-cycle-fail-"));
    const { store, blockers, progress } = memoryStore();

    // Reproduces the snowball: every item fails with a driver exception whose
    // parameter dump contains the CURRENT run-progress payload. Without
    // cleaning, each failure's text is stored and fed back into the next
    // payload, so failure N carries failures 1..N-1 inside it.
    const failing: CorpusCycleOptions["cycleOverrides"] = {
      registryDiscover: async () => {
        const latest = JSON.stringify(progress[progress.length - 1] ?? {});
        const error = new Error(
          `Failed query: update "hunter_runs" set "result" = $1 where "hunter_runs"."id" = $2\nparams: ${latest},7`,
        );
        (error as { cause?: unknown }).cause = new Error("connection terminated unexpectedly");
        throw error;
      },
    };

    const items = Array.from({ length: 10 }, (_, i) => ({ title: `Doomed Text ${i + 1}` }));
    const result = await runCorpusListCycle({
      list: { name: "failing-list", items },
      policy: POLICY as never,
      registry: REGISTRY,
      corpusRoot,
      store,
      useAi: false,
      cycleOverrides: failing,
    });

    expect(result.corpus_list.failed).toBe(10);
    const first = result.corpus_list.items[0];
    const tenth = result.corpus_list.items[9];

    // Each failure names its own item and the real cause, not the statement.
    for (const outcome of result.corpus_list.items) {
      expect(outcome.detail).toMatch(/connection terminated unexpectedly/);
      expect(outcome.detail).not.toMatch(/params:/);
      expect(outcome.detail).not.toMatch(/hunter_runs/);
      expect(outcome.detail.length).toBeLessThanOrEqual(240);
    }
    expect(first.blockers[0].detail).toMatch(/Doomed Text 1/);
    expect(tenth.blockers[0].detail).toMatch(/Doomed Text 10/);
    expect(tenth.detail.length).toBeLessThanOrEqual(first.detail.length + 2);

    // Stored blocker details stay short, and the progress payload written for
    // the last item is not materially larger than the one for the first.
    for (const b of blockers as { detail: string }[]) {
      expect(b.detail.length).toBeLessThanOrEqual(240);
    }
    const payloadSizes = progress
      .filter((p) => p.phase === "corpus_item")
      .map((p) => JSON.stringify(p).length);
    expect(payloadSizes.length).toBeGreaterThanOrEqual(10);
    // Growth is linear in the number of items (one bounded outcome each),
    // never multiplicative from nesting previous payloads.
    const perItem = payloadSizes[0];
    expect(payloadSizes[payloadSizes.length - 1]).toBeLessThan(perItem * 15);

    await fs.rm(corpusRoot, { recursive: true, force: true });
  });
});

// ---------------------------------------------------------------------------
// interrupted runs
// ---------------------------------------------------------------------------

describe("salvageInterruptedCorpusResult", () => {
  const fetched = {
    title: "Theogony", author: "Hesiod", status: "fetched", languages: ["en"], english: true,
    edition_ids: ["edition:t"], detail: "", blockers: [],
  };
  const notFound = {
    title: "The Baal Cycle", author: null, status: "not_found", languages: [], english: false,
    edition_ids: [], detail: "No leads.", blockers: [{ reason: "not_found", detail: "nothing", url: null }],
  };
  const originals = [
    { title: "Theogony", author: "Hesiod", language: "en" },
    { title: "The Baal Cycle", language: "en" },
    { title: "Kojiki", author: "Basil Hall Chamberlain", language: "en", url: "https://en.wikisource.org/wiki/Kojiki" },
    { title: "Poetic Edda", author: "Henry Adams Bellows" },
  ];

  it("promotes the progress snapshot to a per-item report with the unreached items skipped", () => {
    const stored = {
      scope: { query: "Corpus list: shadows-benchmark", corpusList: "shadows-benchmark" },
      progress: {
        phase: "corpus_item", corpus_list: "shadows-benchmark", item_index: 3, item_total: 4,
        current_title: "Kojiki", items: [fetched, notFound], original_items: originals,
      },
    };
    const report = salvageInterruptedCorpusResult(stored)!;
    expect(report).not.toBeNull();
    expect(report.interrupted).toBe(true);
    expect(report.scope).toEqual(stored.scope);
    const corpusList = report.corpus_list as any;
    expect(corpusList.name).toBe("shadows-benchmark");
    expect(corpusList).toMatchObject({ total: 4, fetched: 1, not_found: 1, skipped: 2, failed: 0, blocked_reasons: { not_found: 1 } });
    expect(corpusList.items.map((i: any) => [i.title, i.status])).toEqual([
      ["Theogony", "fetched"],
      ["The Baal Cycle", "not_found"],
      ["Kojiki", "skipped"],
      ["Poetic Edda", "skipped"],
    ]);
    expect(corpusList.items[2].detail).toBe(INTERRUPTED_ITEM_DETAIL);
    expect(corpusList.items[2].author).toBe("Basil Hall Chamberlain");
    // The retry endpoint reads url and language from here.
    expect(corpusList.original_items).toEqual(originals);
  });

  it("counts unnamed remaining items as skipped when the snapshot predates original_items", () => {
    const report = salvageInterruptedCorpusResult({
      progress: { corpus_list: "old-list", item_total: 5, items: [fetched] },
    })!;
    const corpusList = report.corpus_list as any;
    expect(corpusList.items).toHaveLength(1);
    expect(corpusList).toMatchObject({ total: 5, fetched: 1, skipped: 4 });
    expect(corpusList.original_items).toEqual([]);
  });

  it("leaves completed runs, free-query runs and empty results alone", () => {
    expect(salvageInterruptedCorpusResult(null)).toBeNull();
    expect(salvageInterruptedCorpusResult({ scope: { query: "x" } })).toBeNull();
    expect(salvageInterruptedCorpusResult({ scope: {}, progress: { phase: "downloading" } })).toBeNull();
    expect(
      salvageInterruptedCorpusResult({ corpus_list: { name: "done", items: [] }, progress: { corpus_list: "done", items: [] } }),
    ).toBeNull();
  });

  it("is fed by every progress write of a corpus-list cycle", async () => {
    const corpusRoot = await fs.mkdtemp(path.join(os.tmpdir(), "corpus-cycle-progress-"));
    const { store: base } = memoryStore();
    // Snapshot each write the way the database does; the cycle hands over a
    // live reference to its outcomes array.
    const progress: Record<string, unknown>[] = [];
    const store: CycleStore = { ...base, updateProgress: async (p) => { progress.push(structuredClone(p)); } };
    const items = [{ title: "Theogony", author: "Hesiod" }, { title: "Lost Fragments" }];
    await runCorpusListCycle({
      list: { name: "progress-list", items },
      policy: POLICY as never,
      registry: REGISTRY,
      corpusRoot,
      store,
      useAi: false,
      cycleOverrides: {
        fetchImpl: fetchStub({ "https://example.org/theogony-en.txt": "The Theogony, complete English text." }),
        robotsCheck: async () => ({ allowed: true, reason: "test" }),
        registryDiscover: async (scope: CycleScope) =>
          scope.targetWork?.title === "Theogony"
            ? [{ candidate: makeCandidate("Theogony", "en", "https://example.org/theogony-en.txt"), origin: "registry_crawl" as const, originDetail: "test" }]
            : [],
      },
    });
    // Take the snapshot written while item 2 was in flight, as a restart would find it.
    const midFlight = progress.find((p) => p.phase === "corpus_item" && p.item_index === 2 && Array.isArray(p.items) && (p.items as unknown[]).length === 1);
    expect(midFlight).toBeDefined();
    expect(midFlight!.original_items).toEqual(items);
    const report = salvageInterruptedCorpusResult({ scope: {}, progress: midFlight })!;
    const corpusList = report.corpus_list as any;
    expect(corpusList.items.map((i: any) => [i.title, i.status])).toEqual([
      ["Theogony", "fetched"],
      ["Lost Fragments", "skipped"],
    ]);
    await fs.rm(corpusRoot, { recursive: true, force: true });
  });
});
