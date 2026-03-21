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

const DIRECT_FIXES: Array<{ nodeId: number; updates: Record<string, string | string[] | null>; suggestionIds: number[] }> = [
  { nodeId: 3636, updates: { physicalCharacteristics: "bull, human" }, suggestionIds: [95] },
  { nodeId: 4378, updates: { object: "jaguar, arrow, spear, mirror, shield, smoking knife, obsidian knife" }, suggestionIds: [] },
  { nodeId: 4141, updates: { name: "Rekhyt" }, suggestionIds: [63] },
  { nodeId: 4415, updates: { physicalCharacteristics: "bandaged mouth, finger on lips" }, suggestionIds: [] },
  { nodeId: 4402, updates: { domain: "hearth" }, suggestionIds: [3, 10, 33] },
  { nodeId: 3872, updates: { domain: "agriculture, fertility" }, suggestionIds: [19] },
  { nodeId: 4066, updates: { domain: null }, suggestionIds: [23] },
  { nodeId: 3704, updates: { domain: "poverty, need" }, suggestionIds: [28] },
  { nodeId: 3726, updates: { domain: "nature" }, suggestionIds: [29] },
  { nodeId: 3809, updates: { domain: "earth, fire, home, hearth" }, suggestionIds: [52] },
  { nodeId: 4255, updates: { domain: "war, crafts, fertility, agriculture, grain supply" }, suggestionIds: [53, 55] },
  { nodeId: 3432, updates: { domain: "sun, prophecy, music, order, art" }, suggestionIds: [57] },
  { nodeId: 4020, updates: { domain: "wine" }, suggestionIds: [13] },
  { nodeId: 3941, updates: { domain: "creation" }, suggestionIds: [16, 61] },
  { nodeId: 3412, updates: { characterTrait: "fertile, abundant, primal, beautiful" }, suggestionIds: [38] },
  { nodeId: 4352, updates: { domain: "excess, pleasure" }, suggestionIds: [51] },
  { nodeId: 3407, updates: { domain: "wisdom, storm, rebirth, light, sacrifice, souls, creation" }, suggestionIds: [5] },
  { nodeId: 3421, updates: { domain: "war, sun, sacrifice, creation" }, suggestionIds: [5] },
  { nodeId: 4378, updates: { domain: "kingship, night, creation" }, suggestionIds: [5] },
  { nodeId: 3648, updates: { animals: "cicada, horse, bear, dragon" }, suggestionIds: [] },
  { nodeId: 3518, updates: { animals: "horse, rooster, wolf, cattle, serpent, bull, lion, stag, dog, bear, cock, crane, cow, dragon" }, suggestionIds: [] },
  { nodeId: 3656, updates: { animals: "dog, horse, bull, snake" }, suggestionIds: [] },
  { nodeId: 3430, updates: { animals: null }, suggestionIds: [] },
  { nodeId: 3476, updates: { animals: null, physicalCharacteristics: "winged, bird body" }, suggestionIds: [] },
  { nodeId: 3428, updates: { animals: null, deathTypes: ["killed by boar"] }, suggestionIds: [] },
  { nodeId: 3442, updates: { animals: "bull, snake" }, suggestionIds: [] },
  { nodeId: 3472, updates: { animals: null }, suggestionIds: [] },
  { nodeId: 3443, updates: { animals: "serpent tails", physicalCharacteristics: "multiple heads, sea monster, dog heads" }, suggestionIds: [] },
  { nodeId: 4008, updates: { animals: "serpent, horse" }, suggestionIds: [] },
  { nodeId: 3422, updates: { animals: "wings" }, suggestionIds: [] },
  { nodeId: 3411, updates: { animals: "lion" }, suggestionIds: [] },
  { nodeId: 3447, updates: { animals: "lion, tiger" }, suggestionIds: [] },
  { nodeId: 3465, updates: { animals: null, object: "wheel, rudder, cornucopia, chariot, lion" }, suggestionIds: [] },
  { nodeId: 3405, updates: { animals: null }, suggestionIds: [] },
  { nodeId: 4205, updates: { animals: "serpent, snake, bull, deer, bear, cow, tiger, lion" }, suggestionIds: [] },
  { nodeId: 3448, updates: { animals: "owl", physicalCharacteristics: "winged" }, suggestionIds: [] },
  { nodeId: 4233, updates: { animals: "owl" }, suggestionIds: [] },
  { nodeId: 3395, updates: { animals: "pig, sow, snake, dove" }, suggestionIds: [] },
  { nodeId: 3435, updates: { animals: null, object: "magic wand, potions, pigs" }, suggestionIds: [] },
  { nodeId: 3407, updates: { animals: "feathered serpent" }, suggestionIds: [] },
  { nodeId: 4525, updates: { animals: "serpent" }, suggestionIds: [] },
  { nodeId: 3420, updates: { animals: "serpent" }, suggestionIds: [] },
];

