import OpenAI from "openai";
import { db } from "../server/storage";
import { nodes } from "../shared/schema";
import { eq, sql } from "drizzle-orm";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  timeout: 25000,
  maxRetries: 0,
});

const CONCURRENCY = 3;
const REQUEST_TIMEOUT_MS = 30000;

process.on("unhandledRejection", (r) => console.error("UNHANDLED:", r));

const SYSTEM = `You clean a single descriptive field "object" for a mythological figure.

The field lists physical objects, weapons, attributes, vehicles, regalia associated with the figure.

Rules:
1. Keep ONLY generic English nouns ("conch", "discus", "mace", "lotus", "trident", "bow", "cosmic serpent", "yellow garments").
2. REMOVE proper-noun specifications and place names ("Shesha", "Sharnga", "Vaikuntha", "Mjolnir", "Excalibur", "Gungnir", "Aegis"). Keep only the generic kind ("hammer", "sword", "spear", "shield").
3. REMOVE annotations like "as couch", "for X", "made by Y", "given by Z", possessive clauses, parentheticals.
4. REMOVE places, abodes, realms — they are not objects.
5. Output a comma-separated list, lowercase except for legitimate proper-name-free terms. Plain ASCII only.
6. If after cleaning nothing remains, return null.

Return strict JSON: {"object": "cleaned string or null"}`;

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`timeout ${ms}ms`)), ms)),
  ]);
}

async function cleanObject(name: string, tradition: string, object: string): Promise<string | null> {
  const resp = await withTimeout(openai.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    temperature: 0,
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: JSON.stringify({ name, tradition, object }) },
    ],
  }), REQUEST_TIMEOUT_MS);
  const parsed = JSON.parse(resp.choices[0].message.content || "{}");
  const v = parsed.object;
  if (v === null || v === undefined || v === "") return null;
  return String(v);
}

async function main() {
  const all = await db.execute(sql`
    SELECT id, name, tradition, object, original_descriptions
    FROM nodes
    WHERE object ~ '\\m[A-Z][a-z]{2,}'
    ORDER BY tradition, name
  `);
  const rows = ((all as any).rows ?? all) as any[];
  console.log(`Semantic cleanup of object field: ${rows.length} figures, concurrency=${CONCURRENCY}`);

  let cursor = 0;
  let done = 0;
  let changed = 0;
  let failed = 0;
  const start = Date.now();

  const workers = Array.from({ length: CONCURRENCY }, async (_, wi) => {
    while (true) {
      const idx = cursor++;
      if (idx >= rows.length) return;
      const r = rows[idx];
      try {
        const cleaned = await cleanObject(r.name, r.tradition, r.object);
        if (cleaned !== r.object) {
          const backup = { ...(r.original_descriptions ?? {}) };
          if (!("object" in backup)) backup.object = r.object;
          await db.update(nodes).set({ object: cleaned, originalDescriptions: backup as any }).where(eq(nodes.id, r.id));
          changed++;
        }
      } catch (e: any) {
        failed++;
        console.error(`[${r.name}|${r.tradition}] ${e.message?.slice(0, 120)}`);
      }
      done++;
      if (done % 10 === 0) {
        const elapsed = Math.round((Date.now() - start) / 1000);
        console.log(`progress ${done}/${rows.length} (changed=${changed} failed=${failed}) ${elapsed}s`);
      }
    }
  });
  await Promise.all(workers);
  console.log(`DONE. changed=${changed} failed=${failed} total=${rows.length}`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
