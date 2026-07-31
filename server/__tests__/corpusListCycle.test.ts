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
import { runCorpusListCycle } from "../hunterCorpusCycle";
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
  const blockers: unknown[] = [];
  const progress: Record<string, unknown>[] = [];
  const mirrored: Record<string, unknown>[] = [];
  const store: CycleStore = {
    async existingEditionIds() {
      return new Set(editionIds);
    },
    async insertCandidate(c) {
      editionIds.add(String(c.edition_id));
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
  return { store, blockers, progress, mirrored };
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
});
