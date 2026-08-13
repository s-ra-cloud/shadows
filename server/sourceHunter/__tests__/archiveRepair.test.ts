/**
 * Automatic repair of blocked Internet Archive downloads.
 *
 * A repair must produce a real download *and* keep rights review intact:
 * licence evidence comes from the resolved item's own catalog metadata, never
 * from the previous (wrong) item and never from a model's claim.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { loadPolicy, loadFulltextRegistry, type Candidate, type Policy } from "../index.js";
import { isRepairableArchiveFailure, repairArchiveDownload } from "../archiveRepair.js";
import { clearRobotsCache } from "../robots.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(HERE, "..", "data");

/** Fake Archive: metadata JSON, a redirecting /download/ path, a node file. */
function fakeArchive(options: {
  identifier: string;
  fileName: string;
  body: string;
  licenseUrl?: string | null;
  node?: string;
}) {
  const { identifier, fileName, body } = options;
  const node = options.node ?? "dn760000.eu.archive.org";
  const downloadUrl = `https://archive.org/download/${identifier}/${encodeURIComponent(fileName)}`;
  const nodeUrl = `https://${node}/0/items/${identifier}/${encodeURIComponent(fileName)}`;
  const calls: string[] = [];
  const fetchImpl = (async (input: unknown) => {
    const url = String(input);
    calls.push(url);
    const json = (payload: unknown) => ({
      ok: true,
      status: 200,
      url,
      headers: { get: () => null },
      json: async () => payload,
      text: async () => JSON.stringify(payload),
      arrayBuffer: async () => Buffer.from(JSON.stringify(payload), "utf-8"),
    });
    if (url.endsWith("/robots.txt")) {
      return {
        ok: true,
        status: 200,
        url,
        headers: { get: () => null },
        text: async () => "User-agent: *\nDisallow: /control/\n",
        arrayBuffer: async () => Buffer.from("", "utf-8"),
        json: async () => ({}),
      };
    }
    if (url === `https://archive.org/metadata/${identifier}`) {
      return json({
        files: [
          { name: `${identifier}_meta.xml`, format: "Metadata" },
          { name: fileName, format: "DjVuTXT", size: String(body.length) },
        ],
        metadata: {
          identifier,
          title: "Repaired Item",
          date: "1865",
          ...(options.licenseUrl ? { licenseurl: options.licenseUrl } : {}),
        },
      });
    }
    if (url === downloadUrl) {
      return {
        ok: false,
        status: 302,
        url,
        headers: { get: (k: string) => (k.toLowerCase() === "location" ? nodeUrl : null) },
        text: async () => "",
        arrayBuffer: async () => Buffer.from("", "utf-8"),
        json: async () => ({}),
      };
    }
    if (url === nodeUrl) {
      return {
        ok: true,
        status: 200,
        url,
        headers: { get: (k: string) => (k.toLowerCase() === "content-type" ? "text/plain" : null) },
        text: async () => body,
        arrayBuffer: async () => Buffer.from(body, "utf-8"),
        json: async () => ({}),
      };
    }
    return {
      ok: false,
      status: 404,
      url,
      headers: { get: () => null },
      text: async () => "",
      arrayBuffer: async () => Buffer.from("", "utf-8"),
      json: async () => ({}),
    };
  }) as unknown as typeof fetch;
  return { fetchImpl, downloadUrl, calls };
}

function blockedCandidate(overrides: Partial<Candidate> = {}): Candidate {
  return {
    work_id: "work:repair-me",
    edition_id: "edition:internet-archive-repair-me",
    title: "Repaired Item",
    author: "Etheridge, J. W.",
    translator: null,
    source_id: "source:internet-archive",
    language: "eng",
    language_role: "unknown",
    format: "txt",
    // A read-online viewer path: never downloadable.
    text_url: "https://archive.org/stream/repairme/repairme_djvu.txt",
    rights: {
      status_claim: "unknown",
      basis: "source_statement",
      statement: "AI-suggested lead (confidence: medium); rights evidence pending verification.",
      ai_claimed_statement: "Public domain, CC0 (model claim)",
      ai_claimed_license_url: "https://creativecommons.org/publicdomain/zero/1.0/",
    },
    access: { download_allowed: true, requires_auth: false },
    ...overrides,
  } as unknown as Candidate;
}

