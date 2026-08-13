/**
 * Internet Archive resolver: turning links the hunter is handed into links
 * the Archive actually serves.
 *
 * Every response here is a recorded shape of the real endpoints
 * (archive.org/metadata/<id> and advancedsearch.php) — no network access.
 */
import { describe, it, expect, beforeEach } from "vitest";

import {
  archiveIdentifierFromUrl,
  isArchiveUrl,
  repairArchiveUrl,
  resolveArchiveItem,
  selectArchiveFile,
  scoreArchiveCandidate,
} from "../archiveResolver.js";
import { clearRobotsCache } from "../robots.js";

/** Fake fetch over recorded JSON payloads, keyed by URL. */
function fakeFetch(routes: Record<string, unknown>) {
  return (async (input: unknown) => {
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
    const payload = routes[url];
    if (payload === undefined) {
      return {
        ok: false,
        status: 404,
        url,
        headers: { get: () => null },
        text: async () => "not found",
        json: async () => ({}),
      };
    }
    return {
      ok: true,
      status: 200,
      url,
      headers: { get: () => null },
      text: async () => JSON.stringify(payload),
      json: async () => payload,
    };
  }) as unknown as typeof fetch;
}

const OPTIONS = { requestsPerSecond: 1000 };
const metadataUrl = (id: string) => `https://archive.org/metadata/${id}`;

/** An ordinary scanned book: OCR text plus the usual derivatives. */
function scannedItem(identifier: string, extra: Record<string, unknown> = {}) {
  return {
    created: 1,
    dir: `/0/items/${identifier}`,
    files: [
      { name: `${identifier}.epub`, format: "EPUB", size: "2977151" },
      { name: `${identifier}.pdf`, format: "Text PDF", size: "32556254" },
      { name: `${identifier}_dc.xml`, format: "Dublin Core", size: "787" },
      { name: `${identifier}_djvu.txt`, format: "DjVuTXT", size: "1202903" },
      { name: `${identifier}_djvu.xml`, format: "Djvu XML", size: "15156926" },
      { name: `${identifier}_meta.xml`, format: "Metadata", size: "2901" },
    ],
    metadata: {
      identifier,
      title: "The targums of Onkelos and Jonathan ben Uzziel on the Pentateuch",
      creator: ["Etheridge, J. W."],
      date: "1865",
      language: "eng",
      licenseurl: "http://creativecommons.org/publicdomain/mark/1.0/",
      ...extra,
    },
  };
}

describe("archive identifier parsing", () => {
  it("reads the identifier from every link shape the hunter meets", () => {
    const cases: [string, string | null][] = [
      ["https://archive.org/details/3enochorhebrewbo00unse", "3enochorhebrewbo00unse"],
      ["https://archive.org/details/foo00bar/page/n7/mode/2up", "foo00bar"],
      ["https://archive.org/stream/targumsofonkelo02etheuoft/targumsofonkelo02etheuoft_djvu.txt", "targumsofonkelo02etheuoft"],
      ["https://archive.org/download/manyoshu-volumes-5-6/manyoshu-volumes-5-6_djvu.txt", "manyoshu-volumes-5-6"],
      ["https://archive.org/embed/foo00bar", "foo00bar"],
      ["https://dn760000.eu.archive.org/0/items/manyoshu-volumes-5-6/x.txt", "manyoshu-volumes-5-6"],
      ["https://archive.org/", null],
    ];
    for (const [url, expected] of cases) {
      expect(archiveIdentifierFromUrl(url), url).toBe(expected);
    }
  });

  it("recognises archive.org links only over https", () => {
    expect(isArchiveUrl("https://archive.org/details/x")).toBe(true);
    expect(isArchiveUrl("https://ia800.us.archive.org/0/items/x/y.txt")).toBe(true);
    expect(isArchiveUrl("http://archive.org/details/x")).toBe(false);
    expect(isArchiveUrl("https://archive.org.evil.example/details/x")).toBe(false);
    expect(isArchiveUrl("https://www.gutenberg.org/ebooks/1")).toBe(false);
  });
});

