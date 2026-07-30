/**
 * Route-level tests for the /api/hunter/* HTTP layer.
 *
 * Uses an in-memory Postgres (PGlite) in place of the real database and a
 * temp working directory so CORPUS_ROOT / the policy override land in an
 * isolated corpus root. Auth uses the real requireEditor middleware and the
 * real HMAC x-editor-token derived from SESSION_SECRET.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import express, { type Express } from "express";
import request from "supertest";

import { requireEditor, EDITOR_TOKEN } from "../editorAuth";

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
