/**
 * Safe page fetcher for extraction recipes that crawl linked pages.
 *
 * Every fetch (including each redirect hop) is pinned to the host of the
 * original download and re-checked against robots.txt — extraction can never
 * take traffic off the source the text came from.
 */

import { robotsAllowsUrl } from "../robots";
import { CYCLE_USER_AGENT } from "../../hunterCycle";

const MAX_REDIRECTS = 5;
const MAX_PAGE_BYTES = 4 * 1024 * 1024;

function sameHost(url: string, allowedHost: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    return parsed.hostname.toLowerCase() === allowedHost.toLowerCase();
  } catch {
    return false;
  }
}

export interface PageFetcherOptions {
  allowedHost: string;
  throttleMs?: number;
  fetchImpl?: typeof fetch;
}

/** Sequential, throttled page fetcher pinned to one host. */
export class PageFetcher {
  private lastFetch = 0;
  private readonly throttleMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: PageFetcherOptions) {
    this.throttleMs = options.throttleMs ?? 500;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async fetchPage(url: string): Promise<string> {
    try {
      return await this.fetchPageOnce(url);
    } catch (e) {
      // One retry after a pause: CDN-fronted archives intermittently 403/5xx
      // single pages mid-crawl; losing a page silently drops a whole chapter
      // (or a whole book, when the page is a sub-index).
      const message = e instanceof Error ? e.message : String(e);
      if (!/page fetch failed \((403|429|5\d\d)\)/.test(message) && !/fetch failed/i.test(message)) {
        throw e;
      }
      await new Promise((resolve) => setTimeout(resolve, 3000));
      return await this.fetchPageOnce(url);
    }
  }

  private async fetchPageOnce(url: string): Promise<string> {
    let current = url;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
      if (!sameHost(current, this.options.allowedHost)) {
        throw new Error(`page left the source host: ${current}`);
      }
      const robots = await robotsAllowsUrl(current, CYCLE_USER_AGENT, { fetchImpl: this.fetchImpl });
      if (!robots.allowed) {
        throw new Error(`robots policy disallows page: ${robots.reason}`);
      }
      const wait = this.lastFetch + this.throttleMs - Date.now();
      if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
      this.lastFetch = Date.now();
      const response = await this.fetchImpl(current, {
        headers: { "User-Agent": CYCLE_USER_AGENT, Accept: "text/html, text/plain" },
        redirect: "manual",
      });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) throw new Error(`redirect without location (${response.status})`);
        current = new URL(location, current).toString();
        continue;
      }
      if (!response.ok) throw new Error(`page fetch failed (${response.status})`);
      const payload = Buffer.from(await response.arrayBuffer());
      if (payload.length > MAX_PAGE_BYTES) throw new Error("page exceeds maximum size");
      return payload.toString("utf-8");
    }
    throw new Error("too many redirects while fetching page");
  }
}
