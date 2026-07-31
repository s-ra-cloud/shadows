/**
 * Route-level integration tests for POST /api/hunter/cycles/corpus.
 *
 * Verifies that the stored run result always contains the fields the Cycles UI
 * depends on — `scope`, `corpus_list.items[]` with per-item statuses, and the
 * aggregated counters (downloaded_public, blockers, …) — so a future change to
 * the cycle result contract cannot silently hide the report or the stats.
 *
 * `runCorpusListCycle` is mocked so no real discovery/download happens; this
 * keeps the test fast and focused on the HTTP/storage contract.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { Mock } from "vitest";
import { promises as fs } from "node:fs";
import * as os from "node:os";
import express, { type Express } from "express";
import request from "supertest";

import { requireEditor, EDITOR_TOKEN } from "../editorAuth";

// ── storage stub ────────────────────────────────────────────────────────────
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
    CREATE TABLE hunter_screen_verdicts (
      id serial PRIMARY KEY,
      title_key text NOT NULL UNIQUE,
      title text NOT NULL,
      classification text NOT NULL,
      justification text NOT NULL,
      created_at timestamp DEFAULT now() NOT NULL
    );
    CREATE TABLE hunter_rights_reviews (
      id serial PRIMARY KEY,
      corpus_file_id integer REFERENCES hunter_corpus_files(id),
      work_id text NOT NULL,
      edition_id text NOT NULL,
      decision text NOT NULL,
      determined_status text,
      basis text NOT NULL,
      notes text,
      previous_status text,
      created_at timestamp DEFAULT now() NOT NULL
    );
  `);
  const db = drizzle(client, { schema });
  return {
    db,
    storage: { getNodes: async () => [] },
  };
});

// ── corpus-cycle stub ────────────────────────────────────────────────────────
// Mocked before the route module is imported so the route always uses the mock.
vi.mock("../hunterCorpusCycle", () => ({
  runCorpusListCycle: vi.fn(),
}));

// ── helpers ──────────────────────────────────────────────────────────────────

const asEditor = { "x-editor-token": EDITOR_TOKEN };

/** A minimal but valid corpus-cycle result matching CorpusCycleResult. */
function makeCycleResult(listName: string) {
  return {
    corpus_list: {
      name: listName,
      total: 2,
      fetched: 1,
      fetched_locked: 0,
      metadata_only: 0,
      failed: 0,
      not_found: 1,
      items: [
        {
          title: "Theogony",
          author: "Hesiod",
          status: "fetched",
          languages: ["en"],
          english: true,
          edition_ids: ["edition:theogony-en"],
          detail: "",
        },
        {
          title: "Lost Fragments",
          author: null,
          status: "not_found",
          languages: [],
          english: false,
          edition_ids: [],
          detail: "No leads found.",
        },
      ],
    },
    summary: {
      discovered: 1,
      created: 1,
      duplicates: 0,
      invalid: 0,
      secondary: 0,
      downloaded_public: 1,
      downloaded_locked: 0,
      metadata_only: 0,
      failed: 0,
      blockers: 0,
      entries: [],
      discovery: [],
    },
  };
}

async function waitForRun(app: Express, runId: number, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const res = await request(app).get(`/api/hunter/runs/${runId}`);
    expect(res.status).toBe(200);
    if (res.body.status !== "running") return res.body;
    if (Date.now() > deadline) throw new Error(`run ${runId} did not finish in time`);
    await new Promise((r) => setTimeout(r, 50));
  }
}

// ── test suite ────────────────────────────────────────────────────────────────

let app: Express;
let tempRoot: string;
let runCorpusListCycleMock: Mock;

beforeAll(async () => {
  tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "corpus-routes-"));
  vi.spyOn(process, "cwd").mockReturnValue(tempRoot);

  const { registerHunterRoutes } = await import("../hunterRoutes");
  const { runCorpusListCycle } = await import("../hunterCorpusCycle");
  runCorpusListCycleMock = runCorpusListCycle as Mock;

  app = express();
  app.use(express.json({ limit: "10mb" }));
  registerHunterRoutes(app, requireEditor);
});

