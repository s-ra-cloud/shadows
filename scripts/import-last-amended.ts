import { db } from "../server/storage";
import { nodes, edges } from "../shared/schema";
import { eq, sql, or } from "drizzle-orm";
import fs from "node:fs";

const FILE = "attached_assets/shadows-last-amended_1778820724057.json";

const TRADITION_NORMALIZE: Record<string, string> = {
  "Abrahamic / Gnostic (Wisdom literature continuum, from Proverbs through Gnostic systems)": "Abrahamic / Gnostic",
};

const TARGET_TRADITIONS = new Set([
  "Buddhist", "Maya", "Phrygian", "Balinese", "Germanic", "Gnostic",
  "Abrahamic / Gnostic",
]);

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
    if (entry[k] && typeof entry[k] === "string" && entry[k].trim()) out[f] = entry[k].trim();
  }
  return out;
}

function pick<T = any>(v: T | undefined | null): T | null {
  if (v === undefined || v === null) return null;
  if (typeof v === "string" && v.trim() === "") return null;
  if (Array.isArray(v) && v.length === 0) return null;
  return v;
}

function normalizeTradition(t: string): string {
  return TRADITION_NORMALIZE[t] ?? t;
}

async function main() {
  const data = JSON.parse(fs.readFileSync(FILE, "utf8"));
  const targets = data.nodes
    .map((n: any) => ({ ...n, tradition: normalizeTradition(n.tradition) }))
    .filter((n: any) => TARGET_TRADITIONS.has(n.tradition));
  console.log(`Found ${targets.length} target figures across ${TARGET_TRADITIONS.size} traditions`);

  const existingRes = await db.execute(sql`SELECT id, name, tradition FROM nodes`);
  const existingRows = (((existingRes as any).rows ?? existingRes) as any[]);
  const byName = new Map<string, { id: number; tradition: string }>(
    existingRows.map((r) => [r.name.toLowerCase(), { id: r.id, tradition: r.tradition }])
  );

  let updated = 0;
  let inserted = 0;

  for (const e of targets) {
    const sa = buildSourceAttributions(e);
    const payload: any = {
      projectId: 6,
      name: e.name,
      tradition: e.tradition,
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

    const hit = byName.get(e.name.toLowerCase());
    if (hit) {
      await db.update(nodes).set(payload).where(eq(nodes.id, hit.id));
      updated++;
      if (hit.tradition !== e.tradition) {
        console.log(`  ~ retagged ${e.name}: ${hit.tradition} → ${e.tradition}`);
      }
    } else {
      await db.insert(nodes).values(payload);
      inserted++;
      console.log(`  + new [${e.tradition}]: ${e.name}`);
    }
  }
  console.log(`\nUpdated ${updated}, inserted ${inserted}`);

  // Dedup Kwan-yin → Avalokiteshvara
  const kwan = await db.execute(sql`SELECT id FROM nodes WHERE LOWER(name)='kwan-yin' LIMIT 1`);
  const kwanId = ((kwan as any).rows ?? kwan)[0]?.id as number | undefined;
  const avalo = await db.execute(sql`SELECT id FROM nodes WHERE LOWER(name)='avalokiteshvara' LIMIT 1`);
  const avaloId = ((avalo as any).rows ?? avalo)[0]?.id as number | undefined;
  if (kwanId && avaloId && kwanId !== avaloId) {
    const r1 = await db.execute(sql`UPDATE edges SET source_node_id=${avaloId} WHERE source_node_id=${kwanId}`);
    const r2 = await db.execute(sql`UPDATE edges SET target_node_id=${avaloId} WHERE target_node_id=${kwanId}`);
    await db.execute(sql`DELETE FROM edges WHERE source_node_id=target_node_id`);
    await db.execute(sql`DELETE FROM nodes WHERE id=${kwanId}`);
    console.log(`Dedup: deleted Kwan-yin (id ${kwanId}); redirected its edges to Avalokiteshvara (id ${avaloId})`);
  }

  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
