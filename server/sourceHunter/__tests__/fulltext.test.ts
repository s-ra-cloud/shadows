import { describe, it, expect, beforeAll } from "vitest";
import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import {
  loadPolicy,
  loadCandidates,
  loadFulltextRegistry,
  planCandidates,
  assessRights,
  collectFulltexts,
  verifyCorpus,
  type Candidate,
  type Policy,
} from "../index.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(HERE, "..", "data");
const NOW = new Date("2026-07-29T12:00:00+00:00");

async function loadFixtures() {
  const policy = await loadPolicy(path.join(DATA, "config", "collection-policy.json"));
  const candidates = await loadCandidates(path.join(HERE, "fulltext-candidates.jsonl"));
  return { policy, candidates };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

describe("rights decision table", () => {
  let policy: Policy;
  let candidates: Candidate[];
  beforeAll(async () => {
    ({ policy, candidates } = await loadFixtures());
  });

  const assess = (candidate: Candidate, embeddedNotice = "") =>
    assessRights(candidate, policy, { embeddedNotice, assessedAt: NOW });

  it("CC BY-SA is publishable and translatable", () => {
    const result = assess(candidates[0]);
    expect(result.status).toBe("open_license");
    expect(result.publication_allowed).toBe(true);
    expect(result.translation_allowed).toBe(true);
    expect(result.locked).toBe(false);
    expect(result.obligations).toContain("share_alike");
  });

  it("no-derivatives license is locked", () => {
    const candidate = clone(candidates[0]);
    candidate.rights = {
      status_claim: "open_license",
      statement: "Creative Commons Attribution-NoDerivatives 4.0",
      license: "CC BY-ND 4.0",
      license_url: "https://creativecommons.org/licenses/by-nd/4.0/",
      territories: ["WORLDWIDE"],
      basis: "source_metadata",
    };
    const result = assess(candidate);
    expect(result.status).toBe("restricted_license");
    expect(result.locked).toBe(true);
    expect(result.translation_allowed).toBe(false);
  });

  it("US-only public-domain claim stays locked in France", () => {
    const candidate = clone(candidates[0]);
    candidate.rights = {
      status_claim: "unknown",
      statement: "This ebook is not protected by copyright in the United States.",
      license: null,
      territories: ["US"],
      basis: "embedded_notice",
    };
    const result = assess(candidate);
    expect(result.status).toBe("public_domain_jurisdictional");
    expect(result.locked).toBe(true);
    expect(result.publication_allowed).toBe(false);
  });

  it("gutenberg permission notice beats generic US license text", () => {
    const candidate = clone(candidates[0]);
    candidate.rights = {
      status_claim: "unknown",
      statement: "",
      license: null,
      territories: ["US"],
      basis: "embedded_notice",
    };
    const result = assess(
      candidate,
      "Books not restricted by U.S. copyright law. This particular work is posted with permission of the copyright holder.",
    );
    expect(result.status).toBe("copyrighted");
    expect(result.locked).toBe(true);
  });

  it("life-plus-seventy is only likely until reviewed", () => {
    const candidate = clone(candidates[0]);
    candidate.rights = {
      status_claim: "unknown",
      statement: "",
      license: null,
      territories: [],
      basis: "unknown",
    };
    candidate.copyright_author_death_year = 1900;
    const result = assess(candidate);
    expect(result.status).toBe("public_domain_likely");
    expect(result.locked).toBe(true);
    expect(result.review_required).toBe(true);
  });

  it("embedded copyright notice overrides unknown", () => {
    const candidate = clone(candidates[0]);
    candidate.rights = {
      status_claim: "unknown",
      statement: "",
      license: null,
      territories: [],
      basis: "unknown",
    };
    const result = assess(candidate, "Copyright 2026. All rights reserved.");
    expect(result.status).toBe("copyrighted");
    expect(result.do_not_publish).toBe(true);
  });

  it("conflicting open and restrictive markers are locked", () => {
    const candidate = clone(candidates[0]);
    const result = assess(candidate, "Copyright 2026. All rights reserved.");
    expect(result.status).toBe("conflicting");
    expect(result.locked).toBe(true);
    expect(result.obligations).toContain("resolve_conflicting_rights_evidence");
  });

  it("CC0 unlocks worldwide", () => {
    const candidate = clone(candidates[0]);
    candidate.rights = {
      status_claim: "open_license",
      statement: "CC0 1.0 Universal",
      license: "CC0",
      license_url: "https://creativecommons.org/publicdomain/zero/1.0/",
      territories: ["WORLDWIDE"],
      basis: "manual",
    };
    const result = assess(candidate);
    expect(result.status).toBe("public_domain");
    expect(result.locked).toBe(false);
  });

  it("unknown rights are locked with do_not_publish", () => {
    const candidate = clone(candidates[0]);
    candidate.rights = {
      status_claim: "unknown",
      statement: "",
      license: null,
      territories: [],
      basis: "unknown",
    };
    candidate.publication_year = null;
    candidate.copyright_author_death_year = null;
    const result = assess(candidate);
    expect(result.status).toBe("unknown");
    expect(result.locked).toBe(true);
    expect(result.do_not_publish).toBe(true);
  });
});

describe("planning language preference order", () => {
  let policy: Policy;
  let candidates: Candidate[];
  beforeAll(async () => {
    ({ policy, candidates } = await loadFixtures());
  });

  it("selects open english + original then fallback", () => {
    const plans = planCandidates(candidates, policy, { assessedAt: NOW });
    const reasons = new Map(
      plans.map((p) => [String(p.candidate.edition_id), p.selection.reason]),
    );
    expect(reasons.get("edition:city-goddess-en-open")).toBe("preferred_open_english");
    expect(reasons.get("edition:city-goddess-grc-original")).toBe("preferred_open_original");
    expect(reasons.get("edition:city-goddess-fr-locked")).toBe("not_selected");
    expect(reasons.get("edition:ancient-ritual-sa-original")).toBe("preferred_open_original");
    expect(reasons.get("edition:ancient-ritual-la-open")).toBe("fallback_open_ai_translatable");
    expect(reasons.get("edition:modern-divinity-study-en-locked")).toBe("locked_english_reference");
  });
});

describe("corpus download and verify", () => {
  let policy: Policy;
  let candidates: Candidate[];
  let registry: Record<string, unknown>;
  beforeAll(async () => {
    ({ policy, candidates } = await loadFixtures());
    registry = await loadFulltextRegistry(path.join(DATA, "sources", "fulltext-registry.json"));
  });

  it("full bytes are partitioned and locked", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "rmrh-corpus-"));
    const corpus = path.join(dir, "corpus");
    const records = await collectFulltexts(candidates, policy, registry, corpus, {
      assessedAt: NOW,
    });
    const statuses = records.map((r) => r.download_status);
    expect(statuses.filter((s) => s === "downloaded").length).toBe(5);
    expect(statuses.filter((s) => s === "not_selected").length).toBe(1);

    const modern = records.find(
      (r) => r.edition_id === "edition:modern-divinity-study-en-locked",
    )!;
    const modernFile = modern.file as Record<string, unknown>;
    expect(modernFile.locked).toBe(true);
    expect(String(modernFile.relative_path).startsWith("locked/")).toBe(true);
    const lockedPath = path.join(corpus, String(modernFile.relative_path));
    const sourcePath = path.join(HERE, "fixtures", "fulltexts", "modern_study_en.txt");
    expect((await fs.readFile(lockedPath)).equals(await fs.readFile(sourcePath))).toBe(true);
    const mode = (await fs.stat(lockedPath)).mode & 0o077;
    expect(mode).toBe(0);
    expect((await fs.stat(path.join(corpus, String(modernFile.lock_path)))).isFile()).toBe(true);
    expect((await fs.stat(path.join(corpus, String(modernFile.rights_path)))).isFile()).toBe(true);

    const english = records.find((r) => r.edition_id === "edition:city-goddess-en-open")!;
    const englishFile = english.file as Record<string, unknown>;
    expect(englishFile.locked).toBe(false);
    expect(String(englishFile.relative_path).startsWith("public/")).toBe(true);

    const counts = await verifyCorpus(corpus);
    expect(counts.downloaded).toBe(5);
    expect(counts.public).toBe(4);
    expect(counts.locked).toBe(1);
    expect(counts.not_selected).toBe(1);
  });

  function iaCandidate(): Candidate {
    return {
      work_id: "work:redirect-test",
      edition_id: "edition:internet-archive-redirect-test",
      title: "Redirect Test",
      author: null,
      translator: null,
      source_id: "source:internet-archive",
      language: "eng",
      language_role: "unknown",
      format: "txt",
      text_url: "https://archive.org/download/redirecttest/redirecttest_djvu.txt",
      rights: {
        status_claim: "unknown",
        basis: "source_statement",
        statement: "Internet Archive item; licence not verified.",
      },
      access: { download_allowed: true, requires_auth: false },
    } as unknown as Candidate;
  }

  function fakeFetch(
    routes: Record<string, { status: number; headers?: Record<string, string>; body?: string }>,
  ) {
    return (async (input: unknown) => {
      const url = String(input);
      const route = routes[url] ?? { status: 404, body: "" };
      return {
        ok: route.status >= 200 && route.status < 300,
        status: route.status,
        url,
        headers: { get: (k: string) => route.headers?.[k.toLowerCase()] ?? null },
        arrayBuffer: async () => Buffer.from(route.body ?? "", "utf-8"),
        text: async () => route.body ?? "",
      };
    }) as unknown as typeof fetch;
  }

  it("follows trusted Internet Archive mirror redirects", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "rmrh-redirect-"));
    const corpus = path.join(dir, "corpus");
    const body = "THE FULL TEXT OF THE REDIRECT TEST ITEM";
    const fetchImpl = fakeFetch({
      "https://archive.org/download/redirecttest/redirecttest_djvu.txt": {
        status: 302,
        headers: { location: "https://ia803109.us.archive.org/12/items/redirecttest/redirecttest_djvu.txt" },
      },
      "https://ia803109.us.archive.org/12/items/redirecttest/redirecttest_djvu.txt": {
        status: 200,
        body,
        headers: { "content-type": "text/plain; charset=utf-8" },
      },
    });
    const records = await collectFulltexts([iaCandidate()], policy, registry, corpus, {
      assessedAt: NOW,
      selectionMode: "all",
      fetchImpl,
    });
    const record = records.find((r) => r.edition_id === "edition:internet-archive-redirect-test")!;
    expect(record.download_status).toBe("downloaded");
    const file = record.file as Record<string, unknown>;
    const saved = await fs.readFile(path.join(corpus, String(file.relative_path)), "utf-8");
    expect(saved).toBe(body);
  });

  it("refuses redirects to untrusted hosts", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "rmrh-redirect-"));
    const corpus = path.join(dir, "corpus");
    const fetchImpl = fakeFetch({
      "https://archive.org/download/redirecttest/redirecttest_djvu.txt": {
        status: 302,
        headers: { location: "https://evil.example.com/steal.txt" },
      },
    });
    const records = await collectFulltexts([iaCandidate()], policy, registry, corpus, {
      assessedAt: NOW,
      selectionMode: "all",
      fetchImpl,
    });
    const record = records.find((r) => r.edition_id === "edition:internet-archive-redirect-test")!;
    expect(record.download_status).toBe("metadata_only");
    expect(String(record.error)).toMatch(/not a trusted redirect/);
  });

  it("refuses trusted-host redirects with untrusted paths", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "rmrh-redirect-"));
    const corpus = path.join(dir, "corpus");
    const fetchImpl = fakeFetch({
      "https://archive.org/download/redirecttest/redirecttest_djvu.txt": {
        status: 302,
        headers: { location: "https://ia803109.us.archive.org/internal/admin.txt" },
      },
    });
    const records = await collectFulltexts([iaCandidate()], policy, registry, corpus, {
      assessedAt: NOW,
      selectionMode: "all",
      fetchImpl,
    });
    const record = records.find((r) => r.edition_id === "edition:internet-archive-redirect-test")!;
    expect(record.download_status).toBe("metadata_only");
    expect(String(record.error)).toMatch(/not a trusted redirect/);
  });

  it("resume never overwrites full text", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "rmrh-corpus-"));
    const corpus = path.join(dir, "corpus");
    await collectFulltexts(candidates, policy, registry, corpus, { assessedAt: NOW });
    const second = await collectFulltexts(candidates, policy, registry, corpus, {
      assessedAt: NOW,
    });
    const statuses = second.map((r) => r.download_status);
    expect(statuses.filter((s) => s === "already_present").length).toBe(5);
  });
});
