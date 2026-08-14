/**
 * Route-level tests for the /api/hunter/* HTTP layer.
 *
 * Uses an in-memory Postgres (PGlite) in place of the real database and a
 * temp working directory so CORPUS_ROOT / the policy override land in an
 * isolated corpus root. Auth uses the real requireEditor middleware and the
 * real HMAC x-editor-token derived from SESSION_SECRET.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach, vi } from "vitest";
import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import express, { type Express } from "express";
import request from "supertest";
import * as http from "node:http";
import * as https from "node:https";
import { lookup } from "node:dns/promises";

import { requireEditor, EDITOR_TOKEN } from "../editorAuth";
import { db } from "../storage";
import { hunterRuns, hunterCorpusFiles, hunterBlockers } from "@shared/schema";
import { runCorpusListCycle } from "../hunterCorpusCycle";
import { runHuntingCycle } from "../hunterCycle";

// Mock the corpus-list cycle runner so retry tests don't need real HTTP crawls.
vi.mock("../hunterCorpusCycle", () => ({
  runCorpusListCycle: vi.fn(),
}));

// Mock the standard hunting-cycle runner so cycle POST tests don't make real HTTP calls.
vi.mock("../hunterCycle", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../hunterCycle")>();
  return { ...actual, runHuntingCycle: vi.fn() };
});

// Mock node:http/https so the check-url probe tests never make real connections.
vi.mock("node:http", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:http")>();
  return { ...actual, request: vi.fn() };
});
vi.mock("node:https", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:https")>();
  return { ...actual, request: vi.fn() };
});
// Mock node:dns/promises so tests control what IPs "resolve" to.
vi.mock("node:dns/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:dns/promises")>();
  return { ...actual, lookup: vi.fn() };
});

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(HERE, "..", "sourceHunter", "__tests__");

// In-memory Postgres standing in for server/storage.ts.
vi.mock("../storage", async () => {
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const schema = await import("@shared/schema");
  const client = new PGlite();
  await client.exec(`
    CREATE TABLE hunter_candidates (
      id serial PRIMARY KEY,
      work_id text NOT NULL,
      edition_id text NOT NULL UNIQUE,
      data jsonb NOT NULL,
      created_at timestamp DEFAULT now() NOT NULL,
      updated_at timestamp DEFAULT now() NOT NULL
    );
    CREATE TABLE hunter_runs (
      id serial PRIMARY KEY,
      kind text NOT NULL,
      status text NOT NULL DEFAULT 'running',
      started_at timestamp DEFAULT now() NOT NULL,
      finished_at timestamp,
      result jsonb,
      error text
    );
    CREATE TABLE hunter_corpus_files (
      id serial PRIMARY KEY,
      work_id text NOT NULL,
      edition_id text NOT NULL,
      language text,
      partition text NOT NULL,
      path text NOT NULL UNIQUE,
      byte_count integer,
      sha256 text,
      record jsonb,
      run_id integer REFERENCES hunter_runs(id),
      downloaded_at timestamp DEFAULT now() NOT NULL
    );
    CREATE TABLE hunter_blockers (
      id serial PRIMARY KEY,
      run_id integer REFERENCES hunter_runs(id),
      source_id text,
      url text,
      reason text NOT NULL,
      detail text,
      work_id text,
      edition_id text,
      status text NOT NULL DEFAULT 'open',
      created_at timestamp DEFAULT now() NOT NULL,
      updated_at timestamp DEFAULT now() NOT NULL
    );
  `);
  const db = drizzle(client, { schema });
  return {
    db,
    storage: {
      // Only getNodes is used by the hunter routes (catalog entity list).
      getNodes: async () => [],
    },
  };
});

let app: Express;
let tempRoot: string;
let corpusRoot: string;
let openCandidate: Record<string, unknown>;
let lockedCandidate: Record<string, unknown>;

const asEditor = { "x-editor-token": EDITOR_TOKEN };

async function loadFixtureCandidates() {
  const text = await fs.readFile(path.join(FIXTURES, "fulltext-candidates.jsonl"), "utf-8");
  const all = text
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as Record<string, unknown>);
  // Make local_path absolute so downloads work regardless of cwd.
  for (const candidate of all) {
    if (candidate.local_path) {
      candidate.local_path = path.join(FIXTURES, String(candidate.local_path));
    }
  }
  const open = all.find((c) => c.edition_id === "edition:city-goddess-en-open");
  const locked = all.find((c) => c.edition_id === "edition:city-goddess-fr-locked");
  if (!open || !locked) throw new Error("expected fixture candidates not found");
  return { open, locked };
}

beforeAll(async () => {
  tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "hunter-routes-"));
  corpusRoot = path.join(tempRoot, "data", "hunter-corpus");
  // hunterRoutes derives CORPUS_ROOT and the policy override path from
  // process.cwd() at import time; point both into the temp dir.
  vi.spyOn(process, "cwd").mockReturnValue(tempRoot);
  const { registerHunterRoutes } = await import("../hunterRoutes");
  app = express();
  app.use(express.json({ limit: "10mb" }));
  registerHunterRoutes(app, requireEditor);
  ({ open: openCandidate, locked: lockedCandidate } = await loadFixtureCandidates());
});

afterAll(async () => {
  vi.restoreAllMocks();
  await fs.rm(tempRoot, { recursive: true, force: true });
});

async function waitForRun(runId: number, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const res = await request(app).get(`/api/hunter/runs/${runId}`);
    expect(res.status).toBe(200);
    if (res.body.status !== "running") return res.body;
    if (Date.now() > deadline) throw new Error(`run ${runId} did not finish in time`);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

describe("auth gating", () => {
  const protectedCalls: Array<[string, string]> = [
    ["post", "/api/hunter/candidates"],
    ["put", "/api/hunter/candidates/1"],
    ["delete", "/api/hunter/candidates/1"],
    ["put", "/api/hunter/policy"],
    ["post", "/api/hunter/plan"],
    ["post", "/api/hunter/download"],
    ["post", "/api/hunter/verify"],
    ["post", "/api/hunter/catalog"],
  ];

  it.each(protectedCalls)("%s %s returns 401 without a token", async (method, url) => {
    const res = await (request(app) as any)[method](url).send({});
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ message: "Unauthorized" });
  });

  it("every registered mutating /api/hunter route rejects requests without a token", async () => {
    // Systematic guarantee: enumerate the live Express router so any future
    // compute/LLM route added without `requireEditor` fails this test.
    const stack: any[] = (app as any).router?.stack ?? (app as any)._router?.stack ?? [];
    const mutating: Array<[string, string]> = [];
    for (const layer of stack) {
      const route = layer.route;
      if (!route?.path || typeof route.path !== "string") continue;
      if (!route.path.startsWith("/api/hunter")) continue;
      for (const method of Object.keys(route.methods ?? {})) {
        if (method === "get" || method === "head") continue;
        mutating.push([method, route.path.replace(/:[^/]+/g, "1")]);
      }
    }
    expect(mutating.length).toBeGreaterThanOrEqual(15);
    for (const [method, url] of mutating) {
      const res = await (request(app) as any)[method](url).send({});
      expect(res.status, `${method.toUpperCase()} ${url} must require editor auth`).toBe(401);
    }
  });

  it("rejects a wrong x-editor-token", async () => {
    const res = await request(app)
      .post("/api/hunter/plan")
      .set("x-editor-token", "not-the-token")
      .send({});
    expect(res.status).toBe(401);
  });

  it("read-only routes are public", async () => {
    for (const url of [
      "/api/hunter/candidates",
      "/api/hunter/policy",
      "/api/hunter/plan/latest",
      "/api/hunter/corpus",
      "/api/hunter/verify/latest",
      "/api/hunter/runs",
    ]) {
      const res = await request(app).get(url);
      expect(res.status, url).toBe(200);
    }
  });
});

describe("candidate CRUD and validation", () => {
  it("rejects an invalid candidate with 400", async () => {
    const res = await request(app)
      .post("/api/hunter/candidates")
      .set(asEditor)
      .send({ data: { work_id: "work:x" } });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/missing fields/);
  });

  it("rejects a candidate with a bad format with 400", async () => {
    const res = await request(app)
      .post("/api/hunter/candidates")
      .set(asEditor)
      .send({ data: { ...openCandidate, format: "docx" } });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/format/);
  });

  it("creates, lists, updates and deletes candidates", async () => {
    const created = await request(app)
      .post("/api/hunter/candidates")
      .set(asEditor)
      .send({ data: openCandidate });
    expect(created.status).toBe(200);
    expect(created.body.workId).toBe(openCandidate.work_id);
    expect(created.body.data.edition_id).toBe(openCandidate.edition_id);
    const id = created.body.id;

    const listed = await request(app).get("/api/hunter/candidates");
    expect(listed.body.map((r: any) => r.id)).toContain(id);

    const updated = await request(app)
      .put(`/api/hunter/candidates/${id}`)
      .set(asEditor)
      .send({ data: { ...openCandidate, title: "Retitled Hymn" } });
    expect(updated.status).toBe(200);
    expect(updated.body.data.title).toBe("Retitled Hymn");

    const missing = await request(app)
      .put("/api/hunter/candidates/999999")
      .set(asEditor)
      .send({ data: openCandidate });
    expect(missing.status).toBe(404);

    const badUpdate = await request(app)
      .put(`/api/hunter/candidates/${id}`)
      .set(asEditor)
      .send({ data: { nope: true } });
    expect(badUpdate.status).toBe(400);

    const deleted = await request(app).delete(`/api/hunter/candidates/${id}`).set(asEditor);
    expect(deleted.status).toBe(200);
    const after = await request(app).get("/api/hunter/candidates");
    expect(after.body.map((r: any) => r.id)).not.toContain(id);
  });
});

describe("policy", () => {
  it("serves the default policy and rejects an invalid override", async () => {
    const current = await request(app).get("/api/hunter/policy");
    expect(current.status).toBe(200);
    expect(current.body.maximum_file_bytes).toBeGreaterThan(0);

    const bad = await request(app).put("/api/hunter/policy").set(asEditor).send({ nope: 1 });
    expect(bad.status).toBe(400);
  });

  it("accepts and persists a valid policy override", async () => {
    const current = await request(app).get("/api/hunter/policy");
    const put = await request(app).put("/api/hunter/policy").set(asEditor).send(current.body);
    expect(put.status).toBe(200);
    const reread = await request(app).get("/api/hunter/policy");
    expect(reread.body).toEqual(current.body);
  });
});

describe("plan -> download -> verify happy path", () => {
  beforeAll(async () => {
    for (const candidate of [openCandidate, lockedCandidate]) {
      const res = await request(app)
        .post("/api/hunter/candidates")
        .set(asEditor)
        .send({ data: candidate });
      expect(res.status).toBe(200);
    }
  });

  it("plans the candidates and records the run", async () => {
    const res = await request(app).post("/api/hunter/plan").set(asEditor).send({});
    expect(res.status).toBe(200);
    expect(res.body.run.status).toBe("completed");
    expect(res.body.entries).toHaveLength(2);
    expect(res.body.entries.some((e: any) => e.selection.selected)).toBe(true);

    const latest = await request(app).get("/api/hunter/plan/latest");
    expect(latest.body.run.id).toBe(res.body.run.id);
    expect(latest.body.entries).toHaveLength(2);
  });

  it("downloads into the temp corpus root and mirrors the corpus table", async () => {
    const res = await request(app)
      .post("/api/hunter/download")
      .set(asEditor)
      .send({ selection_mode: "all" });
    expect(res.status).toBe(200);
    expect(res.body.run.status).toBe("running");

    const run = await waitForRun(res.body.run.id);
    expect(run.status).toBe("completed");
    expect(run.error).toBeNull();
    expect(run.result.records).toBe(2);
    expect(run.result.downloaded).toBe(2);
    expect(run.result.failed).toBe(0);

    // Files actually landed in the temp corpus root, in the right partitions.
    const entries = run.result.entries as any[];
    const open = entries.find((e) => e.edition_id === "edition:city-goddess-en-open");
    const locked = entries.find((e) => e.edition_id === "edition:city-goddess-fr-locked");
    expect(open.file.locked).toBe(false);
    expect(open.file.relative_path).toMatch(/^public\//);
    expect(locked.file.locked).toBe(true);
    expect(locked.file.relative_path).toMatch(/^locked\//);
    for (const entry of [open, locked]) {
      const stat = await fs.stat(path.join(corpusRoot, entry.file.relative_path));
      expect(stat.isFile()).toBe(true);
      expect(stat.size).toBe(entry.file.bytes);
    }

    const corpus = await request(app).get("/api/hunter/corpus");
    expect(corpus.body).toHaveLength(2);
    const partitions = corpus.body.map((r: any) => r.partition).sort();
    expect(partitions).toEqual(["locked", "public"]);
    for (const row of corpus.body) {
      expect(row.sha256).toMatch(/^sha256:/);
      // Provenance: newly downloaded files carry the run that produced them.
      expect(row.runId).toBe(res.body.run.id);
    }

    // Run detail lists the files this run produced.
    const detail = await request(app).get(`/api/hunter/runs/${res.body.run.id}`);
    expect(detail.status).toBe(200);
    expect(detail.body.files).toHaveLength(2);
    expect(Array.isArray(detail.body.blockers)).toBe(true);

    // Readable extraction is queued automatically for every fresh download,
    // and failures are reported in the summary rather than thrown.
    expect(run.result.auto_extraction).toMatchObject({ queued: 2, failed: [] });
    // Raw files are untouched (extraction only writes readable siblings).
    for (const entry of [open, locked]) {
      const stat = await fs.stat(path.join(corpusRoot, entry.file.relative_path));
      expect(stat.size).toBe(entry.file.bytes);
    }
  });

  it("reports auto-extraction failures in the summary instead of throwing", async () => {
    const { autoExtractDownloaded } = await import("../hunterRoutes");
    const summary = await autoExtractDownloaded([
      {
        download_status: "downloaded",
        edition_id: "edition:ghost",
        file: { relative_path: "public/nowhere/ghost.txt", locked: false },
      },
      // Non-downloaded records are ignored entirely.
      { download_status: "metadata_only", edition_id: "edition:meta", file: {} },
    ]);
    expect(summary.queued).toBe(0);
    expect(summary.failed).toEqual([
      { edition_id: "edition:ghost", error: "File not found in corpus table" },
    ]);
  });

  it("keeps run provenance stable when a later download finds files already present", async () => {
    const corpusBefore = await request(app).get("/api/hunter/corpus");
    const runIdsBefore = new Map(corpusBefore.body.map((r: any) => [r.path, r.runId]));

    const res = await request(app)
      .post("/api/hunter/download")
      .set(asEditor)
      .send({ selection_mode: "all" });
    const run = await waitForRun(res.body.run.id);
    expect(run.status).toBe("completed");
    expect(run.result.already_present).toBe(2);

    // Already-present files keep the run that originally downloaded them.
    const corpusAfter = await request(app).get("/api/hunter/corpus");
    expect(corpusAfter.body).toHaveLength(2);
    for (const row of corpusAfter.body) {
      expect(row.runId).toBe(runIdsBefore.get(row.path));
      expect(row.runId).not.toBe(res.body.run.id);
    }
    // And the re-download run reports no produced files.
    const detail = await request(app).get(`/api/hunter/runs/${res.body.run.id}`);
    expect(detail.body.files).toHaveLength(0);
  });

  it("verifies the corpus", async () => {
    const res = await request(app).post("/api/hunter/verify").set(asEditor).send({});
    expect(res.status).toBe(200);
    expect(res.body.run.status).toBe("completed");
    expect(res.body.report.ok).toBe(true);
    expect(res.body.report.counts).toMatchObject({
      records: 2,
      downloaded: 2,
      public: 1,
      locked: 1,
      failed: 0,
    });

    const latest = await request(app).get("/api/hunter/verify/latest");
    expect(latest.body.run.id).toBe(res.body.run.id);
    expect(latest.body.report.ok).toBe(true);
  });

  it("verify reports a problem when a corpus file is tampered with", async () => {
    const manifest = await fs.readFile(path.join(corpusRoot, "corpus.jsonl"), "utf-8");
    const record = manifest
      .split(/\r?\n/)
      .filter((l) => l.trim())
      .map((l) => JSON.parse(l))
      .find((r) => r.file && !r.file.locked);
    const target = path.join(corpusRoot, record.file.relative_path);
    const original = await fs.readFile(target);
    await fs.writeFile(target, Buffer.concat([original, Buffer.from("tampered")]));
    try {
      const res = await request(app).post("/api/hunter/verify").set(asEditor).send({});
      expect(res.status).toBe(200);
      expect(res.body.report.ok).toBe(false);
      expect(String(res.body.report.problems[0])).toMatch(/byte count mismatch/);
    } finally {
      await fs.writeFile(target, original);
    }
  });

  it("lists runs without bulky results", async () => {
    const res = await request(app).get("/api/hunter/runs");
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(3);
    for (const run of res.body) {
      expect(run).not.toHaveProperty("result");
      expect(typeof run.hasResult).toBe("boolean");
    }
    const unknown = await request(app).get("/api/hunter/runs/999999");
    expect(unknown.status).toBe(404);
  });
});

describe("catalog builder and SSRF guard", () => {
  it("rejects an unknown format with 400", async () => {
    const res = await request(app)
      .post("/api/hunter/catalog")
      .set(asEditor)
      .send({ format: "docx", payload: "hello" });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Unknown format/);
  });

  it("requires a url or payload", async () => {
    const res = await request(app)
      .post("/api/hunter/catalog")
      .set(asEditor)
      .send({ format: "plain_text" });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/url or payload/);
  });

  it("rejects non-https URLs", async () => {
    const res = await request(app)
      .post("/api/hunter/catalog")
      .set(asEditor)
      .send({ format: "plain_text", url: "http://example.com/catalog.txt" });
    expect(res.status).toBe(500);
    expect(res.body.message).toMatch(/Only https/);
  });

  it.each([
    "https://127.0.0.1/catalog.txt",
    "https://10.0.0.8/catalog.txt",
    "https://192.168.1.5/catalog.txt",
    "https://169.254.169.254/latest/meta-data/",
    "https://[::1]/catalog.txt",
  ])("rejects private/internal address %s", async (url) => {
    const res = await request(app)
      .post("/api/hunter/catalog")
      .set(asEditor)
      .send({ format: "plain_text", url });
    expect(res.status).toBe(500);
    expect(res.body.message).toMatch(/private or internal/);
  });

  it("builds a catalog from an inline payload", async () => {
    const res = await request(app)
      .post("/api/hunter/catalog")
      .set(asEditor)
      .send({ format: "plain_text", payload: "A short sample text about ancient hymns." });
    expect(res.status).toBe(200);
    expect(res.body.run.status).toBe("completed");
    expect(Array.isArray(res.body.records)).toBe(true);
  });
});

describe("corpus-list retry endpoint", () => {
  /** Run whose items mix fetched / missing statuses — the main retry test target. */
  let mixedRunId: number;

  const MOCK_CYCLE_RESULT = {
    corpus_list: {
      name: "retry-result",
      total: 0,
      fetched: 0,
      fetched_locked: 0,
      metadata_only: 0,
      failed: 0,
      not_found: 0,
      items: [],
      original_items: [],
    },
    summary: {
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
      entries: [],
      discovery: [],
    },
  };

  beforeAll(async () => {
    vi.mocked(runCorpusListCycle).mockResolvedValue(MOCK_CYCLE_RESULT as any);

    // Insert a completed corpus-list run with four items: one fetched (should
    // be excluded from retry) and three missing (should be retried).
    const [row] = await (db as any)
      .insert(hunterRuns)
      .values({
        kind: "cycle",
        status: "completed",
        result: {
          scope: { query: "Corpus list: mylist", corpusList: "mylist" },
          corpus_list: {
            name: "mylist",
            total: 4,
            fetched: 1,
            fetched_locked: 0,
            metadata_only: 1,
            failed: 1,
            not_found: 1,
            original_items: [
              // Fetched — must NOT appear in the retry list
              { title: "Iliad", author: "Homer", url: "https://example.org/iliad.txt" },
              // metadata_only — must appear, url preserved
              { title: "Odyssey", author: "Homer", url: "https://example.org/odyssey.txt" },
              // failed — must appear, language preserved
              { title: "Theogony", author: "Hesiod", language: "grc" },
              // not_found — must appear, title+author only
              { title: "Works and Days", author: "Hesiod" },
            ],
            items: [
              { title: "Iliad", author: "Homer", status: "fetched", languages: ["en"], english: true, edition_ids: ["ed1"], detail: "OK" },
              { title: "Odyssey", author: "Homer", status: "metadata_only", languages: [], english: false, edition_ids: [], detail: "No download allowed" },
              { title: "Theogony", author: "Hesiod", status: "failed", languages: [], english: false, edition_ids: [], detail: "Failed" },
              { title: "Works and Days", author: "Hesiod", status: "not_found", languages: [], english: false, edition_ids: [], detail: "Not found" },
            ],
          },
        },
      })
      .returning({ id: hunterRuns.id });
    mixedRunId = row.id;
  });

  it("returns 401 without an editor token", async () => {
    const res = await request(app).post("/api/hunter/cycles/corpus/1/retry").send({});
    expect(res.status).toBe(401);
  });

  it("returns 404 for a non-existent run", async () => {
    const res = await request(app)
      .post("/api/hunter/cycles/corpus/999999/retry")
      .set(asEditor)
      .send({});
    expect(res.status).toBe(404);
  });

  it("returns 400 when all items in the run were already fetched", async () => {
    const [row] = await (db as any)
      .insert(hunterRuns)
      .values({
        kind: "cycle",
        status: "completed",
        result: {
          corpus_list: {
            name: "fully-fetched",
            total: 1,
            fetched: 1,
            fetched_locked: 0,
            metadata_only: 0,
            failed: 0,
            not_found: 0,
            original_items: [{ title: "Iliad", author: "Homer" }],
            items: [
              { title: "Iliad", author: "Homer", status: "fetched", languages: ["en"], english: true, edition_ids: ["ed1"], detail: "OK" },
            ],
          },
        },
      })
      .returning({ id: hunterRuns.id });

    const res = await request(app)
      .post(`/api/hunter/cycles/corpus/${row.id}/retry`)
      .set(asEditor)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/nothing to retry/i);
  });

  it("retries only missing items and preserves url and language from original_items", async () => {
    vi.mocked(runCorpusListCycle).mockClear();

    const res = await request(app)
      .post(`/api/hunter/cycles/corpus/${mixedRunId}/retry`)
      .set(asEditor)
      .send({ use_ai: false });
    expect(res.status).toBe(200);
    expect(res.body.run.status).toBe("running");
    expect(res.body.corpus_list.name).toBe("mylist (retry)");
    expect(res.body.corpus_list.items).toBe(3); // 3 missing, 1 fetched excluded

    // Wait for the background run to complete.
    const run = await waitForRun(res.body.run.id);
    expect(run.status).toBe("completed");

    // Verify the list passed to runCorpusListCycle.
    expect(vi.mocked(runCorpusListCycle)).toHaveBeenCalledTimes(1);
    const { list } = vi.mocked(runCorpusListCycle).mock.calls[0][0];
    expect(list.name).toBe("mylist (retry)");
    expect(list.items).toHaveLength(3);

    // Fetched item (Iliad) excluded.
    expect(list.items.find((i: any) => i.title === "Iliad")).toBeUndefined();

    // metadata_only item: url must be preserved from original_items.
    const odyssey = list.items.find((i: any) => i.title === "Odyssey");
    expect(odyssey).toBeDefined();
    expect(odyssey.url).toBe("https://example.org/odyssey.txt");

    // failed item: language must be preserved from original_items.
    const theogony = list.items.find((i: any) => i.title === "Theogony");
    expect(theogony).toBeDefined();
    expect(theogony.language).toBe("grc");

    // not_found item: title and author only.
    const worksAndDays = list.items.find((i: any) => i.title === "Works and Days");
    expect(worksAndDays).toBeDefined();
    expect(worksAndDays.author).toBe("Hesiod");
    expect(worksAndDays.url).toBeUndefined();
  });
});

