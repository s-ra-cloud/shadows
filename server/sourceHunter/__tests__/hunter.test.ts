import { describe, it, expect, beforeAll } from "vitest";
import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import {
  entitiesFromJsonl,
  loadCatalog,
  mergeEntities,
  writeCatalog,
  EntityMatcher,
  IiifAdapter,
  LegacyJsonlAdapter,
  MediaWikiAdapter,
  OaiDcAdapter,
  PlainTextAdapter,
  TeiAdapter,
  parsePayload,
  prepareRecords,
  mergeJsonl,
  writeJsonl,
  validateJsonl,
  validateRecord,
  validateSourceRegistry,
  loadRegistry,
  entitiesFromJsonlText,
  type Entity,
} from "../index.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(HERE, "fixtures");
const DATA = path.join(HERE, "..", "data");
const NOW = new Date("2026-07-29T12:00:00+00:00");

function source(sourceFamily: string, defaults: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    source_id: `source:test-${sourceFamily.replace(/_/g, "-")}`,
    name: "Example Collection",
    source_family: sourceFamily,
    endpoint_url: "https://museum.example.org/api",
    resource_types: ["text_excerpt", "art_description", "museum_object"],
    defaults,
    access: {
      review_status: "reviewed",
      terms_url: "https://museum.example.org/terms",
      robots_url: "https://museum.example.org/robots.txt",
      license: "Public-domain fixture",
      reuse_notes: "Synthetic fixture.",
    },
    rate_limit: { requests_per_second: 0.5 },
  };
}

async function readFixture(name: string): Promise<Buffer> {
  return fs.readFile(path.join(FIXTURES, name));
}

describe("catalog and matching", () => {
  let entities: Entity[];
  beforeAll(async () => {
    entities = await loadCatalog(path.join(FIXTURES, "shadows_sample.json"));
  });

  it("shadows export becomes entity catalog", () => {
    expect(entities.length).toBe(5);
    const athena = entities.find((e) => e.name === "Athena")!;
    expect(athena.gender).toBe("female");
    expect(athena.aliases).toContain("Pallas Athena");
  });

  it("short aliases are case-sensitive", () => {
    const matcher = new EntityMatcher(entities);
    expect(matcher.find("Ra rose.").map((m) => m.entity.name)).toEqual(["Ra"]);
    expect(matcher.find("The syllable ra occurs.")).toEqual([]);
  });

  it("canonical names case-insensitive but alternatives exact", () => {
    const matcher = new EntityMatcher(entities);
    const matches = matcher.find("Jupiter spoke to Pallas Athena and ZEUS.");
    expect(new Set(matches.map((m) => m.entity.name))).toEqual(new Set(["Zeus", "Athena"]));
    expect(matcher.find("jupiter")).toEqual([]);
  });

  it("catalog round trip", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "rmrh-"));
    const p = path.join(dir, "catalog.json");
    await writeCatalog(p, entities);
    const loaded = await loadCatalog(p);
    expect(loaded).toEqual(entities);
  });

  it("resource jsonl enriches alias catalog", async () => {
    const resources = await entitiesFromJsonl(path.join(FIXTURES, "sample_legacy.jsonl"));
    const merged = mergeEntities([...entities, ...resources]);
    const athena = merged.find((e) => e.name === "Athena")!;
    expect(athena.aliases).toContain("Pallas Athena");
    expect(athena.aliases).toContain("Athena");
  });

  it("known false-positive alias is not reimported", () => {
    const [hera] = entitiesFromJsonlText(
      JSON.stringify({ deity: "Hera", tradition: "Greek", gender: "female", matched_alias: "Here" }) + "\n",
    );
    expect(hera.aliases).toEqual(["Hera"]);
  });
});

