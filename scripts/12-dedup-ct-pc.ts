import { db } from "../server/storage";
import { nodes } from "../shared/schema";
import { eq } from "drizzle-orm";

const REMOVE_FROM_CT: Array<[string, string]> = [
  ["Odin", "one-eyed"],
  ["El", "aged"],
  ["Lugh", "young"],
  ["Idun", "young"],
  ["Kartikeya", "youthful"],
  ["Yum Kaax", "youthful"],
  ["Phanes", "golden-winged"],
  ["Kimpurushas", "horse-headed"],
  ["Ravana", "ten-headed"],
  ["Krishna", "beautiful"],
  ["Amaterasu", "radiant"],
  ["Scylla", "monstrous"],
];

const REMOVE_FROM_PC: Array<[string, string[]]> = [
  ["Morrigan", ["shapeshifting"]],
  ["Babi", ["aggressive", "dangerous"]],
  ["Aura", ["swift"]],
  ["Theseus", ["strong"]],
];

function stripTokens(field: string, tokens: string[]): string {
  // split on ',' or ';', preserve original separator for the field as-is
  // Strategy: split on regex, filter, then rejoin with ', ' (uniform)
  const parts = field.split(/\s*[,;]\s*/).map(p => p.trim()).filter(Boolean);
  const lcTokens = tokens.map(t => t.toLowerCase());
  const kept = parts.filter(p => !lcTokens.includes(p.toLowerCase()));
  return kept.join(", ");
}

(async () => {
  for (const [name, token] of REMOVE_FROM_CT) {
    const [n] = await db.select().from(nodes).where(eq(nodes.name, name));
    if (!n) { console.log(`SKIP ${name} (not found)`); continue; }
    const before = n.characterTrait || "";
    const after = stripTokens(before, [token]);
    if (before === after) { console.log(`NOOP ${name} (token "${token}" not in CT)`); continue; }
    await db.update(nodes).set({ characterTrait: after }).where(eq(nodes.id, n.id));
    console.log(`✓ ${name}: CT removed "${token}"`);
    console.log(`    BEFORE: ${before}`);
    console.log(`    AFTER:  ${after}`);
  }

  for (const [name, tokens] of REMOVE_FROM_PC) {
    const [n] = await db.select().from(nodes).where(eq(nodes.name, name));
    if (!n) { console.log(`SKIP ${name} (not found)`); continue; }
    const before = n.physicalCharacteristics || "";
    const after = stripTokens(before, tokens);
    if (before === after) { console.log(`NOOP ${name} (tokens ${tokens.join(",")} not in PC)`); continue; }
    await db.update(nodes).set({ physicalCharacteristics: after }).where(eq(nodes.id, n.id));
    console.log(`✓ ${name}: PC removed [${tokens.join(", ")}]`);
    console.log(`    BEFORE: ${before}`);
    console.log(`    AFTER:  ${after}`);
  }
  process.exit(0);
})();
