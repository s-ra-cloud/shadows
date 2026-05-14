import { db } from "../server/storage";
import { nodes } from "../shared/schema";
import { and, eq, sql } from "drizzle-orm";
import fs from "node:fs";

const FILE = "attached_assets/shadows-celtic-amended_1778767328568.json";

const SOURCE_FIELDS = [
  "domain", "object", "animals", "characterTrait", "physicalCharacteristics",
  "significantEvent", "symbolism", "neumannArchetype",
  "eventTypes", "birthTypes", "deathTypes", "familyRoles",
  "birthCircumstances", "deathCircumstances", "gender",
] as const;

function buildSourceAttributions(entry: any): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of SOURCE_FIELDS) {
    const k = `${f}_source`;
    if (entry[k] && typeof entry[k] === "string" && entry[k].trim()) {
      out[f] = entry[k].trim();
    }
  }
  return out;
}

function pick<T = any>(v: T | undefined | null): T | null {
  if (v === undefined || v === null) return null;
  if (typeof v === "string" && v.trim() === "") return null;
  if (Array.isArray(v) && v.length === 0) return null;
  return v;
}

async function main() {
  const data = JSON.parse(fs.readFileSync(FILE, "utf8"));
  const celtic = data.nodes.filter((n: any) => n.tradition === "Celtic");
  console.log(`Found ${celtic.length} Celtic figures in file`);

  const existing = await db.execute(sql`SELECT id, name FROM nodes WHERE tradition='Celtic'`);
  const rows = ((existing as any).rows ?? existing) as any[];
  const byName = new Map<string, number>(rows.map((r) => [r.name.toLowerCase(), r.id]));

  let updated = 0;
  let inserted = 0;

  for (const e of celtic) {
    const sa = buildSourceAttributions(e);
    const payload: any = {
      projectId: 6,
      name: e.name,
      tradition: "Celtic",
      gender: pick(e.gender),
      domain: pick(e.domain),
      object: pick(e.object),
      animals: pick(e.animals),
      characterTrait: pick(e.characterTrait),
      physicalCharacteristics: pick(e.physicalCharacteristics),
      significantEvent: pick(e.significantEvent),
      symbolism: pick(e.symbolism),
      neumannArchetype: pick(e.neumannArchetype),
      mentionCount: pick(e.mentionCount),
      eventTypes: pick(e.eventTypes),
      birthTypes: pick(e.birthTypes),
      deathTypes: pick(e.deathTypes),
      familyRoles: pick(e.familyRoles),
      birthCircumstances: pick(e.birthCircumstances),
      deathCircumstances: pick(e.deathCircumstances),
      sourceAttributions: Object.keys(sa).length ? sa : null,
    };

    const id = byName.get(e.name.toLowerCase());
    if (id) {
      await db.update(nodes).set(payload).where(eq(nodes.id, id));
      updated++;
    } else {
      await db.insert(nodes).values(payload);
      inserted++;
      console.log(`  + new: ${e.name}`);
    }
  }
  console.log(`Updated ${updated}, inserted ${inserted}`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
