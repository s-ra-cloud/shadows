/**
 * Conservative one-request transport for reviewed registry sources.
 * Port of fetch.py, extended (per porting brief) to also resolve local_path
 * candidates against a caller-supplied base directory.
 */

import { promises as fs } from "node:fs";
import * as path from "node:path";
import type { SourceDefinition } from "./adapters.js";

export const DEFAULT_USER_AGENT =
  "ReligiousMythologyResourceHunter/0.1 (research collector; contact configured by operator)";

function allowedHost(url: string, source: SourceDefinition): boolean {
  const target = (safeHostname(url) || "").toLowerCase();
  const endpoint = (safeHostname(String(source.endpoint_url)) || "").toLowerCase();
  const allowed = (source.allowed_hosts as string[]) ?? [endpoint];
  return allowed.some((host) => {
    const h = String(host).toLowerCase();
    return target === h || target.endsWith("." + h);
  });
}

function safeHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

/** Result of a fetch: the payload bytes and a best-effort content type. */
export interface FetchResult {
  payload: Buffer;
  contentType: string;
}

/**
 * Fetch one allowed payload over http(s) after an allow-list check.
 * Robots handling is best-effort (Python read robots.txt; here we honour the
 * allow-list and `review_status: blocked`). Enforces a byte ceiling.
 */
export async function fetchPayload(
  url: string,
  source: SourceDefinition,
  options: { userAgent?: string; timeout?: number; maxBytes?: number } = {},
): Promise<FetchResult> {
  const userAgent = options.userAgent ?? DEFAULT_USER_AGENT;
  const maxBytes = options.maxBytes ?? 25_000_000;
  const timeout = options.timeout ?? 30.0;
  if (!allowedHost(url, source)) {
    throw new Error("URL host is not allowed by the source definition");
  }
  const access = (source.access as Record<string, unknown>) ?? {};
  if (access.review_status === "blocked") {
    throw new Error("source access review is blocked");
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout * 1000);
  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json, application/xml, text/xml, text/plain",
        "User-Agent": userAgent,
      },
      signal: controller.signal,
    });
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > maxBytes) {
      throw new Error(`response exceeds ${maxBytes} bytes`);
    }
    const contentType = (response.headers.get("content-type") || "").split(";")[0].trim();
    return { payload: buffer, contentType };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Read a local_path candidate payload, resolving relative paths against
 * `baseDir`. Enforces a byte ceiling. Mirrors the local branch behavior used
 * by the full-text collector.
 */
export async function readLocalPayload(
  localPath: string,
  options: { baseDir?: string; maxBytes?: number } = {},
): Promise<FetchResult> {
  const maxBytes = options.maxBytes ?? 25_000_000;
  const resolved = path.isAbsolute(localPath)
    ? localPath
    : path.resolve(options.baseDir ?? process.cwd(), localPath);
  const stat = await fs.stat(resolved).catch(() => null);
  if (!stat || !stat.isFile()) {
    throw new Error(`local full text does not exist: ${resolved}`);
  }
  if (stat.size > maxBytes) {
    throw new Error("local full text exceeds maximum bytes");
  }
  const payload = await fs.readFile(resolved);
  return { payload, contentType: guessContentType(resolved) };
}

/** Very small MIME guesser mirroring the formats the tool handles. */
export function guessContentType(name: string): string {
  const ext = path.extname(name).toLowerCase();
  switch (ext) {
    case ".txt":
      return "text/plain";
    case ".xml":
      return "application/xml";
    case ".html":
      return "text/html";
    case ".json":
      return "application/json";
    case ".epub":
      return "application/epub+zip";
    case ".pdf":
      return "application/pdf";
    default:
      return "";
  }
}
