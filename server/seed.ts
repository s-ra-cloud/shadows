import { storage } from "./storage";
import { db } from "./storage";
import { nodes, edges, suggestions } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import * as fs from "fs";
import * as path from "path";

const TRAIT_MERGES: Array<{ from: string; to: string; suggestionIds: number[] }> = [
  { from: "fangs", to: "fanged", suggestionIds: [69, 105] },
  { from: "four arms", to: "four-armed", suggestionIds: [71, 106] },
  { from: "half-female", to: "half female", suggestionIds: [72, 107] },
  { from: "half-male", to: "half male", suggestionIds: [73, 108] },
  { from: "horns", to: "horned", suggestionIds: [74, 109] },
  { from: "many arms", to: "many-armed", suggestionIds: [76, 112] },
  { from: "beard", to: "bearded", suggestionIds: [65, 93] },
  { from: "beast", to: "beastly", suggestionIds: [94] },
  { from: "multi-headed", to: "multiple heads", suggestionIds: [114] },
  { from: "three-headed", to: "three heads", suggestionIds: [121] },
  { from: "six arms", to: "six-armed", suggestionIds: [118] },
];

async function applyTraitMerges() {
  let totalUpdated = 0;
  for (const merge of TRAIT_MERGES) {
    const matchingNodes = await db.select().from(nodes).where(
      sql`physical_characteristics = ${merge.from}
        OR physical_characteristics LIKE ${merge.from + ", %"}
        OR physical_characteristics LIKE ${"%, " + merge.from}
        OR physical_characteristics LIKE ${"%, " + merge.from + ", %"}`
    );

    for (const node of matchingNodes) {
      const traits = node.physicalCharacteristics!.split(",").map((t: string) => t.trim());
      const idx = traits.indexOf(merge.from);
      if (idx === -1) continue;

      if (traits.includes(merge.to)) {
        traits.splice(idx, 1);
      } else {
        traits[idx] = merge.to;
      }

      await db.update(nodes).set({ physicalCharacteristics: traits.join(", ") }).where(eq(nodes.id, node.id));
      totalUpdated++;
    }

    for (const sid of merge.suggestionIds) {
      await db.update(suggestions).set({ status: "approved" }).where(eq(suggestions.id, sid)).catch(() => {});
    }
  }
  if (totalUpdated > 0) {
    console.log(`Applied trait merges: ${totalUpdated} nodes updated.`);
  }

  await applyTraitMoves();
}

const TRAIT_MOVES: Array<{ nodeId: number; trait: string; fromField: "physicalCharacteristics"; toField: "object" | "characterTrait"; suggestionIds: number[] }> = [
  { nodeId: 4438, trait: "armor", fromField: "physicalCharacteristics", toField: "object", suggestionIds: [91] },
  { nodeId: 4288, trait: "fierce", fromField: "physicalCharacteristics", toField: "characterTrait", suggestionIds: [110] },
  { nodeId: 3977, trait: "fierce", fromField: "physicalCharacteristics", toField: "characterTrait", suggestionIds: [] },
  { nodeId: 4378, trait: "smoking knife", fromField: "physicalCharacteristics", toField: "object", suggestionIds: [119] },
];

async function applyTraitMoves() {
  let totalMoved = 0;
  for (const move of TRAIT_MOVES) {
    const [node] = await db.select().from(nodes).where(eq(nodes.id, move.nodeId));
    if (!node) continue;

    const pcVal = node.physicalCharacteristics || "";
    const pcTraits = pcVal.split(",").map((t: string) => t.trim()).filter(Boolean);
    if (!pcTraits.includes(move.trait)) continue;

    const newPc = pcTraits.filter((t: string) => t !== move.trait).join(", ") || null;

    const toVal = (move.toField === "object" ? node.object : node.characterTrait) || "";
    const toTraits = toVal.split(",").map((t: string) => t.trim()).filter(Boolean);
    if (!toTraits.includes(move.trait)) {
      toTraits.push(move.trait);
    }
    const newTo = toTraits.join(", ");

    const updates: any = { physicalCharacteristics: newPc };
    if (move.toField === "object") updates.object = newTo;
    else updates.characterTrait = newTo;

    await db.update(nodes).set(updates).where(eq(nodes.id, move.nodeId));
    totalMoved++;

    for (const sid of move.suggestionIds) {
      await db.update(suggestions).set({ status: "approved" }).where(eq(suggestions.id, sid)).catch(() => {});
    }
  }
  if (totalMoved > 0) {
    console.log(`Applied trait moves: ${totalMoved} nodes updated.`);
  }

  await applyDirectFixes();
}

const DIRECT_FIXES: Array<{ nodeId: number; updates: Record<string, string | null>; suggestionIds: number[] }> = [
  { nodeId: 3636, updates: { physicalCharacteristics: "bull, human" }, suggestionIds: [95] },
  { nodeId: 4378, updates: { object: "jaguar, arrow, spear, mirror, shield, smoking knife, obsidian knife" }, suggestionIds: [] },
  { nodeId: 4141, updates: { name: "Rekhyt" }, suggestionIds: [63] },
  { nodeId: 4415, updates: { physicalCharacteristics: "bandaged mouth, finger on lips" }, suggestionIds: [] },
];

