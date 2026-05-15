import { db } from "../server/storage";
import { nodes, edges } from "../shared/schema";
import { eq, and, or, sql } from "drizzle-orm";
import OpenAI from "openai";
import fs from "fs";

const PROJECT_ID = 6;
const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

function normName(s: string): string {
  return s
    .replace(/^(greek|roman|egyptian|hindu|chinese|japanese|norse|aztec|maya|celtic|sumerian|babylonian|canaanite|hittite|deified|the)\s+/i, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .toLowerCase()
    .trim();
}

async function extractTargets(name: string, domain: string): Promise<string[]> {
  const prompt = `From the text below about the deity "${name}", extract ONLY names that represent true SYNCRETIC IDENTIFICATION (i.e. the same divine being known under another name in another tradition, or interpretatio graeca/romana). 

DO INCLUDE:
- "identified with X" (cross-cultural syncretism)
- "equated with X", "syncretized with X"
- "the Roman/Greek/Egyptian X" used as equivalence (e.g. "Roman counterpart of Greek X" where one is the cultural translation of the other)
- alternative names or aspects of the SAME deity (e.g. Yandi = Shennong, Quirinus = deified Romulus)

DO NOT INCLUDE:
- family relationships: parent, child, sibling, spouse, lover (e.g. "son of Venus" → exclude Venus)
- narrative pairs/foils/opposites (e.g. "the dark counterpart of Isis" as sister, "cautionary counterpart of Nanahuatzin" as foil) → exclude
- members of a triad/group together (e.g. "one of the Archaic Triad with Jupiter and Mars" → exclude Jupiter and Mars)
- adversaries, rivals
- subtitles, epithets of the same deity within one tradition (e.g. "Sol Invictus" is an epithet of Sol → exclude)

Return JSON: {"targets": ["name1", ...]} or {"targets": []}.

Text: "${domain}"`;
  const r = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    temperature: 0,
  });
  const content = r.choices[0].message.content || "{}";
  try {
    const parsed = JSON.parse(content);
    const arr = Array.isArray(parsed) ? parsed : (parsed.names || parsed.targets || parsed.result || []);
    return Array.isArray(arr) ? arr.filter((x: any) => typeof x === "string" && x.trim()) : [];
  } catch {
    return [];
  }
}

async function main() {
  const dryRun = !process.argv.includes("--apply");
  console.log(`Mode: ${dryRun ? "DRY RUN" : "APPLY"}`);

  const all = await db.select().from(nodes);
  const candidates = all.filter(
    (n) => n.domain && /identified with|counterpart|equivalent|equated|syncreti/i.test(n.domain),
  );
  console.log(`Candidates: ${candidates.length}`);

  const byNormName = new Map<string, any[]>();
  for (const n of all) {
    const k = normName(n.name);
    if (!byNormName.has(k)) byNormName.set(k, []);
    byNormName.get(k)!.push(n);
  }

  const report: string[] = ["source\ttradition\textracted\tresolved\taction"];
  let edgesToCreate = 0, alreadyExist = 0, addedToColumn = 0, noTargets = 0;
  const updates: { id: number; ids: string[] }[] = [];

  for (const node of candidates) {
    const targets = await extractTargets(node.name, node.domain!);
    if (targets.length === 0) {
      report.push(`${node.name}\t${node.tradition}\t-\t-\tNO_TARGETS`);
      noTargets++;
      continue;
    }
    const unresolvedNames: string[] = [];
    for (const t of targets) {
      const matches = byNormName.get(normName(t)) || [];
      if (matches.length === 0) {
        report.push(`${node.name}\t${node.tradition}\t${t}\t-\tCOLUMN`);
        unresolvedNames.push(t);
        continue;
      }
      // Prefer different tradition; else first
      const pick = matches.find((m) => m.tradition !== node.tradition && m.id !== node.id) || matches.find((m) => m.id !== node.id) || matches[0];
      if (pick.id === node.id) {
        report.push(`${node.name}\t${node.tradition}\t${t}\t-\tSELF_SKIP`);
        continue;
      }
      // Check existing edge
      const existing = await db
        .select()
        .from(edges)
        .where(
          and(
            or(
              and(eq(edges.sourceNodeId, node.id), eq(edges.targetNodeId, pick.id)),
              and(eq(edges.sourceNodeId, pick.id), eq(edges.targetNodeId, node.id)),
            ),
            eq(edges.relationType, "identified with"),
          ),
        );
      if (existing.length > 0) {
        report.push(`${node.name}\t${node.tradition}\t${t}\t${pick.name}/${pick.tradition}\tEXISTS`);
        alreadyExist++;
      } else {
        if (!dryRun) {
          await db.insert(edges).values({
            projectId: PROJECT_ID,
            sourceNodeId: node.id,
            targetNodeId: pick.id,
            relationType: "identified with",
            weight: 1,
          });
        }
        report.push(`${node.name}\t${node.tradition}\t${t}\t${pick.name}/${pick.tradition}\tCREATE_EDGE`);
        edgesToCreate++;
      }
    }
    if (unresolvedNames.length > 0) {
      const merged = Array.from(new Set([...(node.identification || []), ...unresolvedNames]));
      updates.push({ id: node.id, ids: merged });
      addedToColumn += unresolvedNames.length;
    }
  }

  if (!dryRun) {
    for (const u of updates) {
      await db.update(nodes).set({ identification: u.ids }).where(eq(nodes.id, u.id));
    }
  }

  fs.mkdirSync("scripts/reports", { recursive: true });
  fs.writeFileSync("scripts/reports/03-identification.tsv", report.join("\n"));

  console.log(`\nCandidates: ${candidates.length}`);
  console.log(`Edges to create: ${edgesToCreate}`);
  console.log(`Already exist: ${alreadyExist}`);
  console.log(`Added to identification[]: ${addedToColumn} (across ${updates.length} nodes)`);
  console.log(`No targets extracted: ${noTargets}`);
  console.log("Report: scripts/reports/03-identification.tsv");
  if (dryRun) console.log(">>> DRY RUN — re-run with --apply");
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
