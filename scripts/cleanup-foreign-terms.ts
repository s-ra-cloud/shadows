import { db } from "../server/storage";
import { nodes } from "../shared/schema";
import { eq, sql } from "drizzle-orm";

const FIELDS = ["domain", "object", "characterTrait", "physicalCharacteristics", "symbolism", "significantEvent"] as const;
type Field = typeof FIELDS[number];

const COLS: Record<Field, string> = {
  domain: "domain",
  object: "object",
  characterTrait: "character_trait",
  physicalCharacteristics: "physical_characteristics",
  symbolism: "symbolism",
  significantEvent: "significant_event",
};

const DIGRAPH_MAP: Record<string, string> = {
  "ś": "sh", "Ś": "Sh",
  "ṣ": "sh", "Ṣ": "Sh",
  "š": "sh", "Š": "Sh",
  "ž": "zh", "Ž": "Zh",
  "č": "ch", "Č": "Ch",
  "ć": "ch", "Ć": "Ch",
  "ĉ": "ch", "Ĉ": "Ch",
  "ñ": "n", "Ñ": "N",
  "ŋ": "ng", "Ŋ": "Ng",
  "ß": "ss",
  "æ": "ae", "Æ": "Ae",
  "œ": "oe", "Œ": "Oe",
  "ø": "o", "Ø": "O",
  "đ": "d", "Đ": "D",
  "ð": "d", "Ð": "D",
  "þ": "th", "Þ": "Th",
  "ł": "l", "Ł": "L",
  "ḥ": "h", "Ḥ": "H",
  "ḫ": "kh", "Ḫ": "Kh",
  "ʿ": "", "ʾ": "", "‘": "'", "’": "'", "“": '"', "”": '"', "—": "-", "–": "-",
};

function transliterate(s: string): string {
  let out = "";
  for (const ch of s) {
    if (ch in DIGRAPH_MAP) {
      out += DIGRAPH_MAP[ch];
    } else {
      out += ch;
    }
  }
  return out.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function stripParens(s: string): string {
  let prev = s;
  let next = s.replace(/\s*\([^()]*\)/g, "");
  while (next !== prev) {
    prev = next;
    next = next.replace(/\s*\([^()]*\)/g, "");
  }
  return next.replace(/\s+/g, " ").replace(/\s+([,;.])/g, "$1").replace(/\s*;\s*;\s*/g, "; ").replace(/^[\s,;]+|[\s,;]+$/g, "").trim();
}

function clean(s: string | null | undefined): string | null {
  if (!s) return s ?? null;
  const cleaned = stripParens(transliterate(s));
  return cleaned || null;
}

async function main() {
  const all = await db.execute(sql`
    SELECT id, name, tradition, domain, object, character_trait, physical_characteristics, symbolism, significant_event, original_descriptions
    FROM nodes
    WHERE
      (domain ~ '[^[:ascii:]]' OR object ~ '[^[:ascii:]]' OR character_trait ~ '[^[:ascii:]]'
       OR physical_characteristics ~ '[^[:ascii:]]' OR symbolism ~ '[^[:ascii:]]' OR significant_event ~ '[^[:ascii:]]')
      OR domain LIKE '%(%' OR object LIKE '%(%' OR character_trait LIKE '%(%'
      OR physical_characteristics LIKE '%(%' OR symbolism LIKE '%(%' OR significant_event LIKE '%(%'
    ORDER BY tradition, name
  `);
  const rows = ((all as any).rows ?? all) as any[];
  console.log(`Cleaning ${rows.length} figures (deterministic, local)...`);

  let changed = 0;
  for (const r of rows) {
    const original: Record<Field, string | null> = {
      domain: r.domain,
      object: r.object,
      characterTrait: r.character_trait,
      physicalCharacteristics: r.physical_characteristics,
      symbolism: r.symbolism,
      significantEvent: r.significant_event,
    };
    const updates: Record<string, string | null> = {};
    const newBackup: Record<string, string | null> = { ...(r.original_descriptions ?? {}) };
    for (const f of FIELDS) {
      const orig = original[f];
      const cleaned = clean(orig);
      if (cleaned !== orig) {
        updates[f] = cleaned;
        if (!(f in newBackup)) newBackup[f] = orig;
      }
    }
    if (Object.keys(updates).length === 0) continue;
    await db.update(nodes).set({ ...updates, originalDescriptions: newBackup as any }).where(eq(nodes.id, r.id));
    changed++;
  }
  console.log(`Updated ${changed} figures.`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
