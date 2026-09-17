/**
 * Route-level tests for the benchmark launcher and the bot progress report:
 *   POST /api/hunter/cycles/benchmark   (editor token)
 *   POST /api/bot/hunter/benchmark      (bot bearer token)
 *   GET  /api/bot/hunter/report         (bot bearer token)
 *
 * In-memory Postgres (PGlite) stands in for the database, `process.cwd()`
 * points at a temp dir holding a two-item benchmark CSV, and the corpus-list
 * cycle runner is mocked so nothing touches the network.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { Mock } from "vitest";
import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import express, { type Express } from "express";
import request from "supertest";

import { requireEditor, requireHunterBot, EDITOR_TOKEN } from "../editorAuth";

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
      resolved_url text,
      item_url text,
      repair_state text,
      repair_detail text,
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
  return { db, storage: { getNodes: async () => [] } };
});

vi.mock("../hunterCorpusCycle", () => ({
  runCorpusListCycle: vi.fn(),
}));

const BOT_TOKEN = "benchmark-test-bot-token";
const asEditor = { "x-editor-token": EDITOR_TOKEN };
const asBot = { authorization: `Bearer ${BOT_TOKEN}` };
const LIST = "shadows-benchmark";

const BENCHMARK_CSV = [
  "title,author,language,url,tradition,notes",
  "Kojiki,Basil Hall Chamberlain,en,,Shinto,test",
  "Theogony,Hesiod,en,,Greek,test",
  "",
].join("\n");

function cycleResult(items: { title: string; author: string | null; status: string }[]) {
  return {
    corpus_list: {
      name: LIST,
      total: items.length,
      fetched: items.filter((i) => i.status === "fetched").length,
      fetched_locked: 0,
      metadata_only: 0,
      failed: 0,
      not_found: items.filter((i) => i.status === "not_found").length,
      skipped: 0,
      blocked_reasons: {},
      items: items.map((i) => ({
        ...i,
        languages: i.status === "fetched" ? ["en"] : [],
        english: i.status === "fetched",
        edition_ids: [],
        detail: "",
        blockers: [],
      })),
      original_items: items.map((i) => ({ title: i.title, author: i.author ?? undefined })),
    },
    summary: {
      discovered: 1, created: 1, duplicates: 0, invalid: 0, secondary: 0,
      downloaded_public: 1, downloaded_locked: 0, metadata_only: 0, failed: 0, blockers: 0,
      entries: [], discovery: [],
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

let app: Express;
let tempRoot: string;
let csvPath: string;
let runCorpusListCycleMock: Mock;
let db: typeof import("../storage").db;
const originalBotToken = process.env.HUNTER_BOT_API_TOKEN;

beforeAll(async () => {
  tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "benchmark-routes-"));
  csvPath = path.join(tempRoot, "data", "hunter-benchmark", "shadows-benchmark.csv");
  await fs.mkdir(path.dirname(csvPath), { recursive: true });
  await fs.writeFile(csvPath, BENCHMARK_CSV);
  vi.spyOn(process, "cwd").mockReturnValue(tempRoot);
  process.env.HUNTER_BOT_API_TOKEN = BOT_TOKEN;

  const { registerHunterRoutes } = await import("../hunterRoutes");
  const { registerHunterBotRoutes } = await import("../hunterBotRoutes");
  const { runCorpusListCycle } = await import("../hunterCorpusCycle");
  runCorpusListCycleMock = runCorpusListCycle as Mock;
  db = (await import("../storage")).db;

  app = express();
  app.use(express.json({ limit: "10mb" }));
  // Same order as server/routes.ts: the bot guard is mounted before the
  // hunter routes register /api/bot/hunter/benchmark.
  registerHunterBotRoutes(app, requireHunterBot);
  registerHunterRoutes(app, requireEditor);
});

afterAll(async () => {
  vi.restoreAllMocks();
  if (originalBotToken === undefined) delete process.env.HUNTER_BOT_API_TOKEN;
  else process.env.HUNTER_BOT_API_TOKEN = originalBotToken;
  await fs.rm(tempRoot, { recursive: true, force: true });
});

describe("benchmark launcher", () => {
  it("requires an editor token on the editor route and a bearer token on the bot route", async () => {
    expect((await request(app).post("/api/hunter/cycles/benchmark").send({})).status).toBe(401);
    expect((await request(app).post("/api/bot/hunter/benchmark").send({})).status).toBe(401);
    expect((await request(app).post("/api/bot/hunter/benchmark").set({ authorization: "Bearer wrong" }).send({})).status).toBe(401);
  });

  it("runs the checked-in list under its fixed name and stores a comparable result", async () => {
    runCorpusListCycleMock.mockResolvedValueOnce(
      cycleResult([
        { title: "Kojiki", author: "Basil Hall Chamberlain", status: "not_found" },
        { title: "Theogony", author: "Hesiod", status: "fetched" },
      ]),
    );
    const res = await request(app).post("/api/bot/hunter/benchmark").set(asBot).send({});
    expect(res.status).toBe(200);
    expect(res.body.run.status).toBe("running");
    expect(res.body.corpus_list).toEqual({ name: LIST, items: 2 });
    expect(res.body.links.poll).toBe(`/api/hunter/runs/${res.body.run.id}`);

    const run = await waitForRun(app, res.body.run.id);
    expect(run.status).toBe("completed");
    expect(run.result.scope.corpusList).toBe(LIST);
    expect(run.result.corpus_list.name).toBe(LIST);
    expect(run.result.corpus_list.items).toHaveLength(2);

    // The cycle received the items parsed from the CSV (people-only columns dropped).
    const call = runCorpusListCycleMock.mock.calls.at(-1)![0];
    expect(call.list.name).toBe(LIST);
    expect(call.list.items).toEqual([
      { title: "Kojiki", author: "Basil Hall Chamberlain", language: "en" },
      { title: "Theogony", author: "Hesiod", language: "en" },
    ]);
    expect(call.useAi).toBe(true);
  });

  it("refuses a second benchmark run while one is in progress, then allows one after it finishes", async () => {
    let finish!: (value: unknown) => void;
    runCorpusListCycleMock.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const first = await request(app).post("/api/hunter/cycles/benchmark").set(asEditor).send({ use_ai: false });
    expect(first.status).toBe(200);

    const second = await request(app).post("/api/hunter/cycles/benchmark").set(asEditor).send({});
    expect(second.status).toBe(409);
    expect(second.body.message).toMatch(/already in progress/);

    // The handler responds before the cycle starts (policy and registry are
    // loaded first), so wait until the mocked cycle is actually running.
    await vi.waitFor(() => expect(finish).toBeTypeOf("function"));
    finish(cycleResult([
      { title: "Kojiki", author: "Basil Hall Chamberlain", status: "fetched" },
      { title: "Theogony", author: "Hesiod", status: "fetched" },
    ]));
    await waitForRun(app, first.body.run.id);
    expect(runCorpusListCycleMock.mock.calls.at(-1)![0].useAi).toBe(false);

    runCorpusListCycleMock.mockResolvedValueOnce(cycleResult([]));
    const third = await request(app).post("/api/hunter/cycles/benchmark").set(asEditor).send({});
    expect(third.status).toBe(200);
    await waitForRun(app, third.body.run.id);
  });

  it("returns 503 when the benchmark file is missing", async () => {
    const parked = `${csvPath}.parked`;
    await fs.rename(csvPath, parked);
    try {
      const res = await request(app).post("/api/hunter/cycles/benchmark").set(asEditor).send({});
      expect(res.status).toBe(503);
      expect(res.body.message).toMatch(/Benchmark list unavailable/);
    } finally {
      await fs.rename(parked, csvPath);
    }
  });
});

describe("GET /api/bot/hunter/report", () => {
  it("is documented and listed", async () => {
    const index = await request(app).get("/api/bot/hunter").set(asBot);
    expect(index.body.operations.report).toBe("GET /api/bot/hunter/report");
    expect(index.body.operations.benchmark).toBe("POST /api/bot/hunter/benchmark");
    const openapi = await request(app).get("/api/bot/hunter/openapi.json").set(asBot);
    expect(openapi.body.paths["/api/bot/hunter/report"].get).toBeDefined();
    expect(openapi.body.paths["/api/bot/hunter/benchmark"].post).toBeDefined();
  });

  it("requires the bot token", async () => {
    expect((await request(app).get("/api/bot/hunter/report")).status).toBe(401);
  });

  it("compares the two most recent completed benchmark runs and groups the latest blockers", async () => {
    const { hunterRuns, hunterBlockers } = await import("@shared/schema");
    // Earlier tests stored: run A (Kojiki not_found, Theogony fetched), run B
    // (both fetched), run C (empty). Add a retry-named run, a failed run and
    // a fresh completed run so the comparison pair is unambiguous.
    await db.insert(hunterRuns).values({
      kind: "cycle",
      status: "completed",
      result: { scope: {}, corpus_list: { name: `${LIST} (retry)`, items: [{ title: "Kojiki", status: "fetched" }] } },
    });
    const [previous] = await db.insert(hunterRuns).values({
      kind: "cycle",
      status: "completed",
      result: {
        scope: {},
        corpus_list: {
          name: LIST,
          blocked_reasons: {},
          items: [
            { title: "Kojiki", author: "Basil Hall Chamberlain", status: "fetched", languages: ["en"], english: true, edition_ids: [], detail: "", blockers: [] },
            { title: "Theogony", author: "Hesiod", status: "not_found", languages: [], english: false, edition_ids: [], detail: "", blockers: [] },
          ],
        },
      },
    }).returning({ id: hunterRuns.id });
    await db.insert(hunterRuns).values({ kind: "cycle", status: "failed", error: "restart", result: { scope: {}, corpus_list: { name: LIST, items: [] } } });
    const [latest] = await db.insert(hunterRuns).values({
      kind: "cycle",
      status: "completed",
      result: {
        scope: {},
        corpus_list: {
          name: LIST,
          blocked_reasons: { fetch_failed: 1 },
          items: [
            { title: "Kojiki", author: "Basil Hall Chamberlain", status: "fetched_locked", languages: ["en"], english: true, edition_ids: [], detail: "", blockers: [] },
            { title: "Theogony", author: "Hesiod", status: "fetched", languages: ["en"], english: true, edition_ids: [], detail: "", blockers: [] },
          ],
        },
      },
    }).returning({ id: hunterRuns.id });
    await db.insert(hunterBlockers).values([
      { runId: latest.id, sourceId: "source:project-gutenberg", reason: "fetch_failed", url: "https://www.gutenberg.org/ebooks/348", detail: "503" },
      { runId: latest.id, sourceId: "source:project-gutenberg", reason: "fetch_failed", url: "https://www.gutenberg.org/ebooks/348", detail: "503 again" },
      { runId: latest.id, sourceId: "source:internet-archive", reason: "rights_locked", url: null, detail: "locked" },
      { runId: previous.id, sourceId: "source:internet-archive", reason: "robots_disallowed", url: null, detail: "old" },
    ]);

    const res = await request(app).get("/api/bot/hunter/report?limit=3").set(asBot);
    expect(res.status).toBe(200);
    const report = res.body.data;
    expect(report.list).toBe(LIST);
    expect(report.runs).toHaveLength(3);
    expect(report.runs[0]).toMatchObject({ run_id: latest.id, status: "completed", coverage: 1, total: 2, fetched: 1, fetched_locked: 1 });
    expect(report.runs[1].status).toBe("failed");
    expect(report.runs[2]).toMatchObject({ run_id: previous.id, coverage: 0.5 });
    // The retry run is never listed under the benchmark name.
    expect(report.runs.every((r: { run_id: number }) => r.run_id !== previous.id - 1)).toBe(true);

    expect(report.latest).toMatchObject({
      run_id: latest.id,
      previous_run_id: previous.id,
      coverage: 1,
      coverage_delta: 0.5,
      improved: 1,
      regressed: 1,
    });
    const byTitle = Object.fromEntries(report.latest.items.map((i: { title: string }) => [i.title, i]));
    expect(byTitle.Theogony).toMatchObject({ status: "fetched", previous_status: "not_found", change: "improved" });
    expect(byTitle.Kojiki).toMatchObject({ status: "fetched_locked", previous_status: "fetched", change: "regressed" });

    expect(report.blockers).toEqual([
      expect.objectContaining({ reason: "fetch_failed", source_id: "source:project-gutenberg", count: 2, owner: "code", sample_urls: ["https://www.gutenberg.org/ebooks/348"] }),
      expect.objectContaining({ reason: "rights_locked", source_id: "source:internet-archive", count: 1, owner: "rights" }),
    ]);
    expect(report.routing.rights_locked).toBe("rights");
  });

  it("returns an empty report for an unknown list and clamps limit", async () => {
    const res = await request(app).get("/api/bot/hunter/report?list=no-such-list&limit=999").set(asBot);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ list: "no-such-list", runs: [], latest: null, blockers: [] });
  });
});
