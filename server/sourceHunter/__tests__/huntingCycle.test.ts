/**
 * Hunting-cycle engine tests: discovery injection, candidate creation,
 * public/locked partitioning, and the blocker ledger.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
  runHuntingCycle,
  blockerFromRecord,
  fetchJson,
  looksLikeSecondarySource,
  confidentlySecondary,
  screenLeads,
  screenCacheKey,
  SCREEN_CHUNK_SIZE,
  type AiScreenVerdict,
  type ScreenVerdictCache,
  type BlockerInput,
  type CycleStore,
  type DiscoveredLead,
} from "../../hunterCycle";
import { parseRobots, robotsRulesAllow, clearRobotsCache } from "../robots";
import { loadDefaultPolicy } from "../index";
import type { Candidate } from "../rights";

function makeStore() {
  const candidates: Candidate[] = [];
  const blockers: BlockerInput[] = [];
  const progress: Record<string, unknown>[] = [];
  const mirrored: Record<string, unknown>[] = [];
  const existing = new Set<string>();
  const store: CycleStore = {
    async existingEditionIds() {
      return new Set(existing);
    },
    async insertCandidate(candidate) {
      candidates.push(candidate);
    },
    async addBlocker(blocker) {
      blockers.push(blocker);
    },
    async updateProgress(p) {
      progress.push(p);
    },
    async mirrorCorpusRecords(records) {
      mirrored.push(...records);
    },
  };
  return { store, candidates, blockers, progress, mirrored, existing };
}

const REGISTRY = {
  schema_version: "1.0.0",
  sources: [
    {
      source_id: "source:local-import",
      name: "Local import",
      local_only: true,
      allowed_hosts: [],
      automated_download_allowed: true,
      terms_url: null,
      robots_mode: "not_applicable",
      requests_per_second: 10,
      rights_notes: "reviewed local files",
    },
    {
      source_id: "source:no-auto",
      name: "Manual-only source",
      local_only: false,
      allowed_hosts: ["manual.example.org"],
      automated_download_allowed: false,
      terms_url: null,
      robots_mode: "target_origin",
      requests_per_second: 1,
      rights_notes: "requires manual review",
    },
  ],
};

function localCandidate(id: string, filePath: string, statement: string): Candidate {
  return {
    work_id: `work:${id}`,
    edition_id: `edition:${id}`,
    title: `Test ${id}`,
    author: null,
    translator: null,
    source_id: "source:local-import",
    language: "en",
    language_role: "translation",
    format: "txt",
    local_path: filePath,
    rights: { status_claim: "unknown", basis: "source_statement", statement },
    access: { download_allowed: true, requires_auth: false },
  };
}

describe("runHuntingCycle", () => {
  let corpusRoot: string;
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "hunter-cycle-"));
    corpusRoot = path.join(tmpDir, "corpus");
  });

  it("creates candidates, partitions downloads and records blockers", async () => {
    const openFile = path.join(tmpDir, "open.txt");
    const murkyFile = path.join(tmpDir, "murky.txt");
    await fs.writeFile(
      openFile,
      "Hymn to the city goddess. License: https://creativecommons.org/licenses/by/4.0/\n",
    );
    await fs.writeFile(murkyFile, "An edition with no rights statement at all.\n");
    const policy = await loadDefaultPolicy();

    const { store, candidates, blockers, mirrored } = makeStore();
    const leads: DiscoveredLead[] = [
      {
        candidate: localCandidate("open-hymn", openFile, "CC BY 4.0"),
        origin: "registry_crawl",
        originDetail: "fixture",
      },
      {
        candidate: localCandidate("murky-hymn", murkyFile, "unknown"),
        origin: "ai_search",
        originDetail: "fixture ai",
      },
      {
        // Missing required fields -> invalid_candidate blocker.
        candidate: { edition_id: "edition:broken", title: "Broken" } as Candidate,
        origin: "ai_search",
        originDetail: "broken",
      },
    ];

    const summary = await runHuntingCycle({
      scope: { query: "city goddess", useAi: true },
      policy,
      registry: REGISTRY,
      corpusRoot,
      store,
      registryDiscover: async (_scope, sources, report) => {
        // Mimic the default: manual-only sources are reported, not crawled.
        for (const source of sources) {
          if (!source.local_only && !source.automated_download_allowed) {
            await report({
              sourceId: String(source.source_id),
              reason: "download_not_authorized",
              detail: "manual only",
            });
          }
        }
        return leads;
      },
      aiDiscover: async () => [],
      // No AI opinions -> keyword heuristic fallback for every lead.
      aiScreen: async (leads) => leads.map(() => null),
    });

    expect(summary.discovered).toBe(3);
    expect(summary.created).toBe(2);
    expect(summary.invalid).toBe(1);
    expect(candidates.map((c) => c.edition_id)).toEqual([
      "edition:open-hymn",
      "edition:murky-hymn",
    ]);
    // CC BY marker -> public, unknown rights -> locked.
    expect(summary.downloaded_public).toBe(1);
    expect(summary.downloaded_locked).toBe(1);
    expect(mirrored.length).toBe(2);
    const reasons = blockers.map((b) => b.reason).sort();
    expect(reasons).toEqual(["download_not_authorized", "invalid_candidate", "rights_locked"]);
    const lockedBlocker = blockers.find((b) => b.reason === "rights_locked");
    expect(lockedBlocker?.editionId).toBe("edition:murky-hymn");
    // Locked file exists in the locked partition, never public.
    const locked = await fs.readdir(path.join(corpusRoot, "locked", "murky-hymn"));
    expect(locked.some((f) => f.endsWith(".txt"))).toBe(true);
  });

  it("skips duplicate edition_ids", async () => {
    const file = path.join(tmpDir, "dup.txt");
    await fs.writeFile(file, "text\n");
    const policy = await loadDefaultPolicy();
    const { store, existing, candidates } = makeStore();
    existing.add("edition:dup");
    const summary = await runHuntingCycle({
      scope: { query: "x", useAi: false },
      policy,
      registry: REGISTRY,
      corpusRoot,
      store,
      registryDiscover: async () => [
        {
          candidate: localCandidate("dup", file, "unknown"),
          origin: "registry_crawl",
          originDetail: "fixture",
        },
      ],
    });
    expect(summary.duplicates).toBe(1);
    expect(summary.created).toBe(0);
    expect(candidates.length).toBe(0);
  });

  it("records an AI failure as a blocker without failing the cycle", async () => {
    const policy = await loadDefaultPolicy();
    const { store, blockers } = makeStore();
    const summary = await runHuntingCycle({
      scope: { query: "x", useAi: true },
      policy,
      registry: REGISTRY,
      corpusRoot,
      store,
      registryDiscover: async () => [],
      aiDiscover: async () => {
        throw new Error("model unavailable");
      },
    });
    expect(summary.created).toBe(0);
    expect(blockers.some((b) => b.reason === "fetch_failed" && /model unavailable/.test(String(b.detail)))).toBe(true);
  });

  it("routes AI leads to registered sources and flags unregistered hosts", async () => {
    const policy = await loadDefaultPolicy();
    const { store, blockers } = makeStore();
    await runHuntingCycle({
      scope: { query: "x", useAi: true },
      policy,
      registry: REGISTRY,
      corpusRoot,
      store,
      registryDiscover: async () => [],
      aiDiscover: async () => [
        { title: "Off registry", url: "https://unknown-host.example.com/text.txt" },
        { title: "Manual host", url: "https://manual.example.org/text.txt" },
        { title: "Bad url", url: "http://insecure.example.com/text.txt" },
      ],
    });
    const reasons = blockers.map((b) => b.reason).sort();
    expect(reasons).toEqual(["download_not_authorized", "invalid_candidate", "unregistered_source"]);
  });
});

describe("primary-source screening", () => {
  it("flags secondary literature by title", () => {
    expect(looksLikeSecondarySource("Encyclopedia of World Mythology")).toBeTruthy();
    expect(looksLikeSecondarySource("A Handbook of Norse Mythology")).toBeTruthy();
    expect(looksLikeSecondarySource("THE GRAND BIBLE - An Encyclopaedic Compilation")).toBeTruthy();
    expect(looksLikeSecondarySource("The ancient world (2700 B.C.E.--c.500 C.E.)")).toBeTruthy();
    expect(looksLikeSecondarySource("History of the Babylonian Religion")).toBeTruthy();
  });

  it("keeps original texts and direct translations", () => {
    expect(looksLikeSecondarySource("Enuma Elish: The Seven Tablets of Creation")).toBeNull();
    expect(looksLikeSecondarySource("The Poetic Edda")).toBeNull();
    expect(looksLikeSecondarySource("Rig Veda, translated by Ralph Griffith")).toBeNull();
    expect(looksLikeSecondarySource("Popol Vuh")).toBeNull();
    expect(looksLikeSecondarySource("Theogony of Hesiod")).toBeNull();
  });

  it("records skipped secondary leads as blockers in a cycle", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "hunter-secondary-"));
    const file = path.join(tmp, "enc.txt");
    await fs.writeFile(file, "text\n");
    const policy = await loadDefaultPolicy();
    const { store, blockers, candidates } = makeStore();
    const lead = {
      candidate: {
        ...localCandidate("enc", file, "unknown"),
        title: "Encyclopedia of Ancient Deities",
      },
      origin: "registry_crawl" as const,
      originDetail: "fixture",
    };
    const summary = await runHuntingCycle({
      scope: { query: "x", useAi: false },
      policy,
      registry: REGISTRY,
      corpusRoot: path.join(tmp, "corpus"),
      store,
      registryDiscover: async () => [lead],
    });
    expect(summary.secondary).toBe(1);
    expect(summary.created).toBe(0);
    expect(candidates.length).toBe(0);
    expect(blockers.some((b) => b.reason === "secondary_source")).toBe(true);
  });
});

describe("AI primary/secondary screening", () => {
  let tmp: string;
  async function fixtureLead(id: string, title: string) {
    const file = path.join(tmp, `${id}.txt`);
    await fs.writeFile(file, "text\n");
    return {
      candidate: { ...localCandidate(id, file, "unknown"), title },
      origin: "registry_crawl" as const,
      originDetail: "fixture",
    };
  }

  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "hunter-ai-screen-"));
  });

  it("blocks secondary leads the keyword heuristic misses, with the model's justification", async () => {
    const policy = await loadDefaultPolicy();
    const { store, blockers, candidates } = makeStore();
    const title = "Babylonian Religion and Its Legacy";
    expect(looksLikeSecondarySource(title)).toBeNull(); // heuristic misses it
    const summary = await runHuntingCycle({
      scope: { query: "babylon", useAi: true },
      policy,
      registry: REGISTRY,
      corpusRoot: path.join(tmp, "corpus"),
      store,
      registryDiscover: async () => [await fixtureLead("legacy", title)],
      aiDiscover: async () => [],
      aiScreen: async () => [
        { classification: "secondary", justification: "A modern survey about Babylonian religion, not a primary text." },
      ],
    });
    expect(summary.secondary).toBe(1);
    expect(summary.created).toBe(0);
    expect(candidates.length).toBe(0);
    const blocker = blockers.find((b) => b.reason === "secondary_source");
    expect(blocker?.detail).toContain("AI screening");
    expect(blocker?.detail).toContain("modern survey about Babylonian religion");
  });

  it("lets a primary verdict pass a lead the heuristic would have flagged", async () => {
    const policy = await loadDefaultPolicy();
    const { store, candidates } = makeStore();
    const title = "History of the Kings of Britain"; // heuristic marker "history of"
    expect(looksLikeSecondarySource(title)).toBeTruthy();
    const summary = await runHuntingCycle({
      scope: { query: "britain", useAi: true },
      policy,
      registry: REGISTRY,
      corpusRoot: path.join(tmp, "corpus"),
      store,
      registryDiscover: async () => [await fixtureLead("hkb", title)],
      aiDiscover: async () => [],
      aiScreen: async () => [
        { classification: "primary", justification: "Geoffrey of Monmouth's medieval chronicle is itself a primary text." },
      ],
    });
    expect(summary.secondary).toBe(0);
    expect(summary.created).toBe(1);
    expect(candidates.map((c) => c.title)).toEqual([title]);
  });

  it("falls back to the heuristic and records a blocker when screening fails", async () => {
    const policy = await loadDefaultPolicy();
    const { store, blockers } = makeStore();
    const summary = await runHuntingCycle({
      scope: { query: "x", useAi: true },
      policy,
      registry: REGISTRY,
      corpusRoot: path.join(tmp, "corpus"),
      store,
      registryDiscover: async () => [
        await fixtureLead("edda", "The Poetic Edda"),
        await fixtureLead("enc2", "Encyclopedia of Ancient Deities"),
      ],
      aiDiscover: async () => [],
      aiScreen: async () => {
        throw new Error("screening model unavailable");
      },
    });
    // Heuristic still catches the encyclopedia; the primary text still lands.
    expect(summary.secondary).toBe(1);
    expect(summary.created).toBe(1);
    expect(
      blockers.some((b) => b.reason === "fetch_failed" && /screening model unavailable/.test(String(b.detail))),
    ).toBe(true);
    expect(blockers.some((b) => b.reason === "secondary_source" && /matched/.test(String(b.detail)))).toBe(true);
  });

  it("skips AI screening for leads the heuristic confidently flags, blocking them by heuristic", async () => {
    const policy = await loadDefaultPolicy();
    const { store, blockers, candidates } = makeStore();
    const screenedTitles: string[] = [];
    const summary = await runHuntingCycle({
      scope: { query: "x", useAi: true },
      policy,
      registry: REGISTRY,
      corpusRoot: path.join(tmp, "corpus"),
      store,
      registryDiscover: async () => [
        await fixtureLead("edda3", "The Poetic Edda"),
        await fixtureLead("enc3", "Encyclopedia of Ancient Deities"),
      ],
      aiDiscover: async () => [],
      aiScreen: async (leads) => {
        screenedTitles.push(...leads.map((l) => l.title));
        return leads.map(() => ({
          classification: "primary" as const,
          justification: "Looks primary.",
        }));
      },
    });
    // Only the non-confident lead reaches the model; the encyclopedia is
    // blocked by the heuristic without spending a screening request.
    expect(screenedTitles).toEqual(["The Poetic Edda"]);
    expect(summary.secondary).toBe(1);
    expect(summary.created).toBe(1);
    expect(candidates.map((c) => c.title)).toEqual(["The Poetic Edda"]);
    expect(blockers.some((b) => b.reason === "secondary_source" && /matched/.test(String(b.detail)))).toBe(true);
  });

  it("does not run AI screening on non-AI cycles", async () => {
    const policy = await loadDefaultPolicy();
    const { store, candidates } = makeStore();
    let screened = false;
    const summary = await runHuntingCycle({
      scope: { query: "x", useAi: false },
      policy,
      registry: REGISTRY,
      corpusRoot: path.join(tmp, "corpus"),
      store,
      registryDiscover: async () => [await fixtureLead("edda2", "The Poetic Edda")],
      aiScreen: async (leads) => {
        screened = true;
        return leads.map(() => null);
      },
    });
    expect(screened).toBe(false);
    expect(summary.created).toBe(1);
    expect(candidates.length).toBe(1);
  });
});

describe("screenLeads chunking", () => {
  const scope = { query: "x", useAi: true };
  function lead(title: string) {
    return { title, author: null };
  }
  function collectBlockers() {
    const blockers: BlockerInput[] = [];
    return { blockers, report: async (b: BlockerInput) => void blockers.push(b) };
  }

  it("splits large lead lists into chunks and realigns verdicts by index", async () => {
    const total = SCREEN_CHUNK_SIZE * 2 + 5; // 3 chunks: full, full, partial
    const leads = Array.from({ length: total }, (_, i) => lead(`Primary Text ${i}`));
    const chunkSizes: number[] = [];
    const { blockers, report } = collectBlockers();
    const verdicts = await screenLeads(
      leads,
      scope,
      async (chunk) => {
        chunkSizes.push(chunk.length);
        return chunk.map((l) => ({
          classification: "primary" as const,
          justification: `verdict for ${l.title}`,
        }));
      },
      report,
    );
    expect(chunkSizes).toEqual([SCREEN_CHUNK_SIZE, SCREEN_CHUNK_SIZE, 5]);
    expect(verdicts).toHaveLength(total);
    // Verdicts land on the right leads across chunk boundaries.
    expect(verdicts[0]?.justification).toBe("verdict for Primary Text 0");
    expect(verdicts[SCREEN_CHUNK_SIZE]?.justification).toBe(`verdict for Primary Text ${SCREEN_CHUNK_SIZE}`);
    expect(verdicts[total - 1]?.justification).toBe(`verdict for Primary Text ${total - 1}`);
    expect(blockers).toHaveLength(0);
  });

  it("isolates a failed chunk: its leads fall back to null, other chunks keep verdicts", async () => {
    const total = SCREEN_CHUNK_SIZE + 10;
    const leads = Array.from({ length: total }, (_, i) => lead(`Primary Text ${i}`));
    let call = 0;
    const { blockers, report } = collectBlockers();
    const verdicts = await screenLeads(
      leads,
      scope,
      async (chunk) => {
        call += 1;
        if (call === 1) throw new Error("model unavailable");
        return chunk.map(() => ({ classification: "primary" as const, justification: "ok" }));
      },
      report,
    );
    // First chunk failed -> nulls; second chunk succeeded -> verdicts.
    expect(verdicts.slice(0, SCREEN_CHUNK_SIZE).every((v) => v === null)).toBe(true);
    expect(verdicts.slice(SCREEN_CHUNK_SIZE).every((v) => v?.classification === "primary")).toBe(true);
    expect(blockers).toHaveLength(1);
    expect(blockers[0].reason).toBe("fetch_failed");
    expect(String(blockers[0].detail)).toContain("model unavailable");
    expect(String(blockers[0].detail)).toContain(`${SCREEN_CHUNK_SIZE} lead(s)`);
  });

  it("never sends confidently-secondary titles to the model and keeps index alignment", async () => {
    const leads = [
      lead("The Poetic Edda"),
      lead("Encyclopedia of Ancient Deities"), // confident -> skipped
      lead("Popol Vuh"),
    ];
    expect(confidentlySecondary(leads[1].title)).toBeTruthy();
    // Weak markers (e.g. "history of") are still screened so the model can overrule.
    expect(confidentlySecondary("History of the Kings of Britain")).toBeNull();
    const seen: string[] = [];
    const { report } = collectBlockers();
    const verdicts = await screenLeads(
      leads,
      scope,
      async (chunk) => {
        seen.push(...chunk.map((l) => l.title));
        return chunk.map((l) => ({
          classification: "primary" as const,
          justification: `verdict for ${l.title}`,
        }));
      },
      report,
    );
    expect(seen).toEqual(["The Poetic Edda", "Popol Vuh"]);
    expect(verdicts[0]?.justification).toBe("verdict for The Poetic Edda");
    expect(verdicts[1]).toBeNull();
    expect(verdicts[2]?.justification).toBe("verdict for Popol Vuh");
  });

  it("handles malformed per-chunk responses by leaving null verdicts", async () => {
    const leads = [lead("A"), lead("B")];
    const { blockers, report } = collectBlockers();
    const verdicts = await screenLeads(
      leads,
      scope,
      async () => [{ classification: "primary", justification: "only one" }] as (AiScreenVerdict | null)[],
      report,
    );
    expect(verdicts[0]?.classification).toBe("primary");
    expect(verdicts[1]).toBeNull();
    expect(blockers).toHaveLength(0);
  });
});

describe("screening verdict cache", () => {
  const scope = { query: "x", useAi: true };
  function lead(title: string) {
    return { title, author: null };
  }
  function collectBlockers() {
    const blockers: BlockerInput[] = [];
    return { blockers, report: async (b: BlockerInput) => void blockers.push(b) };
  }
  function memoryCache(seed: Record<string, AiScreenVerdict> = {}) {
    const entries = new Map<string, { title: string; verdict: AiScreenVerdict }>(
      Object.entries(seed).map(([k, v]) => [k, { title: k, verdict: v }]),
    );
    const gets: string[][] = [];
    const sets: { key: string; title: string; verdict: AiScreenVerdict }[] = [];
    const cache: ScreenVerdictCache = {
      async get(keys) {
        gets.push(keys);
        const found = new Map<string, AiScreenVerdict>();
        for (const key of keys) {
          const hit = entries.get(key);
          if (hit) found.set(key, hit.verdict);
        }
        return found;
      },
      async set(fresh) {
        sets.push(...fresh);
        for (const e of fresh) entries.set(e.key, { title: e.title, verdict: e.verdict });
      },
    };
    return { cache, entries, gets, sets };
  }

  it("normalizes titles into stable cache keys", () => {
    expect(screenCacheKey("The Poetic Edda")).toBe("the poetic edda");
    expect(screenCacheKey("  THE POETIC EDDA!! ")).toBe("the poetic edda");
    expect(screenCacheKey("Enuma Elish: The Seven Tablets")).toBe(
      screenCacheKey("enuma elish — the seven tablets"),
    );
  });

  it("reuses cached verdicts and only sends never-seen titles to the model", async () => {
    const cachedVerdict: AiScreenVerdict = {
      classification: "secondary",
      justification: "Cached: modern survey.",
    };
    const { cache, sets } = memoryCache({
      [screenCacheKey("Babylonian Religion and Its Legacy")]: cachedVerdict,
    });
    const seen: string[] = [];
    const { blockers, report } = collectBlockers();
    const verdicts = await screenLeads(
      [lead("Babylonian Religion and Its Legacy"), lead("The Poetic Edda")],
      scope,
      async (chunk) => {
        seen.push(...chunk.map((l) => l.title));
        return chunk.map(() => ({ classification: "primary" as const, justification: "fresh" }));
      },
      report,
      cache,
    );
    // Cache hit never reaches the model; miss does.
    expect(seen).toEqual(["The Poetic Edda"]);
    expect(verdicts[0]).toEqual(cachedVerdict);
    expect(verdicts[1]?.justification).toBe("fresh");
    // Only the fresh verdict is written back.
    expect(sets).toEqual([
      {
        key: screenCacheKey("The Poetic Edda"),
        title: "The Poetic Edda",
        verdict: { classification: "primary", justification: "fresh" },
      },
    ]);
    expect(blockers).toHaveLength(0);
  });

  it("skips the model entirely when every title is cached", async () => {
    const verdict: AiScreenVerdict = { classification: "primary", justification: "cached" };
    const { cache } = memoryCache({
      [screenCacheKey("The Poetic Edda")]: verdict,
      [screenCacheKey("Popol Vuh")]: verdict,
    });
    let calls = 0;
    const { report } = collectBlockers();
    const verdicts = await screenLeads(
      [lead("The Poetic Edda"), lead("Popol Vuh")],
      scope,
      async (chunk) => {
        calls += 1;
        return chunk.map(() => null);
      },
      report,
      cache,
    );
    expect(calls).toBe(0);
    expect(verdicts.every((v) => v?.justification === "cached")).toBe(true);
  });

  it("matches recurring titles despite capitalization/punctuation differences", async () => {
    const { cache } = memoryCache({
      [screenCacheKey("The Poetic Edda")]: { classification: "primary", justification: "cached" },
    });
    const seen: string[] = [];
    const { report } = collectBlockers();
    const verdicts = await screenLeads(
      [lead("THE POETIC EDDA!")],
      scope,
      async (chunk) => {
        seen.push(...chunk.map((l) => l.title));
        return chunk.map(() => null);
      },
      report,
      cache,
    );
    expect(seen).toEqual([]);
    expect(verdicts[0]?.justification).toBe("cached");
  });

  it("does not consult the cache for confidently-secondary titles", async () => {
    const { cache, gets } = memoryCache();
    const { report } = collectBlockers();
    await screenLeads(
      [lead("Encyclopedia of Ancient Deities"), lead("Popol Vuh")],
      scope,
      async (chunk) => chunk.map(() => null),
      report,
      cache,
    );
    expect(gets).toEqual([[screenCacheKey("Popol Vuh")]]);
  });

  it("falls back to full screening when the cache lookup fails, with a blocker", async () => {
    const seen: string[] = [];
    const { blockers, report } = collectBlockers();
    const cache: ScreenVerdictCache = {
      async get() {
        throw new Error("db down");
      },
      async set() {
        throw new Error("db down");
      },
    };
    const verdicts = await screenLeads(
      [lead("The Poetic Edda")],
      scope,
      async (chunk) => {
        seen.push(...chunk.map((l) => l.title));
        return chunk.map(() => ({ classification: "primary" as const, justification: "fresh" }));
      },
      report,
      cache,
    );
    // Model still screens everything; both cache failures are reported.
    expect(seen).toEqual(["The Poetic Edda"]);
    expect(verdicts[0]?.classification).toBe("primary");
    expect(blockers.filter((b) => /verdict cache/.test(String(b.detail)))).toHaveLength(2);
  });

  it("does not cache leads the model failed to classify", async () => {
    const { cache, sets } = memoryCache();
    const { report } = collectBlockers();
    await screenLeads(
      [lead("A"), lead("B")],
      scope,
      async () => [{ classification: "primary", justification: "only one" }] as (AiScreenVerdict | null)[],
      report,
      cache,
    );
    expect(sets.map((s) => s.key)).toEqual([screenCacheKey("A")]);
  });

  it("runHuntingCycle uses the store's verdict cache across cycles", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "hunter-verdict-cache-"));
    const policy = await loadDefaultPolicy();
    const { cache } = memoryCache();
    const screenedPerCycle: string[][] = [];
    async function cycle(id: string) {
      const { store, blockers } = makeStore();
      const cachingStore: CycleStore = {
        ...store,
        getScreenVerdicts: (keys) => cache.get(keys),
        saveScreenVerdicts: (entries) => cache.set(entries),
      };
      const file = path.join(tmp, `${id}.txt`);
      await fs.writeFile(file, "text\n");
      const screened: string[] = [];
      screenedPerCycle.push(screened);
      const summary = await runHuntingCycle({
        scope: { query: "babylon", useAi: true },
        policy,
        registry: REGISTRY,
        corpusRoot: path.join(tmp, `corpus-${id}`),
        store: cachingStore,
        registryDiscover: async () => [
          {
            candidate: {
              ...localCandidate(id, file, "unknown"),
              title: "Babylonian Religion and Its Legacy",
            },
            origin: "registry_crawl" as const,
            originDetail: "fixture",
          },
        ],
        aiDiscover: async () => [],
        aiScreen: async (leads) => {
          screened.push(...leads.map((l) => l.title));
          return leads.map(() => ({
            classification: "secondary" as const,
            justification: "A modern survey, not a primary text.",
          }));
        },
      });
      return { summary, blockers };
    }
    const first = await cycle("c1");
    const second = await cycle("c2");
    // First cycle pays for screening; second reuses the persisted verdict.
    expect(screenedPerCycle[0]).toEqual(["Babylonian Religion and Its Legacy"]);
    expect(screenedPerCycle[1]).toEqual([]);
    expect(first.summary.secondary).toBe(1);
    expect(second.summary.secondary).toBe(1);
    expect(second.blockers.some((b) => b.reason === "secondary_source")).toBe(true);
  });
});

describe("blockerFromRecord", () => {
  it("maps download outcomes to blocker reasons", () => {
    expect(
      blockerFromRecord({ download_status: "metadata_only", error: "robots policy disallows download: x" })?.reason,
    ).toBe("robots_disallowed");
    expect(
      blockerFromRecord({ download_status: "metadata_only", error: "authenticated retrieval is not supported" })?.reason,
    ).toBe("requires_auth");
    expect(
      blockerFromRecord({ download_status: "failed", error: "remote full text exceeds maximum_file_bytes" })?.reason,
    ).toBe("too_large");
    expect(blockerFromRecord({ download_status: "failed", error: "boom" })?.reason).toBe("fetch_failed");
    expect(
      blockerFromRecord({
        download_status: "downloaded",
        file: { locked: true },
        rights: { status: "unknown" },
      })?.reason,
    ).toBe("rights_locked");
    expect(
      blockerFromRecord({ download_status: "downloaded", file: { locked: false } }),
    ).toBeNull();
    expect(blockerFromRecord({ download_status: "not_selected" })).toBeNull();
  });
});

describe("discovery fetchJson redirect boundary", () => {
  beforeEach(() => clearRobotsCache());

  function fakeFetch(routes: Record<string, { status: number; headers?: Record<string, string>; body?: string }>) {
    return (async (input: any) => {
      const url = String(input);
      const route = routes[url] ?? { status: 404, body: "" };
      return {
        ok: route.status >= 200 && route.status < 300,
        status: route.status,
        url,
        headers: { get: (k: string) => route.headers?.[k.toLowerCase()] ?? null },
        text: async () => route.body ?? "",
        json: async () => JSON.parse(route.body ?? "{}"),
      };
    }) as unknown as typeof fetch;
  }

  it("rejects redirects that leave the allowed hosts", async () => {
    const fetchImpl = fakeFetch({
      "https://archive.org/robots.txt": { status: 404 },
      "https://archive.org/search": {
        status: 302,
        headers: { location: "https://evil.example.com/steal" },
      },
    });
    await expect(fetchJson("https://archive.org/search", ["archive.org"], fetchImpl)).rejects.toThrow(
      /left the allowed hosts/,
    );
  });

  it("re-checks robots on each redirect hop", async () => {
    const fetchImpl = fakeFetch({
      "https://archive.org/robots.txt": {
        status: 200,
        body: "User-agent: *\nDisallow: /private/\n",
      },
      "https://archive.org/search": {
        status: 302,
        headers: { location: "https://archive.org/private/data.json" },
      },
    });
    await expect(fetchJson("https://archive.org/search", ["archive.org"], fetchImpl)).rejects.toThrow(
      /robots_disallowed/,
    );
  });

  it("follows same-host allowed redirects and returns JSON", async () => {
    const fetchImpl = fakeFetch({
      "https://archive.org/robots.txt": { status: 404 },
      "https://archive.org/search": {
        status: 301,
        headers: { location: "https://archive.org/search2" },
      },
      "https://archive.org/search2": { status: 200, body: '{"ok":true}' },
    });
    await expect(fetchJson("https://archive.org/search", ["archive.org"], fetchImpl)).resolves.toEqual({
      ok: true,
    });
  });

  it("rejects non-https discovery URLs", async () => {
    await expect(
      fetchJson("http://archive.org/search", ["archive.org"], fakeFetch({})),
    ).rejects.toThrow(/left the allowed hosts/);
  });
});

describe("robots parser", () => {
  beforeEach(() => clearRobotsCache());

  it("applies longest-match allow/disallow for the * group", () => {
    const rules = parseRobots(
      ["User-agent: *", "Disallow: /w/", "Allow: /w/api.php", "Disallow: /wiki/Special:"].join("\n"),
      "ReligiousMythologyResourceHunter/0.2",
    );
    expect(robotsRulesAllow(rules, "/w/index.php")).toBe(false);
    expect(robotsRulesAllow(rules, "/w/api.php?action=query")).toBe(true);
    expect(robotsRulesAllow(rules, "/wiki/Special:Export/Foo")).toBe(false);
    expect(robotsRulesAllow(rules, "/wiki/Iliad")).toBe(true);
  });

  it("supports wildcards and end anchors", () => {
    const rules = parseRobots("User-agent: *\nDisallow: /*.pdf$\n", "any");
    expect(robotsRulesAllow(rules, "/files/text.pdf")).toBe(false);
    expect(robotsRulesAllow(rules, "/files/text.pdf.txt")).toBe(true);
  });

  it("prefers a specific agent group over the * group", () => {
    const rules = parseRobots(
      "User-agent: religiousmythologyresourcehunter\nDisallow: /private/\n\nUser-agent: *\nDisallow: /\n",
      "ReligiousMythologyResourceHunter/0.2 (research)",
    );
    expect(robotsRulesAllow(rules, "/texts/iliad.txt")).toBe(true);
    expect(robotsRulesAllow(rules, "/private/x")).toBe(false);
  });
});
