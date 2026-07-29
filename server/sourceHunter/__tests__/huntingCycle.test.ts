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
