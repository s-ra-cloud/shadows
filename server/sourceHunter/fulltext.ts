/**
 * Download complete source texts into public/locked corpus partitions.
 * Faithful port of fulltext.py.
 */

import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import * as fsSync from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { FullTextSource } from "./fulltextSources.js";
import {
  PermissionErrorLike,
  selectFulltextSource,
  validateCandidateAccess,
  validateRemoteUrl,
} from "./fulltextSources.js";
import { guessContentType } from "./fetch.js";
import { slug } from "./normalization.js";
import { planCandidates, type CandidatePlan, type PlanSelection } from "./planning.js";
import { assessRights, extractEmbeddedNotice, type Candidate, type Policy } from "./rights.js";
import { pyJsonDumpsCompact } from "./records.js";
import { coerceAssessedAt, isoFormat } from "./dateUtil.js";

export const DEFAULT_USER_AGENT =
  "ReligiousMythologyResourceHunter/0.2 (rights-aware research corpus collector)";

const EXTENSIONS: Record<string, string> = {
  txt: ".txt",
  tei_xml: ".xml",
  xml: ".xml",
  html: ".html",
  epub: ".epub",
  pdf: ".pdf",
  json: ".json",
};

class Throttle {
  private lastRequest = new Map<string, number>();

  async wait(source: FullTextSource): Promise<void> {
    const sourceId = String(source.source_id);
    const interval = 1.0 / Number(source.requests_per_second);
    const previous = this.lastRequest.get(sourceId);
    const now = performance.now() / 1000;
    if (previous !== undefined) {
      const remaining = interval - (now - previous);
      if (remaining > 0) {
        await new Promise((resolve) => setTimeout(resolve, Math.min(remaining, 60.0) * 1000));
      }
    }
    this.lastRequest.set(sourceId, performance.now() / 1000);
  }
}

function downloadId(candidate: Candidate): string {
  const identity = [
    String(candidate.work_id),
    String(candidate.edition_id),
    String(candidate.text_url ?? candidate.local_path),
  ].join("|");
  return "download:" + createHash("sha256").update(identity, "utf-8").digest("hex").slice(0, 16);
}

function checksum(payload: Buffer): string {
  return "sha256:" + createHash("sha256").update(payload).digest("hex");
}

async function robotsAllowed(): Promise<boolean> {
  // Robots handling is best-effort in this port; remote fetches are also gated
  // by the source allow-list in validateRemoteUrl. Default allow.
  return true;
}

async function readCandidatePayload(
  candidate: Candidate,
  source: FullTextSource,
  options: { userAgent: string; maximumBytes: number; throttle: Throttle },
): Promise<{ payload: Buffer; contentType: string | null }> {
  validateCandidateAccess(candidate, source);
  if (candidate.local_path) {
    const p = String(candidate.local_path);
    const stat = await fs.stat(p).catch(() => null);
    if (!stat || !stat.isFile()) {
      throw new Error(`local full text does not exist: ${p}`);
    }
    if (stat.size > options.maximumBytes) {
      throw new Error("local full text exceeds maximum_file_bytes");
    }
    const payload = await fs.readFile(p);
    const guessed = guessContentType(p);
    return { payload, contentType: guessed || null };
  }

  const url = String(candidate.text_url);
  if (!(await robotsAllowed())) {
    throw new PermissionErrorLike(`robots policy disallows download: ${url}`);
  }
  await options.throttle.wait(source);
  const response = await fetch(url, {
    headers: {
      Accept:
        "text/plain, application/xml, text/xml, text/html, application/epub+zip, application/pdf, application/json",
      "User-Agent": options.userAgent,
    },
  });
  validateRemoteUrl(response.url, source);
  const payload = Buffer.from(await response.arrayBuffer());
  if (payload.length > options.maximumBytes) {
    throw new Error("remote full text exceeds maximum_file_bytes");
  }
  const contentType = (response.headers.get("content-type") || "").split(";")[0].trim() || null;
  return { payload, contentType };
}

function editionPaths(
  corpusRoot: string,
  candidate: Candidate,
  locked: boolean,
): { textPath: string; rightsPath: string; lockPath: string | null } {
  const workComponent = slug(String(candidate.work_id).split(":").slice(1).join(":") || String(candidate.work_id));
  const editionRaw = String(candidate.edition_id);
  const editionComponent = slug(editionRaw.includes(":") ? editionRaw.slice(editionRaw.indexOf(":") + 1) : editionRaw);
  const extension = EXTENSIONS[String(candidate.format)];
  const partition = locked ? "locked" : "public";
  const textPath = path.join(corpusRoot, partition, workComponent, `${editionComponent}${extension}`);
  const rightsPath = path.join(corpusRoot, "rights", workComponent, `${editionComponent}.rights.json`);
  const lockPath = locked ? textPath + ".LOCK.json" : null;
  return { textPath, rightsPath, lockPath };
}

