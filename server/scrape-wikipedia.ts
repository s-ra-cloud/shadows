import { db } from "./storage";
import { projects, nodes, edges } from "@shared/schema";
import { eq } from "drizzle-orm";

const WIKI_API = "https://en.wikipedia.org/w/api.php";
const DELAY_MS = 100;

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchJson(url: string): Promise<any> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function getCategoryMembers(category: string, maxPages = 500): Promise<string[]> {
  const titles: string[] = [];
  let cmcontinue: string | undefined;

  while (titles.length < maxPages) {
    const params = new URLSearchParams({
      action: "query",
      list: "categorymembers",
      cmtitle: category,
      cmtype: "page",
      cmlimit: "500",
      format: "json",
    });
    if (cmcontinue) params.set("cmcontinue", cmcontinue);

    const data = await fetchJson(`${WIKI_API}?${params}`);
    const members = data.query?.categorymembers || [];
    for (const m of members) {
      if (m.ns === 0) titles.push(m.title);
    }

    cmcontinue = data.continue?.cmcontinue;
    if (!cmcontinue) break;
    await sleep(DELAY_MS);
  }

  return titles;
}

async function getSubcategoryMembers(parentCategory: string, maxPerSubcat = 200): Promise<string[]> {
  const params = new URLSearchParams({
    action: "query",
    list: "categorymembers",
    cmtitle: parentCategory,
    cmtype: "subcat",
    cmlimit: "500",
    format: "json",
  });

  const data = await fetchJson(`${WIKI_API}?${params}`);
  const subcats = data.query?.categorymembers || [];
  const allTitles: string[] = [];

  const directPages = await getCategoryMembers(parentCategory, 200);
  allTitles.push(...directPages);

  const skipSubcats = ["stubs", "Set index", "Wikipedia categories", "by source", "by location", "Pegasus"];

  for (const sub of subcats) {
    if (skipSubcats.some(s => sub.title.includes(s))) continue;
    console.log(`  Fetching subcategory: ${sub.title}`);
    const pages = await getCategoryMembers(sub.title, maxPerSubcat);
    allTitles.push(...pages);
    await sleep(DELAY_MS);
  }

  return [...new Set(allTitles)];
}

async function batchFetchWikitext(titles: string[]): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const batchSize = 50;

  for (let i = 0; i < titles.length; i += batchSize) {
    const batch = titles.slice(i, i + batchSize);
    const params = new URLSearchParams({
      action: "query",
      titles: batch.join("|"),
      prop: "revisions",
      rvprop: "content",
      rvslots: "main",
      format: "json",
      formatversion: "2",
    });

    try {
      const data = await fetchJson(`${WIKI_API}?${params}`);
      const pages = data.query?.pages || [];
      for (const page of pages) {
        if (page.missing) continue;
        const content = page.revisions?.[0]?.slots?.main?.content;
        if (content && typeof content === "string") {
          result.set(page.title, content);
        }
      }
    } catch (e) {
      console.error(`Error fetching batch starting at ${i}:`, e);
    }

    if (i + batchSize < titles.length) {
      await sleep(DELAY_MS);
    }
    if (i % 200 === 0) console.log(`  Fetched ${Math.min(i + batchSize, titles.length)}/${titles.length} pages...`);
  }

  return result;
}