describe("archive download repair", () => {
  let policy: Policy;
  let registry: Record<string, unknown>;

  beforeEach(async () => {
    clearRobotsCache();
    policy = await loadPolicy(path.join(DATA, "config", "collection-policy.json"));
    registry = await loadFulltextRegistry(path.join(DATA, "sources", "fulltext-registry.json"));
  });

  it("recognises only the download failures a resolver can fix", () => {
    const base = { source_id: "source:internet-archive", download_status: "metadata_only" };
    expect(
      isRepairableArchiveFailure({ ...base, error: "target path is not allowed for source:internet-archive" }),
    ).toBe(true);
    expect(
      isRepairableArchiveFailure({
        ...base,
        error: "redirect target is not a trusted redirect for source:internet-archive: https://dn760000.eu.archive.org/…",
      }),
    ).toBe(true);
    expect(
      isRepairableArchiveFailure({ ...base, download_status: "failed", error: "download failed (404)" }),
    ).toBe(true);
    // Not repairable: robots refusals, auth walls, other sources, successes.
    expect(isRepairableArchiveFailure({ ...base, error: "robots_disallowed: robots.txt disallows /x" })).toBe(false);
    expect(isRepairableArchiveFailure({ ...base, download_status: "downloaded", error: "" })).toBe(false);
    expect(
      isRepairableArchiveFailure({ ...base, source_id: "source:perseus", error: "target path is not allowed" }),
    ).toBe(false);
  });

  it("resolves the real file, downloads it, and keeps rights assessment", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "rmrh-repair-"));
    const body = "THE REAL OCR TEXT OF THE REPAIRED ITEM";
    const { fetchImpl, downloadUrl } = fakeArchive({
      identifier: "repairme",
      fileName: "Repaired Item & Notes_djvu.txt",
      body,
    });
    const outcome = await repairArchiveDownload(blockedCandidate(), {
      policy,
      registry,
      corpusRoot: dir,
      fetchImpl,
      requestsPerSecond: 1000,
    });
    expect(outcome.repaired).toBe(true);
    expect(outcome.resolvedUrl).toBe(downloadUrl);
    expect(outcome.itemUrl).toBe("https://archive.org/details/repairme");

    const record = outcome.record!;
    expect(record.download_status).toBe("downloaded");
    // Rights review still ran: no licence evidence, so the text is locked.
    const rights = record.rights as Record<string, unknown>;
    expect(rights.status).toBe("unknown");
    expect(rights.locked).toBe(true);
    const file = record.file as Record<string, unknown>;
    expect(String(file.relative_path).startsWith("locked/")).toBe(true);
    expect(await fs.readFile(path.join(dir, String(file.relative_path)), "utf-8")).toBe(body);
  });

  it("takes licence evidence from the resolved item, never from the model's claim", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "rmrh-repair-"));
    const { fetchImpl } = fakeArchive({
      identifier: "repairme",
      fileName: "repairme_djvu.txt",
      body: "TEXT",
      licenseUrl: "http://creativecommons.org/licenses/by/4.0/",
    });
    const outcome = await repairArchiveDownload(blockedCandidate(), {
      policy,
      registry,
      corpusRoot: dir,
      fetchImpl,
      requestsPerSecond: 1000,
    });
    expect(outcome.repaired).toBe(true);
    const rights = outcome.candidate!.rights as Record<string, unknown>;
    expect(rights.license_url).toBe("http://creativecommons.org/licenses/by/4.0/");
    expect(rights.rights_url).toBe("https://archive.org/details/repairme");
    // The model's claim survives only in its own unverified key.
    expect(String(rights.statement)).not.toMatch(/CC0|model claim/i);
    expect(rights.ai_claimed_statement).toBe("Public domain, CC0 (model claim)");
    const recordRights = outcome.record!.rights as Record<string, unknown>;
    expect(recordRights.status).toBe("open_license");
  });

  it("reports an unfixable item instead of retrying blindly", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "rmrh-repair-"));
    const fetchImpl = (async (input: unknown) => {
      const url = String(input);
      if (url.endsWith("/robots.txt")) {
        return {
          ok: true,
          status: 200,
          url,
          headers: { get: () => null },
          text: async () => "User-agent: *\nDisallow: /control/\n",
          json: async () => ({}),
        };
      }
      // Unknown item, and the catalog search finds nothing convincing.
      const payload = url.startsWith("https://archive.org/metadata/")
        ? {}
        : { response: { numFound: 0, docs: [] } };
      return {
        ok: true,
        status: 200,
        url,
        headers: { get: () => null },
        json: async () => payload,
        text: async () => JSON.stringify(payload),
      };
    }) as unknown as typeof fetch;

    const outcome = await repairArchiveDownload(blockedCandidate(), {
      policy,
      registry,
      corpusRoot: dir,
      fetchImpl,
      requestsPerSecond: 1000,
    });
    expect(outcome.repaired).toBe(false);
    expect(outcome.record).toBeNull();
    expect(outcome.reason).toBe("no_confident_match");
    expect(outcome.detail).toMatch(/Auto-repair tried and failed/);
  });
});