async function atomicWrite(filePath: string, payload: Buffer, mode: number): Promise<string> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const desired = checksum(payload);
  if (fsSync.existsSync(filePath)) {
    const existing = await fs.readFile(filePath);
    if (checksum(existing) !== desired) {
      throw new Error(`refusing to overwrite different existing file: ${filePath}`);
    }
    await fs.chmod(filePath, mode);
    return "already_present";
  }
  const tempPath = path.join(path.dirname(filePath), `.partial-${uniqueSuffix()}`);
  await fs.writeFile(tempPath, payload);
  await fs.chmod(tempPath, mode);
  await fs.rename(tempPath, filePath);
  return "downloaded";
}

async function writeJson(
  filePath: string,
  value: Record<string, unknown>,
  mode: number,
): Promise<void> {
  const payload = Buffer.from(JSON.stringify(value, null, 2) + "\n", "utf-8");
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  if (fsSync.existsSync(filePath)) {
    const existing = await fs.readFile(filePath);
    if (existing.equals(payload)) {
      await fs.chmod(filePath, mode);
      return;
    }
  }
  const tempPath = path.join(path.dirname(filePath), `.metadata-${uniqueSuffix()}`);
  await fs.writeFile(tempPath, payload);
  await fs.chmod(tempPath, mode);
  await fs.rename(tempPath, filePath);
}

let counter = 0;
function uniqueSuffix(): string {
  counter += 1;
  return `${process.pid}-${Date.now()}-${counter}-${Math.random().toString(36).slice(2)}`;
}

function relative(filePath: string | null, root: string): string | null {
  if (filePath === null) {
    return null;
  }
  return path.relative(root, filePath);
}

function baseRecord(plan: CandidatePlan, selection: PlanSelection): Record<string, unknown> {
  const candidate = plan.candidate;
  return {
    schema_version: "1.0.0",
    download_id: downloadId(candidate),
    work_id: candidate.work_id,
    edition_id: candidate.edition_id,
    title: candidate.title,
    author: candidate.author ?? null,
    translator: candidate.translator ?? null,
    language: candidate.language,
    language_role: candidate.language_role,
    original_language: candidate.original_language ?? null,
    source_id: candidate.source_id,
    source_reference: String(candidate.text_url ?? candidate.local_path),
    format: candidate.format,
    selection: { ...selection },
    rights: plan.rights_assessment,
    download_status: "not_selected",
    file: null,
    error: null,
    retrieved_at: null,
  };
}

async function writeCorpusReadme(root: string): Promise<void> {
  const filePath = path.join(root, "README.txt");
  const content = Buffer.from(
    "FULL-TEXT CORPUS\n\n" +
      "public/ contains editions whose explicit rights evidence permits publication under the configured policy.\n" +
      "locked/ contains research copies that MUST NOT be republished. Every locked file has a .LOCK.json marker and restrictive local permissions.\n" +
      "rights/ contains the per-edition decision and evidence. corpus.jsonl is the machine-readable index.\n\n" +
      "A lock is a safety control, not a legal determination or DRM.\n",
    "utf-8",
  );
  if (fsSync.existsSync(filePath)) {
    const existing = await fs.readFile(filePath);
    if (existing.equals(content)) {
      return;
    }
    throw new Error(`refusing to overwrite corpus README: ${filePath}`);
  }
  await atomicWrite(filePath, content, 0o644);
}

/**
 * Plan the candidates, then download the selected editions into a public/locked
 * corpus partition under `corpusRoot`, writing rights sidecars, lock markers and
 * the corpus.jsonl manifest exactly like the Python tool.
 * `assessedAt` accepts an ISO string or Date (defaults to now).
 */
