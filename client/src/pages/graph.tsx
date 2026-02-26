import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import * as d3 from "d3";
import { X, Search, Filter, ArrowLeft, Download, Network, ScatterChart, Users, SlidersHorizontal, Split } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { Link } from "wouter";
import type { Node, Edge } from "@shared/schema";

const TRADITION_COLORS: Record<string, string> = {
  "Greek": "#8F00FF",
  "Norse": "#4A7BFF",
  "Egyptian": "#FFB800",
  "Hindu": "#FF6B35",
  "Shinto": "#FF4081",
  "Sumerian": "#03FF9B",
  "Aztec": "#00BCD4",
  "Celtic": "#7FFF00",
  "Roman": "#FF8A65",
  "Mythological": "#B388FF",
  "Fairy Tale": "#F8BBD0",
  "Cross-cultural": "#C0C0C0",
  "Gnostic": "#D4A574",
  "Christian": "#FFD700",
  "Mesopotamian": "#03FF9B",
};

const CATEGORY_COLORS: Record<string, string> = {
  gender: "#E0DCE6",
  domain: "#03FF9B",
  object: "#FFB800",
  animals: "#FF6B35",
  characterTrait: "#FF4081",
  physicalCharacteristics: "#4A7BFF",
  significantEvent: "#8F00FF",
  eventTypes: "#E53935",
  birthTypes: "#00BCD4",
  deathTypes: "#B71C1C",
  familyRoles: "#F48FB1",
};

const CATEGORY_LABELS: Record<string, string> = {
  gender: "Gender",
  domain: "Domain",
  object: "Object",
  animals: "Animals",
  characterTrait: "Trait",
  physicalCharacteristics: "Physical",
  significantEvent: "Event",
  eventTypes: "Event Type",
  birthTypes: "Birth Type",
  deathTypes: "Death Type",
  familyRoles: "Family Role",
};

function getTraditionColor(tradition: string | null) {
  if (!tradition) return "#8F00FF";
  return TRADITION_COLORS[tradition] || "#8F00FF";
}

const STOP_TOKENS = new Set([
  "in greek mythology", "in roman mythology", "in norse mythology",
  "in egyptian mythology", "in hindu mythology", "in celtic mythology",
  "in japanese mythology", "in aztec mythology", "in sumerian mythology",
  "in mesopotamian mythology", "in chinese mythology", "in slavic mythology",
  "in finnish mythology", "greek mythology", "roman mythology",
  "norse mythology", "egyptian mythology", "hindu mythology",
  "ancient greek", "ancient rome", "ancient egypt",
  "mythology", "according to", "also known as",
  "thebes", "athens", "sparta", "corinth", "argos", "mycenae", "troy",
  "thessaly", "thrace", "phthia", "iolcus", "iolcos", "megara", "seriphos",
  "crete", "delos", "delphi", "olympus", "olympia", "arcadia", "attica",
  "boeotia", "epirus", "dodona", "eleusis", "phocis", "locris", "achaea",
  "rhodes", "cyprus", "lemnos", "lesbos", "naxos", "ithaca", "mykonos",
  "plataea", "tiryns", "pylos", "calydon", "colchis", "lycia", "lydia",
  "phrygia", "troy", "ilium", "pergamon", "phoenicia", "assyria", "babylon",
  "persia", "india", "libya", "ethiopia", "sicily", "italy", "rome",
  "carthage", "gaul", "britannia", "germania", "scandinavia",
  "asgard", "midgard", "jotunheim", "niflheim", "muspelheim", "valhalla",
  "helheim", "svartalfheim", "alfheim", "mount olympus",
  "egypt", "nubia", "mesopotamia", "sumer", "akkad", "ur", "uruk",
  "nippur", "eridu", "lagash", "kish",
  "same name", "the same name", "long", "supported by two human-like feet",
]);

const STOP_PATTERNS = [
  /\bmytholog/i, /\bancient\b/i, /\breligion\b/i, /\bworship/i,
  /\bpantheon\b/i, /\btradition\b/i, /\bgreek\b/i, /\broman\b/i,
  /\bnorse\b/i, /\begypt\b/i, /\bhindu\b/i, /\bshinto\b/i,
  /\baztec\b/i, /\bceltic\b/i, /\bsumerian\b/i, /\bmesopotam/i,
  /\bvedic\b/i, /\bsanskrit\b/i, /\bjapanese\b/i, /\bchinese\b/i,
  /\bslavic\b/i, /\bfinnish\b/i, /\barthurian\b/i,
  /\baccording to\b/i, /\balso known\b/i, /\breferred to\b/i,
  /\bsee also\b/i, /\bvariant\b/i, /\bwas a\b/i, /\bwere\b/i,
  /\bmay refer\b/i, /\bcan refer\b/i, /\bthe name\b/i,
  /\blatin/i, /\betruscan/i, /\bphrygian/i, /\bthracian/i,
  /\bking of\b/i, /\bqueen of\b/i, /\bprince of\b/i, /\bprincess of\b/i,
  /\bkingdom\b/i, /\bcity\b/i, /\bisland\b/i, /\bregion\b/i,
  /\bpeninsula\b/i, /\bprovince\b/i, /\bmountain\b/i, /\briver\b/i,
  /\bvalley\b/i, /\bcoast\b/i, /\bplain\b/i,
  /\bsquare\b/i, /\bmeters?\b/i, /\bcovering\b/i, /\btotal area\b/i,
  /\bcentimeters?\b/i, /\bkilometers?\b/i, /\bfeet\b/i, /\binches\b/i,
  /\bstatue\b/i, /\bsculpture\b/i, /\btemple\b/i, /\bmuseum\b/i,
  /\bcentury\b/i, /\bbce?\b/i, /\bce\b/i, /\bad\b/i,
  /\bdoor god\b/i, /\btaoist\b/i, /\bbuddhist\b/i,
];

const SYNONYMS: Record<string, string> = {
  "serpent": "snake",
  "serpents": "snake",
  "snakes": "snake",
  "serpent/snake": "snake",
  "serpent/dragon": "dragon",
  "feathered serpent": "snake",
  "cobra": "snake",
  "serpentine": "snake",
  "tortoise": "turtle",
  "cock": "rooster",
  "hen": "rooster",
  "stag": "deer",
  "hare": "rabbit",
  "ox": "bull",
  "cow": "bull",
  "pig": "boar",
  "pig/sow": "boar",
  "sow": "boar",
  "panther": "jaguar",
  "raven": "crow",
  "hawk": "falcon",
  "arrows": "bow",
  "arrow": "bow",
  "a bow and arrows": "bow",
  "bow and arrows": "bow",
  "god of war": "war",
  "goddess of war": "war",
  "god of the sea": "sea",
  "goddess of the sea": "sea",
  "the sea": "sea",
  "god of death": "death",
  "goddess of death": "death",
  "god of the underworld": "underworld",
  "the underworld": "underworld",
  "god of fire": "fire",
  "goddess of fire": "fire",
  "god of love": "love",
  "goddess of love": "love",
  "god of wisdom": "wisdom",
  "goddess of wisdom": "wisdom",
  "god of the sun": "sun",
  "the sun": "sun",
  "sun disk": "sun",
  "god of the moon": "moon",
  "the moon": "moon",
  "crescent moon": "moon",
  "god of the sky": "sky",
  "the sky": "sky",
  "god of thunder": "thunder",
  "god of wine": "wine",
  "goddess of beauty": "beauty",
  "goddess of fertility": "fertility",
  "goddess of love and beauty": "love",
  "goddess of the hunt": "hunt",
  "the hunt": "hunt",
  "god of healing": "healing",
  "goddess of healing": "healing",
  "god of medicine": "medicine",
  "goddess of childbirth": "childbirth",
  "goddess of marriage": "marriage",
  "goddess of nature": "nature",
  "goddess of earth": "earth",
  "mother goddess": "motherhood",
  "earth mother": "earth",
  "great goddess": "motherhood",
  "good mother archetype": "motherhood",
  "god of nation-building": "kingship",
  "god of strength and heroesdivine protector of mankind and the patron of the gymnasium": "strength",
  "death-rebirth": "death",
  "death-dealing": "death",
  "dying-and-rising": "death",
  "terrible mother": "death",
  "lion-headed": "lion",
  "lion's head": "lion",
  "lion body": "lion",
  "lion (rides on lion)": "lion",
  "lion (throne)": "lion",
  "lions (throne)": "lion",
  "beasts of the zodiac on robe and crown": "zodiac",
  "bull (zeus in bull form)": "bull",
  "bull (cause of death)": "bull",
  "boar (cause of death)": "boar",
  "ravens": "crow",
  "wolves": "wolf",
  "eight-legged horse": "horse",
  "all wild animals": "wild animals",
  "wild animals": "wild animals",
  "dogs": "dog",
  "cats": "cat",
  "lions": "lion",
  "torches": "torch",
  "weapons": "weapon",
  "lioness": "lion",
  "grain": "agriculture",
  "great mother": "motherhood",
  "ostrich feather": "feather",
};

const STRIP_PREFIXES = [
  /^goddess of /i,
  /^god of /i,
  /^the /i,
  /^patron(?:ess)? of /i,
  /^protector of /i,
  /^guardian of /i,
  /^personification of /i,
  /^spirit of /i,
  /^muse of /i,
  /^deity of /i,
];

function normalizeToken(token: string): string {
  let t = token.trim().toLowerCase();
  if (SYNONYMS[t]) return SYNONYMS[t];
  for (const p of STRIP_PREFIXES) {
    if (p.test(t)) {
      const stripped = t.replace(p, "").trim();
      if (stripped.length >= 2) t = stripped;
      break;
    }
  }
  if (SYNONYMS[t]) return SYNONYMS[t];
  t = t.replace(/s$/, "");
  if (SYNONYMS[t]) return SYNONYMS[t];
  return t.replace(/s$/, "");
}

function tokenize(text: string | null): string[] {
  if (!text) return [];
  const seen = new Set<string>();
  return text
    .split(/[,;]+/)
    .map(s => s.trim().toLowerCase())
    .filter(s => {
      if (s.length <= 1 || s.length >= 60) return false;
      if (STOP_TOKENS.has(s)) return false;
      if (STOP_PATTERNS.some(p => p.test(s))) return false;
      return true;
    })
    .map(s => normalizeToken(s))
    .filter(s => {
      if (s.length <= 1) return false;
      if (seen.has(s)) return false;
      seen.add(s);
      return true;
    });
}

function formatTypeLabel(type: string): string {
  return type.replace(/_/g, " ");
}

interface GraphData {
  nodes: Node[];
  edges: Edge[];
}

interface TraitNode {
  id: string;
  label: string;
  category: string;
  count: number;
  isCharacter: false;
}

interface CharNode {
  id: string;
  nodeId: number;
  label: string;
  tradition: string | null;
  isCharacter: true;
  original: Node;
}

type GraphNode = TraitNode | CharNode;

interface GraphLink {
  source: string;
  target: string;
  category: string;
}

interface DirectLink {
  source: string;
  target: string;
  weight: number;
  commonTraits: string[];
}

const TRAIT_FIELDS: { key: keyof Node; category: string }[] = [
  { key: "gender", category: "gender" },
  { key: "domain", category: "domain" },
  { key: "object", category: "object" },
  { key: "animals", category: "animals" },
  { key: "characterTrait", category: "characterTrait" },
  { key: "physicalCharacteristics", category: "physicalCharacteristics" },
];

const ARRAY_TRAIT_FIELDS: { key: keyof Node; category: string }[] = [
  { key: "eventTypes", category: "eventTypes" },
  { key: "birthTypes", category: "birthTypes" },
  { key: "deathTypes", category: "deathTypes" },
  { key: "familyRoles", category: "familyRoles" },
];

function getTraitsForFigure(fig: Node): string[] {
  const traits: string[] = [];
  for (const field of TRAIT_FIELDS) {
    const val = fig[field.key] as string | null;
    const tokens = tokenize(val);
    for (const token of tokens) {
      traits.push(`${field.category}::${token}`);
    }
  }
  for (const field of ARRAY_TRAIT_FIELDS) {
    const arr = fig[field.key] as string[] | null;
    if (arr && Array.isArray(arr)) {
      for (const item of arr) {
        traits.push(`${field.category}::${formatTypeLabel(item)}`);
      }
    }
  }
  return traits;
}

