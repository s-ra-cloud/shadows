import OpenAI from "openai";
import { db } from "../server/storage";
import { nodes } from "../shared/schema";
import { eq, sql } from "drizzle-orm";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  timeout: 25000,
  maxRetries: 1,
});

const CONCURRENCY = 4;
const REQUEST_TIMEOUT_MS = 30000;

process.on("unhandledRejection", (r) => console.error("UNHANDLED:", r));

const SYSTEM_PC = `You clean the field "physical_characteristics" of a mythological figure.

This field MUST describe ONLY visible/bodily appearance: body, face, hair, skin, clothing, attire, regalia worn or carried, animal features, posture, age in appearance.

It MUST NOT contain:
- identity statements ("the supreme deity of...", "a god of X", "deity of Y", "patron of Z", "personification of...", "X is associated with Y")
- role/function descriptions ("god of love", "spirit of orderly conduct")
- mythological narrative ("son of Shiva and Uma", "later identified with Tian")
- titles unless they directly describe appearance ("the Cloud Serpent" → keep ONLY if the figure is depicted as a serpent)

Rules:
1. Extract ONLY the appearance-describing fragments. If the entry mixes identity + appearance, keep just the appearance.
2. Plain English, no parentheticals, no diacritics on Latin scripts (use plain ASCII).
3. Lowercase except for proper-name attributes that legitimately describe appearance.
4. Comma-separated phrases or one short descriptive sentence.
5. If after cleaning there is NO appearance content, return null.
6. Do NOT invent details that are not in the source text.

Return strict JSON: {"physical_characteristics": "cleaned string or null"}`;

const SYSTEM_CT = `You clean the field "character_trait" of a mythological figure.

This field MUST be ONLY a comma-separated list of personality adjectives or short adjectival phrases (e.g. "warlike, jealous, compassionate, cunning, ferociously powerful").

It MUST NOT contain:
- narrative sub-clauses ("in the X Sutta, himself a being subject to karma")
- quoted phrases ("'the Spirit of truth'", "'groanings too deep for words'")
- identity statements ("the great prince who stands for Israel", "head of the sitra ahra", "the embodiment of all that opposes liberation")
- biographical actions ("naming the animals", "contending with Satan over Moses's body", "consort of YHWH")

Rules:
1. Extract ONLY the bare adjectives or compact adjectival phrases.
2. Comma-separated, lowercase, plain ASCII.
3. Drop everything inside quotes and after a semicolon-introduced clause.
4. If after cleaning there is NO adjective content, return null.

Return strict JSON: {"character_trait": "cleaned string or null"}`;

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`timeout ${ms}ms`)), ms)),
  ]);
}

async function clean(field: "physical_characteristics" | "character_trait", system: string, name: string, tradition: string, value: string): Promise<string | null> {
  const resp = await withTimeout(openai.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    temperature: 0,
    messages: [
      { role: "system", content: system },
      { role: "user", content: JSON.stringify({ name, tradition, [field]: value }) },
    ],
  }), REQUEST_TIMEOUT_MS);
  const parsed = JSON.parse(resp.choices[0].message.content || "{}");
  const v = parsed[field];
  if (v === null || v === undefined || v === "") return null;
  return String(v).trim();
}

const MODE = process.argv[2] as "pc" | "ct" | undefined;
if (!MODE || (MODE !== "pc" && MODE !== "ct")) {
  console.error("Usage: tsx scripts/cleanup-pc-and-traits.ts <pc|ct>");
  process.exit(1);
}

const QUERY_PC = sql`
  SELECT id, name, tradition, physical_characteristics AS value, original_descriptions
  FROM nodes
  WHERE physical_characteristics IS NOT NULL AND (
       physical_characteristics ~* '(god|goddess|deity|spirit|kami) of'
    OR physical_characteristics ~* '(patron|personification|epithet|title|aspect) of'
    OR physical_characteristics ~* '(identified|associated|syncretized|equated) with'
    OR physical_characteristics ~* '^the [a-z]+ (lord|son|daughter|prince|princess|deity|god|goddess|one|king|queen|hero|naga|spirit|serpent|eagle|owl|emperor|dragon|child|mother|father|mountain|sea|sky|sun|moon|star|cloud|jade|grass|young|old|great|little|young|first|primordial)'
    OR physical_characteristics ~* '^(a|an) (god|goddess|deity|spirit|kami|hero|warrior|princess|prince|queen|king)'
    OR physical_characteristics ~* '\\m(supreme being|primordial deity|creator deity|tutelary deity)\\m'
    OR physical_characteristics ~* '^[A-Z][a-z]+ (god|goddess|deity|spirit|king|queen|lord|prince|princess|hero|warrior)( |,|;|$)'
  )
  ORDER BY tradition, name
`;

const QUERY_CT = sql`
  SELECT id, name, tradition, character_trait AS value, original_descriptions
  FROM nodes
  WHERE character_trait IS NOT NULL AND (
       character_trait ~* '\\m(the |is |was |associated|deity|god|goddess|known for|appears as)\\m'
    OR character_trait ~* '''[^'']{4,}'''
    OR character_trait ~* ';'
  )
  ORDER BY tradition, name
`;

async function main() {
  const field = MODE === "pc" ? "physical_characteristics" : "character_trait";
  const system = MODE === "pc" ? SYSTEM_PC : SYSTEM_CT;
  const all = await db.execute(MODE === "pc" ? QUERY_PC : QUERY_CT);
  const rows = ((all as any).rows ?? all) as any[];
  console.log(`Cleaning ${field}: ${rows.length} figures, concurrency=${CONCURRENCY}`);

  let cursor = 0, done = 0, changed = 0, blanked = 0, failed = 0;
  const start = Date.now();

  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (true) {
      const idx = cursor++;
      if (idx >= rows.length) return;
      const r = rows[idx];
      try {
        const cleaned = await clean(field as any, system, r.name, r.tradition, r.value);
        if (cleaned !== r.value) {
          const backupKey = MODE === "pc" ? "physicalCharacteristics" : "characterTrait";
          const backup = { ...(r.original_descriptions ?? {}) };
          if (!(backupKey in backup)) backup[backupKey] = r.value;
          const update: any = { originalDescriptions: backup };
          if (MODE === "pc") update.physicalCharacteristics = cleaned;
          else update.characterTrait = cleaned;
          await db.update(nodes).set(update).where(eq(nodes.id, r.id));
          changed++;
          if (cleaned === null) blanked++;
        }
      } catch (e: any) {
        failed++;
        console.error(`[${r.name}|${r.tradition}] ${e.message?.slice(0, 120)}`);
      }
      done++;
      if (done % 20 === 0) {
        const elapsed = Math.round((Date.now() - start) / 1000);
        console.log(`progress ${done}/${rows.length} (changed=${changed} blanked=${blanked} failed=${failed}) ${elapsed}s`);
      }
    }
  });
  await Promise.all(workers);
  console.log(`DONE ${field}: changed=${changed} blanked=${blanked} failed=${failed} total=${rows.length}`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