describe("library reader never shows raw markup", () => {
  async function insertCorpusFile(relPath: string, content: string, record: Record<string, unknown> = {}) {
    const abs = path.join(corpusRoot, relPath);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, content, "utf-8");
    const [row] = await (db as any)
      .insert(hunterCorpusFiles)
      .values({
        workId: "work:test",
        editionId: `edition:${relPath.replace(/[^a-z0-9]/gi, "-")}`,
        language: "en",
        partition: "public",
        path: relPath,
        byteCount: Buffer.byteLength(content),
        record: { title: "Test Text", ...record },
      })
      .returning({ id: hunterCorpusFiles.id });
    return { id: row.id as number, abs };
  }

  it("returns plain text directly with readable_status plain", async () => {
    const prose = "In the beginning the gods assembled and spoke of the deep.\n".repeat(5);
    const { id } = await insertCorpusFile("public/work-test/plain-one.txt", prose);
    const res = await request(app).get(`/api/hunter/library/${id}/text`);
    expect(res.status).toBe(200);
    expect(res.body.readable_status).toBe("plain");
    expect(res.body.text).toContain("gods assembled");
  });

  it("never returns raw HTML: queues extraction and reports preparing", async () => {
    const prose = "When heaven and earth began, three deities came into existence. ".repeat(20);
    const html = `<!DOCTYPE html><html><head><title>Kojiki</title><script>x()</script></head><body><p>${prose}</p></body></html>`;
    const { id, abs } = await insertCorpusFile("public/work-test/kojiki.html", html, {
      file: { content_type: "text/html" },
    });
    const res = await request(app).get(`/api/hunter/library/${id}/text`);
    expect(res.status).toBe(200);
    expect(res.body.text).toBeNull();
    expect(res.body.markdown).toBeNull();
    expect(res.body.readable_status).toBe("preparing");
    // The queued extraction eventually writes a readable sibling…
    const deadline = Date.now() + 15_000;
    while (!(await fs.stat(`${abs}.readable.md`).catch(() => null))) {
      if (Date.now() > deadline) throw new Error("extraction did not finish");
      await new Promise((r) => setTimeout(r, 100));
    }
    // …after which the reader gets Markdown, never the raw bytes.
    const after = await request(app).get(`/api/hunter/library/${id}/text`);
    expect(after.body.readable_status).toBe("ready");
    expect(after.body.markdown).toContain("three deities came into existence");
    expect(after.body.markdown).not.toContain("<script>");
    expect(after.body.text).toBeNull();
  });

  it("extracts a Wikisource revisions JSON payload into readable prose", async () => {
    const prose = "Now when chaos had begun to condense, the names of the deities were these. ".repeat(15);
    const payload = JSON.stringify({
      query: { pages: { "9": { title: "Kojiki", revisions: [{ slots: { main: { "*": `== Part I ==\n${prose}` } } }] } } },
    });
    const { id, abs } = await insertCorpusFile("public/work-test/kojiki.json", payload, {
      file: { content_type: "application/json" },
    });
    const res = await request(app).get(`/api/hunter/library/${id}/text`);
    expect(res.body.readable_status).toBe("preparing");
    const deadline = Date.now() + 15_000;
    while (!(await fs.stat(`${abs}.readable.md`).catch(() => null))) {
      if (Date.now() > deadline) throw new Error("extraction did not finish");
      await new Promise((r) => setTimeout(r, 100));
    }
    const after = await request(app).get(`/api/hunter/library/${id}/text`);
    expect(after.body.readable_status).toBe("ready");
    expect(after.body.markdown).toContain("chaos had begun to condense");
    expect(after.body.markdown).not.toContain('"query"');
  });

  it("reports failed (not raw markup) when no readable version can be made", async () => {
    // Tiny HTML: the single-page recipe rejects it as too short, so the
    // queued extraction fails — the reader must see a failure, not markup.
    const { id } = await insertCorpusFile(
      "public/work-test/stub.html",
      "<!DOCTYPE html><html><body><p>tiny</p></body></html>",
      { file: { content_type: "text/html" } },
    );
    const first = await request(app).get(`/api/hunter/library/${id}/text`);
    expect(first.body.text).toBeNull();
    // Either the job fails synchronously at queue time or shortly after.
    const deadline = Date.now() + 15_000;
    let status = first.body.readable_status;
    while (status === "preparing") {
      if (Date.now() > deadline) throw new Error("extraction never settled");
      await new Promise((r) => setTimeout(r, 100));
      const res = await request(app).get(`/api/hunter/library/${id}/text`);
      status = res.body.readable_status;
    }
    expect(status).toBe("failed");
    const final = await request(app).get(`/api/hunter/library/${id}/text`);
    expect(final.body.text).toBeNull();
    expect(final.body.markdown).toBeNull();
  });

  it("backfill endpoint queues extraction for files without readable siblings", async () => {
    const prose = "The great flood covered the land and the hero built a vessel of reeds. ".repeat(20);
    const html = `<!DOCTYPE html><html><head><title>Flood</title></head><body><p>${prose}</p></body></html>`;
    const { abs } = await insertCorpusFile("public/work-test/flood.html", html, {
      file: { content_type: "text/html" },
    });
    const unauthorized = await request(app).post("/api/hunter/extraction/backfill").send({});
    expect(unauthorized.status).toBe(401);
    const res = await request(app).post("/api/hunter/extraction/backfill").set(asEditor).send({});
    expect(res.status).toBe(200);
    expect(res.body.queued).toBeGreaterThanOrEqual(1);
    const deadline = Date.now() + 15_000;
    while (!(await fs.stat(`${abs}.readable.md`).catch(() => null))) {
      if (Date.now() > deadline) throw new Error("backfill extraction did not finish");
      await new Promise((r) => setTimeout(r, 100));
    }
    const md = await fs.readFile(`${abs}.readable.md`, "utf-8");
    expect(md).toContain("built a vessel of reeds");
  });
});

