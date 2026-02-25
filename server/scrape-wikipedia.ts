import { db } from "./storage";
import { projects, nodes, edges } from "@shared/schema";

const WIKI_API = "https://en.wikipedia.org/w/api.php";
const DELAY_MS = 800;

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchJson(url: string, retries = 5): Promise<any> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url);
      if (res.status === 503 || res.status === 429) {
        console.log(`  Rate limited (${res.status}), waiting ${2 + i * 3}s...`);
        await sleep((2 + i * 3) * 1000);
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e: any) {
      if (i === retries - 1) throw e;
      console.log(`  Retry ${i + 1}/${retries}: ${e.message}`);
      await sleep((2 + i * 2) * 1000);
    }
  }
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
  const batchSize = 20;

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

    await sleep(DELAY_MS);
    if (i % 100 === 0) console.log(`  Fetched ${Math.min(i + batchSize, titles.length)}/${titles.length} pages...`);
  }

  return result;
}

function cleanWikitext(text: string): string {
  return text
    .replace(/\[\[([^\]|]*\|)?([^\]]*)\]\]/g, "$2")
    .replace(/\{\{[^}]*\}\}/g, "")
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, "")
    .replace(/<ref[^>]*\/>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/'''?/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&ndash;/g, "–")
    .replace(/&mdash;/g, "—")
    .replace(/\s+/g, " ")
    .trim();
}

function extractInfobox(wikitext: string): Record<string, string> {
  const result: Record<string, string> = {};
  const infoboxMatch = wikitext.match(/\{\{Infobox[\s\S]*?\n\}\}/i);
  if (!infoboxMatch) return result;

  const box = infoboxMatch[0];
  for (const line of box.split("\n")) {
    const m = line.match(/^\s*\|\s*([^=]+?)\s*=\s*(.*)/);
    if (m) {
      const key = m[1].trim().toLowerCase().replace(/\s+/g, "_");
      const val = cleanWikitext(m[2]);
      if (val && val.length > 0) result[key] = val;
    }
  }
  return result;
}

function getFullText(wikitext: string): string {
  const lines = wikitext.split("\n");
  const paragraphs: string[] = [];
  let inInfobox = false;
  let braceDepth = 0;

  for (const line of lines) {
    if (line.includes("{{Infobox") || line.includes("{{infobox")) inInfobox = true;
    if (inInfobox) {
      braceDepth += (line.match(/\{\{/g) || []).length;
      braceDepth -= (line.match(/\}\}/g) || []).length;
      if (braceDepth <= 0) { inInfobox = false; braceDepth = 0; }
      continue;
    }

    const trimmed = line.trim();
    if (trimmed.startsWith("==") && trimmed.includes("== See also") ||
        trimmed.includes("== References") || trimmed.includes("== External") ||
        trimmed.includes("== Notes") || trimmed.includes("== Sources") ||
        trimmed.includes("== Bibliography") || trimmed.includes("== Further")) {
      break;
    }

    if (
      trimmed.length > 30 &&
      !trimmed.startsWith("{{") &&
      !trimmed.startsWith("|") &&
      !trimmed.startsWith("!") &&
      !trimmed.startsWith("{|") &&
      !trimmed.startsWith("|}") &&
      !trimmed.startsWith("[[Category") &&
      !trimmed.startsWith("[[File") &&
      !trimmed.startsWith("[[Image") &&
      !trimmed.startsWith("*") &&
      !trimmed.startsWith("#")
    ) {
      const cleaned = cleanWikitext(trimmed);
      if (cleaned.length > 25) paragraphs.push(cleaned);
    }
  }
  return paragraphs.join(" ");
}

function getSections(wikitext: string): Map<string, string> {
  const sections = new Map<string, string>();
  const lines = wikitext.split("\n");
  let currentSection = "_intro";
  let buf: string[] = [];

  for (const line of lines) {
    const heading = line.match(/^==+\s*(.+?)\s*==+/);
    if (heading) {
      if (buf.length > 0) sections.set(currentSection.toLowerCase(), cleanWikitext(buf.join(" ")));
      currentSection = heading[1];
      buf = [];
    } else {
      const t = line.trim();
      if (t.length > 20 && !t.startsWith("{{") && !t.startsWith("|") && !t.startsWith("[[Category") && !t.startsWith("[[File")) {
        buf.push(t);
      }
    }
  }
  if (buf.length > 0) sections.set(currentSection.toLowerCase(), cleanWikitext(buf.join(" ")));
  return sections;
}

function isListOrDisambiguation(title: string, wikitext: string): boolean {
  if (title.startsWith("List of") || title.startsWith("Lists of")) return true;
  if (/\{\{(disambiguation|disambig|set index)/i.test(wikitext)) return true;
  return false;
}

function detectTradition(wikitext: string, defaultTrad: string): string {
  const lower = wikitext.toLowerCase().slice(0, 3000);
  const tradMap: [string, string[]][] = [
    ["Norse", ["norse mythology", "norse god", "old norse", "edda", "asgard"]],
    ["Egyptian", ["egyptian mythology", "egyptian god", "ancient egypt"]],
    ["Hindu", ["hindu mythology", "hinduism", "vedic", "mahabharata", "ramayana"]],
    ["Shinto", ["shinto", "japanese mythology", "kami"]],
    ["Sumerian", ["sumerian", "mesopotamian", "babylonian", "akkadian"]],
    ["Aztec", ["aztec", "nahua", "mesoamerican"]],
    ["Celtic", ["celtic mythology", "irish mythology", "welsh mythology"]],
    ["Roman", ["roman mythology", "roman god", "roman religion"]],
    ["Chinese", ["chinese mythology", "chinese legend"]],
    ["Slavic", ["slavic mythology"]],
    ["Finnish", ["finnish mythology", "kalevala"]],
    ["Arthurian", ["arthurian", "king arthur", "camelot"]],
  ];
  for (const [trad, keywords] of tradMap) {
    for (const kw of keywords) {
      if (lower.includes(kw)) return trad;
    }
  }
  return defaultTrad;
}

function extractGender(infobox: Record<string, string>, text: string): string | null {
  if (infobox.gender || infobox.sex) return infobox.gender || infobox.sex;

  const lower = text.toLowerCase();
  if (/\bgoddess\b/.test(lower)) return "Female";
  if (/\bgod\b/.test(lower.slice(0, 200)) && !/\bgods\b/.test(lower.slice(0, 200))) return "Male";
  if (/\bheroine\b/.test(lower) || /\bpriestess\b/.test(lower) || /\bnymph\b/.test(lower) || /\bprincess\b/.test(lower)) return "Female";
  if (/\bhero\b/.test(lower.slice(0, 300)) || /\bpriest\b/.test(lower.slice(0, 300))) return "Male";

  const first500 = lower.slice(0, 500);
  const heCount = (first500.match(/\bhe\b/g) || []).length + (first500.match(/\bhis\b/g) || []).length;
  const sheCount = (first500.match(/\bshe\b/g) || []).length + (first500.match(/\bher\b/g) || []).length;
  if (heCount > sheCount && heCount >= 2) return "Male";
  if (sheCount > heCount && sheCount >= 2) return "Female";
  return null;
}

function extractDomain(infobox: Record<string, string>, text: string): string | null {
  const domainFields = ["god_of", "godof", "role", "sphere", "domain"];
  for (const f of domainFields) {
    if (infobox[f]) return infobox[f];
  }

  const patterns = [
    /(?:god(?:dess)?|deity|personification|patron|guardian|spirit|titan) (?:of|associated with) ([^.]{3,80})/i,
    /(?:god|goddess) of ([^.,]{3,60})/i,
    /the (?:god|goddess) of ([^.,]{3,60})/i,
    /personification of ([^.,]{3,60})/i,
    /(?:patron(?:ess)?|protector|guardian) of ([^.,]{3,60})/i,
    /(?:muse|nymph|spirit) of ([^.,]{3,60})/i,
    /presided over ([^.,]{3,60})/i,
    /associated with ([^.,]{3,60})/i,
    /represented ([^.,]{3,60})/i,
  ];

  for (const p of patterns) {
    const m = text.match(p);
    if (m) {
      let domain = m[1].trim();
      domain = domain.replace(/\b(the|a|an|and|or|in|to|of|for|with|by|as|is|was|were|are|has|had|have|being|who|which|that)\b/gi, " ")
        .replace(/\s+/g, " ").trim();
      if (domain.length >= 3 && domain.length <= 80) return m[1].trim();
    }
  }
  return null;
}

function extractObjects(infobox: Record<string, string>, text: string): string | null {
  const symbolFields = ["symbol", "symbols", "weapons", "weapon", "attributes"];
  const parts: string[] = [];
  for (const f of symbolFields) {
    if (infobox[f]) parts.push(infobox[f]);
  }

  const patterns = [
    /(?:symbol(?:s|ized)?|attribute(?:s)?|emblem(?:s)?) (?:include|are|is|were|was|:) ([^.]{5,100})/i,
    /(?:wield(?:s|ed)?|carri(?:es|ed)|bore|bears|brandish(?:es|ed)) (?:a |an |the )?([^.,]{3,60})/i,
    /(?:armed with|equipped with) ([^.,]{3,60})/i,
    /(?:sacred|holy) (?:to .+? )?(?:are|is|were|was) ([^.,]{3,60})/i,
    /(?:his |her |their )?(?:weapon|tool|instrument|scepter|staff|sword|spear|shield|bow|trident|hammer|thunderbolt|crown|helmet|armor|chariot)s?\b/i,
  ];

  for (const p of patterns) {
    const m = text.match(p);
    if (m && m[1]) {
      const obj = m[1].trim();
      if (obj.length >= 3 && obj.length <= 80 && !parts.includes(obj)) parts.push(obj);
    }
  }

  const weaponMatches = text.match(/\b(thunderbolt|trident|spear|sword|shield|bow|arrows?|hammer|aegis|scepter|staff|crown|helmet|chariot|lyre|caduceus|cornucopia|torch|mirror|flail|ankh|conch|discus|mace|net)\b/gi);
  if (weaponMatches) {
    const unique = [...new Set(weaponMatches.map(w => w.toLowerCase()))];
    for (const w of unique) {
      if (!parts.some(p => p.toLowerCase().includes(w))) parts.push(w);
    }
  }

  return parts.length > 0 ? parts.join(", ") : null;
}

function extractAnimals(infobox: Record<string, string>, text: string): string | null {
  const parts: string[] = [];
  const animalFields = ["mount", "animal", "animals"];
  for (const f of animalFields) {
    if (infobox[f]) parts.push(infobox[f]);
  }

  const animalList = [
    "eagle", "owl", "serpent", "snake", "bull", "horse", "lion", "deer", "stag",
    "dove", "swan", "raven", "crow", "hawk", "falcon", "vulture", "peacock",
    "dolphin", "fish", "whale", "ram", "goat", "pig", "boar", "wolf", "dog",
    "cat", "jaguar", "panther", "bear", "hare", "rabbit", "tortoise", "turtle",
    "scorpion", "spider", "bee", "ant", "butterfly", "rooster", "cock", "hen",
    "sparrow", "crane", "heron", "ibis", "scarab", "jackal", "crocodile",
    "hippopotamus", "cow", "ox", "donkey", "monkey", "elephant", "tiger",
    "dragon", "phoenix", "griffin", "sphinx", "centaur", "minotaur",
    "pegasus", "unicorn", "chimera", "hydra", "cerberus",
    "feathered serpent", "quetzal",
  ];

  const lower = text.toLowerCase();
  for (const animal of animalList) {
    const regex = new RegExp(`\\b${animal}s?\\b`, "i");
    if (regex.test(lower)) {
      if (!parts.some(p => p.toLowerCase().includes(animal))) {
        if (lower.includes(`sacred ${animal}`) || lower.includes(`${animal} was sacred`) ||
            lower.includes(`associated with ${animal}`) || lower.includes(`symbol`) ||
            lower.includes(`depicted as`) || lower.includes(`transformed into`) ||
            lower.includes(`rode a ${animal}`) || lower.includes(`${animal} form`) ||
            lower.includes(`accompanied by`) || lower.includes(`mount`)) {
          parts.push(animal);
        } else {
          const idx = lower.indexOf(animal);
          const context = lower.slice(Math.max(0, idx - 50), idx + animal.length + 50);
          if (/sacred|symbol|attribute|associated|depicted|transform|shape|form|accompan|mount|rode|chariot|pull/i.test(context)) {
            parts.push(animal);
          }
        }
      }
    }
  }

  return parts.length > 0 ? parts.join(", ") : null;
}

function extractTraits(text: string, sections: Map<string, string>): string | null {
  const traits: string[] = [];

  const traitPatterns = [
    /(?:known|renowned|famous|noted|celebrated) (?:for |as )(?:being |having )?(?:a |an |the )?([^.,]{3,60})/i,
    /(?:characterized|distinguished|marked) by (?:his |her |their )?([^.,]{3,60})/i,
    /(?:was|is) (?:a |an )?(?:wise|cunning|brave|fierce|beautiful|just|merciful|wrathful|jealous|loyal|treacherous|proud|humble|patient|compassionate|deceitful|trickster|shapeshifter)[^.,]*/i,
  ];

  for (const p of traitPatterns) {
    const m = text.match(p);
    if (m) {
      const trait = m[1] || m[0].replace(/^.*(?:was|is) (?:a |an )?/i, "").trim();
      if (trait.length >= 3 && trait.length <= 60) traits.push(trait);
    }
  }

  const traitWords = [
    "wise", "cunning", "brave", "fierce", "beautiful", "just", "merciful",
    "wrathful", "jealous", "loyal", "treacherous", "proud", "humble",
    "patient", "compassionate", "deceitful", "trickster", "shapeshifter",
    "benevolent", "malevolent", "protective", "nurturing", "warlike",
    "peaceful", "strategic", "intelligent", "creative", "prophetic",
    "healing", "vengeful", "seductive", "virginal", "chaste",
    "civilizing", "destructive", "chaotic", "orderly",
  ];

  const lower = text.toLowerCase().slice(0, 2000);
  for (const trait of traitWords) {
    if (lower.includes(trait) && !traits.includes(trait)) {
      const idx = lower.indexOf(trait);
      const before = lower.slice(Math.max(0, idx - 30), idx);
      if (/\b(was|is|being|known|described|considered|regarded|depicted|portrayed)\b/i.test(before)) {
        traits.push(trait);
      }
    }
  }

  return traits.length > 0 ? [...new Set(traits)].slice(0, 5).join(", ") : null;
}

function extractPhysical(infobox: Record<string, string>, text: string): string | null {
  const parts: string[] = [];

  const patterns = [
    /depicted (?:as|with) ([^.]{5,80})/i,
    /portrayed (?:as|with) ([^.]{5,80})/i,
    /described as ([^.]{5,80})/i,
    /represented (?:as|with) ([^.]{5,80})/i,
    /appears? (?:as|in the form of) ([^.]{5,80})/i,
    /(?:took|takes|assumed) the (?:form|shape) of ([^.]{5,60})/i,
    /(?:had|has|with) (?:a |an )?([^.]*?(?:head|body|wings?|tail|eyes?|arms?|hands?|skin|hair|beard)[^.]{0,40})/i,
  ];

  for (const p of patterns) {
    const m = text.match(p);
    if (m) {
      const desc = m[1].trim();
      if (desc.length >= 5 && desc.length <= 80 && !parts.includes(desc)) {
        parts.push(desc);
      }
    }
  }

  const physWords = [
    "blue-skinned", "four-armed", "three-eyed", "one-eyed", "winged",
    "horned", "bearded", "helmeted", "armored", "crowned", "veiled",
    "beautiful", "monstrous", "giant", "dwarf", "serpentine",
    "radiant", "luminous", "golden", "green-skinned", "half-human",
    "animal-headed", "hawk-headed", "jackal-headed", "ibis-headed",
    "lion-headed", "ram-headed", "cobra", "feathered",
  ];

  const lower = text.toLowerCase().slice(0, 3000);
  for (const w of physWords) {
    if (lower.includes(w) && !parts.some(p => p.toLowerCase().includes(w))) {
      parts.push(w);
    }
  }

  return parts.length > 0 ? [...new Set(parts)].slice(0, 4).join(", ") : null;
}

function extractEvent(text: string, sections: Map<string, string>): string | null {
  const mythSection = sections.get("mythology") || sections.get("myth") ||
    sections.get("legend") || sections.get("story") || sections.get("role") || "";
  const fullSearch = mythSection || text.slice(0, 2000);

  const patterns = [
    /(?:best )?known for ([^.]{10,120})\./i,
    /famous for ([^.]{10,120})\./i,
    /noted for ([^.]{10,120})\./i,
    /most (?:notable|important|significant) (?:act|deed|feat|role|myth) (?:was|is|involves?) ([^.]{10,120})\./i,
  ];

  for (const p of patterns) {
    const m = fullSearch.match(p);
    if (m) return m[1].trim();
  }

  const eventPatterns = [
    /[^.]*(?:slew|killed|defeated|conquered|overthrew|rescued|freed|created|founded|built|discovered|stole|retrieved|journeyed to|descended to|ascended to|transformed|cursed|punished|tricked)[^.]*\./i,
  ];

  for (const p of eventPatterns) {
    const m = fullSearch.match(p);
    if (m && m[0].length > 20 && m[0].length < 200) return m[0].trim();
  }

  return null;
}

function extractBirth(infobox: Record<string, string>, text: string): string | null {
  const patterns = [
    /[^.]*(?:born (?:of|from|to)|(?:son|daughter|child|offspring) of|born when|sprang from|emerged from|created from|arose from|hatched from)[^.]*\./i,
  ];

  for (const p of patterns) {
    const m = text.slice(0, 2000).match(p);
    if (m && m[0].length < 200) return m[0].trim();
  }

  const parentFields = ["parents", "father", "mother"];
  const parentInfo: string[] = [];
  for (const f of parentFields) {
    if (infobox[f]) parentInfo.push(`${f}: ${infobox[f]}`);
  }
  if (parentInfo.length > 0) return parentInfo.join("; ");

  return null;
}

function extractDeath(text: string): string | null {
  const patterns = [
    /[^.]*(?:killed by|slain by|murdered by|struck down by|died (?:of|when|after|during|in)|put to death|executed|sacrificed|perished)[^.]*\./i,
  ];

  for (const p of patterns) {
    const m = text.slice(0, 3000).match(p);
    if (m && m[0].length < 200) return m[0].trim();
  }
  return null;
}

function extractRelationships(infobox: Record<string, string>): { target: string; type: string }[] {
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
  return relationships;
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

function parseFigure(title: string, wikitext: string, tradition: string): FigureData | null {
  if (isListOrDisambiguation(title, wikitext)) return null;

  const infobox = extractInfobox(wikitext);
  const fullText = getFullText(wikitext);
  const sections = getSections(wikitext);

  if (fullText.length < 50 && Object.keys(infobox).length === 0) return null;

  const detectedTradition = tradition === "Mythological"
    ? detectTradition(wikitext, tradition)
    : tradition;

  const gender = extractGender(infobox, fullText);
  const domain = extractDomain(infobox, fullText);
  const object = extractObjects(infobox, fullText);
  const animals = extractAnimals(infobox, fullText);
  const characterTrait = extractTraits(fullText, sections);
  const physicalCharacteristics = extractPhysical(infobox, fullText);
  const significantEvent = extractEvent(fullText, sections);
  const birthCircumstances = extractBirth(infobox, fullText);
  const deathCircumstances = extractDeath(fullText);
  const relationships = extractRelationships(infobox);

  const name = infobox.name || title.replace(/ \(.*\)$/, "");
  if (name.length < 2 || name.length > 80) return null;

  const hasAnyData = gender || domain || object || animals || characterTrait ||
    significantEvent || birthCircumstances || deathCircumstances ||
    physicalCharacteristics || relationships.length > 0;

  if (!hasAnyData) return null;

  return {
    name,
    tradition: detectedTradition,
    gender,
    domain,
    object,
    animals,
    characterTrait,
    physicalCharacteristics,
    significantEvent,
    birthCircumstances,
    deathCircumstances,
    relationships,
  };
}

async function main() {
  console.log("=== Wikipedia Mythological Characters Scraper v2 ===\n");

  console.log("1. Fetching category members...");

  const categoryGroups: { label: string; category: string; tradition: string; useSubcats: boolean; max: number }[] = [
    { label: "Greek gods", category: "Category:Greek_gods", tradition: "Greek", useSubcats: false, max: 80 },
    { label: "Greek goddesses", category: "Category:Greek_goddesses", tradition: "Greek", useSubcats: false, max: 50 },
    { label: "Greek heroes", category: "Category:Greek_mythological_heroes", tradition: "Greek", useSubcats: false, max: 60 },
    { label: "Greek creatures", category: "Category:Creatures_in_Greek_mythology", tradition: "Greek", useSubcats: false, max: 40 },
    { label: "Norse gods", category: "Category:Norse_gods", tradition: "Norse", useSubcats: false, max: 50 },
    { label: "Norse creatures", category: "Category:Creatures_in_Norse_mythology", tradition: "Norse", useSubcats: false, max: 30 },
    { label: "Egyptian gods", category: "Category:Egyptian_gods", tradition: "Egyptian", useSubcats: false, max: 60 },
    { label: "Egyptian goddesses", category: "Category:Egyptian_goddesses", tradition: "Egyptian", useSubcats: false, max: 40 },
    { label: "Hindu deities", category: "Category:Hindu_deities", tradition: "Hindu", useSubcats: false, max: 40 },
    { label: "Shinto kami", category: "Category:Shinto_kami", tradition: "Shinto", useSubcats: false, max: 40 },
    { label: "Mesopotamian deities", category: "Category:Mesopotamian_deities", tradition: "Sumerian", useSubcats: false, max: 40 },
    { label: "Aztec gods", category: "Category:Aztec_gods", tradition: "Aztec", useSubcats: false, max: 40 },
    { label: "Celtic deities", category: "Category:Celtic_deities", tradition: "Celtic", useSubcats: false, max: 30 },
    { label: "Roman deities", category: "Category:Roman_deities", tradition: "Roman", useSubcats: false, max: 40 },
    { label: "Roman goddesses", category: "Category:Roman_goddesses", tradition: "Roman", useSubcats: false, max: 30 },
    { label: "Chinese deities", category: "Category:Chinese_gods", tradition: "Chinese", useSubcats: false, max: 30 },
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

  console.log("\n3. Parsing figures with deep text extraction...");
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

  console.log(`  Parsed ${figures.length} figures, skipped ${skipped}`);

  let stats = { gender: 0, domain: 0, object: 0, animals: 0, trait: 0, phys: 0, event: 0, birth: 0, death: 0 };
  for (const f of figures) {
    if (f.gender) stats.gender++;
    if (f.domain) stats.domain++;
    if (f.object) stats.object++;
    if (f.animals) stats.animals++;
    if (f.characterTrait) stats.trait++;
    if (f.physicalCharacteristics) stats.phys++;
    if (f.significantEvent) stats.event++;
    if (f.birthCircumstances) stats.birth++;
    if (f.deathCircumstances) stats.death++;
  }
  console.log(`  Data coverage:`, JSON.stringify(stats));

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