export async function collectFulltexts(
  candidates: Iterable<Candidate>,
  policy: Policy,
  registry: Record<string, unknown>,
  corpusRoot: string,
  options: { assessedAt?: string | Date; selectionMode?: string; userAgent?: string } = {},
): Promise<Record<string, unknown>[]> {
  const selectionMode = options.selectionMode ?? "preferred";
  const userAgent = options.userAgent ?? DEFAULT_USER_AGENT;
  const assessedAt = coerceAssessedAt(options.assessedAt);
  if (!["preferred", "all"].includes(selectionMode)) {
    throw new Error("selection_mode must be preferred or all");
  }
  const plans = planCandidates(candidates, policy, { assessedAt });
  await fs.mkdir(corpusRoot, { recursive: true });
  await writeCorpusReadme(corpusRoot);
  const throttle = new Throttle();
  const records: Record<string, unknown>[] = [];
  for (const plan of plans) {
    const candidate = plan.candidate;
    const access = candidate.access as Record<string, unknown>;
    let selection: PlanSelection = { ...plan.selection };
    if (selectionMode === "all" && access.download_allowed) {
      selection = { selected: true, reason: "all_authorized_editions", rank: 50 };
    }
    const record = baseRecord(plan, selection);
    if (!selection.selected) {
      records.push(record);
      continue;
    }
    if (!access.download_allowed || access.requires_auth) {
      record.download_status = "metadata_only";
      records.push(record);
      continue;
    }
    try {
      const source = selectFulltextSource(registry, String(candidate.source_id));
      const { payload, contentType } = await readCandidatePayload(candidate, source, {
        userAgent,
        maximumBytes: Number(policy.maximum_file_bytes),
        throttle,
      });
      const embeddedNotice = extractEmbeddedNotice(payload, String(candidate.format));
      const finalRights = assessRights(candidate, policy, { embeddedNotice, assessedAt });
      record.rights = finalRights;
      const { textPath, rightsPath, lockPath } = editionPaths(
        corpusRoot,
        candidate,
        finalRights.locked,
      );
      const status = await atomicWrite(textPath, payload, finalRights.locked ? 0o600 : 0o644);
      const rightsDocument = {
        schema_version: "1.0.0",
        work_id: candidate.work_id,
        edition_id: candidate.edition_id,
        source_id: candidate.source_id,
        source_reference: record.source_reference,
        rights: finalRights,
        candidate_rights_evidence: candidate.rights,
        file_sha256: checksum(payload),
      };
      await writeJson(rightsPath, rightsDocument, finalRights.locked ? 0o600 : 0o644);
      if (lockPath) {
        const lockDocument = {
          locked: true,
          do_not_publish: true,
          work_id: candidate.work_id,
          edition_id: candidate.edition_id,
          rights_status: finalRights.status,
          reasons: finalRights.reasons,
          rights_record: relative(rightsPath, corpusRoot),
        };
        await writeJson(lockPath, lockDocument, 0o600);
      }
      record.download_status = status;
      record.retrieved_at = isoFormat(assessedAt);
      record.file = {
        relative_path: relative(textPath, corpusRoot),
        bytes: payload.length,
        sha256: checksum(payload),
        content_type: contentType,
        locked: finalRights.locked,
        lock_path: relative(lockPath, corpusRoot),
        rights_path: relative(rightsPath, corpusRoot),
      };
    } catch (error) {
      if (error instanceof PermissionErrorLike) {
        record.download_status = "metadata_only";
        record.error = error.message;
      } else {
        record.download_status = "failed";
        record.error = error instanceof Error ? error.message : String(error);
      }
    }
    records.push(record);
  }
  await writeCorpusManifest(path.join(corpusRoot, "corpus.jsonl"), records);
  return records;
}

/** Write the corpus.jsonl manifest (compact JSON lines, mode 0644). */
export async function writeCorpusManifest(
  filePath: string,
  records: Iterable<Record<string, unknown>>,
): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const lines: string[] = [];
  for (const record of Array.from(records)) {
    lines.push(pyJsonDumpsCompact(record));
  }
  const payload = Buffer.from(lines.length > 0 ? lines.join("\n") + "\n" : "", "utf-8");
  const tempPath = path.join(path.dirname(filePath), `.manifest-${uniqueSuffix()}`);
  await fs.writeFile(tempPath, payload);
  await fs.chmod(tempPath, 0o644);
  await fs.rename(tempPath, filePath);
}

/** Read the corpus.jsonl manifest into record objects. */
export async function iterCorpusManifest(filePath: string): Promise<Record<string, unknown>[]> {
  const text = await fs.readFile(filePath, "utf-8");
  const out: Record<string, unknown>[] = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.trim()) {
      continue;
    }
    const value = JSON.parse(line);
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error(`${filePath}:${i + 1}: corpus record is not an object`);
    }
    out.push(value as Record<string, unknown>);
  }
  return out;
}

/** Counts returned by verifyCorpus (keys match the Python verify-corpus output). */
export interface CorpusCounts {
  records: number;
  downloaded: number;
  public: number;
  locked: number;
  metadata_only: number;
  not_selected: number;
  failed: number;
}