describe("file selection", () => {
  it("prefers plain OCR text over the other readable formats", () => {
    const { file } = selectArchiveFile(scannedItem("targumsofonkelos00okel").files);
    expect(file?.name).toBe("targumsofonkelos00okel_djvu.txt");
    expect(file?.format).toBe("txt");
  });

  it("skips catalog sidecars, coordinate dumps and DRM containers", () => {
    const { file } = selectArchiveFile([
      { name: "x_meta.xml", format: "Metadata" },
      { name: "x_djvu.xml", format: "Djvu XML", size: "999999" },
      { name: "x_lcp.epub", format: "LCP Encrypted EPUB", size: "3201184" },
      { name: "x_hocr.html", format: "hOCR", size: "29963795" },
      { name: "x.pdf", format: "Text PDF", size: "12345" },
    ]);
    expect(file?.name).toBe("x.pdf");
  });

  it("respects the policy's maximum file size", () => {
    const { file } = selectArchiveFile(
      [
        { name: "big_djvu.txt", format: "DjVuTXT", size: "90000000" },
        { name: "small.epub", format: "EPUB", size: "1200" },
      ],
      { maxBytes: 50_000_000 },
    );
    expect(file?.name).toBe("small.epub");
  });
});

describe("resolveArchiveItem", () => {
  beforeEach(() => clearRobotsCache());

  it("rewrites a viewer link to the item's real OCR file", async () => {
    const fetchImpl = fakeFetch({
      [metadataUrl("targumsofonkelos00okel")]: scannedItem("targumsofonkelos00okel"),
    });
    const result = await resolveArchiveItem("targumsofonkelos00okel", { ...OPTIONS, fetchImpl });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.downloadUrl).toBe(
      "https://archive.org/download/targumsofonkelos00okel/targumsofonkelos00okel_djvu.txt",
    );
    expect(result.itemUrl).toBe("https://archive.org/details/targumsofonkelos00okel");
    expect(result.format).toBe("txt");
    expect(result.item.licenseUrl).toBe("http://creativecommons.org/publicdomain/mark/1.0/");
  });

  it("corrects a wrong assumed filename and encodes the real one", async () => {
    const fetchImpl = fakeFetch({
      [metadataUrl("manyoshu-volumes-5-6")]: {
        files: [
          { name: "__ia_thumb.jpg", format: "Item Tile" },
          { name: "Man'yōshū Volumes 5 & 6_djvu.txt", format: "DjVuTXT", size: "500000" },
          { name: "manyoshu-volumes-5-6_meta.xml", format: "Metadata" },
        ],
        metadata: { identifier: "manyoshu-volumes-5-6", title: "Man'yōshū Volumes 5 & 6" },
      },
    });
    const result = await repairArchiveUrl(
      {
        // The conventional <identifier>_djvu.txt does not exist on this item.
        url: "https://archive.org/download/manyoshu-volumes-5-6/manyoshu-volumes-5-6_djvu.txt",
        title: "Man'yōshū Volumes 5 & 6",
      },
      { ...OPTIONS, fetchImpl },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.fileName).toBe("Man'yōshū Volumes 5 & 6_djvu.txt");
    // Encoded, and still under the source's allowed /download/ path prefix.
    expect(new URL(result.downloadUrl).pathname.startsWith("/download/")).toBe(true);
    expect(result.downloadUrl).toContain("%20");
    expect(result.downloadUrl).toContain("%26");
  });

  it("reports a missing item instead of guessing", async () => {
    // The Archive answers with an empty object for identifiers that do not exist.
    const fetchImpl = fakeFetch({ [metadataUrl("3enochorhebrewbo00odeb")]: {} });
    const result = await resolveArchiveItem("3enochorhebrewbo00odeb", { ...OPTIONS, fetchImpl });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("item_not_found");
  });

  it("reports lending-restricted items as unfixable", async () => {
    const fetchImpl = fakeFetch({
      [metadataUrl("wessexbkpeopleon0000robi")]: {
        files: [
          { name: "wessexbkpeopleon0000robi_djvu.txt", format: "DjVuTXT", private: "true" },
          { name: "wessexbkpeopleon0000robi_encrypted.pdf", format: "ACS Encrypted PDF" },
          { name: "wessexbkpeopleon0000robi_meta.xml", format: "Metadata" },
        ],
        metadata: {
          identifier: "wessexbkpeopleon0000robi",
          title: "Wessex: the book of the people",
          "access-restricted-item": "true",
        },
      },
    });
    const result = await resolveArchiveItem("wessexbkpeopleon0000robi", { ...OPTIONS, fetchImpl });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("item_restricted");
    expect(result.itemUrl).toBe("https://archive.org/details/wessexbkpeopleon0000robi");
  });

  it("reports items with no text file at all", async () => {
    const fetchImpl = fakeFetch({
      [metadataUrl("imagesonly")]: {
        files: [{ name: "scan_jp2.zip", format: "Single Page Processed JP2 ZIP" }],
        metadata: { identifier: "imagesonly", title: "Scans only" },
      },
    });
    const result = await resolveArchiveItem("imagesonly", { ...OPTIONS, fetchImpl });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("no_text_file");
  });

  it("reports dark items as restricted", async () => {
    const fetchImpl = fakeFetch({
      [metadataUrl("darkitem")]: {
        is_dark: true,
        metadata: { identifier: "darkitem", title: "Withdrawn" },
        files: [],
      },
    });
    const result = await resolveArchiveItem("darkitem", { ...OPTIONS, fetchImpl });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("item_restricted");
  });
});

