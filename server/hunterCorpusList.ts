/**
 * Corpus-list parsing for list-driven hunting cycles.
 *
 * An editor uploads a file (.csv, .json or .txt) whose NAME becomes the name
 * of the hunting cycle and whose CONTENT lists the sources the hunter must
 * try to fetch during the cycle.
 *
 * Accepted shapes:
 * - .txt  — one source per line. "Title — Author", "Title - Author" (single
 *           separator occurrence) or just "Title". Lines starting with # are
 *           comments; blank lines are skipped.
 * - .csv  — with or without a header row. Recognized header columns (case
 *           insensitive): title/name/work/source, author, language/lang,
 *           url/link. Without a header, column 1 = title, column 2 = author.
 * - .json — an array of strings (titles) or objects with title/name plus
 *           optional author, language, url. Also accepts {"items":[...]} or
 *           {"sources":[...]} wrappers.
 */

export interface CorpusListItem {
  title: string;
  author?: string | null;
  /** Optional language hint from the list (ISO 639 code or name). */
  language?: string | null;
  /** Optional direct URL the editor already knows for this source. */
  url?: string | null;
}

export interface CorpusList {
  /** Cycle name: the uploaded file's base name without extension. */
  name: string;
  items: CorpusListItem[];
}

export class CorpusListParseError extends Error {}

export const MAX_CORPUS_LIST_ITEMS = 200;

/** File base name without its extension; "" when nothing sensible remains. */
export function corpusListName(filename: string): string {
  const base = filename.replace(/\\/g, "/").split("/").pop() ?? "";
  return base.replace(/\.(csv|json|txt|text)$/i, "").trim();
}

function cleanItem(raw: CorpusListItem): CorpusListItem | null {
  const title = raw.title.replace(/\s+/g, " ").trim();
  if (!title) return null;
  const item: CorpusListItem = { title };
  const author = raw.author?.replace(/\s+/g, " ").trim();
  if (author) item.author = author;
  const language = raw.language?.trim().toLowerCase();
  if (language) item.language = language;
  const url = raw.url?.trim();
  if (url) {
    if (!/^https:\/\//i.test(url)) {
      throw new CorpusListParseError(
        `"${title}": URLs in a corpus list must be https:// (got "${url.slice(0, 80)}")`,
      );
    }
    item.url = url;
  }
  return item;
}

// ---------------------------------------------------------------------------
// .txt
// ---------------------------------------------------------------------------

function parseTxt(content: string): CorpusListItem[] {
  const items: CorpusListItem[] = [];
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    // "Title — Author" (em dash always splits; a single " - " also splits).
    let title = line;
    let author: string | null = null;
    const emDash = line.split(/\s+—\s+/);
    if (emDash.length === 2) {
      [title, author] = emDash;
    } else {
      const hyphen = line.split(/\s+-\s+/);
      if (hyphen.length === 2) [title, author] = hyphen;
    }
    const item = cleanItem({ title, author });
    if (item) items.push(item);
  }
  return items;
}

// ---------------------------------------------------------------------------
// .csv
// ---------------------------------------------------------------------------

/** Minimal CSV line splitter with double-quote support. */
export function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      cells.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  cells.push(current);
  return cells.map((c) => c.trim());
}

const TITLE_HEADERS = ["title", "name", "work", "source", "text"];
const AUTHOR_HEADERS = ["author", "writer", "attributed to"];
const LANGUAGE_HEADERS = ["language", "lang"];
const URL_HEADERS = ["url", "link", "text_url"];