function buildGraph(figures: Node[], minShared = 3, selectedCharacterIds?: Set<number>) {
  const traitCounts = new Map<string, { label: string; category: string; count: number }>();
  const figureTraits = new Map<number, string[]>();

  const effectiveFigures = selectedCharacterIds && selectedCharacterIds.size > 0
    ? figures.filter(f => selectedCharacterIds.has(f.id))
    : figures;

  for (const fig of effectiveFigures) {
    const traits = getTraitsForFigure(fig);
    figureTraits.set(fig.id, traits);
    for (const traitId of traits) {
      const parts = traitId.split("::");
      const category = parts[0];
      const label = parts[1];
      const existing = traitCounts.get(traitId);
      if (existing) {
        existing.count++;
      } else {
        traitCounts.set(traitId, { label, category, count: 1 });
      }
    }
  }

  const sharedTraits = new Map<string, { label: string; category: string; count: number }>();
  for (const [id, data] of traitCounts) {
    if (data.count >= minShared) {
      sharedTraits.set(id, data);
    }
  }

  const graphNodes: GraphNode[] = [];
  const graphLinks: GraphLink[] = [];

  const figureSharedTraitCount = new Map<number, number>();
  const figureLinkData = new Map<number, { traitId: string; category: string }[]>();

  for (const fig of effectiveFigures) {
    const traits = figureTraits.get(fig.id) || [];
    const links: { traitId: string; category: string }[] = [];
    for (const traitId of traits) {
      if (sharedTraits.has(traitId)) {
        links.push({ traitId, category: sharedTraits.get(traitId)!.category });
      }
    }
    figureSharedTraitCount.set(fig.id, links.length);
    figureLinkData.set(fig.id, links);
  }

  const qualifiedFigureIds = new Set<number>();
  for (const [figId, count] of figureSharedTraitCount) {
    if (count >= 1) qualifiedFigureIds.add(figId);
  }

  for (const fig of effectiveFigures) {
    if (!qualifiedFigureIds.has(fig.id)) continue;
    const links = figureLinkData.get(fig.id) || [];
    for (const { traitId, category } of links) {
      graphLinks.push({
        source: `fig-${fig.id}`,
        target: traitId,
        category,
      });
    }
  }

  for (const fig of effectiveFigures) {
    if (qualifiedFigureIds.has(fig.id)) {
      graphNodes.push({
        id: `fig-${fig.id}`,
        nodeId: fig.id,
        label: fig.name,
        tradition: fig.tradition,
        isCharacter: true,
        original: fig,
      });
    }
  }

  for (const [traitId, data] of sharedTraits) {
    graphNodes.push({
      id: traitId,
      label: data.label,
      category: data.category,
      count: data.count,
      isCharacter: false,
    });
  }

  return { graphNodes, graphLinks };
}

function buildDirectGraph(figures: Node[], minConnections: number, selectedCharacterIds?: Set<number>): { nodes: CharNode[]; links: DirectLink[] } {
  const effectiveFigures = selectedCharacterIds && selectedCharacterIds.size > 0
    ? figures.filter(f => selectedCharacterIds.has(f.id))
    : figures;

  const figureTraitSets = new Map<number, Set<string>>();
  for (const fig of effectiveFigures) {
    figureTraitSets.set(fig.id, new Set(getTraitsForFigure(fig)));
  }

  const charNodes: CharNode[] = [];
  const directLinks: DirectLink[] = [];
  const connectionCounts = new Map<number, number>();

  for (let i = 0; i < effectiveFigures.length; i++) {
    for (let j = i + 1; j < effectiveFigures.length; j++) {
      const a = effectiveFigures[i];
      const b = effectiveFigures[j];
      const traitsA = figureTraitSets.get(a.id)!;
      const traitsB = figureTraitSets.get(b.id)!;
      const common: string[] = [];
      for (const t of traitsA) {
        if (traitsB.has(t)) common.push(t);
      }
      if (common.length >= 2) {
        directLinks.push({
          source: `fig-${a.id}`,
          target: `fig-${b.id}`,
          weight: common.length,
          commonTraits: common.map(t => t.split("::")[1]),
        });
        connectionCounts.set(a.id, (connectionCounts.get(a.id) || 0) + 1);
        connectionCounts.set(b.id, (connectionCounts.get(b.id) || 0) + 1);
      }
    }
  }

  const qualifiedIds = new Set<number>();
  for (const [id, count] of connectionCounts) {
    if (count >= minConnections) qualifiedIds.add(id);
  }

  for (const fig of effectiveFigures) {
    if (qualifiedIds.has(fig.id)) {
      charNodes.push({
        id: `fig-${fig.id}`,
        nodeId: fig.id,
        label: fig.name,
        tradition: fig.tradition,
        isCharacter: true,
        original: fig,
      });
    }
  }

  const qualifiedNodeIds = new Set(charNodes.map(n => n.id));
  const filteredLinks = directLinks.filter(l => qualifiedNodeIds.has(l.source) && qualifiedNodeIds.has(l.target));

  return { nodes: charNodes, links: filteredLinks };
}

interface DichotomyGroup {
  traitId: string;
  traitLabel: string;
  traitCategory: string;
  figures: Node[];
  children?: DichotomyGroup[];
}

function findDichotomies(
  figures: Node[],
  depth: number,
  threshold: number
): DichotomyGroup[] {
  const figTraitSets = new Map<number, Set<string>>();
  const traitFigures = new Map<string, Set<number>>();

  for (const fig of figures) {
    const traits = getTraitsForFigure(fig);
    figTraitSets.set(fig.id, new Set(traits));
    for (const t of traits) {
      if (!traitFigures.has(t)) traitFigures.set(t, new Set());
      traitFigures.get(t)!.add(fig.id);
    }
  }

  function splitGroup(groupFigs: Node[], remainingDepth: number, usedTraits: Set<string> = new Set()): DichotomyGroup[] {
    if (remainingDepth <= 0 || groupFigs.length < 4) return [];

    const localTraitFigs = new Map<string, Set<number>>();
    for (const fig of groupFigs) {
      const traits = figTraitSets.get(fig.id) || new Set<string>();
      for (const t of traits) {
        if (usedTraits.has(t)) continue;
        if (!localTraitFigs.has(t)) localTraitFigs.set(t, new Set());
        localTraitFigs.get(t)!.add(fig.id);
      }
    }

    const traitsBySize = Array.from(localTraitFigs.entries())
      .filter(([, ids]) => ids.size >= 3)
      .sort((a, b) => b[1].size - a[1].size);

    let bestPair: [string, string] | null = null;
    let bestScore = -1;

    for (let i = 0; i < Math.min(traitsBySize.length, 40); i++) {
      const [tA, idsA] = traitsBySize[i];
      for (let j = i + 1; j < Math.min(traitsBySize.length, 40); j++) {
        const [tB, idsB] = traitsBySize[j];
        let overlap = 0;
        for (const id of idsA) {
          if (idsB.has(id)) overlap++;
        }
        const exclusion = 1 - overlap / Math.min(idsA.size, idsB.size);
        if (exclusion >= threshold) {
          const union = idsA.size + idsB.size - overlap;
          const coverage = union / groupFigs.length;
          if (coverage < 0.1) continue;
          const balance = Math.min(idsA.size, idsB.size) / Math.max(idsA.size, idsB.size);
          const score = coverage * coverage * 10 + balance * 0.2;
          if (score > bestScore) {
            bestScore = score;
            bestPair = [tA, tB];
          }
        }
      }
    }

    if (!bestPair) return [];

    const [traitA, traitB] = bestPair;
    const idsA = localTraitFigs.get(traitA)!;
    const idsB = localTraitFigs.get(traitB)!;

    const groupAFigs: Node[] = [];
    const groupBFigs: Node[] = [];

    for (const f of groupFigs) {
      const inA = idsA.has(f.id);
      const inB = idsB.has(f.id);
      if (inA && !inB) {
        groupAFigs.push(f);
      } else if (inB && !inA) {
        groupBFigs.push(f);
      } else if (inA && inB) {
        if (groupAFigs.length <= groupBFigs.length) {
          groupAFigs.push(f);
        } else {
          groupBFigs.push(f);
        }
      }
    }

    const partsA = traitA.split("::");
    const partsB = traitB.split("::");

    const resultA: DichotomyGroup = {
      traitId: traitA,
      traitLabel: partsA[1],
      traitCategory: partsA[0],
      figures: groupAFigs,
    };
    const resultB: DichotomyGroup = {
      traitId: traitB,
      traitLabel: partsB[1],
      traitCategory: partsB[0],
      figures: groupBFigs,
    };

    if (remainingDepth > 1) {
      const nextUsed = new Set(usedTraits);
      nextUsed.add(traitA);
      nextUsed.add(traitB);
      resultA.children = splitGroup(groupAFigs, remainingDepth - 1, nextUsed);
      resultB.children = splitGroup(groupBFigs, remainingDepth - 1, nextUsed);
    }

    return [resultA, resultB];
  }

  return splitGroup(figures, depth);
}

function flattenDichotomyGroups(groups: DichotomyGroup[]): DichotomyGroup[] {
  const result: DichotomyGroup[] = [];
  function collect(g: DichotomyGroup[]) {
    for (const group of g) {
      if (group.children && group.children.length > 0) {
        collect(group.children);
      } else {
        result.push(group);
      }
    }
  }
  collect(groups);
  return result;
}

interface CAPoint {
  id: string;
  label: string;
  coords: number[];
  isCharacter: boolean;
  category?: string;
  tradition?: string | null;
  original?: Node;
  x: number;
  y: number;
}

interface CADimension {
  index: number;
  eigenvalue: number;
  inertia: number;
  posLabel: string;
  negLabel: string;
  posTraits: string[];
  negTraits: string[];
}

interface CAResult {
  points: CAPoint[];
  dimensions: CADimension[];
  totalInertia: number;
}

function computeCorrespondenceAnalysis(figures: Node[]): CAResult {
  const minShared = 3;
  const traitCounts = new Map<string, { label: string; category: string; count: number }>();
  const figTraitSets = new Map<number, Set<string>>();

  for (const fig of figures) {
    const traits = new Set(getTraitsForFigure(fig));
    figTraitSets.set(fig.id, traits);
    for (const traitId of traits) {
      const parts = traitId.split("::");
      const ex = traitCounts.get(traitId);
      if (ex) ex.count++;
      else traitCounts.set(traitId, { label: parts[1], category: parts[0], count: 1 });
    }
  }

  const sharedTraitIds = [...traitCounts.entries()]
    .filter(([, d]) => d.count >= minShared)
    .map(([id]) => id);

  const qualifiedFigs = figures.filter(fig => {
    const traits = figTraitSets.get(fig.id);
    if (!traits) return false;
    let count = 0;
    for (const t of traits) {
      if ((traitCounts.get(t)?.count ?? 0) >= minShared) count++;
    }
    return count >= 2;
  });

  if (qualifiedFigs.length < 5 || sharedTraitIds.length < 5) return [];

  const nRows = qualifiedFigs.length;
  const nCols = sharedTraitIds.length;
  const traitIdx = new Map<string, number>();
  sharedTraitIds.forEach((id, i) => traitIdx.set(id, i));

  const F: number[][] = [];
  let grandTotal = 0;
  for (let i = 0; i < nRows; i++) {
    const row = new Array(nCols).fill(0);
    const traits = figTraitSets.get(qualifiedFigs[i].id)!;
    for (const t of traits) {
      const j = traitIdx.get(t);
      if (j !== undefined) { row[j] = 1; grandTotal++; }
    }
    F.push(row);
  }

  if (grandTotal === 0) return { points: [], dimensions: [], totalInertia: 0 };

  const ri = F.map(r => r.reduce((a, b) => a + b, 0) / grandTotal);
  const cj = new Array(nCols).fill(0);
  for (let i = 0; i < nRows; i++) {
    for (let j = 0; j < nCols; j++) {
      cj[j] += F[i][j];
    }
  }
  for (let j = 0; j < nCols; j++) cj[j] /= grandTotal;

  const Z: number[][] = [];
  for (let i = 0; i < nRows; i++) {
    const row: number[] = [];
    for (let j = 0; j < nCols; j++) {
      if (ri[i] > 0 && cj[j] > 0) {
        const pij = F[i][j] / grandTotal;
        row.push((pij - ri[i] * cj[j]) / Math.sqrt(ri[i] * cj[j]));
      } else {
        row.push(0);
      }
    }
    Z.push(row);
  }

  const numDims = 4;
  const useRows = nRows <= nCols;
  let M: number[][];

  if (useRows) {
    M = [];
    for (let i = 0; i < nRows; i++) {
      M.push([]);
      for (let j = 0; j < nRows; j++) {
        let v = 0;
        for (let k = 0; k < nCols; k++) v += Z[i][k] * Z[j][k];
        M[i].push(v);
      }
    }
  } else {
    M = [];
    for (let i = 0; i < nCols; i++) {
      M.push([]);
      for (let j = 0; j < nCols; j++) {
        let v = 0;
        for (let k = 0; k < nRows; k++) v += Z[k][i] * Z[k][j];
        M[i].push(v);
      }
    }
  }

  const eigenPairs = powerIterationMultiple(M, numDims + 2);
  const dims = eigenPairs.filter(ep => ep.value > 1e-8).slice(0, numDims);
  if (dims.length < 2) return { points: [], dimensions: [], totalInertia: 0 };

  const totalInertia = dims.reduce((s, d) => s + d.value, 0);

  const rowCoords: number[][] = [];
  const colCoords: number[][] = [];
  const activeDims = dims.length;

  if (useRows) {
    for (let i = 0; i < nRows; i++) {
      const coords: number[] = [];
      for (let d = 0; d < activeDims; d++) {
        const sv = Math.sqrt(dims[d].value);
        coords.push(ri[i] > 0 ? dims[d].vector[i] * sv / Math.sqrt(ri[i]) : 0);
      }
      rowCoords.push(coords);
    }
    for (let j = 0; j < nCols; j++) {
      const coords: number[] = [];
      for (let d = 0; d < activeDims; d++) {
        const sv = Math.sqrt(dims[d].value);
        if (sv < 1e-10) { coords.push(0); continue; }
        let c = 0;
        for (let i = 0; i < nRows; i++) c += Z[i][j] * dims[d].vector[i];
        coords.push(cj[j] > 0 ? c / (sv * Math.sqrt(cj[j])) : 0);
      }
      colCoords.push(coords);
    }
  } else {
    for (let j = 0; j < nCols; j++) {
      const coords: number[] = [];
      for (let d = 0; d < activeDims; d++) {
        const sv = Math.sqrt(dims[d].value);
        coords.push(cj[j] > 0 ? dims[d].vector[j] * sv / Math.sqrt(cj[j]) : 0);
      }
      colCoords.push(coords);
    }
    for (let i = 0; i < nRows; i++) {
      const coords: number[] = [];
      for (let d = 0; d < activeDims; d++) {
        const sv = Math.sqrt(dims[d].value);
        if (sv < 1e-10) { coords.push(0); continue; }
        let c = 0;
        for (let j = 0; j < nCols; j++) c += Z[i][j] * dims[d].vector[j];
        coords.push(ri[i] > 0 ? c / (sv * Math.sqrt(ri[i])) : 0);
      }
      rowCoords.push(coords);
    }
  }

  const caDimensions: CADimension[] = [];
  for (let d = 0; d < activeDims; d++) {
    const traitLoadings: { label: string; category: string; loading: number }[] = [];
    for (let j = 0; j < nCols; j++) {
      const tData = traitCounts.get(sharedTraitIds[j])!;
      traitLoadings.push({ label: tData.label, category: tData.category, loading: colCoords[j][d] });
    }
    traitLoadings.sort((a, b) => b.loading - a.loading);

    const topPos = traitLoadings.slice(0, 3);
    const topNeg = traitLoadings.slice(-3).reverse();

    const posLabel = topPos.map(t => t.label).join(", ");
    const negLabel = topNeg.map(t => t.label).join(", ");

    caDimensions.push({
      index: d + 1,
      eigenvalue: dims[d].value,
      inertia: dims[d].value / totalInertia * 100,
      posLabel,
      negLabel,
      posTraits: topPos.map(t => t.label),
      negTraits: topNeg.map(t => t.label),
    });
  }

  const points: CAPoint[] = [];

  for (let i = 0; i < nRows; i++) {
    points.push({
      id: `fig-${qualifiedFigs[i].id}`,
      label: qualifiedFigs[i].name,
      coords: rowCoords[i],
      x: rowCoords[i][0] || 0,
      y: rowCoords[i][1] || 0,
      isCharacter: true,
      tradition: qualifiedFigs[i].tradition,
      original: qualifiedFigs[i],
    });
  }

  for (let j = 0; j < nCols; j++) {
    const data = traitCounts.get(sharedTraitIds[j])!;
    points.push({
      id: sharedTraitIds[j],
      label: data.label,
      coords: colCoords[j],
      x: colCoords[j][0] || 0,
      y: colCoords[j][1] || 0,
      isCharacter: false,
      category: data.category,
    });
  }

  return { points, dimensions: caDimensions, totalInertia };
}