function extractInfobox(wikitext: string): Record<string, string> {
  const result: Record<string, string> = {};

  const infoboxMatch = wikitext.match(/\{\{Infobox[\s\S]*?\n\}\}/i);
  if (!infoboxMatch) return result;

  const box = infoboxMatch[0];
  const lines = box.split("\n");

  for (const line of lines) {
    const m = line.match(/^\s*\|\s*([^=]+?)\s*=\s*(.*)/);
    if (m) {
      const key = m[1].trim().toLowerCase().replace(/\s+/g, "_");
      let val = m[2].trim();
      val = val
        .replace(/\[\[([^\]|]*\|)?([^\]]*)\]\]/g, "$2")
        .replace(/\{\{[^}]*\}\}/g, "")
        .replace(/<[^>]+>/g, "")
        .replace(/'''?/g, "")
        .replace(/&nbsp;/g, " ")
        .trim();
      if (val) result[key] = val;
    }
  }

  return result;
}

function extractFirstParagraph(wikitext: string): string {
  const lines = wikitext.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (
      trimmed.length > 50 &&
      !trimmed.startsWith("{{") &&
      !trimmed.startsWith("|") &&
      !trimmed.startsWith("!") &&
      !trimmed.startsWith("{|") &&
      !trimmed.startsWith("==") &&
      !trimmed.startsWith("[[Category") &&
      !trimmed.startsWith("[[File") &&
      !trimmed.startsWith("[[Image")
    ) {
      return trimmed
        .replace(/\[\[([^\]|]*\|)?([^\]]*)\]\]/g, "$2")
        .replace(/\{\{[^}]*\}\}/g, "")
        .replace(/<ref[^>]*>.*?<\/ref>/g, "")
        .replace(/<ref[^>]*\/>/g, "")
        .replace(/<[^>]+>/g, "")
        .replace(/'''?/g, "")
        .trim();
    }
  }
  return "";
}

function isListOrDisambiguation(title: string, wikitext: string): boolean {
  if (title.startsWith("List of")) return true;
  if (title.startsWith("Lists of")) return true;
  if (wikitext.includes("{{disambiguation}}") || wikitext.includes("{{Disambiguation}}")) return true;
  if (wikitext.includes("{{disambig") || wikitext.includes("{{Disambig")) return true;
  if (wikitext.includes("{{set index")) return true;
  return false;
}

interface FigureData {
  name: string;
  tradition: string | null;
  gender: string | null;
  domain: string | null;
  object: string | null;
  animals: string | null;
  characterTrait: string | null;
  physicalCharacteristics: string | null;
  significantEvent: string | null;
  birthCircumstances: string | null;
  deathCircumstances: string | null;
  relationships: { target: string; type: string }[];
}

