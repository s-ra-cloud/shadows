import { storage } from "./storage";

export async function seedDatabase() {
  try {
    const existingProjects = await storage.getProjects();
    if (existingProjects.length > 0) return;

    console.log("Seeding database with empty project...");
    await storage.createProject({
      title: "Comparative Mythological Atlas",
      description: "An interactive network mapping mythological figures across world traditions, positioning them by attribute similarity.",
      slug: "atlas",
    });

    console.log("Project created. Run 'npx tsx server/scrape-wikipedia.ts' to populate with Wikipedia data.");
  } catch (error) {
    console.error("Seed error:", error);
  }
}