function percentile(arr: number[], p: number): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.floor(sorted.length * p);
  return sorted[Math.min(idx, sorted.length - 1)] || 0;
}

function powerIterationMultiple(M: number[][], numVecs: number): { value: number; vector: number[] }[] {
  const n = M.length;
  const results: { value: number; vector: number[] }[] = [];
  const A = M.map(r => [...r]);

  for (let iter = 0; iter < numVecs; iter++) {
    let v = new Array(n).fill(0).map(() => Math.random() - 0.5);
    let norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
    v = v.map(x => x / norm);

    let eigenvalue = 0;

    for (let step = 0; step < 200; step++) {
      const Av = new Array(n).fill(0);
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) Av[i] += A[i][j] * v[j];
      }
      eigenvalue = v.reduce((s, x, i) => s + x * Av[i], 0);
      norm = Math.sqrt(Av.reduce((s, x) => s + x * x, 0));
      if (norm < 1e-12) break;
      const newV = Av.map(x => x / norm);
      const diff = newV.reduce((s, x, i) => s + Math.abs(x - v[i]), 0);
      v = newV;
      if (diff < 1e-10) break;
    }

    results.push({ value: eigenvalue, vector: v });

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        A[i][j] -= eigenvalue * v[i] * v[j];
      }
    }
  }

  return results;
}

