import { db } from "../server/storage";
import { nodes } from "../shared/schema";
import { eq, sql } from "drizzle-orm";
import { writeFileSync } from "fs";

type Field = "eventTypes" | "deathTypes";

const dbCol = { eventTypes: "event_types", deathTypes: "death_types" } as const;

const evPatternMap: Array<[RegExp, string[]]> = [
  [/(?:^|-)deification$|^deified-|-deified$/i, ["apotheosis"]],
  [/(?:^|-)foundation$|^founding-of-|-foundation-/i, ["founding"]],
  [/(?:^|-)rescue(?:-|$)/i, ["rescue"]],
  [/(?:^|-)festival(?:-recipient)?$|festival-/i, ["cult"]],
  [/(?:^|-)cult$|pilgrimage-cult/i, ["cult"]],
  [/^miraculous-/i, ["miraculous birth"]],
  [/(?:^|-)interpretatio$|syncretism/i, ["syncretism"]],
  [/(?:^|-)curse(?:-|$)|^curse-of-/i, ["curse"]],
  [/(?:^|-)patronage$|^patron(?:ess)?-of-/i, ["patronage"]],
  [/(?:^|-)restoration$|^restoration-of-/i, ["restoration"]],
  [/(?:^|-)presidency$|^presiding-/i, ["presidency"]],
  [/(?:^|-)immortality$|^immortality-of-/i, ["immortality"]],
  [/(?:^|-)protection$|^protector-of-/i, ["protection"]],
  [/(?:^|-)marriage$|^marriage-of-|-marriage-/i, ["marriage"]],
  [/^world-creation$|world-creation-/i, ["world creation"]],
  [/(?:^|-)creation(?:-|$)/i, ["creation"]],
];

const evExactSlayMap: Record<string, string[]> = {
  "demon-slaying-wandering": ["slays monster"],
  "slaying-of-the-Dragon-Kings-son": ["slays monster"],
  "Kaṃsa-slaying": ["slays monster"],
  "monster-slaying": ["slays monster"],
  "Indrajit-slaying": ["slays monster"],
  "Rāvaṇa-slaying": ["slays monster"],
  "dragon-slaying": ["slays monster"],
};
const evDelete = new Set([
  "being-slain-by-Bellerophon",
  "being-slain-by-Theseus",
  "being-slain-by-Heracles",
]);

const dtExactMap: Record<string, string[]> = {
  "slain by Bellerophon riding Pegasus": ["killed by hero"],
  "slain by Theseus in the Labyrinth": ["killed by hero"],
  "slain by hero (pit-ambush)": ["killed by hero"],
  "slain by Narasiṃha": ["killed by hero"],
  "slain by Durgā": ["killed by hero"],
  "slain by Rāma in cosmic battle": ["killed by hero"],
  "slain by Heracles and Iolaus (heads severed and cauterized)": ["killed by hero"],
  "dismembered by Huitzilopochtli on Coatepec": ["dismemberment", "killed by god"],
  "cosmic dismemberment": ["dismemberment", "killed by god"],
  "dismembered": ["dismemberment", "killed by god"],
  "murdered by Set (trickery-coffin or dismemberment)": ["dismemberment", "killed by god"],
  "dismembered by Tzitzimitl, transformed into the maguey": ["dismemberment", "killed by god"],
  "defeated by YHWH (primordial)": ["killed by god"],
  "decreed by gods": ["killed by god"],
  "death by divine decree": ["killed by god"],
  "taken by demons": ["killed by god"],
  "killed by goddess (via henchman)": ["killed by god"],
  "divine vengeance": ["killed by god"],
  "killed by boar": ["killed by beast"],
  "killed by beast": ["killed by beast"],
  "devoured at Ragnarök": ["mutual slaughter"],
  "killed by Vídar at Ragnarök (jaws torn apart)": ["mutual slaughter"],
  "devoured by wolf Sköll at Ragnarök": ["mutual slaughter"],
  "parinirvāṇa (final nirvāṇa) at Kuśinagara": ["natural death"],
  "wasting away": ["natural death"],
  "grief-death": ["natural death"],
  "funeral-pyre death": ["natural death"],
  "executed by crucifixion": ["crucifixion", "sacrificed ritually"],
  "self-immolation": ["sacrificed ritually"],
};

function remapValue(field: Field, val: string): string[] | "delete" | null {
  if (field === "eventTypes") {
    if (evDelete.has(val)) return "delete";
    if (evExactSlayMap[val]) return evExactSlayMap[val];
    for (const [rx, target] of evPatternMap) {
      if (rx.test(val)) return target;
    }
    return null;
  } else {
    if (dtExactMap[val]) return dtExactMap[val];
    return null;
  }
}

async function run() {
  const dryRun = !process.argv.includes("--apply");
  const allNodes = await db.select().from(nodes);
  const changes: Array<{ id: number; name: string; field: Field; before: string[]; after: string[] }> = [];

  for (const n of allNodes) {
    for (const field of ["eventTypes", "deathTypes"] as Field[]) {
      const arr = (n as any)[field] as string[] | null;
      if (!arr || arr.length === 0) continue;
      let modified = false;
      const out = new Set<string>();
      for (const v of arr) {
        const r = remapValue(field, v);
        if (r === null) {
          out.add(v);
        } else if (r === "delete") {
          modified = true;
        } else {
          modified = true;
          for (const t of r) out.add(t);
        }
      }
      if (modified) {
        const after = Array.from(out);
        const before = arr;
        if (JSON.stringify(before) !== JSON.stringify(after)) {
          changes.push({ id: n.id, name: n.name, field, before, after });
        }
      }
    }
  }

  // Report
  const tsv = ["id\tname\tfield\tbefore\tafter"];
  for (const c of changes) {
    tsv.push(`${c.id}\t${c.name}\t${c.field}\t${c.before.join("|")}\t${c.after.join("|")}`);
  }
  writeFileSync("scripts/reports/07-singletons-phase2.tsv", tsv.join("\n"));
  console.log(`Changes: ${changes.length} ${dryRun ? "(dry-run)" : "(APPLIED)"}`);
  console.log(`Report: scripts/reports/07-singletons-phase2.tsv`);

  if (!dryRun) {
    for (const c of changes) {
      const col = dbCol[c.field];
      await db.execute(sql.raw(
        `UPDATE nodes SET ${col} = ARRAY[${c.after.map(v => `'${v.replace(/'/g, "''")}'`).join(",")}]::text[] WHERE id = ${c.id}`
      ));
    }
    console.log("DB updated.");
  }
  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
