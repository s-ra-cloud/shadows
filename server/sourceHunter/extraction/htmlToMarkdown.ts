/**
 * HTML → Markdown conversion for extraction recipes.
 * Boilerplate (scripts, styles, navigation, forms...) is stripped before the
 * remaining document is converted with Turndown.
 */

import TurndownService from "turndown";

const DROP_BLOCKS = [
  "script",
  "style",
  "noscript",
  "iframe",
  "form",
  "nav",
  "header",
  "footer",
  "svg",
  "select",
  "button",
];

/** Remove boilerplate blocks and comments from raw HTML. */
export function stripBoilerplate(html: string): string {
  let out = html.replace(/<!--[\s\S]*?-->/g, " ");
  out = out.replace(/<head\b[\s\S]*?<\/head>/gi, " ");
  for (const tag of DROP_BLOCKS) {
    out = out.replace(new RegExp(`<${tag}\\b[\\s\\S]*?<\\/${tag}>`, "gi"), " ");
  }
  return out;
}

let turndown: TurndownService | null = null;

function service(): TurndownService {
  if (!turndown) {
    turndown = new TurndownService({
      headingStyle: "atx",
      hr: "---",
      bulletListMarker: "-",
      codeBlockStyle: "fenced",
    });
    // One rule handles every link (later-added turndown rules take
    // precedence, so keeping this logic in a single rule avoids ordering
    // surprises):
    // - navigation links ("Next", "Previous", "Index"...) are dropped
    //   entirely — they are noise in a compiled document;
    // - relative links point at other pages of the source site and are
    //   meaningless in a compiled document — keep just their text;
    // - absolute links are kept as markdown links.
    // Images are decoration in a compiled text document (and relative image
    // URLs would be broken anyway) — drop them all.
    turndown.addRule("dropImages", {
      filter: "img",
      replacement: () => "",
    });
    turndown.addRule("cleanLinks", {
      filter: "a",
      replacement: (content, node) => {
        const text = content.replace(/\s+/g, " ").trim();
        const lower = text.toLowerCase();
        if (
          ["next", "previous", "prev", "index", "contents", "up", "home", "back"].includes(lower) ||
          /^(next|previous|prev)\s*[:.]/.test(lower)
        ) {
          return "";
        }
        const href = (node as HTMLElement).getAttribute?.("href") ?? "";
        if (!/^https?:\/\//i.test(href)) return content;
        return text ? `[${text}](${href})` : "";
      },
    });
  }
  return turndown;
}

/** Convert an HTML document (or fragment) to Markdown. */
export function htmlToMarkdown(html: string): string {
  const markdown = service().turndown(stripBoilerplate(html));
  return markdown.replace(/\n{3,}/g, "\n\n").trim();
}

/** Best-effort page title: <title> then first heading. */
export function htmlTitle(html: string): string | null {
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1];
  const heading = /<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/i.exec(html)?.[1];
  const raw = (title ?? heading ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    // Drop trailing site-name suffixes ("... | Internet Sacred Text Archive").
    .replace(/\s*\|[^|]*$/, "")
    .trim();
  return raw || null;
}

export interface ExtractedLink {
  url: string;
  text: string;
}

/**
 * Extract same-host content links from an HTML page in document order.
 * Fragments, mailto/js links, images and off-host URLs are skipped.
 */
export function extractContentLinks(html: string, baseUrl: string): ExtractedLink[] {
  const base = new URL(baseUrl);
  const seen = new Set<string>();
  const links: ExtractedLink[] = [];
  const body = stripBoilerplate(html);
  const pattern = /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(body)) !== null) {
    const href = match[1].trim();
    if (!href || href.startsWith("#") || /^(mailto|javascript|data):/i.test(href)) continue;
    let resolved: URL;
    try {
      resolved = new URL(href, base);
    } catch {
      continue;
    }
    if (resolved.protocol !== "https:" && resolved.protocol !== "http:") continue;
    if (resolved.hostname.toLowerCase() !== base.hostname.toLowerCase()) continue;
    if (/\.(png|jpe?g|gif|svg|ico|css|js|zip|mp3|mp4|pdf|epub)$/i.test(resolved.pathname)) continue;
    resolved.hash = "";
    const key = resolved.toString();
    if (key === base.toString() || seen.has(key)) continue;
    seen.add(key);
    const text = match[2].replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    links.push({ url: key, text });
  }
  return links;
}