describe("adapters", () => {
  let entities: Entity[];
  beforeAll(async () => {
    entities = await loadCatalog(path.join(FIXTURES, "shadows_sample.json"));
  });

  function runAdapter(
    adapter: { parseSample: (p: Buffer, o: any) => Record<string, unknown>[] },
    payload: Buffer,
    def: Record<string, unknown>,
  ) {
    const records = adapter.parseSample(payload, { source: def, entities, retrievedAt: NOW });
    for (const record of records) validateRecord(record);
    return records;
  }

  it("plain text adapter", async () => {
    const records = runAdapter(
      new PlainTextAdapter(),
      await readFixture("sample_plain.txt"),
      source("plain_text", {
        source_work: "Sample Source",
        source_author: "Anonymous",
        corpus: "test",
        origin: "primary_source",
        locator: "urn:test:plain",
      }),
    );
    expect(new Set(records.map((r) => r.deity))).toEqual(new Set(["Athena", "Zeus", "Ra"]));
    expect(new Set(records.map((r) => r.matched_alias))).not.toContain("ra");
  });

  it("tei adapter extracts header and locators", async () => {
    const records = runAdapter(
      new TeiAdapter(),
      await readFixture("sample_tei.xml"),
      source("tei", { corpus: "greek", origin: "primary_source" }),
    );
    expect(new Set(records.map((r) => r.deity))).toEqual(new Set(["Zeus", "Athena", "Ra"]));
    expect(records.every((r) => r.source_work === "Sample Hymns")).toBe(true);
    expect(records.every((r) => r.translator === "Example Translator")).toBe(true);
    expect(records.some((r) => String(r.locator).endsWith("#hymn-1"))).toBe(true);
  });

  it("iiif adapter emits museum fields", async () => {
    const records = runAdapter(
      new IiifAdapter(),
      await readFixture("sample_iiif.json"),
      source("iiif", { corpus: "museum", origin: "museum_catalog_modern" }),
    );
    expect(records.length).toBe(1);
    const record = records[0];
    expect(record.deity).toBe("Athena");
    expect(record.record_type).toBe("museum_object");
    expect(record.artwork_medium).toBe("Marble");
    expect(record.match_confidence).toBe("high");
    expect(record.source_author).toBe("Example Museum");
  });

  it("oai_dc adapter emits museum record", async () => {
    const records = runAdapter(
      new OaiDcAdapter(),
      await readFixture("sample_oai_dc.xml"),
      source("oai_dc", { corpus: "museum", origin: "museum_catalog_modern" }),
    );
    expect(records.length).toBe(1);
    expect(records[0].deity).toBe("Shiva");
    expect(records[0].artwork_classification).toBe("Sculpture");
    expect(records[0].locator).toBe("oai:example.org:shiva-1");
  });

  it("mediawiki handles file and text pages", async () => {
    const records = runAdapter(
      new MediaWikiAdapter(),
      await readFixture("sample_mediawiki.json"),
      source("mediawiki", { corpus: "mixed", origin: "primary_source" }),
    );
    const byDeity = new Map(records.map((r) => [r.deity as string, r]));
    expect(new Set(byDeity.keys())).toEqual(new Set(["Bast", "Zeus", "Athena"]));
    expect(byDeity.get("Bast")!.record_type).toBe("museum_object");
    expect(byDeity.get("Zeus")!.matched_alias).toBe("Jupiter");
  });

  it("legacy adapter is lossless", async () => {
    const records = new LegacyJsonlAdapter().parseSample(await readFixture("sample_legacy.jsonl"), {
      source: source("legacy_jsonl"),
      entities,
      retrievedAt: NOW,
    });
    expect(records.length).toBe(2);
    expect(records[1].artwork_title).toBe("Bast statuette");
    for (const record of records) validateRecord(record);
  });

  it("adapter boundary selects family and validates", async () => {
    const records = parsePayload(await readFixture("sample_tei.xml"), {
      source: source("tei", { corpus: "greek", origin: "primary_source" }),
      entities,
      retrievedAt: NOW,
    });
    expect(records.length).toBe(3);
  });
});

describe("pipeline", () => {
  it("prepare deduplicates and reindexes", async () => {
    const text = await fs.readFile(path.join(FIXTURES, "sample_legacy.jsonl"), "utf-8");
    const records = text
      .split(/\r?\n/)
      .filter((l) => l.trim())
      .map((l) => JSON.parse(l));
    const prepared = prepareRecords([records[0], records[0], records[1]], { sequentialIds: true });
    expect(prepared.length).toBe(2);
    expect(prepared.map((r) => r.id)).toEqual(["rec000000", "rec000001"]);
  });

  it("merge writes valid jsonl", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "rmrh-"));
    const output = path.join(dir, "merged.jsonl");
    const records = await mergeJsonl([
      path.join(FIXTURES, "sample_legacy.jsonl"),
      path.join(FIXTURES, "sample_legacy.jsonl"),
    ], output);
    expect(records.length).toBe(2);
    expect(await validateJsonl(output)).toBe(2);
  });

  it("registry is valid and has unique sources", async () => {
    const registry = await loadRegistry(path.join(DATA, "sources", "registry.json"));
    const sources = registry.sources as Record<string, unknown>[];
    expect(sources.length).toBe(3);
    expect(new Set(sources.map((s) => s.source_id)).size).toBe(3);
  });

  it("registry rejects unreviewed shape", async () => {
    const registry = await loadRegistry(path.join(DATA, "sources", "registry.json"));
    const invalid = JSON.parse(JSON.stringify(registry));
    invalid.sources[0].access.review_status = "unknown";
    expect(() => validateSourceRegistry(invalid)).toThrow(/review_status/);
  });

  it("write jsonl preserves unicode", async () => {
    const text = await fs.readFile(path.join(FIXTURES, "sample_legacy.jsonl"), "utf-8");
    const record = JSON.parse(text.split(/\r?\n/)[0]);
    record.excerpt = "Athena protège la cité.";
    record.n_words = 4;
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "rmrh-"));
    const output = path.join(dir, "unicode.jsonl");
    await writeJsonl(output, [record]);
    expect(await fs.readFile(output, "utf-8")).toContain("protège");
  });
});