describe("check-url endpoint", () => {
  /** Insert a manual-fetch blocker and return its DB id. */
  async function insertBlocker(url: string | null, reason = "robots_disallowed"): Promise<number> {
    const [row] = await db
      .insert(hunterBlockers)
      .values({ reason, url, status: "open", detail: "test" })
      .returning({ id: hunterBlockers.id });
    return row.id;
  }

  /**
   * Set up one mock hop via http/https.request.
   * The mock calls options.lookup (our safeLookup) before responding, which is
   * exactly what Node.js does at connect time — this exercises the full SSRF
   * validation path without opening any real sockets.
   */
  function setupHopResponse(
    mod: typeof https | typeof http,
    statusCode: number,
    headers: Record<string, string> = {},
  ) {
    vi.mocked(mod.request).mockImplementationOnce((options: any, callback: any) => {
      const handlers: Record<string, Function> = {};
      const req = {
        on: vi.fn((event: string, handler: Function) => { handlers[event] = handler; return req; }),
        end: vi.fn(() => {
          // Invoke safeLookup — mirrors how Node.js calls lookup at connect time
          if (options.lookup) {
            options.lookup(options.hostname ?? "", {}, (err: Error | null) => {
              if (err) handlers["error"]?.(err);
              else callback({ statusCode, headers, resume: vi.fn() });
            });
          } else {
            callback({ statusCode, headers, resume: vi.fn() });
          }
          return req;
        }),
        destroy: vi.fn(() => req),
      };
      return req as any;
    });
  }

  beforeEach(() => {
    // Default: DNS resolves to a public IP so normal probes proceed.
    vi.mocked(lookup).mockResolvedValue([{ address: "93.184.216.34", family: 4 }] as any);
  });

  afterEach(() => {
    vi.mocked(https.request).mockReset();
    vi.mocked(http.request).mockReset();
    vi.mocked(lookup).mockReset();
  });

  it("requires editor auth", async () => {
    const id = await insertBlocker("https://example.com/text.txt");
    const res = await request(app).get(`/api/hunter/check-url?id=${id}`);
    expect(res.status).toBe(401);
  });

  it("returns 400 when id is missing", async () => {
    const res = await request(app).get("/api/hunter/check-url").set(asEditor);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/id parameter required/);
  });

  it("returns 404 for an unknown blocker id", async () => {
    const res = await request(app).get("/api/hunter/check-url?id=999999").set(asEditor);
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });

  it("returns 400 when the blocker has no URL", async () => {
    const id = await insertBlocker(null);
    const res = await request(app).get(`/api/hunter/check-url?id=${id}`).set(asEditor);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/no URL/i);
  });

  it.each([
    "https://127.0.0.1/text.txt",
    "https://10.0.0.8/text.txt",
    "https://192.168.1.5/text.txt",
    "https://169.254.169.254/latest/meta-data/",
    "https://[::1]/text.txt",
    // IPv4-mapped IPv6 in hex-group form — Node skips custom lookup for IP
    // literals, so the preflight must catch these directly.
    "https://[::ffff:7f00:1]/text.txt",      // maps to 127.0.0.1
    "https://[::ffff:0a00:0001]/text.txt",   // maps to 10.0.0.1
    "https://[::ffff:a9fe:a9fe]/text.txt",   // maps to 169.254.169.254
    // IPv6 non-global-unicast ranges beyond ::1/fe80::/fc00::/fd00::
    "https://[fe81::1]/text.txt",            // fe80::/10 link-local (past fe80:)
    "https://[febf::1]/text.txt",            // fe80::/10 link-local (upper edge)
    "https://[ff00::1]/text.txt",            // ff00::/8  multicast
    "https://[fec0::1]/text.txt",            // fec0::/10 deprecated site-local
    // IPv4 IANA special-use ranges not in the original denylist
    "https://198.18.0.1/text.txt",           // 198.18.0.0/15 benchmarking
    "https://198.19.255.255/text.txt",       // 198.18.0.0/15 upper edge
    "https://192.0.2.1/text.txt",            // 192.0.2.0/24 TEST-NET-1
    "https://198.51.100.1/text.txt",         // 198.51.100.0/24 TEST-NET-2
    "https://203.0.113.1/text.txt",          // 203.0.113.0/24 TEST-NET-3
    "https://240.0.0.1/text.txt",            // 240.0.0.0/4 reserved
  ])("blocks IP-literal private address %s — preflight rejects before any socket is opened", async (url) => {
    // Node's http(s).request skips the custom lookup option for IP-literal hostnames,
    // so the endpoint must detect and block them before calling request().
    const id = await insertBlocker(url);
    const res = await request(app).get(`/api/hunter/check-url?id=${id}`).set(asEditor);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toMatch(/private or internal/);
    // No socket attempt — request() must not have been called at all
    expect(vi.mocked(https.request)).not.toHaveBeenCalled();
    expect(vi.mocked(lookup)).not.toHaveBeenCalled();
  });

  it("returns ok:true and status 200 for a reachable URL", async () => {
    setupHopResponse(https, 200);
    const id = await insertBlocker("https://example.com/text.txt");
    const res = await request(app).get(`/api/hunter/check-url?id=${id}`).set(asEditor);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 200, ok: true, redirected: false, error: null });
  });

  it("reports unreachable on 404", async () => {
    setupHopResponse(https, 404);
    const id = await insertBlocker("https://example.com/gone.txt");
    const res = await request(app).get(`/api/hunter/check-url?id=${id}`).set(asEditor);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 404, ok: false, error: null });
  });

  it("falls back to GET when HEAD returns 405", async () => {
    setupHopResponse(https, 405); // HEAD attempt
    setupHopResponse(https, 200); // GET retry
    const id = await insertBlocker("https://example.com/text.txt");
    const res = await request(app).get(`/api/hunter/check-url?id=${id}`).set(asEditor);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 200, ok: true });
    expect(vi.mocked(https.request)).toHaveBeenCalledTimes(2);
  });

  it("blocks a private IP-literal redirect target — preflight fires before the second request is opened", async () => {
    // Hop 1 (example.com): DNS hostname, passes safeLookup, returns 301 → private IP literal
    setupHopResponse(https, 301, { location: "https://10.0.0.1/evil" });
    // Hop 2 (10.0.0.1): preflight detects IP literal + isPrivateAddress → rejected before request()
    const id = await insertBlocker("https://example.com/text.txt");
    const res = await request(app).get(`/api/hunter/check-url?id=${id}`).set(asEditor);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toMatch(/private or internal/);
    // Only the first hop opened a socket; the redirect target was blocked before request()
    expect(vi.mocked(https.request)).toHaveBeenCalledTimes(1);
  });

  it("marks redirected:true when the final host differs from the original", async () => {
    setupHopResponse(https, 301, { location: "https://other.example.com/text.txt" });
    setupHopResponse(https, 200);
    const id = await insertBlocker("https://example.com/text.txt");
    const res = await request(app).get(`/api/hunter/check-url?id=${id}`).set(asEditor);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 200, ok: true, redirected: true });
  });

  it("stops after 5 redirects and reports an error", async () => {
    for (let i = 0; i <= 5; i++) {
      setupHopResponse(https, 301, { location: "https://example.com/loop" });
    }
    const id = await insertBlocker("https://example.com/loop");
    const res = await request(app).get(`/api/hunter/check-url?id=${id}`).set(asEditor);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toMatch(/too many redirects/i);
  });

  it("blocks DNS AAAA response returning IPv4-mapped private address (::ffff:a.b.c.d form)", async () => {
    // A malicious DNS server could return an AAAA record like ::ffff:127.0.0.1
    // for a public-looking hostname. safeLookup must classify it as private and
    // propagate the error so no HTTP response is read.
    vi.mocked(lookup).mockResolvedValueOnce([
      { address: "::ffff:127.0.0.1", family: 6 },
    ] as any);
    // setupHopResponse is required so the mock invokes options.lookup (safeLookup);
    // the lookup error fires handlers["error"] before the 200 callback is reached.
    setupHopResponse(https, 200);
    const id = await insertBlocker("https://example.com/text.txt");
    const res = await request(app).get(`/api/hunter/check-url?id=${id}`).set(asEditor);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toMatch(/private or internal/);
  });

  it("DNS rebinding protection: dnsLookup is called exactly once per hop (inside safeLookup at connect time)", async () => {
    // Simulate a rebinding attack: first call returns public IP, subsequent
    // calls return a private IP. With our implementation, the runtime calls
    // safeLookup once per connection (at connect time) — the private-IP call
    // is never reached for the same hop.
    vi.mocked(lookup)
      .mockResolvedValueOnce([{ address: "8.8.8.8", family: 4 }] as any)     // used for the HEAD probe
      .mockResolvedValueOnce([{ address: "169.254.169.254", family: 4 }] as any); // would be a rebind

    setupHopResponse(https, 200);
    const id = await insertBlocker("https://example.com/text.txt");
    const res = await request(app).get(`/api/hunter/check-url?id=${id}`).set(asEditor);
    expect(res.status).toBe(200);
    // Probe succeeded using the first (public) resolution
    expect(res.body).toMatchObject({ status: 200, ok: true, error: null });
    // lookup was called exactly once — no second DNS round-trip opened the rebinding window
    expect(vi.mocked(lookup)).toHaveBeenCalledTimes(1);
  });
});