async function applyDirectFixes() {
  let totalFixed = 0;
  for (const fix of DIRECT_FIXES) {
    const [node] = await db.select().from(nodes).where(eq(nodes.id, fix.nodeId));
    if (!node) continue;

    let needsUpdate = false;
    for (const [key, val] of Object.entries(fix.updates)) {
      if ((node as any)[key] !== val) needsUpdate = true;
    }
    if (!needsUpdate) continue;

    await db.update(nodes).set(fix.updates as any).where(eq(nodes.id, fix.nodeId));
    totalFixed++;

    for (const sid of fix.suggestionIds) {
      await db.update(suggestions).set({ status: "approved" }).where(eq(suggestions.id, sid)).catch(() => {});
    }
  }
  if (totalFixed > 0) {
    console.log(`Applied direct fixes: ${totalFixed} nodes updated.`);
  }
}

export async function seedDatabase() {
  try {
    const existingProjects = await storage.getProjects();
    let project;

    if (existingProjects.length === 0) {
      console.log("Seeding database with project...");
      project = await storage.createProject({
        title: "Comparative Mythological Atlas",
        description: "An interactive network mapping mythological figures across world traditions, positioning them by attribute similarity.",
        slug: "atlas",
      });
      console.log("Project created with id:", project.id);
    } else {
      project = existingProjects[0];
    }

    const existingNodes = await storage.getNodes(project.id);
    if (existingNodes.length > 0) {
      const hasNewFields = existingNodes.some(
        (n) => n.eventTypes || n.birthTypes || n.deathTypes || n.familyRoles
      );
      if (hasNewFields) {
        console.log(`Database already has ${existingNodes.length} nodes with full data, skipping seed.`);
        await applyTraitMerges();
        return;
      }
      console.log(`Database has ${existingNodes.length} nodes but missing new trait fields. Re-seeding...`);
      await db.delete(edges);
      await db.delete(nodes);
      const allProjects = await storage.getProjects();
      for (const p of allProjects) {
        if (p.id !== project.id) {
          await db.delete(edges);
          await db.delete(nodes);
        }
      }
    }

    console.log("Seeding mythology nodes...");

    let data: any;
    const jsonPaths = [
      path.join(process.cwd(), "data", "mythology-database.json"),
      path.join(process.cwd(), "attached_assets", "mythology-database_(2)_1772124184100.json"),
      path.join(process.cwd(), "attached_assets", "mythology-database_(1)_1772119800603.json"),
      path.join(process.cwd(), "attached_assets", "mythology-database_1772118861322.json"),
    ];

    for (const p of jsonPaths) {
      if (fs.existsSync(p)) {
        data = JSON.parse(fs.readFileSync(p, "utf8"));
        console.log(`Loaded data from ${p}`);
        break;
      }
    }

    if (!data) {
      console.log("No mythology JSON data file found, skipping node seed.");
      return;
    }

    const batchSize = 50;
    let inserted = 0;
    const nameToId: Record<string, number> = {};

    for (let i = 0; i < data.nodes.length; i += batchSize) {
      const batch = data.nodes.slice(i, i + batchSize);
      const values = batch.map((n: any) => ({
        projectId: project.id,
        name: n.name,
        tradition: n.tradition || null,
        gender: n.gender || null,
        domain: n.domain || null,
        object: n.object || null,
        animals: n.animals || null,
        characterTrait: n.characterTrait || null,
        physicalCharacteristics: n.physicalCharacteristics || null,
        significantEvent: n.significantEvent || null,
        symbolism: n.symbolism || null,
        neumannArchetype: n.neumannArchetype || null,
        mentionCount: n.mentionCount || null,
        eventTypes: n.eventTypes && n.eventTypes.length > 0 ? n.eventTypes : null,
        birthTypes: n.birthTypes && n.birthTypes.length > 0 ? n.birthTypes : null,
        deathTypes: n.deathTypes && n.deathTypes.length > 0 ? n.deathTypes : null,
        familyRoles: n.familyRoles && n.familyRoles.length > 0 ? n.familyRoles : null,
        birthCircumstances: n.birthCircumstances || null,
        deathCircumstances: n.deathCircumstances || null,
      }));

      const result = await db.insert(nodes).values(values).returning({ id: nodes.id, name: nodes.name });
      result.forEach((r) => { nameToId[r.name] = r.id; });
      inserted += batch.length;
    }

    console.log(`Seeded ${inserted} mythology nodes.`);

    if (data.edges && data.edges.length > 0) {
      let edgesInserted = 0;
      let edgesSkipped = 0;

      const allEdgeIds = data.edges.flatMap((e: any) => [e.sourceNodeId, e.targetNodeId]);
      const oldIdOffset = Math.min(...allEdgeIds);

      const oldIdToNewId: Record<number, number> = {};
      data.nodes.forEach((n: any, i: number) => {
        const oldId = oldIdOffset + i;
        if (nameToId[n.name]) {
          oldIdToNewId[oldId] = nameToId[n.name];
        }
      });

      for (let i = 0; i < data.edges.length; i += batchSize) {
        const batch = data.edges.slice(i, i + batchSize);
        const validEdges: any[] = [];

        for (const e of batch) {
          const sourceId = oldIdToNewId[e.sourceNodeId];
          const targetId = oldIdToNewId[e.targetNodeId];
          if (sourceId && targetId) {
            validEdges.push({
              projectId: project.id,
              sourceNodeId: sourceId,
              targetNodeId: targetId,
              relationType: e.relationType || e.type || null,
              weight: e.weight || 1,
            });
          } else {
            edgesSkipped++;
          }
        }

        if (validEdges.length > 0) {
          await db.insert(edges).values(validEdges);
          edgesInserted += validEdges.length;
        }
      }

      console.log(`Seeded ${edgesInserted} edges (skipped ${edgesSkipped}).`);
    }
  } catch (error) {
    console.error("Seed error:", error);
  }
}