afterAll(async () => {
  vi.restoreAllMocks();
  await fs.rm(tempRoot, { recursive: true, force: true });
});

import * as path from "node:path";

// ── 400 / 413 rejection paths ─────────────────────────────────────────────

describe("POST /api/hunter/cycles/corpus — rejection paths", () => {
  it("returns 400 when filename is missing", async () => {
    const res = await request(app)
      .post("/api/hunter/cycles/corpus")
      .set(asEditor)
      .send({ content: "Theogony\n" });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/file.*name|name.*file/i);
  });

  it("returns 400 when content is empty", async () => {
    const res = await request(app)
      .post("/api/hunter/cycles/corpus")
      .set(asEditor)
      .send({ filename: "list.txt", content: "   \n  " });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/empty/i);
  });

  it("returns 413 when content exceeds the 512 KB cap", async () => {
    // Build a string slightly over 512 KB of valid-looking lines.
    const line = "A".repeat(80) + "\n";
    const oversized = line.repeat(Math.ceil((512 * 1024) / line.length) + 10);
    const res = await request(app)
      .post("/api/hunter/cycles/corpus")
      .set(asEditor)
      .send({ filename: "big.txt", content: oversized });
    expect(res.status).toBe(413);
    expect(res.body.message).toMatch(/512 KB/i);
  });

  it("returns 400 when the content cannot be parsed (bad JSON)", async () => {
    const res = await request(app)
      .post("/api/hunter/cycles/corpus")
      .set(asEditor)
      .send({ filename: "bad.json", content: "{not valid json" });
    expect(res.status).toBe(400);
    // CorpusListParseError message comes through unchanged.
    expect(typeof res.body.message).toBe("string");
    expect(res.body.message.length).toBeGreaterThan(0);
  });

  it("returns 400 when the list parses to zero items (only comments)", async () => {
    const res = await request(app)
      .post("/api/hunter/cycles/corpus")
      .set(asEditor)
      .send({ filename: "empty.txt", content: "# just a comment\n\n" });
    expect(res.status).toBe(400);
    expect(typeof res.body.message).toBe("string");
  });

  it("returns 401 without an editor token", async () => {
    const res = await request(app)
      .post("/api/hunter/cycles/corpus")
      .send({ filename: "list.txt", content: "Theogony\n" });
    expect(res.status).toBe(401);
  });
});

// ── happy path: stored result contract ──────────────────────────────────────

