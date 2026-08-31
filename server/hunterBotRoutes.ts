/**
 * Small, stable API for trusted autonomous agents.
 *
 * Search itself is registered in hunterRoutes.ts so it calls the identical
 * handler used by the editor UI. Everything here is read/download plumbing.
 */
import type { Express, RequestHandler } from "express";
import { promises as fs } from "node:fs";
import * as path from "node:path";
import { desc, eq } from "drizzle-orm";
import { db } from "./storage";
import { hunterBlockers, hunterCorpusFiles, hunterRuns } from "@shared/schema";
import { readablePaths } from "./sourceHunter/extraction/run";

const CORPUS_ROOT = path.resolve(process.cwd(), "data", "hunter-corpus");

function parseId(value: string): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

async function safeExistingPath(candidate: string): Promise<string | null> {
  try {
    const [realRoot, realTarget] = await Promise.all([
      fs.realpath(CORPUS_ROOT),
      fs.realpath(candidate),
    ]);
    const prefix = realRoot.endsWith(path.sep) ? realRoot : `${realRoot}${path.sep}`;
    return realTarget.startsWith(prefix) ? realTarget : null;
  } catch {
    return null;
  }
}

export async function resolveSafeCorpusPath(relativePath: string): Promise<string | null> {
  if (!relativePath || path.isAbsolute(relativePath)) return null;
  const resolved = path.resolve(CORPUS_ROOT, relativePath);
  const prefix = CORPUS_ROOT.endsWith(path.sep) ? CORPUS_ROOT : `${CORPUS_ROOT}${path.sep}`;
  if (!resolved.startsWith(prefix)) return null;
  // realpath resolves every symlink in the chain, preventing a DB row or
  // sidecar symlink from escaping the corpus root.
  return safeExistingPath(resolved);
}

async function readableSidecars(rawPath: string): Promise<{
  markdown: string;
  provenance: string | null;
} | null> {
  const candidates = readablePaths(rawPath);
  const markdown = await safeExistingPath(candidates.markdown);
  if (!markdown) return null;
  return {
    markdown,
    provenance: await safeExistingPath(candidates.provenance),
  };
}

async function corpusSummary(row: typeof hunterCorpusFiles.$inferSelect) {
  const record = (row.record ?? {}) as Record<string, unknown>;
  const rawPath = await resolveSafeCorpusPath(row.path);
  const readable = rawPath ? await readableSidecars(rawPath) : null;
  return {
    id: row.id,
    work_id: row.workId,
    edition_id: row.editionId,
    title: typeof record.title === "string" ? record.title : null,
    author: typeof record.author === "string" ? record.author : null,
    translator: typeof record.translator === "string" ? record.translator : null,
    language: row.language,
    partition: row.partition,
    source_id: typeof record.source_id === "string" ? record.source_id : null,
    format: typeof record.format === "string" ? record.format : null,
    byte_count: row.byteCount,
    sha256: row.sha256,
    downloaded_at: row.downloadedAt,
    readable: readable != null,
    links: {
      metadata: `/api/bot/hunter/texts/${row.id}`,
      text: `/api/bot/hunter/texts/${row.id}/content`,
      download: `/api/bot/hunter/texts/${row.id}/download`,
    },
  };
}

const OPENAPI = {
  openapi: "3.1.0",
  info: {
    title: "SHADOWS Hunter Bot API",
    version: "1.0.0",
    description:
      "Editor-level API for trusted agents. All operations require a Bearer token. Search runs asynchronously; poll the returned run URL.",
  },
  servers: [{ url: "/" }],
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer" },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    "/api/bot/hunter/search": {
      post: {
        summary: "Start a Hunter search",
        description:
          "Uses the same search as the editor UI. region_id may be supplied instead of query. Poll the returned run URL until status is completed or failed.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  query: { type: "string" },
                  region_id: { type: "string" },
                  limit: { type: "integer", minimum: 1, maximum: 25, default: 10 },
                  use_ai: { type: "boolean", default: true },
                },
              },
            },
          },
        },
        responses: { "200": { description: "Search launched" }, "400": { description: "Invalid search" } },
      },
    },
    "/api/bot/hunter/runs": {
      get: { summary: "List recent Hunter runs", responses: { "200": { description: "Run list" } } },
    },
    "/api/bot/hunter/runs/{id}": {
      get: {
        summary: "Poll one run and inspect its files and blockers",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        responses: { "200": { description: "Run detail" }, "404": { description: "Run not found" } },
      },
    },
    "/api/bot/hunter/texts": {
      get: {
        summary: "List all stored texts, including locked texts",
        parameters: [
          { name: "q", in: "query", schema: { type: "string" }, description: "Title or author substring" },
          { name: "language", in: "query", schema: { type: "string" } },
          { name: "partition", in: "query", schema: { type: "string", enum: ["public", "locked"] } },
          { name: "source_id", in: "query", schema: { type: "string" } },
        ],
        responses: { "200": { description: "Corpus inventory" } },
      },
    },
    "/api/bot/hunter/texts/{id}": {
      get: {
        summary: "Get metadata for one stored text",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        responses: { "200": { description: "Text metadata" }, "404": { description: "Text not found" } },
      },
    },
    "/api/bot/hunter/texts/{id}/content": {
      get: {
        summary: "Read one text directly",
        description: "Returns extracted Markdown when available, otherwise the raw UTF-8 text.",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        responses: { "200": { description: "Text content" }, "415": { description: "Binary text must be downloaded" } },
      },
    },
    "/api/bot/hunter/texts/{id}/download": {
      get: {
        summary: "Download the original stored file",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        responses: { "200": { description: "Original file attachment" } },
      },
    },
  },
};

