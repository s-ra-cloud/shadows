import { db } from "../server/storage";
import { nodes } from "../shared/schema";
import { writeFileSync, readFileSync } from "fs";
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY!,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const BATCH_NUM = parseInt(process.argv[2] || "1");
const BATCH_SIZE = 100;
const CHUNK_SIZE = 10;

const SYSTEM_PROMPT = `You re-classify entries that are currently mis-stored in a mythology database's "family_roles" column. The column should ONLY contain canonical kinship terms (mother, father, sister, brother, son, daughter, husband, wife, spouse, consort, grandfather/mother, uncle, aunt, cousin, twin, sibling, ancestor, descendant, child, half-X, step-X, in-law).

For each entry, return one of these actions in JSON. RESPOND ONLY with a JSON array, one object per entry, in the same order.

ACTIONS:
- {"id": <id>, "value": "<original>", "action": "KEEP_AS_KIN", "new_kin": "<canonical kinship term>"}  → if entry is a misformatted kinship (e.g. "consort (contested)" → wife)
- {"id": <id>, "value": "<original>", "action": "DELETE"}  → if redundant/meta-academic ("popular Iron-Age goddess", parenthetical sources)
- {"id": <id>, "value": "<original>", "action": "MOVE", "target": "character_trait|domain|identification|event_type|significant_event", "new_value": "<text to ADD to that field>"}  → single target
- {"id": <id>, "value": "<original>", "action": "SPLIT", "moves": [{"target": "character_trait", "new_value": "..."}, {"target": "domain", "new_value": "..."}, ...]}  → multiple targets

GUIDELINES:
1. Pure title/rank nouns (demon-king, archangel, prophet, patriarch, prince, chief, lord, king, queen, hero, sage) → MOVE to character_trait
2. "X of Y" where X=title and Y=concept/realm (angel of death, prince of demons, lord of Mictlan, chief of the Watchers) → SPLIT: X to character_trait, Y to domain. Drop parenthetical citations like "(in 1 Enoch)".
3. "Y-god" / "Y-goddess" / "fire-deity" → MOVE to domain (just the concept Y, no "-god" suffix)
4. Pure descriptive identity (first woman, primordial monster, cosmic adversary, primordial cow) → MOVE to character_trait
5. Syncretic identification ("East Asian form: Guanyin", "identified with X", "transformed Enoch") → MOVE to identification (extract just the deity name when possible, otherwise full text)
6. Narrative event ("rescued by Quetzalcoatl from her grandmother", "transformed into Tonatiuh") → SPLIT: event_type gets ONLY the canonical short verb (rescue, transformation, quest, etc. — pick one of: birth, death, rescue, sacrifice, descent_to_underworld, ascent_to_heaven, quest, transformation, exile, return, theft, gift_to_humanity, contest, theomachy, creation, dismemberment, resurrection, marriage, deception, prophecy, judgment, epiphany, hero_journey). significant_event gets the full text appended.
7. Meta-academic notes ("popular Iron-Age goddess", "(per epigraphic evidence, contested)", historical context phrases) → DELETE
8. "co-ruler", "co-supreme", "co-X with Y" → MOVE to character_trait (just "co-ruler")
9. "queen of X", "lord of X", "king of X", "master of X" → SPLIT: rank to character_trait, X to domain
10. "feminine half of X" / "masculine half of X" → MOVE to identification (full text)
11. "dwells in X" / "presides over X" / "presiding over X" → SPLIT: ONLY domain gets X
12. "the moon" / "the sun" → MOVE to domain (just "moon" or "sun")
13. "supreme creator-deity in unified-duality aspect" / theological abstractions → MOVE to character_trait
14. If unsure, prefer DELETE for meta-info or MOVE to character_trait for descriptive titles.

Return ONLY a JSON array. No commentary, no markdown fences.`;

async function classifyChunk(items: { id: number; name: string; tradition: string; value: string }[]): Promise<any[]> {
  const userPrompt = items.map(x => `- id=${x.id} | ${x.name} [${x.tradition}] | "${x.value}"`).join("\n");
  const resp = await client.chat.completions.create({
    model: "gpt-5",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
  });
  const txt = resp.choices[0].message.content || "[]";
  const cleaned = txt.replace(/^```json\n?|\n?```$/g, "").trim();
  return JSON.parse(cleaned);
}

(async () => {
  const tsv = readFileSync("/tmp/non_canon.tsv", "utf-8").split("\n").filter(Boolean);
  const all = tsv.map(line => {
    const [id, name, tradition, value] = line.split("\t");
    return { id: Number(id), name, tradition, value };
  });
  const start = (BATCH_NUM - 1) * BATCH_SIZE;
  const batch = all.slice(start, start + BATCH_SIZE);
  console.log(`Classifying batch ${BATCH_NUM}: entries ${start + 1}–${start + batch.length} of ${all.length}`);

  const chunks: typeof batch[] = [];
  for (let i = 0; i < batch.length; i += CHUNK_SIZE) chunks.push(batch.slice(i, i + CHUNK_SIZE));
  console.log(`Launching ${chunks.length} chunks in parallel...`);
  const settled = await Promise.allSettled(chunks.map((c, idx) =>
    classifyChunk(c).then(out => { console.log(`  chunk ${idx + 1} ✓ ${out.length}`); return out; })
                    .catch(e => { console.log(`  chunk ${idx + 1} ✗ ${e.message}`); return c.map(x => ({ id: x.id, value: x.value, action: "ERROR", error: e.message })); })
  ));
  const results: any[] = settled.flatMap(s => s.status === "fulfilled" ? s.value : []);

  // Render markdown
  const md: string[] = [`# 11E — batch ${BATCH_NUM} — proposed re-classification (${results.length} entries)`, ""];
  md.push(`Each row shows the proposal. **Reply with overrides only** (e.g., "id=6215 should be MOVE→domain not character_trait", or "delete id=6108 instead").`, "");
  md.push(`| id | Name | Tradition | Original | Action | Detail |`);
  md.push(`|---|---|---|---|---|---|`);
  const byId = new Map(batch.map(b => [`${b.id}|${b.value}`, b]));
  for (const r of results) {
    const k = `${r.id}|${r.value}`;
    const src = byId.get(k);
    const detail = r.action === "DELETE"
      ? "—"
      : r.action === "KEEP_AS_KIN"
        ? `→ "${r.new_kin}"`
        : r.action === "MOVE"
          ? `${r.target} += "${r.new_value}"`
          : r.action === "SPLIT"
            ? r.moves.map((m: any) => `${m.target} += "${m.new_value}"`).join(" + ")
            : r.action;
    md.push(`| ${r.id} | ${src?.name || "?"} | ${src?.tradition || "?"} | ${r.value} | **${r.action}** | ${detail} |`);
  }

  const outPath = `scripts/reports/11e-batches/batch-${String(BATCH_NUM).padStart(2, "0")}-proposal.md`;
  writeFileSync(outPath, md.join("\n"));
  // Also save raw JSON for apply step
  writeFileSync(outPath.replace(".md", ".json"), JSON.stringify(results, null, 2));
  console.log(`\n✓ Wrote ${outPath}`);
  process.exit(0);
})();