function extractMultipleParagraphs(wikitext: string, count = 3): string {
  const lines = wikitext.split("\n");
  const paragraphs: string[] = [];
  for (const line of lines) {
    if (paragraphs.length >= count) break;
    const trimmed = line.trim();
    if (
      trimmed.length > 40 &&
      !trimmed.startsWith("{{") &&
      !trimmed.startsWith("|") &&
      !trimmed.startsWith("!") &&
      !trimmed.startsWith("{|") &&
      !trimmed.startsWith("==") &&
      !trimmed.startsWith("[[Category") &&
      !trimmed.startsWith("[[File") &&
      !trimmed.startsWith("[[Image")
    ) {
      const cleaned = trimmed
        .replace(/\[\[([^\]|]*\|)?([^\]]*)\]\]/g, "$2")
        .replace(/\{\{[^}]*\}\}/g, "")
        .replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, "")
        .replace(/<ref[^>]*\/>/g, "")
        .replace(/<[^>]+>/g, "")
        .replace(/'''?/g, "")
        .trim();
      if (cleaned.length > 30) paragraphs.push(cleaned);
    }
  }
  return paragraphs.join(" ");
}

function detectTraditionFromText(wikitext: string, defaultTradition: string): string {
  const lower = wikitext.toLowerCase().slice(0, 3000);
  const tradMap: [string, string[]][] = [
    ["Norse", ["norse mythology", "norse", "old norse", "viking", "edda", "asgard", "valhalla"]],
    ["Egyptian", ["egyptian mythology", "ancient egypt", "egyptian god", "pharaoh"]],
    ["Hindu", ["hindu mythology", "hinduism", "vedic", "sanskrit", "mahabharata", "ramayana"]],
    ["Shinto", ["shinto", "japanese mythology", "kami"]],
    ["Sumerian", ["sumerian", "mesopotamian", "babylonian", "akkadian"]],
    ["Aztec", ["aztec", "nahua", "mesoamerican"]],
    ["Celtic", ["celtic mythology", "irish mythology", "welsh mythology", "celtic"]],
    ["Chinese", ["chinese mythology", "chinese legend", "chinese folklore"]],
    ["Roman", ["roman mythology", "roman god", "roman religion"]],
    ["Slavic", ["slavic mythology", "slavic"]],
    ["Finnish", ["finnish mythology", "kalevala"]],
    ["Arthurian", ["arthurian", "king arthur", "round table", "camelot"]],
  ];
  for (const [trad, keywords] of tradMap) {
    for (const kw of keywords) {
      if (lower.includes(kw)) return trad;
    }
  }
  return defaultTradition;
}

function extractDomainFromIntro(intro: string): string | null {
  const patterns = [
    /(?:goddess?|deity) (?:of|associated with) ([^.]{5,80})/i,
    /(?:god|goddess) of ([^.,]{3,60})/i,
    /personification of ([^.,]{3,60})/i,
    /(?:patron|protector) of ([^.,]{3,60})/i,
    /(?:ruler|king|queen) of ([^.,]{3,60})/i,
    /(?:spirit|nymph) of ([^.,]{3,60})/i,
  ];
  for (const p of patterns) {
    const m = intro.match(p);
    if (m) return m[1].trim();
  }
  return null;
}

function extractSignificantEvent(text: string): string | null {
  const patterns = [
    /known for ([^.]{10,120})\./i,
    /famous for ([^.]{10,120})\./i,
    /best known for ([^.]{10,120})\./i,
    /noted for ([^.]{10,120})\./i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[1].trim();
  }
  return null;
}

function extractPhysicalFromText(text: string): string | null {
  const patterns = [
    /depicted as ([^.]{5,80})/i,
    /portrayed as ([^.]{5,80})/i,
    /described as ([^.]{5,80})/i,
    /represented as ([^.]{5,80})/i,
    /appears as ([^.]{5,80})/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[1].trim();
  }
  return null;
}

function parseFigure(title: string, wikitext: string, tradition: string): FigureData | null {
  if (isListOrDisambiguation(title, wikitext)) return null;

  const infobox = extractInfobox(wikitext);
  const intro = extractFirstParagraph(wikitext);
  const fullText = extractMultipleParagraphs(wikitext, 5);

  if (!intro && Object.keys(infobox).length === 0) return null;

  const detectedTradition = tradition === "Mythological"
    ? detectTraditionFromText(wikitext, tradition)
    : tradition;

  let gender: string | null = null;
  if (infobox.gender || infobox.sex) {
    gender = infobox.gender || infobox.sex;
  } else {
    const lowerIntro = (intro + " " + fullText).toLowerCase();
    if (/\bgoddess\b/.test(lowerIntro)) gender = "Female";
    else if (/\bgod\b/.test(lowerIntro) && !/\bgods\b/.test(lowerIntro.slice(0, 100))) gender = "Male";
    else {
      const heCount = (lowerIntro.match(/\bhe\b/g) || []).length + (lowerIntro.match(/\bhis\b/g) || []).length;
      const sheCount = (lowerIntro.match(/\bshe\b/g) || []).length + (lowerIntro.match(/\bher\b/g) || []).length;
      if (heCount > sheCount && heCount >= 2) gender = "Male";
      else if (sheCount > heCount && sheCount >= 2) gender = "Female";
    }
  }

  let domain: string | null = null;
  const domainFields = ["god_of", "godof", "role", "sphere", "domain"];
  for (const f of domainFields) {
    if (infobox[f]) {
      domain = infobox[f];
      break;
    }
  }
  if (!domain && intro) {
    domain = extractDomainFromIntro(intro);
  }

  let object: string | null = null;
  const symbolFields = ["symbol", "symbols", "weapons", "weapon", "attributes"];
  for (const f of symbolFields) {
    if (infobox[f]) {
      object = (object ? object + ", " : "") + infobox[f];
    }
  }

  let animals: string | null = null;
  const animalFields = ["mount", "animal", "animals"];
  for (const f of animalFields) {
    if (infobox[f]) {
      animals = (animals ? animals + ", " : "") + infobox[f];
    }
  }

  const relationships: { target: string; type: string }[] = [];
  const relFields: { key: string; type: string }[] = [
    { key: "parents", type: "child of" },
    { key: "father", type: "child of" },
    { key: "mother", type: "child of" },
    { key: "consort", type: "married to" },
    { key: "spouse", type: "married to" },
    { key: "siblings", type: "sibling of" },
    { key: "children", type: "parent of" },
    { key: "offspring", type: "parent of" },
  ];
  for (const rf of relFields) {
    if (infobox[rf.key]) {
      const names = infobox[rf.key].split(/[,\n]+/).map(s => s.trim()).filter(s => s.length > 1 && s.length < 50);
      for (const name of names) {
        relationships.push({ target: name, type: rf.type });
      }
    }
  }

  let significantEvent: string | null = null;
  let birthCircumstances: string | null = null;
  let deathCircumstances: string | null = null;
  let physicalCharacteristics: string | null = null;

  if (fullText) {
    const deathPatterns = [/killed by/i, /died/i, /slain by/i, /murdered/i];
    for (const p of deathPatterns) {
      const match = fullText.match(new RegExp(`[^.]*${p.source}[^.]*\\.`, "i"));
      if (match && match[0].length < 200) {
        deathCircumstances = match[0].trim();
        break;
      }
    }

    const birthPatterns = [/born of/i, /born from/i, /son of/i, /daughter of/i, /child of/i, /offspring of/i];
    for (const p of birthPatterns) {
      const match = fullText.match(new RegExp(`[^.]*${p.source}[^.]*\\.`, "i"));
      if (match && match[0].length < 200) {
        birthCircumstances = match[0].trim();
        break;
      }
    }

    significantEvent = extractSignificantEvent(fullText);
    physicalCharacteristics = extractPhysicalFromText(fullText);
  }

  const name = infobox.name || title.replace(/ \(.*\)$/, "");

  if (name.length < 2 || name.length > 80) return null;

  const hasAnyData = gender || domain || object || animals || significantEvent ||
    birthCircumstances || deathCircumstances || physicalCharacteristics ||
    relationships.length > 0;

  if (!hasAnyData) return null;

  return {
    name,
    tradition: detectedTradition,
    gender,
    domain,
    object,
    animals,
    characterTrait: null,
    physicalCharacteristics,
    significantEvent,
    birthCircumstances,
    deathCircumstances,
    relationships,
  };
}

async function main() {
  console.log("=== Wikipedia Mythological Characters Scraper ===\n");

  console.log("1. Fetching category members...");

  const categoryGroups: { label: string; category: string; tradition: string; useSubcats: boolean; max: number }[] = [
    { label: "Greek Mythology", category: "Category:Characters_in_Greek_mythology", tradition: "Greek", useSubcats: true, max: 300 },
    { label: "Norse Mythology", category: "Category:Characters_in_Norse_mythology", tradition: "Norse", useSubcats: true, max: 200 },
    { label: "Egyptian Deities", category: "Category:Egyptian_gods", tradition: "Egyptian", useSubcats: false, max: 200 },
    { label: "Egyptian Goddesses", category: "Category:Egyptian_goddesses", tradition: "Egyptian", useSubcats: false, max: 200 },
    { label: "Hindu Deities", category: "Category:Hindu_deities", tradition: "Hindu", useSubcats: false, max: 200 },
    { label: "Shinto Kami", category: "Category:Shinto_kami", tradition: "Shinto", useSubcats: false, max: 100 },
    { label: "Mesopotamian Deities", category: "Category:Mesopotamian_deities", tradition: "Sumerian", useSubcats: false, max: 200 },
    { label: "Aztec Deities", category: "Category:Aztec_gods", tradition: "Aztec", useSubcats: false, max: 100 },
    { label: "Celtic Deities", category: "Category:Celtic_deities", tradition: "Celtic", useSubcats: false, max: 100 },
    { label: "Roman Deities", category: "Category:Roman_deities", tradition: "Roman", useSubcats: false, max: 200 },
    { label: "Mythological Characters", category: "Category:Mythological_characters", tradition: "Mythological", useSubcats: false, max: 300 },
    { label: "Fairy Tale Characters", category: "Category:Fairy_tale_characters", tradition: "Fairy Tale", useSubcats: false, max: 100 },
  ];

  const titleTraditionMap = new Map<string, string>();

  for (const cg of categoryGroups) {
    console.log(`\n  ${cg.label}:`);
    let titles: string[];
    if (cg.useSubcats) {
      titles = await getSubcategoryMembers(cg.category, cg.max);
    } else {
      titles = await getCategoryMembers(cg.category, cg.max);
    }
    console.log(`  Found ${titles.length} pages`);
    for (const t of titles) {
      if (!titleTraditionMap.has(t)) titleTraditionMap.set(t, cg.tradition);
    }
  }

  const allTitles = [...titleTraditionMap.keys()];
  console.log(`\n  Total unique pages: ${allTitles.length}`);

  console.log("\n2. Fetching page content (batches of 50)...");
  const wikitextMap = await batchFetchWikitext(allTitles);
  console.log(`  Retrieved content for ${wikitextMap.size} pages`);

  console.log("\n3. Parsing figures...");
  const figures: FigureData[] = [];
  let skipped = 0;

  for (const [title, wikitext] of wikitextMap) {
    const tradition = titleTraditionMap.get(title) || "Unknown";
    const figure = parseFigure(title, wikitext, tradition);
    if (figure) {
      figures.push(figure);
    } else {
      skipped++;
    }
  }

  console.log(`  Parsed ${figures.length} figures, skipped ${skipped} (lists/disambig/empty)`);

  console.log("\n4. Inserting into database...");

  await db.delete(edges);
  await db.delete(nodes);
  await db.delete(projects);

  const [proj] = await db.insert(projects).values({
    title: "Comparative Mythological Atlas",
    description: "Mythological and fairy tale characters from world traditions",
    slug: "atlas",
  }).returning();

  const nameToId = new Map<string, number>();
  let inserted = 0;

  for (const fig of figures) {
    try {
      const [node] = await db.insert(nodes).values({
        projectId: proj.id,
        name: fig.name,
        tradition: fig.tradition,
        gender: fig.gender,
        domain: fig.domain,
        object: fig.object,
        animals: fig.animals,
        characterTrait: fig.characterTrait,
        physicalCharacteristics: fig.physicalCharacteristics,
        significantEvent: fig.significantEvent,
        birthCircumstances: fig.birthCircumstances,
        deathCircumstances: fig.deathCircumstances,
      }).returning();
      nameToId.set(fig.name.toLowerCase(), node.id);
      inserted++;
    } catch (e: any) {
      console.error(`  Error inserting ${fig.name}: ${e.message}`);
    }
  }

  console.log(`  Inserted ${inserted} figures`);

  console.log("\n5. Creating relationship edges...");
  let edgeCount = 0;

  for (const fig of figures) {
    const sourceId = nameToId.get(fig.name.toLowerCase());
    if (!sourceId) continue;

    for (const rel of fig.relationships) {
      const targetId = nameToId.get(rel.target.toLowerCase());
      if (targetId && targetId !== sourceId) {
        try {
          await db.insert(edges).values({
            projectId: proj.id,
            sourceNodeId: sourceId,
            targetNodeId: targetId,
            relationType: rel.type,
            weight: 2,
          });
          edgeCount++;
        } catch {}
      }
    }
  }

  console.log(`  Created ${edgeCount} relationship edges`);

  console.log(`\n=== Done! ${inserted} figures, ${edgeCount} edges ===`);
  process.exit(0);
}

main().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