describe("failed runs report a readable reason", () => {
  /** A drizzle/pg failure: statement plus every bound parameter, cause attached. */
  function driverError(params: string, causeMessage: string): Error {
    const error = new Error(
      `Failed query: update "hunter_runs" set "result" = $1 where "hunter_runs"."id" = $2\nparams: ${params},7`,
    );
    (error as { cause?: unknown }).cause = new Error(causeMessage);
    return error;
  }

  async function startCorpusRun(filename: string) {
    const res = await request(app)
      .post("/api/hunter/cycles/corpus")
      .set(asEditor)
      .send({ filename, content: "Doomed Text\n" });
    expect(res.status).toBe(200);
    return waitForRun(res.body.run.id);
  }

  afterEach(() => {
    vi.mocked(runCorpusListCycle).mockReset();
  });

  it("stores a short reason for a driver exception, never the SQL or its parameters", async () => {
    // The parameter dump is what makes real failures tens of kilobytes long:
    // it carries the whole run-progress payload.
    const params = JSON.stringify({
      progress: {
        items: Array.from({ length: 300 }, (_, i) => ({
          title: `Item ${i}`,
          detail: "previous failure text ".repeat(20),
        })),
      },
    });
    vi.mocked(runCorpusListCycle).mockImplementationOnce(async () => {
      throw driverError(params, "connection terminated unexpectedly");
    });

    const run = await startCorpusRun("driver-failure.txt");
    expect(run.status).toBe("failed");
    expect(run.error).toBe("connection terminated unexpectedly");
    expect(run.error.length).toBeLessThan(400);
    expect(run.error).not.toMatch(/params:/);
    expect(run.error).not.toMatch(/\$1/);
  });

  it("caps an enormous single-line error instead of storing it whole", async () => {
    vi.mocked(runCorpusListCycle).mockImplementationOnce(async () => {
      throw new Error(`Discovery exploded: ${"x".repeat(50_000)}`);
    });

    const run = await startCorpusRun("huge-failure.txt");
    expect(run.status).toBe("failed");
    expect(run.error.length).toBeLessThanOrEqual(400);
    expect(run.error).toMatch(/^Discovery exploded: x+… \(truncated\)$/);
  });

  it("finishes the run as failed even when recording a blocker fails", async () => {
    vi.mocked(runCorpusListCycle).mockImplementationOnce(async (options: any) => {
      // The blocker insert blows up mid-cycle; that must not become the run's
      // failure reason, and must not stop the cycle from finishing.
      const insertSpy = vi.spyOn(db as any, "insert").mockImplementation(() => {
        throw driverError('{"detail":"..."}', "deadlock detected");
      });
      try {
        await options.store.addBlocker({ reason: "fetch_failed", detail: "Item failed" });
        await options.store.updateProgress({ phase: "corpus_item", item_index: 1 });
      } finally {
        insertSpy.mockRestore();
      }
      throw new Error("Discovery failed for every item in the list");
    });

    const run = await startCorpusRun("blocker-write-failure.txt");
    expect(run.status).toBe("failed");
    // The real cause survives — not the swallowed bookkeeping error.
    expect(run.error).toBe("Discovery failed for every item in the list");

    const detail = await request(app).get(`/api/hunter/runs/${run.id}`);
    expect(detail.status).toBe(200);
    expect(detail.body.blockers).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Minimal CycleSummary shape used by the runHuntingCycle mock.
// ---------------------------------------------------------------------------
const MOCK_CYCLE_SUMMARY = {
  discovered: 0,
  created: 0,
  duplicates: 0,
  invalid: 0,
  secondary: 0,
  downloaded_public: 3,
  downloaded_locked: 1,
  metadata_only: 2,
  failed: 1,
  blockers: 0,
  entries: [],
  discovery: [],
};

describe("cycle POST handler — scope seeding", () => {
  beforeEach(() => {
    vi.mocked(runHuntingCycle).mockResolvedValue(MOCK_CYCLE_SUMMARY as any);
  });

  afterEach(() => {
    vi.mocked(runHuntingCycle).mockReset();
  });

  it("seeds result.scope.region before finishRun is called", async () => {
    // Hold the cycle so we can inspect the DB while the run is still in-flight.
    let releaseCycle!: () => void;
    const cycleBlocked = new Promise<void>((resolve) => {
      releaseCycle = resolve;
    });
    vi.mocked(runHuntingCycle).mockImplementationOnce(
      () => cycleBlocked.then(() => MOCK_CYCLE_SUMMARY as any),
    );

    const res = await request(app)
      .post("/api/hunter/cycles")
      .set(asEditor)
      .send({ region_id: "greece" });

    expect(res.status).toBe(200);
    expect(res.body.run.status).toBe("running");

    // While the cycle is still blocked (finishRun has NOT been called yet),
    // the run row must already carry result.scope.region.
    const detail = await request(app).get(`/api/hunter/runs/${res.body.run.id}`);
    expect(detail.status).toBe(200);
    expect(detail.body.status).toBe("running");
    expect(detail.body.result.scope.region.id).toBe("greece");
    expect(detail.body.result.scope.region.label).toBeTruthy();

    // Let the cycle finish so the test cleans up properly.
    releaseCycle();
    const finished = await waitForRun(res.body.run.id);
    // Scope must still be present in the completed run result.
    expect(finished.result.scope.region.id).toBe("greece");
  });

  it("seeds scope on a region-scoped cycle even when the cycle throws", async () => {
    vi.mocked(runHuntingCycle).mockImplementationOnce(async () => {
      throw new Error("Simulated cycle failure");
    });

    const res = await request(app)
      .post("/api/hunter/cycles")
      .set(asEditor)
      .send({ region_id: "japan" });

    expect(res.status).toBe(200);
    const run = await waitForRun(res.body.run.id);
    expect(run.status).toBe("failed");
    // Region must survive the failure path.
    expect(run.result.scope.region.id).toBe("japan");
  });
});

describe("map endpoint", () => {
  /** Insert cycle run rows directly so we control scope / result shape. */
  async function insertCycleRun(opts: {
    status: "completed" | "failed" | "running";
    regionId?: string;
    result?: Record<string, unknown>;
  }): Promise<number> {
    const scope: Record<string, unknown> = opts.regionId
      ? { query: `test query`, region: { id: opts.regionId, label: opts.regionId } }
      : { query: "test query" };
    const result = opts.result ?? {
      scope,
      downloaded_public: 2,
      downloaded_locked: 0,
      metadata_only: 1,
      failed: 0,
      invalid: 0,
      // Deliberately include a bulky field that the map must strip.
      entries: Array.from({ length: 50 }, (_, i) => ({ work_id: `work:${i}` })),
    };
    const [row] = await (db as any)
      .insert(hunterRuns)
      .values({ kind: "cycle", status: opts.status, result })
      .returning({ id: hunterRuns.id });
    return row.id as number;
  }

  it("returns all cycle rows with no 25-row cap", async () => {
    // Insert 30 cycle rows (more than the default 25-row LIMIT used elsewhere).
    const ids: number[] = [];
    for (let i = 0; i < 30; i++) {
      ids.push(await insertCycleRun({ status: "completed", regionId: "egypt" }));
    }

    const res = await request(app).get("/api/hunter/map");
    expect(res.status).toBe(200);

    const returnedIds = res.body.runs.map((r: any) => r.id);
    for (const id of ids) {
      expect(returnedIds).toContain(id);
    }
    // All inserted rows must appear — no cap trimming.
    expect(returnedIds.length).toBeGreaterThanOrEqual(30);
  });

  it("strips bulky fields and returns only the expected summary fields per row", async () => {
    const id = await insertCycleRun({ status: "completed", regionId: "rome" });

    const res = await request(app).get("/api/hunter/map");
    expect(res.status).toBe(200);

    const row = res.body.runs.find((r: any) => r.id === id);
    expect(row).toBeDefined();

    // Required summary keys must be present.
    expect(row).toHaveProperty("id");
    expect(row).toHaveProperty("status");
    expect(row).toHaveProperty("result");

    // Bulk field must be stripped.
    expect(row.result).not.toHaveProperty("entries");

    // Only the expected result sub-fields should appear.
    const ALLOWED_RESULT_KEYS = new Set([
      "scope",
      "downloaded_public",
      "downloaded_locked",
      "metadata_only",
      "failed",
      "invalid",
    ]);
    for (const key of Object.keys(row.result ?? {})) {
      expect(ALLOWED_RESULT_KEYS.has(key), `unexpected result key: ${key}`).toBe(true);
    }
  });

  it("carries the region on a failed run so the map stays populated", async () => {
    // A failed run seeded with scope: the map must not drop its region.
    const id = await insertCycleRun({
      status: "failed",
      result: {
        scope: { query: "Norse epics", region: { id: "norse", label: "Scandinavia & Norse" } },
      },
    });

    const res = await request(app).get("/api/hunter/map");
    expect(res.status).toBe(200);

    const row = res.body.runs.find((r: any) => r.id === id);
    expect(row).toBeDefined();
    expect(row.status).toBe("failed");
    expect(row.result.scope.region.id).toBe("norse");
  });
});