export function registerHunterBotRoutes(app: Express, requireHunterBot: RequestHandler) {
  // Protect the entire namespace, including documentation.
  app.use("/api/bot/hunter", requireHunterBot);

  app.get("/api/bot/hunter/openapi.json", (_req, res) => res.json(OPENAPI));

  app.get("/api/bot/hunter", (_req, res) => {
    res.json({
      name: "SHADOWS Hunter Bot API",
      openapi: "/api/bot/hunter/openapi.json",
      operations: {
        search: "POST /api/bot/hunter/search",
        runs: "GET /api/bot/hunter/runs",
        texts: "GET /api/bot/hunter/texts",
      },
    });
  });

  app.get("/api/bot/hunter/runs", async (_req, res) => {
    const runs = await db.select().from(hunterRuns).orderBy(desc(hunterRuns.id)).limit(100);
    res.json({
      data: runs.map(({ result, ...run }) => ({ ...run, has_result: result != null })),
    });
  });

  app.get("/api/bot/hunter/runs/:id", async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: { code: "invalid_id", message: "Invalid run id" } });
    const [run] = await db.select().from(hunterRuns).where(eq(hunterRuns.id, id)).limit(1);
    if (!run) return res.status(404).json({ error: { code: "not_found", message: "Run not found" } });
    const files = await db.select().from(hunterCorpusFiles).where(eq(hunterCorpusFiles.runId, id));
    const blockers = await db.select().from(hunterBlockers).where(eq(hunterBlockers.runId, id));
    res.json({ data: { ...run, files: await Promise.all(files.map(corpusSummary)), blockers } });
  });

  app.get("/api/bot/hunter/texts", async (req, res) => {
    const q = typeof req.query.q === "string" ? req.query.q.trim().toLowerCase() : "";
    const language = typeof req.query.language === "string" ? req.query.language : null;
    const partition = req.query.partition === "public" || req.query.partition === "locked"
      ? req.query.partition
      : null;
    const sourceId = typeof req.query.source_id === "string" ? req.query.source_id : null;

    let rows = await db.select().from(hunterCorpusFiles).orderBy(hunterCorpusFiles.id);
    rows = rows.filter((row) => {
      const record = (row.record ?? {}) as Record<string, unknown>;
      if (language && row.language !== language) return false;
      if (partition && row.partition !== partition) return false;
      if (sourceId && record.source_id !== sourceId) return false;
      if (q) {
        const haystack = `${record.title ?? ""} ${record.author ?? ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
    const publicCount = rows.filter((row) => row.partition === "public").length;
    res.json({
      data: await Promise.all(rows.map(corpusSummary)),
      meta: { total: rows.length, public: publicCount, locked: rows.length - publicCount },
    });
  });

  app.get("/api/bot/hunter/texts/:id", async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: { code: "invalid_id", message: "Invalid text id" } });
    const [row] = await db.select().from(hunterCorpusFiles).where(eq(hunterCorpusFiles.id, id)).limit(1);
    if (!row) return res.status(404).json({ error: { code: "not_found", message: "Text not found" } });
    res.json({ data: { ...(await corpusSummary(row)), record: row.record } });
  });

  app.get("/api/bot/hunter/texts/:id/content", async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: { code: "invalid_id", message: "Invalid text id" } });
    const [row] = await db.select().from(hunterCorpusFiles).where(eq(hunterCorpusFiles.id, id)).limit(1);
    if (!row) return res.status(404).json({ error: { code: "not_found", message: "Text not found" } });
    const rawPath = await resolveSafeCorpusPath(row.path);
    if (!rawPath) return res.status(500).json({ error: { code: "unsafe_path", message: "Stored file path is invalid" } });
    try {
      const sidecars = await readableSidecars(rawPath);
      if (sidecars) {
        const markdown = await fs.readFile(sidecars.markdown, "utf8");
        let provenance: unknown = null;
        if (sidecars.provenance) {
          try {
            provenance = JSON.parse(await fs.readFile(sidecars.provenance, "utf8"));
          } catch {
            provenance = null;
          }
        }
        return res.json({
          data: { id: row.id, format: "markdown", content: markdown, provenance },
        });
      }
      const record = (row.record ?? {}) as Record<string, unknown>;
      const format = String(record.format ?? path.extname(rawPath).slice(1)).toLowerCase();
      if (["pdf", "epub", "zip", "gz", "jpg", "jpeg", "png"].includes(format)) {
        return res.status(415).json({
          error: {
            code: "binary_content",
            message: "No readable extraction exists; use the download endpoint for this binary file",
            download: `/api/bot/hunter/texts/${row.id}/download`,
          },
        });
      }
      const content = await fs.readFile(rawPath, "utf8");
      res.json({ data: { id: row.id, format: format || "text", content } });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return res.status(404).json({ error: { code: "file_missing", message: "Stored file is missing" } });
      }
      throw error;
    }
  });

  app.get("/api/bot/hunter/texts/:id/download", async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: { code: "invalid_id", message: "Invalid text id" } });
    const [row] = await db.select().from(hunterCorpusFiles).where(eq(hunterCorpusFiles.id, id)).limit(1);
    if (!row) return res.status(404).json({ error: { code: "not_found", message: "Text not found" } });
    const rawPath = await resolveSafeCorpusPath(row.path);
    if (!rawPath) return res.status(500).json({ error: { code: "unsafe_path", message: "Stored file path is invalid" } });
    res.download(rawPath, path.basename(row.path), (error) => {
      if (error && !res.headersSent) {
        res.status((error as NodeJS.ErrnoException).code === "ENOENT" ? 404 : 500).json({
          error: { code: "download_failed", message: "The stored file could not be downloaded" },
        });
      }
    });
  });
}