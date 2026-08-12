/**
 * Tests for automatic map-region assignment:
 *  - startup backfill of cycle runs missing scope.region (idempotent),
 *  - region inference at cycle creation (free-query and corpus-list),
 *  - the enriched /api/hunter/map payload with per-region text counts.
 *
 * Uses an in-memory Postgres (PGlite) and mocks the cycle runners so no real
 * discovery/download happens.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { Mock } from "vitest";
import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
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

// ── cycle runner stubs (no real discovery/downloads) ────────────────────────
vi.mock("../hunterCorpusCycle", () => ({
  runCorpusListCycle: vi.fn(),
}));
vi.mock("../hunterCycle", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../hunterCycle")>();
  return { ...actual, runHuntingCycle: vi.fn() };
});

import { db } from "../storage";
import { hunterRuns, hunterCorpusFiles } from "@shared/schema";
import { runCorpusListCycle } from "../hunterCorpusCycle";
import { runHuntingCycle } from "../hunterCycle";
import { eq } from "drizzle-orm";

const asEditor = { "x-editor-token": EDITOR_TOKEN };

const runHuntingCycleMock = runHuntingCycle as unknown as Mock;
const runCorpusListCycleMock = runCorpusListCycle as unknown as Mock;

function makeCorpusCycleResult(listName: string) {
  return {
    corpus_list: { name: listName, total: 1, fetched: 0, fetched_locked: 0, not_found: 1, failed: 0, metadata_only: 0, items: [] },
    summary: { discovered: 0, created: 0, duplicates: 0, invalid: 0, downloaded_public: 0, downloaded_locked: 0, metadata_only: 0, failed: 1, blockers: 0 },
  };
}

let app: Express;
let tempRoot: string;
let backfillCycleRegionAssignments: typeof import("../hunterRoutes").backfillCycleRegionAssignments;

beforeAll(async () => {
  tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "hunter-region-"));
  vi.spyOn(process, "cwd").mockReturnValue(tempRoot);
  const routes = await import("../hunterRoutes");
  backfillCycleRegionAssignments = routes.backfillCycleRegionAssignments;
  app = express();
  app.use(express.json({ limit: "10mb" }));
  routes.registerHunterRoutes(app, requireEditor);
  // Let the fire-and-forget startup backfill finish on the (empty) tables
  // before tests seed their own rows.
  await new Promise((resolve) => setTimeout(resolve, 300));
});

afterAll(async () => {
  vi.restoreAllMocks();
  await fs.rm(tempRoot, { recursive: true, force: true });
});

async function waitForRun(runId: number, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const [row] = await db.select().from(hunterRuns).where(eq(hunterRuns.id, runId)).limit(1);
    if (row && row.status !== "running") return row;
    if (Date.now() > deadline) throw new Error(`run ${runId} still running after ${timeoutMs}ms`);
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

describe("backfillCycleRegionAssignments", () => {
  it("assigns inferable runs once, marks unresolved runs, and is idempotent", async () => {
    // A: inferable from its query.
    const [runA] = await db.insert(hunterRuns).values({
      kind: "cycle", status: "completed",
      result: { scope: { query: "Norse mythology Edda saga" }, downloaded_public: 2 },
    }).returning();
    // B: already has an explicit region — must be untouched.
    const [runB] = await db.insert(hunterRuns).values({
      kind: "cycle", status: "completed",
      result: { scope: { query: "anything", region: { id: "greece", label: "Greece & Aegean" } } },
    }).returning();
    // C: no inferable evidence — must be marked unresolved, not guessed.
    const [runC] = await db.insert(hunterRuns).values({
      kind: "cycle", status: "failed",
      result: { scope: { query: "zxqv 12345 lorem ipsum" } },
    }).returning();
    // D: no result at all, but a downloaded text whose record carries evidence.
    const [runD] = await db.insert(hunterRuns).values({
      kind: "cycle", status: "completed", result: null,
    }).returning();
    await db.insert(hunterCorpusFiles).values({
      workId: "work:popol-vuh", editionId: "edition:popol-vuh-en",
      partition: "public", path: "public/popol-vuh.txt", runId: runD.id,
      record: { title: "Popol Vuh", author: "Anonymous", source_id: "sacred-texts" },
    });

    const first = await backfillCycleRegionAssignments();
    expect(first.assigned).toBe(2);
    expect(first.unresolved).toBe(1);
    expect(first.skipped).toBe(1);

    const rows = await db.select().from(hunterRuns);
    const byId = new Map(rows.map((r) => [r.id, r.result as any]));
    expect(byId.get(runA.id).scope.region.id).toBe("norse");
    expect(byId.get(runA.id).scope.regionInferred).toBe(true);
    expect(byId.get(runA.id).scope.regionInference).toBe("inferred");
    // Existing counters survive the scope rewrite.
    expect(byId.get(runA.id).downloaded_public).toBe(2);
    expect(byId.get(runB.id).scope.region.id).toBe("greece");
    expect(byId.get(runB.id).scope.regionInference).toBeUndefined();
    expect(byId.get(runC.id).scope.region).toBeUndefined();
    expect(byId.get(runC.id).scope.regionInference).toBe("unresolved");
    expect(byId.get(runD.id).scope.region.id).toBe("mesoamerica");

    // Second pass: nothing re-analyzed.
    const second = await backfillCycleRegionAssignments();
    expect(second.assigned).toBe(0);
    expect(second.unresolved).toBe(0);
    expect(second.skipped).toBe(second.scanned);
  });
});

describe("region auto-assignment at cycle creation", () => {
  it("infers a region for a free-query cycle", async () => {
    runHuntingCycleMock.mockResolvedValueOnce({
      discovered: 0, created: 0, duplicates: 0, invalid: 0,
      downloaded_public: 0, downloaded_locked: 0, metadata_only: 0, failed: 0, blockers: 0,
    });
    const res = await request(app)
      .post("/api/hunter/cycles")
      .set(asEditor)
      .send({ query: "Greek mythology Hesiod theogony", use_ai: false });
    expect(res.status).toBe(200);
    const run = await waitForRun(res.body.run.id);
    const scope = (run.result as any).scope;
    expect(scope.region?.id).toBe("greece");
    expect(scope.regionInferred).toBe(true);
  });

  it("leaves the region unset when the query is ambiguous", async () => {
    runHuntingCycleMock.mockResolvedValueOnce({
      discovered: 0, created: 0, duplicates: 0, invalid: 0,
      downloaded_public: 0, downloaded_locked: 0, metadata_only: 0, failed: 0, blockers: 0,
    });
    const res = await request(app)
      .post("/api/hunter/cycles")
      .set(asEditor)
      .send({ query: "zxqv obscure untraceable", use_ai: false });
    expect(res.status).toBe(200);
    const run = await waitForRun(res.body.run.id);
    expect((run.result as any).scope.region).toBeUndefined();
  });

  it("does not override an explicit region_id", async () => {
    runHuntingCycleMock.mockResolvedValueOnce({
      discovered: 0, created: 0, duplicates: 0, invalid: 0,
      downloaded_public: 0, downloaded_locked: 0, metadata_only: 0, failed: 0, blockers: 0,
    });
    const res = await request(app)
      .post("/api/hunter/cycles")
      .set(asEditor)
      .send({ query: "Norse mythology Edda", region_id: "egypt", use_ai: false });
    expect(res.status).toBe(200);
    const run = await waitForRun(res.body.run.id);
    const scope = (run.result as any).scope;
    expect(scope.region.id).toBe("egypt");
    expect(scope.regionInferred).toBeUndefined();
  });

  it("infers a region for a corpus-list cycle from the list contents", async () => {
    runCorpusListCycleMock.mockResolvedValueOnce(makeCorpusCycleResult("norse-myths"));
    const res = await request(app)
      .post("/api/hunter/cycles/corpus")
      .set(asEditor)
      .send({ filename: "norse-myths.txt", content: "Prose Edda\nVoluspa\n" });
    expect(res.status).toBe(200);
    const run = await waitForRun(res.body.run.id);
    expect(run.status).toBe("completed");
    const scope = (run.result as any).scope;
    expect(scope.corpusList).toBe("norse-myths");
    expect(scope.region?.id).toBe("norse");
    expect(scope.regionInferred).toBe(true);
  });

  it("keeps the region on a failed corpus-list cycle", async () => {
    runCorpusListCycleMock.mockRejectedValueOnce(new Error("simulated crash"));
    const res = await request(app)
      .post("/api/hunter/cycles/corpus")
      .set(asEditor)
      .send({ filename: "kojiki-shinto.txt", content: "Kojiki\n" });
    expect(res.status).toBe(200);
    const run = await waitForRun(res.body.run.id);
    expect(run.status).toBe("failed");
    expect((run.result as any).scope.region?.id).toBe("japan");
  });
});

describe("GET /api/hunter/map", () => {
  it("returns runs plus per-region downloaded text counts", async () => {
    // Text linked to a run that has a region: attributed via the run.
    const [regionRun] = await db.insert(hunterRuns).values({
      kind: "cycle", status: "completed",
      result: { scope: { query: "x", region: { id: "egypt", label: "Egypt & Nile Valley" } } },
    }).returning();
    await db.insert(hunterCorpusFiles).values({
      workId: "work:amduat", editionId: "edition:amduat-en",
      partition: "public", path: "public/amduat.txt", runId: regionRun.id,
      record: { title: "Some Untitled Fragment" },
    });
    // Orphan text (no run): region inferred from its own record metadata.
    await db.insert(hunterCorpusFiles).values({
      workId: "work:gilgamesh", editionId: "edition:gilgamesh-en",
      partition: "public", path: "public/gilgamesh.txt", runId: null,
      record: { title: "Epic of Gilgamesh", author: "Anonymous", source_id: "etcsl" },
    });
    // Orphan text with no evidence: contributes nowhere.
    await db.insert(hunterCorpusFiles).values({
      workId: "work:mystery", editionId: "edition:mystery",
      partition: "locked", path: "locked/mystery.txt", runId: null,
      record: { title: "qqqq zzzz" },
    });

    const res = await request(app).get("/api/hunter/map");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.runs)).toBe(true);
    // Runs payload keeps the slim shape (scope + counters, no entries).
    const mapRun = res.body.runs.find((r: any) => r.id === regionRun.id);
    expect(mapRun.result.scope.region.id).toBe("egypt");
    expect(res.body.region_texts.egypt).toBe(1);
    expect(res.body.region_texts.mesopotamia).toBeGreaterThanOrEqual(1);
  });
});