const NODES_TO_DELETE = [
  { nodeId: 3840, name: "Chinese gods and immortals", suggestionIds: [4] },
  { nodeId: 4357, name: "Aztec creator gods", suggestionIds: [5] },
  { nodeId: 4407, name: "Dii Consentes", suggestionIds: [6] },
  { nodeId: 4090, name: "Customs of ancient Egypt", suggestionIds: [7] },
  { nodeId: 3397, name: "Kore", suggestionIds: [12] },
];

const NODE_MERGES = [
  {
    targetId: 3425,
    updates: {
      name: "Persephone (Kore)",
      physicalCharacteristics: "young",
      object: "pomegranate, flower",
      characterTrait: "innocent, transformative, maiden, queen",
      significantEvent: "Abduction to underworld; Demeter-Kore mysteries of Eleusis",
      symbolism: "Daughter and partial figure of Demeter; mother-daughter genealogy; relation to corn mother as seed to earth; maiden becoming queen of death",
      neumannArchetype: "Daughter and partial figure of Demeter. The Demeter-Kore relationship represents the mother-daughter unity.",
      birthTypes: ["demigod_birth"],
      familyRoles: ["sister"],
    },
    suggestionIds: [12],
  },
];

const NODES_TO_CREATE = [
  {
    node: {
      projectId: 6, name: "Xipe Totec", tradition: "Aztec", gender: "Male",
      domain: "agriculture, fertility, spring, crafts, creation, death-rebirth",
      physicalCharacteristics: "flayed skin, red-skinned", animals: "quail",
      object: "rattlestick, shield", characterTrait: "life-death-rebirth", mentionCount: 0,
    },
    siblingIds: [3407, 4378, 3421],
    suggestionIds: [5],
  },
  {
    node: {
      projectId: 6, name: "Freyja", tradition: "Norse", gender: "Female",
      domain: "love, beauty, fertility, war, magic, death",
      physicalCharacteristics: "beautiful", animals: "cat, boar, falcon",
      object: "necklace, cloak, chariot", characterTrait: "enchanting, seductive", mentionCount: 0,
    },
    siblingIds: [3699],
    suggestionIds: [],
  },
];

const GENDER_FIXES = [
  { nodeId: 4419, oldGender: "Non-binary", newGender: "Unspecified", suggestionIds: [9] },
];

async function applyNodeDeletions() {
  let totalDeleted = 0;
  for (const del of NODES_TO_DELETE) {
    const [node] = await db.select().from(nodes).where(eq(nodes.id, del.nodeId));
    if (!node) continue;
    await db.delete(edges).where(
      sql`source_node_id = ${del.nodeId} OR target_node_id = ${del.nodeId}`
    );
    await db.delete(nodes).where(eq(nodes.id, del.nodeId));
    totalDeleted++;
    for (const sid of del.suggestionIds) {
      await db.update(suggestions).set({ status: "approved" }).where(eq(suggestions.id, sid)).catch(() => {});
    }
  }
  if (totalDeleted > 0) {
    console.log(`Deleted ${totalDeleted} group/invalid nodes.`);
  }
}

async function applyNodeMerges() {
  for (const merge of NODE_MERGES) {
    const [node] = await db.select().from(nodes).where(eq(nodes.id, merge.targetId));
    if (!node || node.name === merge.updates.name) continue;
    await db.update(nodes).set(merge.updates as any).where(eq(nodes.id, merge.targetId));
    console.log(`Merged node: ${node.name} → ${merge.updates.name}`);
    for (const sid of merge.suggestionIds) {
      await db.update(suggestions).set({ status: "approved" }).where(eq(suggestions.id, sid)).catch(() => {});
    }
  }
}

async function applyNodeCreations() {
  for (const entry of NODES_TO_CREATE) {
    const existing = await db.select().from(nodes).where(eq(nodes.name, entry.node.name));
    if (existing.length > 0) continue;

    const [created] = await db.insert(nodes).values(entry.node as any).returning();
    console.log(`Created node: ${created.name} (id ${created.id})`);

    for (const sibId of entry.siblingIds) {
      const existingEdge = await db.select().from(edges).where(
        sql`(source_node_id = ${created.id} AND target_node_id = ${sibId}) OR (source_node_id = ${sibId} AND target_node_id = ${created.id})`
      );
      if (existingEdge.length === 0) {
        await db.insert(edges).values({ projectId: 6, sourceNodeId: created.id, targetNodeId: sibId, relationType: "sibling_of", weight: 1 });
      }
    }

    for (const sid of entry.suggestionIds) {
      await db.update(suggestions).set({ status: "approved" }).where(eq(suggestions.id, sid)).catch(() => {});
    }
  }
}