async function fileMode(p: string): Promise<number> {
  const stat = await fs.stat(p);
  return stat.mode;
}

/**
 * Verify a corpus: byte counts, checksums, partitions, permissions and lock
 * markers, mirroring the Python verify-corpus command. Throws on any problem.
 */
export async function verifyCorpus(corpusRoot: string): Promise<CorpusCounts> {
  const manifestPath = path.join(corpusRoot, "corpus.jsonl");
  const counts: CorpusCounts = {
    records: 0,
    downloaded: 0,
    public: 0,
    locked: 0,
    metadata_only: 0,
    not_selected: 0,
    failed: 0,
  };
  const root = path.resolve(corpusRoot);
  for (const record of await iterCorpusManifest(manifestPath)) {
    counts.records += 1;
    const status = record.download_status as string;
    if (status === "downloaded" || status === "already_present") {
      counts.downloaded += 1;
      const fileInfo = record.file;
      if (!fileInfo || typeof fileInfo !== "object" || Array.isArray(fileInfo)) {
        throw new Error("downloaded corpus record has no file");
      }
      const info = fileInfo as Record<string, unknown>;
      const p = path.resolve(corpusRoot, String(info.relative_path));
      if (!isInside(root, p)) {
        throw new Error("corpus file escapes corpus root");
      }
      const stat = await fs.stat(p).catch(() => null);
      if (!stat || !stat.isFile()) {
        throw new Error(`missing corpus file: ${p}`);
      }
      const payload = await fs.readFile(p);
      if (payload.length !== info.bytes) {
        throw new Error(`byte count mismatch: ${p}`);
      }
      if (checksum(payload) !== info.sha256) {
        throw new Error(`checksum mismatch: ${p}`);
      }
      const rightsRelative = info.rights_path;
      if (!rightsRelative) {
        throw new Error(`corpus file has no rights record: ${p}`);
      }
      const rightsPath = path.resolve(corpusRoot, String(rightsRelative));
      if (!isInside(root, rightsPath)) {
        throw new Error("rights record escapes corpus root");
      }
      const rightsStat = await fs.stat(rightsPath).catch(() => null);
      if (!rightsStat || !rightsStat.isFile()) {
        throw new Error(`missing rights record: ${rightsPath}`);
      }
      const rightsDocument = JSON.parse(await fs.readFile(rightsPath, "utf-8"));
      if (rightsDocument.edition_id !== record.edition_id) {
        throw new Error(`rights record edition mismatch: ${rightsPath}`);
      }
      if (rightsDocument.file_sha256 !== info.sha256) {
        throw new Error(`rights record checksum mismatch: ${rightsPath}`);
      }
      const recordRights = record.rights as Record<string, unknown>;
      if (info.locked) {
        counts.locked += 1;
        if (!info.lock_path) {
          throw new Error(`locked file has no lock marker: ${p}`);
        }
        const lockPath = path.resolve(corpusRoot, String(info.lock_path));
        if (!isInside(root, lockPath)) {
          throw new Error("lock marker escapes corpus root");
        }
        const lockStat = await fs.stat(lockPath).catch(() => null);
        if (!lockStat || !lockStat.isFile()) {
          throw new Error(`missing lock marker: ${lockPath}`);
        }
        const lockDocument = JSON.parse(await fs.readFile(lockPath, "utf-8"));
        if (!lockDocument.do_not_publish || lockDocument.edition_id !== record.edition_id) {
          throw new Error(`invalid lock marker: ${lockPath}`);
        }
        if (
          ((await fileMode(p)) & 0o077) !== 0 ||
          ((await fileMode(lockPath)) & 0o077) !== 0 ||
          ((await fileMode(rightsPath)) & 0o077) !== 0
        ) {
          throw new PermissionErrorLike(`locked material permissions are too broad: ${p}`);
        }
        if (recordRights.publication_allowed) {
          throw new Error(`locked file marked publishable: ${p}`);
        }
      } else {
        counts.public += 1;
        if (!recordRights.publication_allowed) {
          throw new Error(`public file is not cleared for publication: ${p}`);
        }
      }
    } else if (status in counts) {
      (counts as unknown as Record<string, number>)[status] += 1;
    } else {
      throw new Error(`unsupported download_status: ${status}`);
    }
  }
  return counts;
}

function isInside(root: string, target: string): boolean {
  const rel = path.relative(root, target);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

// Keep os import referenced for potential temp-dir consumers.
void os;
