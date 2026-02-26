import { storage } from "./storage";
import { db } from "./storage";
import { nodes } from "@shared/schema";
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
      path.join(process.cwd(), "attached_assets", "mythology-database_1772118861322.json"),
      path.join(process.cwd(), "data", "mythology-database.json"),
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
        birthCircumstances: null,
        deathCircumstances: null,
      }));

      await db.insert(nodes).values(values);
      inserted += batch.length;
    }

    console.log(`Seeded ${inserted} mythology nodes.`);
  } catch (error) {
    console.error("Seed error:", error);
  }
}