async function applyGenderFixes() {
  let totalFixed = 0;
  for (const fix of GENDER_FIXES) {
    const [node] = await db.select().from(nodes).where(eq(nodes.id, fix.nodeId));
    if (!node || node.gender !== fix.oldGender) continue;
    await db.update(nodes).set({ gender: fix.newGender }).where(eq(nodes.id, fix.nodeId));
    totalFixed++;
    for (const sid of fix.suggestionIds) {
      await db.update(suggestions).set({ status: "approved" }).where(eq(suggestions.id, sid)).catch(() => {});
    }
  }
  if (totalFixed > 0) {
    console.log(`Applied gender fixes: ${totalFixed} nodes updated.`);
  }
}

async function applyDomainAdditions() {
  const domainUpdates = [
    { nodeId: 3407, domain: "wisdom, storm, rebirth, light, sacrifice, souls, creation", suggestionIds: [5] },
    { nodeId: 3421, domain: "war, sun, sacrifice, creation", suggestionIds: [5] },
    { nodeId: 4378, domain: "kingship, night, creation", suggestionIds: [5] },
  ];
  let totalUpdated = 0;
  for (const upd of domainUpdates) {
    const [node] = await db.select().from(nodes).where(eq(nodes.id, upd.nodeId));
    if (!node || node.domain === upd.domain) continue;
    await db.update(nodes).set({ domain: upd.domain }).where(eq(nodes.id, upd.nodeId));
    totalUpdated++;
    for (const sid of upd.suggestionIds) {
      await db.update(suggestions).set({ status: "approved" }).where(eq(suggestions.id, sid)).catch(() => {});
    }
  }
  if (totalUpdated > 0) {
    console.log(`Applied domain additions: ${totalUpdated} nodes updated.`);
  }
}

async function applyDeathTypeCleanup() {
  const underscoreMappings = [
    ['betrayed_and_killed', 'betrayed and killed'],
    ['immortality_denied', 'immortality denied'],
    ['killed_by_god', 'killed by god'],
    ['killed_by_hero', 'killed by hero'],
    ['killed_by_kin', 'killed by kin'],
    ['killed_in_battle', 'killed in battle'],
    ['natural_death', 'natural death'],
    ['prophesied_death', 'prophesied death'],
    ['sacrificed_ritually', 'sacrificed ritually'],
    ['transformation_at_death', 'transformation at death'],
  ];
  let totalFixed = 0;
  for (const [old, newVal] of underscoreMappings) {
    const result = await db.execute(sql`UPDATE nodes SET death_types = array_replace(death_types, ${old}, ${newVal}) WHERE ${old} = ANY(death_types)`);
    if (result.rowCount && result.rowCount > 0) totalFixed += result.rowCount;
  }

  const reclassifications = [
    { nodeId: 3910, deathTypes: ['suicide'], suggestionIds: [87] },
    { nodeId: 4013, deathTypes: ['killed by hero', 'prophesied death'], suggestionIds: [87] },
    { nodeId: 3403, deathTypes: ['killed by kin'], suggestionIds: [88] },
    { nodeId: 3758, deathTypes: ['transformation at death'], suggestionIds: [89] },
    { nodeId: 3952, deathTypes: ['killed in battle'], suggestionIds: [90] },
  ];
  for (const rc of reclassifications) {
    const [node] = await db.select().from(nodes).where(eq(nodes.id, rc.nodeId));
    if (!node) continue;
    const currentTypes = node.deathTypes || [];
    if (JSON.stringify(currentTypes.sort()) !== JSON.stringify(rc.deathTypes.sort())) {
      await db.update(nodes).set({ deathTypes: rc.deathTypes }).where(eq(nodes.id, rc.nodeId));
      totalFixed++;
    }
    for (const sid of rc.suggestionIds) {
      await db.update(suggestions).set({ status: "approved" }).where(eq(suggestions.id, sid)).catch(() => {});
    }
  }

  await db.update(edges).set({ relationType: "sibling of" }).where(eq(edges.relationType, "sibling_of")).catch(() => {});

  const rejectIds = [11, 14, 39, 40, 44, 47];
  for (const sid of rejectIds) {
    await db.update(suggestions).set({ status: "rejected" }).where(eq(suggestions.id, sid)).catch(() => {});
  }
  await db.update(suggestions).set({ status: "approved" }).where(eq(suggestions.id, 64)).catch(() => {});

  if (totalFixed > 0) {
    console.log(`Applied death type cleanup: ${totalFixed} updates.`);
  }
}

async function applyDirectFixes() {
  let totalFixed = 0;
  for (const fix of DIRECT_FIXES) {
    const [node] = await db.select().from(nodes).where(eq(nodes.id, fix.nodeId));
    if (!node) continue;

    let needsUpdate = false;
    for (const [key, val] of Object.entries(fix.updates)) {
      const current = (node as any)[key];
      if (Array.isArray(val)) {
        if (!Array.isArray(current) || JSON.stringify(current.sort()) !== JSON.stringify([...val].sort())) needsUpdate = true;
      } else if (current !== val) needsUpdate = true;
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
        await applyNodeDeletions();
        await applyNodeMerges();
        await applyNodeCreations();
        await applyGenderFixes();
        await applyDomainAdditions();
        await applyDeathTypeCleanup();
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