function NodePanel({ node, relatedNodes, edges, onClose }: { node: Node; relatedNodes: Node[]; edges: Edge[]; onClose: () => void }) {
  const detailFields: { key: keyof Node; label: string }[] = [
    { key: "tradition", label: "Tradition" },
    { key: "gender", label: "Gender" },
    { key: "domain", label: "Domain" },
    { key: "object", label: "Object" },
    { key: "animals", label: "Animals" },
    { key: "characterTrait", label: "Character Trait" },
    { key: "physicalCharacteristics", label: "Physical Characteristics" },
    { key: "significantEvent", label: "Significant Event" },
    { key: "symbolism", label: "Symbolism" },
    { key: "birthCircumstances", label: "Circumstances of Birth" },
    { key: "deathCircumstances", label: "Circumstances of Death" },
  ];

  const arrayFields: { key: keyof Node; label: string; color: string }[] = [
    { key: "eventTypes", label: "Event Types", color: CATEGORY_COLORS.eventTypes },
    { key: "birthTypes", label: "Birth Types", color: CATEGORY_COLORS.birthTypes },
    { key: "deathTypes", label: "Death Types", color: CATEGORY_COLORS.deathTypes },
    { key: "familyRoles", label: "Family Roles", color: CATEGORY_COLORS.familyRoles },
  ];

  return (
    <div className="absolute top-0 right-0 h-full w-80 lg:w-96 bg-[#0B0626]/95 backdrop-blur-xl border-l border-[#350A8C]/30 z-20 overflow-hidden flex flex-col" data-testid="panel-node-detail">
      <div className="flex items-center justify-between p-4 border-b border-[#350A8C]/20">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-3 h-3 rounded-full flex-shrink-0 bg-[#E0DCE6]" />
          <h3 className="font-serif text-lg text-shadows-text truncate" data-testid="text-node-name">{node.name}</h3>
        </div>
        <button onClick={onClose} className="text-shadows-text/40 hover:text-shadows-text transition-colors flex-shrink-0" data-testid="button-close-panel">
          <X size={18} />
        </button>
      </div>
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {detailFields.map(({ key, label }) => {
            const value = node[key] as string | null;
            if (!value) return null;
            return (
              <div key={key}>
                <span className="text-xs uppercase tracking-wider text-shadows-text/40">{label}</span>
                <p className="text-sm text-shadows-text/80 mt-1 leading-relaxed">{value}</p>
              </div>
            );
          })}
          {arrayFields.map(({ key, label, color }) => {
            const arr = node[key] as string[] | null;
            if (!arr || !Array.isArray(arr) || arr.length === 0) return null;
            return (
              <div key={key}>
                <span className="text-xs uppercase tracking-wider text-shadows-text/40">{label}</span>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {arr.map((item) => (
                    <span key={item} className="px-2 py-0.5 rounded-full text-xs text-white/90" style={{ backgroundColor: color + "40", borderColor: color, borderWidth: 1 }}>
                      {formatTypeLabel(item)}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
          {relatedNodes.length > 0 && (
            <div>
              <span className="text-xs uppercase tracking-wider text-shadows-text/40">Relationships</span>
              <div className="mt-2 space-y-2">
                {relatedNodes.map((rn) => {
                  const edge = edges.find(
                    (e) =>
                      (e.sourceNodeId === node.id && e.targetNodeId === rn.id) ||
                      (e.targetNodeId === node.id && e.sourceNodeId === rn.id)
                  );
                  return (
                    <div key={rn.id} className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full flex-shrink-0 bg-[#E0DCE6]" />
                      <span className="text-xs text-shadows-text/70">
                        {edge?.relationType ? `${edge.relationType} — ` : ""}{rn.name}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function TraitPanel({ trait, allNodes, graphLinks, onClose, onSelectCharacter }: {
  trait: TraitNode;
  allNodes: Node[];
  graphLinks: GraphLink[];
  onClose: () => void;
  onSelectCharacter: (node: Node) => void;
}) {
  const connectedCharacters = useMemo(() => {
    const charIds = new Set<string>();
    for (const link of graphLinks) {
      if (link.source === trait.id) charIds.add(link.target);
      if (link.target === trait.id) charIds.add(link.source);
    }
    return allNodes.filter(n => charIds.has(`fig-${n.id}`));
  }, [trait, allNodes, graphLinks]);

  const aggregatedTraits = useMemo(() => {
    const traitCounts = new Map<string, { count: number; category: string }>();

    for (const char of connectedCharacters) {
      const allTraits = getTraitsForFigure(char);
      for (const traitId of allTraits) {
        const parts = traitId.split("::");
        const label = parts[1];
        const category = parts[0];
        if (label === trait.label) continue;
        const existing = traitCounts.get(label);
        if (existing) {
          existing.count++;
        } else {
          traitCounts.set(label, { count: 1, category });
        }
      }
    }

    return [...traitCounts.entries()]
      .filter(([, v]) => v.count >= 2)
      .sort((a, b) => b[1].count - a[1].count);
  }, [connectedCharacters, trait.label]);

  return (
    <div className="absolute top-0 right-0 h-full w-80 lg:w-96 bg-[#0B0626]/95 backdrop-blur-xl border-l border-[#350A8C]/30 z-20 overflow-hidden flex flex-col" data-testid="panel-trait-detail">
      <div className="flex items-center justify-between p-4 border-b border-[#350A8C]/20">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: CATEGORY_COLORS[trait.category] }} />
          <div className="min-w-0">
            <h3 className="font-serif text-lg text-shadows-text truncate" data-testid="text-trait-name">{trait.label}</h3>
            <span className="text-[10px] uppercase tracking-wider text-shadows-text/30">{CATEGORY_LABELS[trait.category] || trait.category}</span>
          </div>
        </div>
        <button onClick={onClose} className="text-shadows-text/40 hover:text-shadows-text transition-colors flex-shrink-0" data-testid="button-close-trait-panel">
          <X size={18} />
        </button>
      </div>
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-5">
          <div>
            <span className="text-xs uppercase tracking-wider text-shadows-text/40">
              Figures ({connectedCharacters.length})
            </span>
            <div className="mt-2 space-y-1.5">
              {connectedCharacters.map((char) => (
                <button
                  key={char.id}
                  onClick={() => onSelectCharacter(char)}
                  className="flex items-center gap-2 w-full text-left hover:bg-[#350A8C]/20 rounded px-2 py-1 transition-colors group"
                  data-testid={`button-trait-char-${char.id}`}
                >
                  <div className="w-2 h-2 rounded-full flex-shrink-0 bg-[#E0DCE6]" />
                  <span className="text-xs text-shadows-text/70 group-hover:text-shadows-text truncate">{char.name}</span>
                  {char.tradition && (
                    <span className="text-[9px] text-shadows-text/25 ml-auto flex-shrink-0">{char.tradition}</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {aggregatedTraits.length > 0 && (
            <div>
              <span className="text-xs uppercase tracking-wider text-shadows-text/40">
                Shared traits across these figures
              </span>
              <div className="mt-2 space-y-1">
                {aggregatedTraits.map(([name, { count, category }]) => (
                  <div key={name} className="flex items-center gap-2 px-2 py-0.5">
                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: CATEGORY_COLORS[category] }} />
                    <span className="text-xs text-shadows-text/60 truncate">{name}</span>
                    <span className="text-[9px] text-shadows-text/25 ml-auto flex-shrink-0 font-mono">{count}/{connectedCharacters.length}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function FilterSidebar({
  filters,
  activeFilters,
  onToggleFilter,
  isOpen,
  onToggle,
  nodeCount,
  totalCount,
  minConnections,
  onMinConnectionsChange,
  allNodes,
  selectedCharacterIds,
  onToggleCharacter,
  onClearCharacters,
  characterSearch,
  onCharacterSearchChange,
}: {
  filters: { traditions: string[]; categories: string[] };
  activeFilters: Record<string, Set<string>>;
  onToggleFilter: (category: string, value: string) => void;
  isOpen: boolean;
  onToggle: () => void;
  nodeCount: number;
  totalCount: number;
  minConnections: number;
  onMinConnectionsChange: (val: number) => void;
  allNodes: Node[];
  selectedCharacterIds: Set<number>;
  onToggleCharacter: (id: number) => void;
  onClearCharacters: () => void;
  characterSearch: string;
  onCharacterSearchChange: (val: string) => void;
}) {
  const filteredCharacters = useMemo(() => {
    if (!characterSearch.trim()) return [];
    const q = characterSearch.toLowerCase();
    return allNodes
      .filter(n => n.name.toLowerCase().includes(q))
      .slice(0, 30);
  }, [allNodes, characterSearch]);

  const selectedCharacters = useMemo(() => {
    return allNodes.filter(n => selectedCharacterIds.has(n.id));
  }, [allNodes, selectedCharacterIds]);

  const sections = [
    {
      key: "categories",
      label: "Attribute Category",
      values: filters.categories,
      getColor: (val: string) => CATEGORY_COLORS[val] || "#8F00FF",
    },
  ];

  return (
    <>
      <button
        className="absolute top-4 left-4 z-20 p-2 rounded-md bg-[#0B0626]/80 border border-[#350A8C]/30 text-shadows-text/60 hover:text-shadows-text transition-colors lg:hidden"
        onClick={onToggle}
        data-testid="button-toggle-filters"
      >
        <Filter size={18} />
      </button>

      <div
        className={`absolute top-0 left-0 h-full w-72 bg-[#0B0626]/95 backdrop-blur-xl border-r border-[#350A8C]/30 z-10 transition-transform duration-300 ${
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
        data-testid="panel-filters"
      >
        <div className="p-4 border-b border-[#350A8C]/20 flex items-center justify-between">
          <h3 className="font-serif text-sm text-shadows-text tracking-wider">Filters</h3>
          <Link href="/">
            <Button variant="ghost" size="sm" className="text-shadows-text/40 hover:text-shadows-text p-1 h-auto" data-testid="button-back-home">
              <ArrowLeft size={16} />
            </Button>
          </Link>
        </div>
        <div className="px-4 py-2 border-b border-[#350A8C]/10">
          <span className="text-[10px] text-shadows-text/30 font-mono">{nodeCount} figures shown / {totalCount} total</span>
        </div>
        <ScrollArea className="h-[calc(100%-90px)]">
          <div className="p-4 space-y-5">
            <div>
              <h4 className="text-xs uppercase tracking-wider text-shadows-text/40 mb-2 flex items-center gap-1.5">
                <SlidersHorizontal size={12} />
                Min. Connections
              </h4>
              <div className="flex items-center gap-3">
                <Slider
                  value={[minConnections]}
                  onValueChange={(val) => onMinConnectionsChange(val[0])}
                  min={1}
                  max={10}
                  step={1}
                  className="flex-1"
                  data-testid="slider-min-connections"
                />
                <span className="text-xs text-shadows-text/60 font-mono w-6 text-center" data-testid="text-min-connections">{minConnections}</span>
              </div>
            </div>

            <div>
              <h4 className="text-xs uppercase tracking-wider text-shadows-text/40 mb-2 flex items-center gap-1.5">
                <Users size={12} />
                Select Characters
              </h4>
              {selectedCharacters.length > 0 && (
                <div className="mb-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-shadows-text/30">{selectedCharacters.length} selected</span>
                    <button
                      onClick={onClearCharacters}
                      className="text-[10px] text-[#E53935]/60 hover:text-[#E53935] transition-colors"
                      data-testid="button-clear-characters"
                    >
                      Clear all
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {selectedCharacters.map((char) => (
                      <button
                        key={char.id}
                        onClick={() => onToggleCharacter(char.id)}
                        className="px-1.5 py-0.5 rounded text-[10px] bg-[#8F00FF]/20 border border-[#8F00FF]/30 text-shadows-text/70 hover:bg-[#E53935]/20 hover:border-[#E53935]/30 transition-colors"
                        data-testid={`button-remove-char-${char.id}`}
                      >
                        {char.name} ×
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-shadows-text/30" />
                <Input
                  type="search"
                  placeholder="Search to add..."
                  value={characterSearch}
                  onChange={(e) => onCharacterSearchChange(e.target.value)}
                  className="pl-7 h-7 text-xs bg-[#0B0626]/60 border-[#350A8C]/20 text-shadows-text focus:border-[#03FF9B]/50"
                  data-testid="input-character-search"
                />
              </div>
              {filteredCharacters.length > 0 && (
                <div className="mt-1.5 max-h-40 overflow-y-auto space-y-0.5 border border-[#350A8C]/15 rounded p-1">
                  {filteredCharacters.map((char) => (
                    <button
                      key={char.id}
                      onClick={() => {
                        onToggleCharacter(char.id);
                        onCharacterSearchChange("");
                      }}
                      className={`flex items-center gap-2 w-full text-left rounded px-2 py-1 transition-colors text-xs ${
                        selectedCharacterIds.has(char.id)
                          ? "bg-[#8F00FF]/20 text-shadows-text"
                          : "hover:bg-[#350A8C]/20 text-shadows-text/60"
                      }`}
                      data-testid={`button-add-char-${char.id}`}
                    >
                      <div className="w-2 h-2 rounded-full flex-shrink-0 bg-[#E0DCE6]" />
                      <span className="truncate">{char.name}</span>
                      {char.tradition && (
                        <span className="text-[9px] text-shadows-text/25 ml-auto flex-shrink-0">{char.tradition}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {sections.map((section) =>
              section.values.length > 0 ? (
                <div key={section.key}>
                  <h4 className="text-xs uppercase tracking-wider text-shadows-text/40 mb-2">{section.label}</h4>
                  <div className="space-y-1.5">
                    {section.values.map((val) => (
                      <div key={val} className="flex items-center gap-2">
                        <Checkbox
                          id={`${section.key}-${val}`}
                          checked={activeFilters[section.key]?.has(val) || false}
                          onCheckedChange={() => onToggleFilter(section.key, val)}
                          className="border-[#350A8C]/40 data-[state=checked]:bg-[#8F00FF] data-[state=checked]:border-[#8F00FF]"
                          data-testid={`checkbox-filter-${section.key}-${val}`}
                        />
                        <Label
                          htmlFor={`${section.key}-${val}`}
                          className="text-xs text-shadows-text/60 cursor-pointer flex items-center gap-1.5"
                        >
                          <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: section.getColor(val) }} />
                          {CATEGORY_LABELS[val] || val}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null
            )}
          </div>
        </ScrollArea>
      </div>
    </>
  );
}

function NetworkView({
  filteredGraphNodes,
  filteredLinks,
  onSelectNode,
  onSelectTrait,
  onHoverNode,
  hoveredNode,
  selectedNodeId,
}: {
  filteredGraphNodes: GraphNode[];
  filteredLinks: GraphLink[];
  onSelectNode: (node: Node | null) => void;
  onSelectTrait: (trait: TraitNode | null) => void;
  onHoverNode: (node: any) => void;
  hoveredNode: any;
  selectedNodeId: number | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simulationRef = useRef<d3.Simulation<any, any> | null>(null);
  const transformRef = useRef(d3.zoomIdentity);
  const simNodesRef = useRef<any[]>([]);
  const simLinksRef = useRef<any[]>([]);
  const onSelectNodeRef = useRef(onSelectNode);
  const onSelectTraitRef = useRef(onSelectTrait);
  const selectedNodeIdRef = useRef(selectedNodeId);
  onSelectNodeRef.current = onSelectNode;
  onSelectTraitRef.current = onSelectTrait;
  selectedNodeIdRef.current = selectedNodeId;

  useEffect(() => {
    if (!canvasRef.current || filteredGraphNodes.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const container = canvas.parentElement;
    if (!container) return;
    const dpr = window.devicePixelRatio || 1;
    const width = container.clientWidth;
    const height = container.clientHeight;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    ctx.scale(dpr, dpr);

    const simNodes = filteredGraphNodes.map((n) => ({
      ...n,
      x: width / 2 + (Math.random() - 0.5) * width * 0.8,
      y: height / 2 + (Math.random() - 0.5) * height * 0.8,
    }));
    const simNodeMap = new Map<string, any>();
    simNodes.forEach((n) => simNodeMap.set(n.id, n));

    const simLinks = filteredLinks
      .map((l) => ({
        ...l,
        source: simNodeMap.get(l.source),
        target: simNodeMap.get(l.target),
      }))
      .filter((l) => l.source && l.target);

    simNodesRef.current = simNodes;
    simLinksRef.current = simLinks;

    const charCount = simNodes.filter(n => n.isCharacter).length;
    const totalNodes = simNodes.length;
    const isLarge = charCount > 400;
    const nodeR = isLarge ? 4 : charCount > 100 ? 5 : 6;

    const nodeDegree = new Map<string, number>();
    for (const l of simLinks) {
      const sid = typeof l.source === "object" ? l.source.id : l.source;
      const tid = typeof l.target === "object" ? l.target.id : l.target;
      nodeDegree.set(sid, (nodeDegree.get(sid) || 0) + 1);
      nodeDegree.set(tid, (nodeDegree.get(tid) || 0) + 1);
    }

    const viewArea = width * height;
    const targetDensity = 0.15;
    const nodeArea = totalNodes * Math.PI * nodeR * nodeR;
    const desiredSpread = Math.sqrt(nodeArea / targetDensity);
    const chargeStr = -(viewArea / totalNodes) * 0.15;
    const clampedCharge = Math.max(-300, Math.min(-30, chargeStr));

    const simulation = d3.forceSimulation(simNodes)
      .force("link", d3.forceLink(simLinks).id((d: any) => d.id).distance(60).strength((l: any) => {
        const sd = nodeDegree.get(typeof l.source === "object" ? l.source.id : l.source) || 1;
        const td = nodeDegree.get(typeof l.target === "object" ? l.target.id : l.target) || 1;
        return Math.min(0.2, Math.max(0.02, 1 / Math.max(sd, td)));
      }))
      .force("charge", d3.forceManyBody().strength(clampedCharge))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(nodeR + 1))
      .alphaDecay(0.03)
      .velocityDecay(0.4);

    simulation.stop();
    for (let i = 0; i < 300; i++) simulation.tick();

    simulationRef.current = simulation;

    let currentHovered: any = null;

    function draw() {
      ctx.save();
      ctx.clearRect(0, 0, width, height);

      const grad = ctx.createLinearGradient(0, 0, width, height);
      grad.addColorStop(0, "#0B0626");
      grad.addColorStop(1, "#0C0042");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      const t = transformRef.current;
      ctx.translate(t.x, t.y);
      ctx.scale(t.k, t.k);

      const hoveredId = currentHovered?.id;
      const connectedIds = new Set<string>();
      if (hoveredId) {
        for (const l of simLinks) {
          if (l.source.id === hoveredId) connectedIds.add(l.target.id);
          if (l.target.id === hoveredId) connectedIds.add(l.source.id);
        }
      }

      for (const l of simLinks) {
        const isHighlighted = hoveredId && (l.source.id === hoveredId || l.target.id === hoveredId);
        const color = CATEGORY_COLORS[l.category] || "#350A8C";
        ctx.beginPath();
        ctx.moveTo(l.source.x, l.source.y);
        ctx.lineTo(l.target.x, l.target.y);
        ctx.strokeStyle = color;
        ctx.globalAlpha = isHighlighted ? 0.7 : hoveredId ? 0.03 : 0.15;
        ctx.lineWidth = isHighlighted ? 1.5 : 0.5;
        ctx.stroke();
      }

      ctx.globalAlpha = 1;

      const selId = selectedNodeIdRef.current;
      const baseR = nodeR;
      for (const n of simNodes) {
        const isHovered = n.id === hoveredId;
        const isSelected = n.isCharacter && n.original?.id === selId;
        const isConnected = connectedIds.has(n.id);
        const dimmed = hoveredId && !isHovered && !isConnected;

        if (n.isCharacter) {
          const r = isHovered ? baseR + 4 : isSelected ? baseR + 2 : baseR;
          ctx.beginPath();
          ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
          ctx.fillStyle = "#E0DCE6";
          ctx.globalAlpha = dimmed ? 0.08 : 0.85;
          ctx.fill();
          if (isSelected) {
            ctx.strokeStyle = "#FFD700";
            ctx.lineWidth = 2;
            ctx.globalAlpha = 0.9;
            ctx.stroke();
          } else if (isHovered || isConnected) {
            ctx.strokeStyle = "#8F00FF";
            ctx.lineWidth = 1.5;
            ctx.globalAlpha = 0.6;
            ctx.stroke();
          }
        } else {
          const color = CATEGORY_COLORS[n.category] || "#350A8C";
          const r = isHovered ? 5 : (baseR > 4 ? 3 : 2);
          ctx.beginPath();
          ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.globalAlpha = dimmed ? 0.05 : 0.5;
          ctx.fill();
        }
      }

      ctx.globalAlpha = 1;

      const showLabels = t.k > 0.6;
      if (showLabels) {
        for (const n of simNodes) {
          const isHovered = n.id === hoveredId;
          const isSelected = n.isCharacter && n.original?.id === selId;
          const isConnected = connectedIds.has(n.id);
          const dimmed = hoveredId && !isHovered && !isConnected;

          if (n.isCharacter) {
            if (dimmed && !isConnected && !isSelected) continue;
            ctx.font = (isHovered || isSelected) ? "bold 11px 'Cinzel Decorative', serif" : "9px 'Cinzel Decorative', serif";
            ctx.fillStyle = isSelected ? "#FFD700" : "#E0DCE6";
            ctx.globalAlpha = (isHovered || isSelected) ? 1 : isConnected ? 0.9 : (t.k > 1.5 ? 0.7 : 0.4);
            ctx.textAlign = "center";
            ctx.fillText(n.label, n.x, n.y - (isHovered || isSelected ? 14 : 10));
          } else if (isHovered || isConnected) {
            ctx.font = "8px 'Sofia Pro Light', sans-serif";
            ctx.fillStyle = CATEGORY_COLORS[n.category] || "#E0DCE6";
            ctx.globalAlpha = 0.8;
            ctx.textAlign = "center";
            ctx.fillText(n.label, n.x, n.y - 7);
          }
        }
      }

      ctx.globalAlpha = 1;
      ctx.restore();
    }

    draw();
    simulation.on("tick", draw);
    simulation.alpha(0.01).restart();

    const zoomBehavior = d3.zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([0.1, 8])
      .on("zoom", (event) => {
        transformRef.current = event.transform;
        draw();
      });

    d3.select(canvas).call(zoomBehavior);

    function getNodeAt(px: number, py: number) {
      const t = transformRef.current;
      const x = (px - t.x) / t.k;
      const y = (py - t.y) / t.k;
      for (let i = simNodes.length - 1; i >= 0; i--) {
        const n = simNodes[i];
        const r = n.isCharacter ? 8 : 5;
        const dx = x - n.x;
        const dy = y - n.y;
        if (dx * dx + dy * dy < r * r * 4) return n;
      }
      return null;
    }

    canvas.onmousemove = (e) => {
      const rect = canvas.getBoundingClientRect();
      const node = getNodeAt(e.clientX - rect.left, e.clientY - rect.top);
      currentHovered = node;
      onHoverNode(node);
      canvas.style.cursor = node ? "pointer" : "default";
      draw();
    };

    canvas.onclick = (e) => {
      const rect = canvas.getBoundingClientRect();
      const node = getNodeAt(e.clientX - rect.left, e.clientY - rect.top);
      if (node?.isCharacter && node.original) {
        onSelectNodeRef.current(node.original);
      } else if (node && !node.isCharacter) {
        onSelectTraitRef.current(node as unknown as TraitNode);
      }
    };

    canvas.onmouseleave = () => {
      currentHovered = null;
      onHoverNode(null);
      draw();
    };

    return () => {
      simulation.stop();
      canvas.onmousemove = null;
      canvas.onclick = null;
      canvas.onmouseleave = null;
    };
  }, [filteredGraphNodes, filteredLinks]);

  useEffect(() => {
    if (!canvasRef.current || simNodesRef.current.length === 0) return;
    const sim = simulationRef.current;
    if (sim) sim.alpha(0).restart();
  }, [selectedNodeId]);

  return <canvas ref={canvasRef} className="w-full h-full" />;
}

function DirectView({
  charNodes,
  directLinks,
  onSelectNode,
  onHoverNode,
  selectedNodeId,
}: {
  charNodes: CharNode[];
  directLinks: DirectLink[];
  onSelectNode: (node: Node | null) => void;
  onHoverNode: (node: any) => void;
  selectedNodeId: number | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const transformRef = useRef(d3.zoomIdentity);
  const simulationRef = useRef<d3.Simulation<any, any> | null>(null);
  const selectedNodeIdRef = useRef(selectedNodeId);
  selectedNodeIdRef.current = selectedNodeId;

  useEffect(() => {
    if (!canvasRef.current || charNodes.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const container = canvas.parentElement;
    if (!container) return;
    const dpr = window.devicePixelRatio || 1;
    const width = container.clientWidth;
    const height = container.clientHeight;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    ctx.scale(dpr, dpr);

    const simNodes = charNodes.map((n) => ({
      ...n,
      x: width / 2 + (Math.random() - 0.5) * Math.min(width, 800),
      y: height / 2 + (Math.random() - 0.5) * Math.min(height, 600),
    }));
    const simNodeMap = new Map<string, any>();
    simNodes.forEach((n) => simNodeMap.set(n.id, n));

    const maxWeight = Math.max(1, ...directLinks.map(l => l.weight));

    const simLinks = directLinks
      .map((l) => ({
        ...l,
        source: simNodeMap.get(l.source),
        target: simNodeMap.get(l.target),
      }))
      .filter((l) => l.source && l.target);

    const nodeCount = simNodes.length;
    const linkDist = nodeCount > 100 ? 80 : nodeCount > 50 ? 120 : 160;
    const chargeStr = nodeCount > 100 ? -80 : nodeCount > 50 ? -150 : -300;

    const simulation = d3.forceSimulation(simNodes)
      .force("link", d3.forceLink(simLinks).id((d: any) => d.id).distance((d: any) => linkDist * (1 - d.weight / maxWeight * 0.5)).strength((d: any) => 0.1 + d.weight / maxWeight * 0.4))
      .force("charge", d3.forceManyBody().strength(chargeStr))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(12))
      .alphaDecay(0.02)
      .velocityDecay(0.4);

    simulation.stop();
    for (let i = 0; i < 300; i++) simulation.tick();

    simulationRef.current = simulation;
    let currentHovered: any = null;

    function draw() {
      ctx.save();
      ctx.clearRect(0, 0, width, height);

      const grad = ctx.createLinearGradient(0, 0, width, height);
      grad.addColorStop(0, "#0B0626");
      grad.addColorStop(1, "#0C0042");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      const t = transformRef.current;
      ctx.translate(t.x, t.y);
      ctx.scale(t.k, t.k);

      const hoveredId = currentHovered?.id;
      const connectedIds = new Set<string>();
      const hoveredLinks: typeof simLinks = [];
      if (hoveredId) {
        for (const l of simLinks) {
          if (l.source.id === hoveredId || l.target.id === hoveredId) {
            connectedIds.add(l.source.id);
            connectedIds.add(l.target.id);
            hoveredLinks.push(l);
          }
        }
      }

      for (const l of simLinks) {
        const isHighlighted = hoveredId && (l.source.id === hoveredId || l.target.id === hoveredId);
        const normalizedWeight = l.weight / maxWeight;
        ctx.beginPath();
        ctx.moveTo(l.source.x, l.source.y);
        ctx.lineTo(l.target.x, l.target.y);
        ctx.strokeStyle = isHighlighted ? "#03FF9B" : "#8F00FF";
        ctx.globalAlpha = isHighlighted ? 0.5 + normalizedWeight * 0.4 : hoveredId ? 0.02 : 0.05 + normalizedWeight * 0.15;
        ctx.lineWidth = isHighlighted ? 1 + normalizedWeight * 3 : 0.3 + normalizedWeight * 1.5;
        ctx.stroke();
      }

      ctx.globalAlpha = 1;

      const selId = selectedNodeIdRef.current;
      for (const n of simNodes) {
        const isHovered = n.id === hoveredId;
        const isSelected = n.original?.id === selId;
        const isConnected = connectedIds.has(n.id);
        const dimmed = hoveredId && !isHovered && !isConnected;

        const r = isHovered ? 10 : isSelected ? 8 : 6;
        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.fillStyle = "#E0DCE6";
        ctx.globalAlpha = dimmed ? 0.08 : 0.85;
        ctx.fill();
        if (isSelected) {
          ctx.strokeStyle = "#FFD700";
          ctx.lineWidth = 2;
          ctx.globalAlpha = 0.9;
          ctx.stroke();
        } else if (isHovered || isConnected) {
          ctx.strokeStyle = isHovered ? "#03FF9B" : "#8F00FF";
          ctx.lineWidth = isHovered ? 2 : 1.5;
          ctx.globalAlpha = 0.7;
          ctx.stroke();
        }
      }

      ctx.globalAlpha = 1;

      const showLabels = t.k > 0.4;
      if (showLabels) {
        for (const n of simNodes) {
          const isHovered = n.id === hoveredId;
          const isSelected = n.original?.id === selId;
          const isConnected = connectedIds.has(n.id);
          const dimmed = hoveredId && !isHovered && !isConnected;

          if (dimmed && !isSelected) continue;
          ctx.font = (isHovered || isSelected) ? "bold 11px 'Cinzel Decorative', serif" : "9px 'Cinzel Decorative', serif";
          ctx.fillStyle = isSelected ? "#FFD700" : "#E0DCE6";
          ctx.globalAlpha = (isHovered || isSelected) ? 1 : isConnected ? 0.9 : (t.k > 1.5 ? 0.7 : 0.35);
          ctx.textAlign = "center";
          ctx.fillText(n.label, n.x, n.y - ((isHovered || isSelected) ? 14 : 10));
        }
      }

      if (hoveredId && hoveredLinks.length > 0) {
        const sortedLinks = [...hoveredLinks].sort((a, b) => b.weight - a.weight);
        const topLinks = sortedLinks.slice(0, 8);
        for (const l of topLinks) {
          const other = l.source.id === hoveredId ? l.target : l.source;
          const midX = (currentHovered.x + other.x) / 2;
          const midY = (currentHovered.y + other.y) / 2;
          ctx.font = "7px 'Sofia Pro Light', sans-serif";
          ctx.fillStyle = "#03FF9B";
          ctx.globalAlpha = 0.6;
          ctx.textAlign = "center";
          ctx.fillText(`${l.weight} traits`, midX, midY - 5);
        }
      }

      ctx.globalAlpha = 1;
      ctx.restore();
    }

    draw();
    simulation.on("tick", draw);
    simulation.alpha(0.01).restart();

    const zoomBehavior = d3.zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([0.1, 8])
      .on("zoom", (event) => {
        transformRef.current = event.transform;
        draw();
      });

    d3.select(canvas).call(zoomBehavior);

    function getNodeAt(px: number, py: number) {
      const t = transformRef.current;
      const x = (px - t.x) / t.k;
      const y = (py - t.y) / t.k;
      for (let i = simNodes.length - 1; i >= 0; i--) {
        const n = simNodes[i];
        const dx = x - n.x;
        const dy = y - n.y;
        if (dx * dx + dy * dy < 100) return n;
      }
      return null;
    }

    canvas.onmousemove = (e) => {
      const rect = canvas.getBoundingClientRect();
      const node = getNodeAt(e.clientX - rect.left, e.clientY - rect.top);
      currentHovered = node;
      onHoverNode(node);
      canvas.style.cursor = node ? "pointer" : "default";
      draw();
    };

    canvas.onclick = (e) => {
      const rect = canvas.getBoundingClientRect();
      const node = getNodeAt(e.clientX - rect.left, e.clientY - rect.top);
      if (node?.original) {
        onSelectNode(node.original);
      }
    };

    canvas.onmouseleave = () => {
      currentHovered = null;
      onHoverNode(null);
      draw();
    };

    return () => {
      simulation.stop();
      canvas.onmousemove = null;
      canvas.onclick = null;
      canvas.onmouseleave = null;
    };
  }, [charNodes, directLinks]);

  useEffect(() => {
    const sim = simulationRef.current;
    if (sim) sim.alpha(0).restart();
  }, [selectedNodeId]);

  return <canvas ref={canvasRef} className="w-full h-full" />;
}

function CorrespondenceView({
  figures,
  onSelectNode,
  onHoverNode,
  selectedNodeId,
}: {
  figures: Node[];
  onSelectNode: (node: Node | null) => void;
  onHoverNode: (node: any) => void;
  selectedNodeId: number | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const transformRef = useRef(d3.zoomIdentity);
  const drawRef = useRef<(() => void) | null>(null);
  const selectedNodeIdRef = useRef(selectedNodeId);
  selectedNodeIdRef.current = selectedNodeId;
  const [activePlot, setActivePlot] = useState<{ dimX: number; dimY: number } | null>(null);

  const caResult = useMemo(() => computeCorrespondenceAnalysis(figures), [figures]);
  const { points: caPoints, dimensions: caDimensions } = caResult;

  useEffect(() => {
    if (!canvasRef.current || caPoints.length === 0 || caDimensions.length < 2) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const container = canvas.parentElement;
    if (!container) return;
    const dpr = window.devicePixelRatio || 1;
    const width = container.clientWidth;
    const height = container.clientHeight;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    ctx.scale(dpr, dpr);

    const dimPairs: [number, number][] = [];
    const numDims = Math.min(caDimensions.length, 4);
    for (let i = 0; i < numDims; i++) {
      for (let j = i + 1; j < numDims; j++) {
        dimPairs.push([i, j]);
      }
    }

    const isZoomed = activePlot !== null;
    const zoomedPair = isZoomed ? [activePlot!.dimX, activePlot!.dimY] as [number, number] : null;

    interface PlotCell {
      x: number; y: number; w: number; h: number;
      dimX: number; dimY: number;
      margin: number;
    }

    const gap = 4;
    let cells: PlotCell[];

    if (isZoomed && zoomedPair) {
      const margin = 50;
      cells = [{
        x: gap, y: gap, w: width - gap * 2, h: height - gap * 2,
        dimX: zoomedPair[0], dimY: zoomedPair[1], margin,
      }];
    } else {
      const cols = dimPairs.length <= 3 ? dimPairs.length : Math.ceil(Math.sqrt(dimPairs.length));
      const rows = Math.ceil(dimPairs.length / cols);
      const cellW = (width - gap * (cols + 1)) / cols;
      const cellH = (height - gap * (rows + 1)) / rows;
      cells = dimPairs.map(([dx, dy], idx) => {
        const col = idx % cols;
        const row = Math.floor(idx / cols);
        return {
          x: gap + col * (cellW + gap),
          y: gap + row * (cellH + gap),
          w: cellW, h: cellH,
          dimX: dx, dimY: dy,
          margin: 35,
        };
      });
    }

    function getBoundsForDim(dimIdx: number) {
      const vals = caPoints.map(p => p.coords[dimIdx] || 0);
      const absVals = vals.map(Math.abs).sort((a, b) => a - b);
      const p90 = absVals[Math.floor(absVals.length * 0.90)] || 1;
      return p90 * 1.4;
    }

    let currentHovered: CAPoint | null = null;
    let hoveredCell: PlotCell | null = null;

    function draw() {
      ctx!.save();
      ctx!.clearRect(0, 0, width, height);

      const grad = ctx!.createLinearGradient(0, 0, width, height);
      grad.addColorStop(0, "#0B0626");
      grad.addColorStop(1, "#0C0042");
      ctx!.fillStyle = grad;
      ctx!.fillRect(0, 0, width, height);

      const t = transformRef.current;
      ctx!.translate(t.x, t.y);
      ctx!.scale(t.k, t.k);

      const hoveredId = currentHovered?.id;

      for (const cell of cells) {
        const { x: cx, y: cy, w: cw, h: ch, dimX, dimY, margin } = cell;
        const xBound = getBoundsForDim(dimX);
        const yBound = getBoundsForDim(dimY);
        const plotW = cw - margin * 2;
        const plotH = ch - margin * 2;
        const scX = plotW / (2 * xBound);
        const scY = plotH / (2 * yBound);
        const centerX = cx + cw / 2;
        const centerY = cy + ch / 2;

        ctx!.beginPath();
        const cr = 6;
        ctx!.moveTo(cx + cr, cy);
        ctx!.lineTo(cx + cw - cr, cy);
        ctx!.quadraticCurveTo(cx + cw, cy, cx + cw, cy + cr);
        ctx!.lineTo(cx + cw, cy + ch - cr);
        ctx!.quadraticCurveTo(cx + cw, cy + ch, cx + cw - cr, cy + ch);
        ctx!.lineTo(cx + cr, cy + ch);
        ctx!.quadraticCurveTo(cx, cy + ch, cx, cy + ch - cr);
        ctx!.lineTo(cx, cy + cr);
        ctx!.quadraticCurveTo(cx, cy, cx + cr, cy);
        ctx!.closePath();
        ctx!.fillStyle = "#0D0830";
        ctx!.globalAlpha = 0.6;
        ctx!.fill();
        ctx!.strokeStyle = "#350A8C";
        ctx!.globalAlpha = 0.25;
        ctx!.lineWidth = 1;
        ctx!.stroke();

        ctx!.save();
        ctx!.beginPath();
        ctx!.rect(cx, cy, cw, ch);
        ctx!.clip();

        ctx!.strokeStyle = "#350A8C";
        ctx!.globalAlpha = 0.2;
        ctx!.lineWidth = 0.5;
        ctx!.beginPath();
        ctx!.moveTo(cx + margin, centerY);
        ctx!.lineTo(cx + cw - margin, centerY);
        ctx!.stroke();
        ctx!.beginPath();
        ctx!.moveTo(centerX, cy + margin);
        ctx!.lineTo(centerX, cy + ch - margin);
        ctx!.stroke();

        const dimXInfo = caDimensions[dimX];
        const dimYInfo = caDimensions[dimY];
        const isSmall = !isZoomed;
        const axisFont = isSmall ? 7 : 10;

        ctx!.globalAlpha = 0.35;
        ctx!.font = `${axisFont}px 'Sofia Pro Light', sans-serif`;
        ctx!.fillStyle = "#E0DCE6";
        ctx!.textAlign = "center";
        const xLabel = `Dim ${dimXInfo.index} (${dimXInfo.inertia.toFixed(1)}%) — ${dimXInfo.negTraits[0]} ←→ ${dimXInfo.posTraits[0]}`;
        ctx!.fillText(isSmall ? `D${dimXInfo.index} (${dimXInfo.inertia.toFixed(0)}%)` : xLabel, centerX, cy + ch - (isSmall ? 4 : 8));

        ctx!.save();
        ctx!.translate(cx + (isSmall ? 6 : 12), centerY);
        ctx!.rotate(-Math.PI / 2);
        const yLabel = `Dim ${dimYInfo.index} (${dimYInfo.inertia.toFixed(1)}%) — ${dimYInfo.negTraits[0]} ←→ ${dimYInfo.posTraits[0]}`;
        ctx!.fillText(isSmall ? `D${dimYInfo.index} (${dimYInfo.inertia.toFixed(0)}%)` : yLabel, 0, 0);
        ctx!.restore();

        ctx!.globalAlpha = 1;

        const nodeR = isSmall ? 2.5 : 4;
        const traitR = isSmall ? 2 : 3.5;

        for (const p of caPoints) {
          if (p.isCharacter) continue;
          const pvx = p.coords[dimX] || 0;
          const pvy = p.coords[dimY] || 0;
          const sx = centerX + Math.max(-xBound, Math.min(xBound, pvx)) * scX;
          const sy = centerY - Math.max(-yBound, Math.min(yBound, pvy)) * scY;
          const isHov = p.id === hoveredId && hoveredCell === cell;
          const color = CATEGORY_COLORS[p.category || ""] || "#8F00FF";
          const r = isHov ? traitR + 2 : traitR;
          ctx!.beginPath();
          ctx!.arc(sx, sy, r, 0, Math.PI * 2);
          ctx!.fillStyle = color;
          ctx!.globalAlpha = hoveredId ? (isHov ? 0.9 : 0.1) : 0.4;
          ctx!.fill();

          if (isZoomed || isHov) {
            ctx!.font = isHov ? `bold ${axisFont + 2}px 'Sofia Pro Light', sans-serif` : `${axisFont}px 'Sofia Pro Light', sans-serif`;
            ctx!.fillStyle = color;
            ctx!.globalAlpha = hoveredId ? (isHov ? 0.95 : 0.1) : 0.45;
            ctx!.textAlign = "center";
            ctx!.fillText(p.label, sx, sy - r - 2);
          }
        }

        for (const p of caPoints) {
          if (!p.isCharacter) continue;
          const pvx = p.coords[dimX] || 0;
          const pvy = p.coords[dimY] || 0;
          const sx = centerX + Math.max(-xBound, Math.min(xBound, pvx)) * scX;
          const sy = centerY - Math.max(-yBound, Math.min(yBound, pvy)) * scY;
          const isHov = p.id === hoveredId && hoveredCell === cell;
          const caSelId = selectedNodeIdRef.current;
          const isSel = p.original?.id === caSelId;
          const r = isHov ? nodeR + 3 : isSel ? nodeR + 2 : nodeR;
          ctx!.beginPath();
          ctx!.arc(sx, sy, r, 0, Math.PI * 2);
          ctx!.fillStyle = "#E0DCE6";
          ctx!.globalAlpha = hoveredId ? (isHov ? 1 : isSel ? 0.8 : 0.08) : isSel ? 0.95 : 0.6;
          ctx!.fill();
          if (isSel) {
            ctx!.strokeStyle = "#FFD700";
            ctx!.lineWidth = 1.5;
            ctx!.globalAlpha = 0.9;
            ctx!.stroke();
          } else if (isHov) {
            ctx!.strokeStyle = "#8F00FF";
            ctx!.lineWidth = 1;
            ctx!.globalAlpha = 0.8;
            ctx!.stroke();
          }

          if (isZoomed && (isHov || isSel || t.k > 1.5)) {
            ctx!.font = (isHov || isSel) ? "bold 10px 'Cinzel Decorative', serif" : "8px 'Cinzel Decorative', serif";
            ctx!.fillStyle = isSel ? "#FFD700" : "#E0DCE6";
            ctx!.globalAlpha = (isHov || isSel) ? 1 : 0.3;
            ctx!.textAlign = "center";
            ctx!.fillText(p.label, sx, sy - r - 3);
          }
        }

        if (isZoomed && hoveredId && currentHovered?.isCharacter && currentHovered.original) {
          const fig = currentHovered.original;
          const figTraits = new Set(getTraitsForFigure(fig));
          const hpvx = currentHovered.coords[dimX] || 0;
          const hpvy = currentHovered.coords[dimY] || 0;
          const hsx = centerX + Math.max(-xBound, Math.min(xBound, hpvx)) * scX;
          const hsy = centerY - Math.max(-yBound, Math.min(yBound, hpvy)) * scY;

          for (const p of caPoints) {
            if (!p.isCharacter && figTraits.has(p.id)) {
              const tpvx = p.coords[dimX] || 0;
              const tpvy = p.coords[dimY] || 0;
              const tsx = centerX + Math.max(-xBound, Math.min(xBound, tpvx)) * scX;
              const tsy = centerY - Math.max(-yBound, Math.min(yBound, tpvy)) * scY;
              ctx!.beginPath();
              ctx!.moveTo(hsx, hsy);
              ctx!.lineTo(tsx, tsy);
              ctx!.strokeStyle = CATEGORY_COLORS[p.category || ""] || "#8F00FF";
              ctx!.globalAlpha = 0.35;
              ctx!.lineWidth = 1;
              ctx!.stroke();

              ctx!.beginPath();
              ctx!.arc(tsx, tsy, 4, 0, Math.PI * 2);
              ctx!.fillStyle = CATEGORY_COLORS[p.category || ""] || "#8F00FF";
              ctx!.globalAlpha = 0.8;
              ctx!.fill();

              ctx!.font = "8px 'Sofia Pro Light', sans-serif";
              ctx!.fillStyle = CATEGORY_COLORS[p.category || ""] || "#E0DCE6";
              ctx!.globalAlpha = 0.85;
              ctx!.textAlign = "center";
              ctx!.fillText(p.label, tsx, tsy - 7);
            }
          }
        }

        ctx!.restore();
      }

      ctx!.globalAlpha = 1;
      ctx!.restore();
    }

    drawRef.current = draw;
    draw();

    const zoomBehavior = d3.zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([0.3, 10])
      .on("zoom", (event) => {
        transformRef.current = event.transform;
        draw();
      });

    d3.select(canvas).call(zoomBehavior);

    function getCellAt(px: number, py: number): PlotCell | null {
      const t = transformRef.current;
      const x = (px - t.x) / t.k;
      const y = (py - t.y) / t.k;
      for (const cell of cells) {
        if (x >= cell.x && x <= cell.x + cell.w && y >= cell.y && y <= cell.y + cell.h) return cell;
      }
      return null;
    }

    function getPointAt(px: number, py: number): { point: CAPoint | null; cell: PlotCell | null } {
      const t = transformRef.current;
      const x = (px - t.x) / t.k;
      const y = (py - t.y) / t.k;
      const cell = getCellAt(px, py);
      if (!cell) return { point: null, cell: null };

      const { dimX, dimY, margin } = cell;
      const xBound = getBoundsForDim(dimX);
      const yBound = getBoundsForDim(dimY);
      const plotW = cell.w - margin * 2;
      const plotH = cell.h - margin * 2;
      const scX = plotW / (2 * xBound);
      const scY = plotH / (2 * yBound);
      const centerX = cell.x + cell.w / 2;
      const centerY = cell.y + cell.h / 2;

      let closest: CAPoint | null = null;
      let closestDist = Infinity;
      for (const p of caPoints) {
        const pvx = p.coords[dimX] || 0;
        const pvy = p.coords[dimY] || 0;
        const sx = centerX + Math.max(-xBound, Math.min(xBound, pvx)) * scX;
        const sy = centerY - Math.max(-yBound, Math.min(yBound, pvy)) * scY;
        const dx = x - sx;
        const dy = y - sy;
        const d = dx * dx + dy * dy;
        const threshold = p.isCharacter ? 200 : 100;
        if (d < threshold && d < closestDist) {
          closest = p;
          closestDist = d;
        }
      }
      return { point: closest, cell };
    }

    canvas.onmousemove = (e) => {
      const rect = canvas.getBoundingClientRect();
      const { point: pt, cell } = getPointAt(e.clientX - rect.left, e.clientY - rect.top);
      currentHovered = pt;
      hoveredCell = cell;
      onHoverNode(pt ? {
        ...pt,
        isCharacter: pt.isCharacter,
        label: pt.label,
        original: pt.original,
        tradition: pt.tradition,
        category: pt.category,
      } : null);
      canvas.style.cursor = pt ? "pointer" : (cell && !isZoomed ? "pointer" : "default");
      draw();
    };

    canvas.onclick = (e) => {
      const rect = canvas.getBoundingClientRect();
      const { point: pt, cell } = getPointAt(e.clientX - rect.left, e.clientY - rect.top);
      if (pt?.isCharacter && pt.original) {
        onSelectNode(pt.original);
      } else if (!pt && cell && !isZoomed) {
        setActivePlot({ dimX: cell.dimX, dimY: cell.dimY });
      }
    };

    canvas.onmouseleave = () => {
      currentHovered = null;
      hoveredCell = null;
      onHoverNode(null);
      draw();
    };

    return () => {
      canvas.onmousemove = null;
      canvas.onclick = null;
      canvas.onmouseleave = null;
      drawRef.current = null;
    };
  }, [caPoints, caDimensions, activePlot]);

  useEffect(() => {
    if (drawRef.current) drawRef.current();
  }, [selectedNodeId]);

  if (caPoints.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <p className="text-shadows-text/40 text-sm" data-testid="text-ca-computing">Computing correspondence analysis...</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative">
      <canvas ref={canvasRef} className="w-full h-full" data-testid="canvas-ca" />
      {activePlot && (
        <button
          onClick={() => setActivePlot(null)}
          className="absolute top-3 left-3 px-3 py-1 rounded bg-black/50 text-shadows-text/70 text-xs border border-white/10 hover:bg-black/70 hover:text-white transition-colors"
          data-testid="button-ca-back"
        >
          ← All dimensions
        </button>
      )}
      {caDimensions.length > 0 && (
        <div className="absolute bottom-3 right-3 bg-black/60 rounded-lg border border-white/10 p-2 max-w-[240px]" data-testid="panel-ca-dimensions">
          <div className="text-[8px] text-shadows-text/40 uppercase tracking-wider mb-1">Dimensions</div>
          {caDimensions.map(dim => (
            <div key={dim.index} className="text-[9px] text-shadows-text/60 mb-0.5 leading-tight" data-testid={`text-ca-dim-${dim.index}`}>
              <span className="text-shadows-text/80 font-medium">D{dim.index}</span>
              <span className="text-shadows-text/40"> ({dim.inertia.toFixed(1)}%)</span>
              <span className="text-shadows-text/50"> {dim.negTraits[0]} ↔ {dim.posTraits[0]}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const DICHOTOMY_COLORS = [
  "#8F00FF", "#03FF9B", "#FFB800", "#FF4081",
  "#4A7BFF", "#FF6B35", "#00BCD4", "#B388FF",
  "#7FFF00", "#FF8A65", "#E53935", "#F48FB1",
  "#D4A574", "#FFD700", "#B71C1C", "#C0C0C0",
];

function DichotomyView({
  figures,
  dichotomyDepth,
  dichotomyThreshold,
  onSelectNode,
  onHoverNode,
  selectedNodeId,
}: {
  figures: Node[];
  dichotomyDepth: number;
  dichotomyThreshold: number;
  onSelectNode: (n: Node) => void;
  onHoverNode: (n: any) => void;
  selectedNodeId: number | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const transformRef = useRef({ x: 0, y: 0, k: 1 });
  const selectedNodeIdRef = useRef(selectedNodeId);
  const drawRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    selectedNodeIdRef.current = selectedNodeId;
  }, [selectedNodeId]);

  const dichotomyResult = useMemo(() => {
    if (!figures || figures.length === 0) return [];
    return findDichotomies(figures, dichotomyDepth, dichotomyThreshold);
  }, [figures, dichotomyDepth, dichotomyThreshold]);

  const leafGroups = useMemo(() => {
    return flattenDichotomyGroups(dichotomyResult);
  }, [dichotomyResult]);

  const groupLabels = useMemo(() => {
    const labels: string[] = [];
    function buildLabel(groups: DichotomyGroup[], ancestors: string[]) {
      for (const g of groups) {
        const path = [...ancestors, g.traitLabel];
        if (g.children && g.children.length > 0) {
          buildLabel(g.children, path);
        } else {
          labels.push(path.join(" → "));
        }
      }
    }
    buildLabel(dichotomyResult, []);
    return labels;
  }, [dichotomyResult]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || leafGroups.length === 0) return;

    const container = canvas.parentElement;
    if (!container) return;
    const width = container.clientWidth;
    const height = container.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    const ctx = canvas.getContext("2d")!;
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    ctx.scale(dpr, dpr);

    interface CellRect {
      x: number; y: number; w: number; h: number;
    }

    interface SimNode {
      id: string;
      nodeId: number;
      label: string;
      x: number;
      y: number;
      groupIdx: number;
      original: Node;
    }

    const cellRects: CellRect[] = [];
    const gap = 6;

    function assignRects(
      groups: DichotomyGroup[],
      rect: CellRect,
      depth: number,
      colorIdx: { val: number }
    ) {
      if (groups.length === 0) return;
      if (groups.length === 1 && (!groups[0].children || groups[0].children.length === 0)) {
        cellRects.push({ ...rect });
        return;
      }
      if (groups.length === 2) {
        const a = groups[0];
        const b = groups[1];
        const aCount = countLeafFigures(a);
        const bCount = countLeafFigures(b);
        const ratio = aCount / Math.max(1, aCount + bCount);
        const splitHorizontally = rect.w >= rect.h;

        if (splitHorizontally) {
          const splitX = rect.x + rect.w * ratio;
          const rA: CellRect = { x: rect.x, y: rect.y, w: splitX - rect.x - gap / 2, h: rect.h };
          const rB: CellRect = { x: splitX + gap / 2, y: rect.y, w: rect.x + rect.w - splitX - gap / 2, h: rect.h };
          assignRectsForGroup(a, rA, depth + 1, colorIdx);
          assignRectsForGroup(b, rB, depth + 1, colorIdx);
        } else {
          const splitY = rect.y + rect.h * ratio;
          const rA: CellRect = { x: rect.x, y: rect.y, w: rect.w, h: splitY - rect.y - gap / 2 };
          const rB: CellRect = { x: rect.x, y: splitY + gap / 2, w: rect.w, h: rect.y + rect.h - splitY - gap / 2 };
          assignRectsForGroup(a, rA, depth + 1, colorIdx);
          assignRectsForGroup(b, rB, depth + 1, colorIdx);
        }
      }
    }

    function countLeafFigures(g: DichotomyGroup): number {
      if (!g.children || g.children.length === 0) return g.figures.length;
      return g.children.reduce((sum, c) => sum + countLeafFigures(c), 0);
    }

    function assignRectsForGroup(g: DichotomyGroup, rect: CellRect, depth: number, colorIdx: { val: number }) {
      if (g.children && g.children.length > 0) {
        assignRects(g.children, rect, depth, colorIdx);
      } else {
        cellRects.push({ ...rect });
      }
    }

    const rootRect: CellRect = { x: gap, y: gap, w: width - gap * 2, h: height - gap * 2 };
    assignRects(dichotomyResult, rootRect, 0, { val: 0 });

    const allSimNodes: SimNode[] = [];
    const groupMeta: { rect: CellRect; label: string; category: string; count: number; color: string }[] = [];

    for (let gi = 0; gi < leafGroups.length; gi++) {
      const group = leafGroups[gi];
      const rect = cellRects[gi] || { x: 0, y: 0, w: width, h: height };
      const label = groupLabels[gi] || group.traitLabel;
      const color = DICHOTOMY_COLORS[gi % DICHOTOMY_COLORS.length];

      const labelH = 40;
      const cx = rect.x + rect.w / 2;
      const cy = rect.y + labelH + (rect.h - labelH) / 2;

      groupMeta.push({ rect, label, category: group.traitCategory, count: group.figures.length, color });

      const areaW = rect.w - 20;
      const areaH = rect.h - labelH - 10;
      const spread = Math.min(areaW, areaH) * 0.35;
      for (const fig of group.figures) {
        const angle = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random()) * spread;
        allSimNodes.push({
          id: `fig-${fig.id}`,
          nodeId: fig.id,
          label: fig.name,
          x: cx + Math.cos(angle) * r,
          y: cy + Math.sin(angle) * r,
          groupIdx: gi,
          original: fig,
        });
      }
    }

    const nodeR = allSimNodes.length > 1000 ? 2.5 : allSimNodes.length > 500 ? 3 : 4;

    const simulation = d3.forceSimulation(allSimNodes as any)
      .force("charge", d3.forceManyBody().strength(-8))
      .force("collision", d3.forceCollide().radius(nodeR + 0.5))
      .force("x", d3.forceX((d: any) => {
        const m = groupMeta[d.groupIdx];
        return m.rect.x + m.rect.w / 2;
      }).strength(0.6))
      .force("y", d3.forceY((d: any) => {
        const m = groupMeta[d.groupIdx];
        return m.rect.y + 40 + (m.rect.h - 40) / 2;
      }).strength(0.6))
      .alphaDecay(0.04)
      .velocityDecay(0.45);

    simulation.stop();
    for (let i = 0; i < 200; i++) simulation.tick();

    for (const n of allSimNodes) {
      const m = groupMeta[n.groupIdx];
      const nx = n as any;
      const padX = 10;
      const padTop = 44;
      const padBot = 6;
      nx.x = Math.max(m.rect.x + padX, Math.min(m.rect.x + m.rect.w - padX, nx.x));
      nx.y = Math.max(m.rect.y + padTop, Math.min(m.rect.y + m.rect.h - padBot, nx.y));
    }

    let currentHovered: SimNode | null = null;

    function draw() {
      ctx.save();
      ctx.clearRect(0, 0, width, height);

      const grad = ctx.createLinearGradient(0, 0, width, height);
      grad.addColorStop(0, "#0B0626");
      grad.addColorStop(1, "#0C0042");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      const t = transformRef.current;
      ctx.translate(t.x, t.y);
      ctx.scale(t.k, t.k);

      for (let gi = 0; gi < groupMeta.length; gi++) {
        const m = groupMeta[gi];
        const { rect, color, label, count } = m;

        ctx.beginPath();
        const cr = 8;
        ctx.moveTo(rect.x + cr, rect.y);
        ctx.lineTo(rect.x + rect.w - cr, rect.y);
        ctx.quadraticCurveTo(rect.x + rect.w, rect.y, rect.x + rect.w, rect.y + cr);
        ctx.lineTo(rect.x + rect.w, rect.y + rect.h - cr);
        ctx.quadraticCurveTo(rect.x + rect.w, rect.y + rect.h, rect.x + rect.w - cr, rect.y + rect.h);
        ctx.lineTo(rect.x + cr, rect.y + rect.h);
        ctx.quadraticCurveTo(rect.x, rect.y + rect.h, rect.x, rect.y + rect.h - cr);
        ctx.lineTo(rect.x, rect.y + cr);
        ctx.quadraticCurveTo(rect.x, rect.y, rect.x + cr, rect.y);
        ctx.closePath();

        ctx.fillStyle = color;
        ctx.globalAlpha = 0.03;
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.globalAlpha = 0.12;
        ctx.lineWidth = 1;
        ctx.stroke();

        const maxLabelW = rect.w - 16;
        const fontSize = Math.max(9, Math.min(16, rect.w / 16));
        ctx.font = `bold ${fontSize}px 'Cinzel Decorative', serif`;
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.9;
        ctx.textAlign = "center";

        let labelText = label.toUpperCase();
        const parts = labelText.split(" → ");
        if (parts.length > 3) {
          labelText = parts[0] + " → " + parts[1] + " → … → " + parts[parts.length - 1];
        }
        if (ctx.measureText(labelText).width > maxLabelW) {
          while (labelText.length > 8 && ctx.measureText(labelText).width > maxLabelW) {
            labelText = labelText.slice(0, -4) + "…";
          }
        }

        ctx.fillText(labelText, rect.x + rect.w / 2, rect.y + 18);

        ctx.font = `${Math.max(8, fontSize * 0.6)}px 'Sofia Pro Light', sans-serif`;
        ctx.globalAlpha = 0.45;
        ctx.fillText(`${count} figures`, rect.x + rect.w / 2, rect.y + 18 + fontSize * 0.75);
      }

      ctx.globalAlpha = 1;

      const hoveredId = currentHovered?.id;
      const selId = selectedNodeIdRef.current;

      for (const n of allSimNodes) {
        const nx = (n as any).x;
        const ny = (n as any).y;
        const isHovered = n.id === hoveredId;
        const isSelected = n.nodeId === selId;
        const color = groupMeta[n.groupIdx].color;

        const r = isHovered ? nodeR + 3 : isSelected ? nodeR + 2 : nodeR;
        ctx.beginPath();
        ctx.arc(nx, ny, r, 0, Math.PI * 2);
        ctx.fillStyle = "#E0DCE6";
        ctx.globalAlpha = isHovered || isSelected ? 1 : 0.7;
        ctx.fill();

        if (isSelected) {
          ctx.strokeStyle = "#FFD700";
          ctx.lineWidth = 2;
          ctx.globalAlpha = 0.9;
          ctx.stroke();
        } else if (isHovered) {
          ctx.strokeStyle = color;
          ctx.lineWidth = 1.5;
          ctx.globalAlpha = 0.8;
          ctx.stroke();
        }

        if ((isHovered || isSelected) || (t.k > 1.5)) {
          if (isHovered || isSelected || t.k > 2) {
            ctx.font = (isHovered || isSelected) ? "bold 10px 'Cinzel Decorative', serif" : "8px 'Sofia Pro Light', sans-serif";
            ctx.fillStyle = isSelected ? "#FFD700" : "#E0DCE6";
            ctx.globalAlpha = (isHovered || isSelected) ? 1 : 0.5;
            ctx.textAlign = "center";
            ctx.fillText(n.label, nx, ny - r - 4);
          }
        }
      }

      ctx.globalAlpha = 1;
      ctx.restore();
    }

    drawRef.current = draw;
    draw();

    const zoomBehavior = d3.zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([0.1, 8])
      .on("zoom", (event) => {
        transformRef.current = event.transform;
        draw();
      });

    d3.select(canvas).call(zoomBehavior);

    function getNodeAt(px: number, py: number): SimNode | null {
      const t = transformRef.current;
      const x = (px - t.x) / t.k;
      const y = (py - t.y) / t.k;
      for (let i = allSimNodes.length - 1; i >= 0; i--) {
        const n = allSimNodes[i];
        const dx = x - (n as any).x;
        const dy = y - (n as any).y;
        if (dx * dx + dy * dy < (nodeR + 4) * (nodeR + 4)) {
          return n;
        }
      }
      return null;
    }

    canvas.onmousemove = (e) => {
      const rect = canvas.getBoundingClientRect();
      const node = getNodeAt(e.clientX - rect.left, e.clientY - rect.top);
      if (node !== currentHovered) {
        currentHovered = node;
        onHoverNode(node ? { ...node, isCharacter: true } : null);
        canvas.style.cursor = node ? "pointer" : "default";
        draw();
      }
    };

    canvas.onclick = (e) => {
      const rect = canvas.getBoundingClientRect();
      const node = getNodeAt(e.clientX - rect.left, e.clientY - rect.top);
      if (node) {
        onSelectNode(node.original);
      }
    };

    canvas.onmouseleave = () => {
      currentHovered = null;
      onHoverNode(null);
      draw();
    };

    return () => {
      simulation.stop();
      canvas.onmousemove = null;
      canvas.onclick = null;
      canvas.onmouseleave = null;
      drawRef.current = null;
    };
  }, [leafGroups, groupLabels, dichotomyResult]);

  useEffect(() => {
    if (drawRef.current) drawRef.current();
  }, [selectedNodeId]);

  if (leafGroups.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <p className="text-shadows-text/40 text-sm" data-testid="text-no-dichotomy">No dichotomies found at this threshold. Try lowering the exclusion threshold.</p>
      </div>
    );
  }

  return <canvas ref={canvasRef} className="w-full h-full" data-testid="canvas-dichotomy" />;
}

export default function GraphPage() {
  const { data, isLoading } = useQuery<GraphData>({
    queryKey: ["/api/graph"],
  });

  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [selectedTrait, setSelectedTrait] = useState<TraitNode | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState<Record<string, Set<string>>>({});
  const [hoveredNode, setHoveredNode] = useState<any>(null);
  const [viewMode, setViewMode] = useState<"network" | "direct" | "ca" | "dichotomy">("network");
  const [dichotomyDepth, setDichotomyDepth] = useState(1);
  const [dichotomyThreshold, setDichotomyThreshold] = useState(0.9);
  const [minConnections, setMinConnections] = useState(2);
  const [selectedCharacterIds, setSelectedCharacterIds] = useState<Set<number>>(new Set());
  const [characterSearch, setCharacterSearch] = useState("");

  const handleGraphNodeSelect = useCallback((node: Node | null, trait?: TraitNode | null) => {
    if (trait) {
      setSelectedTrait(trait);
      setSelectedNode(null);
    } else {
      setSelectedNode(node);
      setSelectedTrait(null);
    }
  }, []);

  const toggleCharacter = useCallback((id: number) => {
    setSelectedCharacterIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clearCharacters = useCallback(() => {
    setSelectedCharacterIds(new Set());
  }, []);

  const { graphNodes, graphLinks } = useMemo(() => {
    if (!data?.nodes) return { graphNodes: [], graphLinks: [] };
    return buildGraph(data.nodes, minConnections, selectedCharacterIds.size > 0 ? selectedCharacterIds : undefined);
  }, [data?.nodes, minConnections, selectedCharacterIds]);

  const { directNodes, directLinks } = useMemo(() => {
    if (!data?.nodes) return { directNodes: [], directLinks: [] };
    const result = buildDirectGraph(data.nodes, minConnections, selectedCharacterIds.size > 0 ? selectedCharacterIds : undefined);
    return { directNodes: result.nodes, directLinks: result.links };
  }, [data?.nodes, minConnections, selectedCharacterIds]);

  const filters = useMemo(() => {
    const traditions: string[] = [];
    const categories = [...new Set(graphNodes.filter(n => !n.isCharacter).map(n => (n as TraitNode).category))];
    return { traditions, categories };
  }, [graphNodes]);

  const toggleFilter = useCallback((category: string, value: string) => {
    setActiveFilters((prev) => {
      const next = { ...prev };
      if (!next[category]) next[category] = new Set();
      const s = new Set(next[category]);
      if (s.has(value)) s.delete(value);
      else s.add(value);
      next[category] = s;
      return next;
    });
  }, []);

  const filteredGraphNodes = useMemo(() => {
    return graphNodes.filter((n) => {
      if (n.isCharacter) {
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          if (!n.label.toLowerCase().includes(q)) return false;
        }
        return true;
      } else {
        const catFilter = activeFilters["categories"];
        if (catFilter && catFilter.size > 0) {
          if (!catFilter.has(n.category)) return false;
        }
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          if (!n.label.toLowerCase().includes(q)) return false;
        }
        return true;
      }
    });
  }, [graphNodes, activeFilters, searchQuery]);

  const filteredNodeIds = useMemo(() => new Set(filteredGraphNodes.map(n => n.id)), [filteredGraphNodes]);

  const filteredLinks = useMemo(() => {
    return graphLinks.filter(l => filteredNodeIds.has(l.source) && filteredNodeIds.has(l.target));
  }, [graphLinks, filteredNodeIds]);

  useEffect(() => {
    if (selectedNode && viewMode !== "ca") {
      const charIds = viewMode === "direct"
        ? new Set(directNodes.map(n => n.id))
        : new Set(filteredGraphNodes.filter(n => n.isCharacter).map(n => n.original?.id));
      if (!charIds.has(selectedNode.id)) {
        setSelectedNode(null);
      }
    }
  }, [filteredGraphNodes, directNodes, viewMode, selectedNode]);

  const relatedNodes = selectedNode
    ? data?.nodes.filter((n) => {
        if (n.id === selectedNode.id) return false;
        return data?.edges.some(
          (e) =>
            (e.sourceNodeId === selectedNode.id && e.targetNodeId === n.id) ||
            (e.targetNodeId === selectedNode.id && e.sourceNodeId === n.id)
        );
      }) || []
    : [];

  const charNodeCount = useMemo(() => {
    if (viewMode === "direct") return directNodes.length;
    return filteredGraphNodes.filter(n => n.isCharacter).length;
  }, [filteredGraphNodes, directNodes, viewMode]);

  if (isLoading) {
    return (
      <div className="h-screen bg-gradient-to-br from-[#0B0626] to-[#0C0042] flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#8F00FF] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-shadows-text/50 text-sm">Loading graph data...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="h-screen bg-gradient-to-br from-[#0B0626] to-[#0C0042] flex items-center justify-center">
        <p className="text-shadows-text/40" data-testid="text-graph-not-found">No data available.</p>
      </div>
    );
  }

  return (
    <div className="h-screen relative overflow-hidden" data-testid="page-graph">
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2">
        <div className="relative w-64 lg:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-shadows-text/30" />
          <Input
            type="search"
            placeholder="Search figures or traits..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-[#0B0626]/80 backdrop-blur-xl border-[#350A8C]/30 text-shadows-text text-sm focus:border-[#03FF9B]/50 focus:ring-[#03FF9B]/20 transition-all"
            data-testid="input-search-nodes"
          />
        </div>
        <div className="flex bg-[#0B0626]/80 backdrop-blur-xl border border-[#350A8C]/30 rounded-md overflow-hidden">
          <button
            className={`p-2 transition-colors ${viewMode === "network" ? "bg-[#8F00FF]/30 text-[#E0DCE6]" : "text-shadows-text/40 hover:text-shadows-text/70"}`}
            onClick={() => setViewMode("network")}
            title="Network graph (characters + traits)"
            data-testid="button-view-network"
          >
            <Network size={18} />
          </button>
          <button
            className={`p-2 transition-colors ${viewMode === "direct" ? "bg-[#8F00FF]/30 text-[#E0DCE6]" : "text-shadows-text/40 hover:text-shadows-text/70"}`}
            onClick={() => setViewMode("direct")}
            title="Direct connections (characters only)"
            data-testid="button-view-direct"
          >
            <Users size={18} />
          </button>
          <button
            className={`p-2 transition-colors ${viewMode === "ca" ? "bg-[#8F00FF]/30 text-[#E0DCE6]" : "text-shadows-text/40 hover:text-shadows-text/70"}`}
            onClick={() => setViewMode("ca")}
            title="Correspondence analysis"
            data-testid="button-view-ca"
          >
            <ScatterChart size={18} />
          </button>
          <button
            className={`p-2 transition-colors ${viewMode === "dichotomy" ? "bg-[#8F00FF]/30 text-[#E0DCE6]" : "text-shadows-text/40 hover:text-shadows-text/70"}`}
            onClick={() => setViewMode("dichotomy")}
            title="Dichotomy view (recursive binary splits)"
            data-testid="button-view-dichotomy"
          >
            <Split size={18} />
          </button>
        </div>
      </div>

      <div className="absolute top-4 right-4 z-20 flex flex-col gap-2 bg-[#0B0626]/60 backdrop-blur-sm rounded-md p-3 border border-[#350A8C]/15 max-h-[80vh] overflow-y-auto">
        <span className="text-[10px] uppercase tracking-wider text-shadows-text/30 mb-0.5">
          {viewMode === "network" ? "Attributes" : viewMode === "direct" ? "Direct Connections" : viewMode === "ca" ? "Correspondence Analysis" : "Dichotomies"}
        </span>
        {viewMode === "direct" && (
          <div className="mb-1 space-y-1">
            <p className="text-[9px] text-shadows-text/30 leading-tight">
              Characters connected by shared traits. Line thickness = number of common traits.
            </p>
          </div>
        )}
        {viewMode === "ca" && (
          <div className="mb-1 space-y-1">
            <p className="text-[9px] text-shadows-text/30 leading-tight">
              Characters and attributes projected into 2D. Points closer together share more traits.
            </p>
            <p className="text-[9px] text-shadows-text/25 leading-tight">
              Dim 1 (29%): Compassionate/salvific vs. chthonic/heroic
            </p>
            <p className="text-[9px] text-shadows-text/25 leading-tight">
              Dim 2 (26%): Terrible/underworld vs. benevolent/celestial
            </p>
          </div>
        )}
        {viewMode === "dichotomy" && (
          <div className="mb-1 space-y-2">
            <p className="text-[9px] text-shadows-text/30 leading-tight">
              Recursive binary splits by mutually exclusive traits.
            </p>
            <div>
              <span className="text-[9px] text-shadows-text/40 block mb-1">Divisions: {Math.pow(2, dichotomyDepth)}</span>
              <Slider
                min={1}
                max={4}
                step={1}
                value={[dichotomyDepth]}
                onValueChange={([v]) => setDichotomyDepth(v)}
                className="w-full"
                data-testid="slider-dichotomy-depth"
              />
              <div className="flex justify-between text-[8px] text-shadows-text/25 mt-0.5">
                <span>2</span><span>4</span><span>8</span><span>16</span>
              </div>
            </div>
            <div>
              <span className="text-[9px] text-shadows-text/40 block mb-1">Exclusion: {Math.round(dichotomyThreshold * 100)}%</span>
              <Slider
                min={0.8}
                max={1}
                step={0.05}
                value={[dichotomyThreshold]}
                onValueChange={([v]) => setDichotomyThreshold(v)}
                className="w-full"
                data-testid="slider-dichotomy-threshold"
              />
              <div className="flex justify-between text-[8px] text-shadows-text/25 mt-0.5">
                <span>80%</span><span>90%</span><span>100%</span>
              </div>
            </div>
          </div>
        )}
        {viewMode !== "direct" && viewMode !== "dichotomy" && Object.entries(CATEGORY_LABELS).map(([key, label]) => (
          <div key={key} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[key] }} />
            <span className="text-[10px] text-shadows-text/40">{label}</span>
          </div>
        ))}
        {viewMode !== "dichotomy" && (
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-[#E0DCE6]" />
            <span className="text-[10px] text-shadows-text/40">Character</span>
          </div>
        )}
        {viewMode === "direct" && (
          <>
            <div className="flex items-center gap-1.5 mt-1">
              <div className="w-4 h-[2px] bg-[#8F00FF]" />
              <span className="text-[10px] text-shadows-text/40">Fewer traits</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-[3px] bg-[#03FF9B]" />
              <span className="text-[10px] text-shadows-text/40">More traits</span>
            </div>
          </>
        )}
        <a
          href="/api/export"
          download="shadows-database.json"
          className="mt-2 flex items-center gap-1.5 text-[10px] text-[#03FF9B]/60 hover:text-[#03FF9B] transition-colors cursor-pointer"
          data-testid="button-download-data"
        >
          <Download className="w-3 h-3" />
          Download open data
        </a>
      </div>

      {hoveredNode && hoveredNode.isCharacter && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 bg-[#0B0626]/90 backdrop-blur-sm border border-[#350A8C]/30 rounded-lg px-4 py-2 pointer-events-none">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-[#E0DCE6]" />
            <span className="text-sm text-shadows-text font-serif">{hoveredNode.label}</span>
          </div>
          {hoveredNode.original?.domain && (
            <p className="text-[10px] text-shadows-text/50 mt-0.5 ml-5">{hoveredNode.original.domain}</p>
          )}
        </div>
      )}

      {hoveredNode && !hoveredNode.isCharacter && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 bg-[#0B0626]/90 backdrop-blur-sm border border-[#350A8C]/30 rounded-lg px-4 py-2 pointer-events-none">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[hoveredNode.category] || "#8F00FF" }} />
            <span className="text-sm text-shadows-text">{hoveredNode.label}</span>
            <span className="text-[10px] text-shadows-text/30">{CATEGORY_LABELS[hoveredNode.category] || hoveredNode.category}</span>
          </div>
        </div>
      )}

      <FilterSidebar
        filters={filters}
        activeFilters={activeFilters}
        onToggleFilter={toggleFilter}
        isOpen={filtersOpen}
        onToggle={() => setFiltersOpen(!filtersOpen)}
        nodeCount={charNodeCount}
        totalCount={data.nodes.length}
        minConnections={minConnections}
        onMinConnectionsChange={setMinConnections}
        allNodes={data.nodes}
        selectedCharacterIds={selectedCharacterIds}
        onToggleCharacter={toggleCharacter}
        onClearCharacters={clearCharacters}
        characterSearch={characterSearch}
        onCharacterSearchChange={setCharacterSearch}
      />

      <div className="absolute inset-0 lg:left-72">
        {viewMode === "network" ? (
          <NetworkView
            filteredGraphNodes={filteredGraphNodes}
            filteredLinks={filteredLinks}
            onSelectNode={(n) => handleGraphNodeSelect(n)}
            onSelectTrait={(t) => handleGraphNodeSelect(null, t)}
            onHoverNode={setHoveredNode}
            hoveredNode={hoveredNode}
            selectedNodeId={selectedNode?.id ?? null}
          />
        ) : viewMode === "direct" ? (
          <DirectView
            charNodes={directNodes}
            directLinks={directLinks}
            onSelectNode={(n) => handleGraphNodeSelect(n)}
            onHoverNode={setHoveredNode}
            selectedNodeId={selectedNode?.id ?? null}
          />
        ) : viewMode === "ca" ? (
          <CorrespondenceView
            figures={data.nodes}
            onSelectNode={(n) => handleGraphNodeSelect(n)}
            onHoverNode={setHoveredNode}
            selectedNodeId={selectedNode?.id ?? null}
          />
        ) : (
          <DichotomyView
            figures={data.nodes}
            dichotomyDepth={dichotomyDepth}
            dichotomyThreshold={dichotomyThreshold}
            onSelectNode={(n) => handleGraphNodeSelect(n)}
            onHoverNode={setHoveredNode}
            selectedNodeId={selectedNode?.id ?? null}
          />
        )}
      </div>

      {selectedNode && (
        <NodePanel
          node={selectedNode}
          relatedNodes={relatedNodes}
          edges={data.edges}
          onClose={() => setSelectedNode(null)}
        />
      )}

      {selectedTrait && (
        <TraitPanel
          trait={selectedTrait}
          allNodes={data.nodes}
          graphLinks={graphLinks}
          onClose={() => setSelectedTrait(null)}
          onSelectCharacter={(char) => handleGraphNodeSelect(char)}
        />
      )}
    </div>
  );
}
