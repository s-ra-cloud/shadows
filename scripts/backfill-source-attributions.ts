import { db } from "../server/storage";
import { nodes } from "../shared/schema";
import { eq } from "drizzle-orm";
import * as fs from "fs";

const SOURCE_FIELDS = [
  "domain_source",
  "animals_source",
  "object_source",
  "characterTrait_source",
  "physicalCharacteristics_source",
  "significantEvent_source",
  "eventTypes_source",
  "birthTypes_source",
  "birthCircumstances_source",
];

async function main() {
  const raw = fs.readFileSync("data/mythology-database.json", "utf-8");
  const data = JSON.parse(raw);
  const dbNodes = await db.select().from(nodes);
  const byKey = new Map<string, number>();
  for (const n of dbNodes) {
    byKey.set(`${n.name}::${n.tradition || ""}`, n.id);
  }

  let updated = 0;
  let unmatched = 0;
  for (const fig of data.nodes as any[]) {
    const attrs: Record<string, string> = {};
    for (const f of SOURCE_FIELDS) {
      const v = fig[f];
      if (v && typeof v === "string" && v.trim()) {
        attrs[f.replace(/_source$/, "")] = v.trim();
      }
    }
    if (Object.keys(attrs).length === 0) continue;

    const key = `${fig.name}::${fig.tradition || ""}`;
    const id = byKey.get(key);
    if (!id) {
      unmatched++;
      continue;
    }
    await db.update(nodes).set({ sourceAttributions: attrs }).where(eq(nodes.id, id));
    updated++;
  }
  console.log(`Updated ${updated} nodes, ${unmatched} unmatched.`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