describe("catalog search fallback", () => {
  beforeEach(() => clearRobotsCache());

  /** advancedsearch.php response shape. */
  function searchResponse(docs: Record<string, unknown>[]) {
    return { responseHeader: { status: 0 }, response: { numFound: docs.length, docs } };
  }

  function searchUrlFor(query: string) {
    return (
      "https://archive.org/advancedsearch.php?output=json&rows=10" +
      "&fl%5B%5D=identifier&fl%5B%5D=title&fl%5B%5D=creator&fl%5B%5D=year&fl%5B%5D=volume" +
      "&fl%5B%5D=licenseurl" +
      "&q=" +
      encodeURIComponent(query)
    );
  }

  it("recovers an invented identifier by searching for the title", async () => {
    const query = "title:(3 enoch hebrew book) AND mediatype:texts";
    const fetchImpl = fakeFetch({
      [metadataUrl("3enochorhebrewbo00odeb")]: {},
      [searchUrlFor(query)]: searchResponse([
        { identifier: "3enochorhebrewbo00unse", title: "3 Enoch; or, The Hebrew book of Enoch.", year: 1928 },
        { identifier: "spp264_sinitic_language_script", title: "Sinitic language and script", year: 2016 },
      ]),
      [metadataUrl("3enochorhebrewbo00unse")]: {
        files: [
          { name: "3enochorhebrewbo00unse_djvu.txt", format: "DjVuTXT", size: "1416165" },
          { name: "3enochorhebrewbo00unse_meta.xml", format: "Metadata" },
        ],
        metadata: {
          identifier: "3enochorhebrewbo00unse",
          title: "3 Enoch; or, The Hebrew book of Enoch.",
          date: "1928",
        },
      },
    });
    const result = await repairArchiveUrl(
      {
        url: "https://archive.org/details/3enochorhebrewbo00odeb",
        title: "3 Enoch, or the Hebrew Book of Enoch",
      },
      { ...OPTIONS, fetchImpl },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.identifier).toBe("3enochorhebrewbo00unse");
    expect(result.viaSearch).toBe(true);
    expect(result.downloadUrl).toBe(
      "https://archive.org/download/3enochorhebrewbo00unse/3enochorhebrewbo00unse_djvu.txt",
    );
  });

  it("refuses to guess when two different works match equally well", async () => {
    const query = "title:(targum onkelos) AND mediatype:texts";
    const fetchImpl = fakeFetch({
      [metadataUrl("missingitem")]: {},
      [searchUrlFor(query)]: searchResponse([
        { identifier: "targumonkelosgenesis", title: "Targum Onkelos to Genesis" },
        { identifier: "targumonkelosexodus", title: "Targum Onkelos to Exodus" },
      ]),
    });
    const result = await repairArchiveUrl(
      { url: "https://archive.org/details/missingitem", title: "The Targum Onkelos" },
      { ...OPTIONS, fetchImpl },
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("no_confident_match");
  });

  it("refuses weak matches rather than taking the top hit", async () => {
    const query = "title:(kojiki records ancient matters) AND mediatype:texts";
    const fetchImpl = fakeFetch({
      [metadataUrl("missingitem")]: {},
      [searchUrlFor(query)]: searchResponse([
        { identifier: "oapen-20.500.12657-53578", title: "War, contents tourism and modern Japan" },
      ]),
    });
    const result = await repairArchiveUrl(
      { url: "https://archive.org/details/missingitem", title: "Kojiki: Records of Ancient Matters" },
      { ...OPTIONS, fetchImpl },
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("no_confident_match");
  });

  it("accepts a different scan of the same work", () => {
    const target = {
      title: "The targums of Onkelos and Jonathan ben Uzziel on the Pentateuch",
      author: "Etheridge",
    };
    const score = scoreArchiveCandidate(target, {
      identifier: "targumsonkelosa00ethegoog",
      title: "The Targums of Onkelos and Jonathan ben Uzziel on the Pentateuch",
      creator: "Etheridge, J. W.",
      year: 1862,
      volume: null,
    });
    expect(score).toBeGreaterThan(0.9);
  });
});