function parseCsv(content: string): CorpusListItem[] {
  const lines = content.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return [];
  const first = splitCsvLine(lines[0]).map((c) => c.toLowerCase());
  const titleIdx = first.findIndex((c) => TITLE_HEADERS.includes(c));
  const hasHeader = titleIdx !== -1;
  const authorIdx = hasHeader ? first.findIndex((c) => AUTHOR_HEADERS.includes(c)) : 1;
  const languageIdx = hasHeader ? first.findIndex((c) => LANGUAGE_HEADERS.includes(c)) : -1;
  const urlIdx = hasHeader ? first.findIndex((c) => URL_HEADERS.includes(c)) : -1;
  const dataLines = hasHeader ? lines.slice(1) : lines;
  const items: CorpusListItem[] = [];
  for (const line of dataLines) {
    const cells = splitCsvLine(line);
    const item = cleanItem({
      title: cells[hasHeader ? titleIdx : 0] ?? "",
      author: authorIdx >= 0 ? cells[authorIdx] ?? null : null,
      language: languageIdx >= 0 ? cells[languageIdx] ?? null : null,
      url: urlIdx >= 0 ? cells[urlIdx] ?? null : null,
    });
    if (item) items.push(item);
  }
  return items;
}

// ---------------------------------------------------------------------------
// .json
// ---------------------------------------------------------------------------

function parseJson(content: string): CorpusListItem[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (e) {
    throw new CorpusListParseError(
      `Invalid JSON: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
  let list: unknown[];
  if (Array.isArray(parsed)) {
    list = parsed;
  } else if (parsed && typeof parsed === "object") {
    const obj = parsed as Record<string, unknown>;
    const wrapped = obj.items ?? obj.sources;
    if (!Array.isArray(wrapped)) {
      throw new CorpusListParseError(
        'JSON corpus lists must be an array, or an object with an "items" or "sources" array',
      );
    }
    list = wrapped;
  } else {
    throw new CorpusListParseError("JSON corpus lists must be an array");
  }
  const items: CorpusListItem[] = [];
  for (const entry of list) {
    if (typeof entry === "string") {
      const item = cleanItem({ title: entry });
      if (item) items.push(item);
      continue;
    }
    if (entry && typeof entry === "object") {
      const obj = entry as Record<string, unknown>;
      const title = obj.title ?? obj.name ?? obj.work ?? obj.source;
      if (typeof title !== "string") {
        throw new CorpusListParseError(
          `Every JSON item needs a "title" (or "name") string: ${JSON.stringify(entry).slice(0, 120)}`,
        );
      }
      const item = cleanItem({
        title,
        author: typeof obj.author === "string" ? obj.author : null,
        language: typeof obj.language === "string" ? obj.language : null,
        url: typeof obj.url === "string" ? obj.url : null,
      });
      if (item) items.push(item);
      continue;
    }
    throw new CorpusListParseError(
      `Unsupported JSON item type: ${JSON.stringify(entry)?.slice(0, 80)}`,
    );
  }
  return items;
}

// ---------------------------------------------------------------------------
// entry point
// ---------------------------------------------------------------------------

export function parseCorpusList(filename: string, content: string): CorpusList {
  const name = corpusListName(filename);
  if (!name) {
    throw new CorpusListParseError("The file needs a name — it becomes the hunting cycle's name.");
  }
  const ext = (filename.match(/\.([a-z0-9]+)$/i)?.[1] ?? "").toLowerCase();
  let items: CorpusListItem[];
  if (ext === "csv") items = parseCsv(content);
  else if (ext === "json") items = parseJson(content);
  else if (ext === "txt" || ext === "text" || ext === "") items = parseTxt(content);
  else {
    throw new CorpusListParseError(
      `Unsupported file type ".${ext}" — use .csv, .json or .txt`,
    );
  }
  // De-duplicate on normalized title+author.
  const seen = new Set<string>();
  const unique: CorpusListItem[] = [];
  for (const item of items) {
    const key = `${item.title.toLowerCase()}|${(item.author ?? "").toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }
  if (unique.length === 0) {
    throw new CorpusListParseError("No sources found in the file.");
  }
  if (unique.length > MAX_CORPUS_LIST_ITEMS) {
    throw new CorpusListParseError(
      `The list has ${unique.length} sources; the maximum per cycle is ${MAX_CORPUS_LIST_ITEMS}.`,
    );
  }
  return { name, items: unique };
}