describe("POST /api/hunter/cycles/corpus — stored run result contract", () => {
  it("returns a running run immediately and stores scope + corpus_list + counters when the cycle finishes", async () => {
    const listName = "test-list";
    const cycleResult = makeCycleResult(listName);
    runCorpusListCycleMock.mockResolvedValueOnce(cycleResult);

    // The route responds immediately with a running run.
    const postRes = await request(app)
      .post("/api/hunter/cycles/corpus")
      .set(asEditor)
      .send({ filename: `${listName}.txt`, content: "Theogony — Hesiod\nLost Fragments\n" });

    expect(postRes.status).toBe(200);
    expect(postRes.body.run.status).toBe("running");
    expect(typeof postRes.body.run.id).toBe("number");
    expect(postRes.body.corpus_list.name).toBe(listName);
    expect(postRes.body.corpus_list.items).toBe(2);

    const runId: number = postRes.body.run.id;

    // Wait for the background cycle to complete and be persisted.
    const run = await waitForRun(app, runId);
    expect(run.status).toBe("completed");
    expect(run.error).toBeNull();

    const result = run.result as Record<string, unknown>;

    // ── scope ──────────────────────────────────────────────────────────────
    // `scope` is what the Cycles UI reads to render the summary card header.
    expect(result).toHaveProperty("scope");
    const scope = result.scope as Record<string, unknown>;
    expect(typeof scope.query).toBe("string");
    expect(scope.query).toMatch(listName);
    expect(scope.corpusList).toBe(listName);

    // ── corpus_list ────────────────────────────────────────────────────────
    expect(result).toHaveProperty("corpus_list");
    const corpusList = result.corpus_list as Record<string, unknown>;
    expect(corpusList.name).toBe(listName);
    expect(corpusList.total).toBe(2);
    expect(corpusList.fetched).toBe(1);
    expect(corpusList.not_found).toBe(1);

    // items[] must be present and each item must carry a status.
    expect(Array.isArray(corpusList.items)).toBe(true);
    const items = corpusList.items as Record<string, unknown>[];
    expect(items).toHaveLength(2);
    for (const item of items) {
      expect(typeof item.title).toBe("string");
      expect(typeof item.status).toBe("string");
      expect(Array.isArray(item.languages)).toBe(true);
      expect(typeof item.english).toBe("boolean");
      expect(Array.isArray(item.edition_ids)).toBe(true);
    }

    // Specific per-item statuses from the mocked cycle result.
    const fetched = items.find((i) => i.title === "Theogony");
    const notFound = items.find((i) => i.title === "Lost Fragments");
    expect(fetched?.status).toBe("fetched");
    expect(fetched?.english).toBe(true);
    expect((fetched?.languages as string[])).toContain("en");
    expect(notFound?.status).toBe("not_found");
    expect((notFound?.edition_ids as string[])).toHaveLength(0);

    // ── standard counters ──────────────────────────────────────────────────
    // These drive the aggregate stats cards in the UI.
    expect(typeof result.downloaded_public).toBe("number");
    expect(typeof result.blockers).toBe("number");
    expect(typeof result.discovered).toBe("number");
    expect(typeof result.failed).toBe("number");
    expect(result.downloaded_public).toBe(cycleResult.summary.downloaded_public);
    expect(result.blockers).toBe(cycleResult.summary.blockers);

    // ── auto_extraction summary ────────────────────────────────────────────
    expect(result).toHaveProperty("auto_extraction");
    const ae = result.auto_extraction as Record<string, unknown>;
    expect(typeof ae.queued).toBe("number");
    expect(Array.isArray(ae.failed)).toBe(true);
  });

  it("marks the run failed when runCorpusListCycle throws", async () => {
    runCorpusListCycleMock.mockRejectedValueOnce(new Error("simulated cycle crash"));

    const postRes = await request(app)
      .post("/api/hunter/cycles/corpus")
      .set(asEditor)
      .send({ filename: "crash.txt", content: "Theogony\n" });

    expect(postRes.status).toBe(200);
    const runId: number = postRes.body.run.id;

    const run = await waitForRun(app, runId);
    expect(run.status).toBe("failed");
    expect(run.error).toMatch(/simulated cycle crash/);
    expect(run.result).toBeNull();
  });

  it("preserves all CorpusItemStatus variants in the stored items", async () => {
    const allStatuses = ["fetched", "fetched_locked", "metadata_only", "failed", "not_found"] as const;
    const items = allStatuses.map((status, i) => ({
      title: `Work ${i}`,
      author: null,
      status,
      languages: status.startsWith("fetched") ? ["en"] : [],
      english: status === "fetched",
      edition_ids: status.startsWith("fetched") ? [`edition:work-${i}`] : [],
      detail: "",
    }));

    runCorpusListCycleMock.mockResolvedValueOnce({
      corpus_list: {
        name: "all-statuses",
        total: 5,
        fetched: 1,
        fetched_locked: 1,
        metadata_only: 1,
        failed: 1,
        not_found: 1,
        items,
      },
      summary: {
        discovered: 5,
        created: 2,
        duplicates: 0,
        invalid: 0,
        secondary: 0,
        downloaded_public: 1,
        downloaded_locked: 1,
        metadata_only: 1,
        failed: 1,
        blockers: 1,
        entries: [],
        discovery: [],
      },
    });

    const postRes = await request(app)
      .post("/api/hunter/cycles/corpus")
      .set(asEditor)
      .send({
        filename: "all-statuses.txt",
        content: allStatuses.map((s) => `Work ${s}`).join("\n") + "\n",
      });

    const run = await waitForRun(app, postRes.body.run.id);
    expect(run.status).toBe("completed");

    const storedItems = (run.result.corpus_list as any).items as Record<string, unknown>[];
    const storedStatuses = storedItems.map((i) => i.status).sort();
    expect(storedStatuses).toEqual([...allStatuses].sort());
  });
});
