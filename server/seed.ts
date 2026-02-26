import { storage } from "./storage";
import { db } from "./storage";
import { nodes, edges } from "@shared/schema";
import * as fs from "fs";
import * as path from "path";

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
      console.log(`Database already has ${existingNodes.length} nodes, skipping seed.`);
      return;
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
