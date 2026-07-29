import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { createHmac } from "crypto";
import session from "express-session";
import { storage, db } from "./storage";
import { seedDatabase } from "./seed";
import { registerHunterRoutes } from "./hunterRoutes";
import { nodes, edges, sources, suggestions, news, publications, projects, traitHierarchy, traitHabitat, traitCrossCut } from "@shared/schema";

declare module "express-session" {
  interface SessionData {
    isAdmin: boolean;
    isEditor: boolean;
  }
}

// Deterministic tokens derived from SESSION_SECRET. Used as a fallback to
// cookies because the app is embedded in a cross-site iframe (canvas preview),
// where browsers (Safari, recent Chrome) block third-party cookies entirely —
// so cookie-based sessions can't be relied on. Tokens are sent in the
// `x-editor-token` header and validated here. They survive restarts and need
// no server-side storage.
const SECRET = process.env.SESSION_SECRET || "shadows-dev-secret";
const EDITOR_TOKEN = createHmac("sha256", SECRET).update("editor").digest("hex");
const ADMIN_TOKEN = createHmac("sha256", SECRET).update("admin").digest("hex");

function tokenFrom(req: Request): string {
  return (req.headers["x-editor-token"] as string | undefined) || "";
}

function hasAdmin(req: Request): boolean {
  return !!(req.session && req.session.isAdmin) || tokenFrom(req) === ADMIN_TOKEN;
}

function hasEditor(req: Request): boolean {
  return !!(req.session && (req.session.isEditor || req.session.isAdmin)) ||
    tokenFrom(req) === EDITOR_TOKEN || tokenFrom(req) === ADMIN_TOKEN;
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (hasAdmin(req)) {
    next();
  } else {
    res.status(401).json({ message: "Unauthorized" });
  }
}

function requireEditor(req: Request, res: Response, next: NextFunction) {
  if (hasEditor(req)) {
    next();
  } else {
    res.status(401).json({ message: "Unauthorized" });
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // The app is served over HTTPS behind Replit's proxy and is frequently
  // embedded in an iframe (canvas preview). Cookies must be SameSite=None +
  // Secure to be sent inside a cross-site iframe; trust proxy so the Secure
  // cookie is actually issued when x-forwarded-proto is https.
  app.set("trust proxy", 1);
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "shadows-dev-secret",
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: true,
        sameSite: "none",
        maxAge: 24 * 60 * 60 * 1000,
      },
    })
  );

  await seedDatabase();

  function getBaseUrl(req: Request): string {
    const forwardedProto = (req.headers["x-forwarded-proto"] as string | undefined)?.split(",")[0].trim();
    const forwardedHost = (req.headers["x-forwarded-host"] as string | undefined)?.split(",")[0].trim();
    const proto = forwardedProto || req.protocol || "https";
    const host = forwardedHost || req.get("host") || "localhost";
    return `${proto}://${host}`;
  }

  app.get("/robots.txt", (req, res) => {
    const base = getBaseUrl(req);
    res.type("text/plain").send(
      `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\n\nSitemap: ${base}/sitemap.xml\n`
    );
  });

  app.get("/sitemap.xml", (req, res) => {
    const base = getBaseUrl(req);
    const pages: Array<{ path: string; changefreq: string; priority: string }> = [
      { path: "/", changefreq: "monthly", priority: "1.0" },
      { path: "/about", changefreq: "monthly", priority: "0.8" },
      { path: "/graph", changefreq: "weekly", priority: "0.9" },
      { path: "/database", changefreq: "weekly", priority: "0.9" },
      { path: "/research", changefreq: "monthly", priority: "0.7" },
      { path: "/news", changefreq: "weekly", priority: "0.6" },
      { path: "/team", changefreq: "monthly", priority: "0.6" },
      { path: "/partners", changefreq: "monthly", priority: "0.6" },
    ];
    const urlEntries = pages
      .map(
        (p) =>
          `  <url><loc>${base}${p.path}</loc><changefreq>${p.changefreq}</changefreq><priority>${p.priority}</priority></url>`
      )
      .join("\n");
    res
      .type("application/xml")
      .send(
        `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlEntries}\n</urlset>\n`
      );
  });

  app.get("/api/projects", async (_req, res) => {
    const projects = await storage.getProjects();
    res.json(projects);
  });

  app.get("/api/projects/:slug/graph", async (req, res) => {
    const project = await storage.getProjectBySlug(req.params.slug);
    if (!project) return res.status(404).json({ message: "Project not found" });
    const projectNodes = await storage.getNodesByProject(project.id);
    const projectEdges = await storage.getEdgesByProject(project.id);
    res.json({ project, nodes: projectNodes, edges: projectEdges });
  });

  app.get("/api/download", async (_req, res) => {
    const allNodes = await storage.getNodes();
    const allEdges = await storage.getEdges();
    res.setHeader("Content-Disposition", `attachment; filename=shadows-database.json`);
    res.setHeader("Content-Type", "application/json");
    res.json({
      exportedAt: new Date().toISOString(),
      nodes: allNodes,
      edges: allEdges,
    });
  });

  app.get("/api/export", requireEditor, async (_req, res) => {
    const allProjects = await storage.getProjects();
    const allNodes = await storage.getNodes();
    const allEdges = await storage.getEdges();
    const newsItems = await storage.getNews();
    const allPublications = await storage.getPublications();
    const allSources = await storage.getSources();
    const allSuggestions = await storage.getSuggestions();
    const allTraitHierarchy = await db.select().from(traitHierarchy).orderBy(traitHierarchy.id);
    const allTraitHabitat = await db.select().from(traitHabitat).orderBy(traitHabitat.id);
    const allTraitCrossCut = await db.select().from(traitCrossCut).orderBy(traitCrossCut.id);
    res.setHeader("Content-Disposition", `attachment; filename=shadows-export-${new Date().toISOString().slice(0, 10)}.json`);
    res.setHeader("Content-Type", "application/json");
    res.json({
      exportedAt: new Date().toISOString(),
      projects: allProjects,
      nodes: allNodes,
      edges: allEdges,
      news: newsItems,
      publications: allPublications,
      sources: allSources,
      suggestions: allSuggestions,
      traitHierarchy: allTraitHierarchy,
      traitHabitat: allTraitHabitat,
      traitCrossCut: allTraitCrossCut,
    });
  });

  app.post("/api/import", requireEditor, async (req, res) => {
    try {
      const data = req.body;
      if (!data || !Array.isArray(data.nodes) || !Array.isArray(data.edges)) {
        return res.status(400).json({ error: "Invalid import file: must contain nodes and edges arrays" });
      }

      const { sql } = await import("drizzle-orm");
      const counts = { projects: 0, nodes: 0, edges: 0, sources: 0, suggestions: 0, news: 0, publications: 0 };

      const hasProjects = data.projects && Array.isArray(data.projects);
      const hasNodes = data.nodes && Array.isArray(data.nodes);
      const hasEdges = data.edges && Array.isArray(data.edges);
      const hasSources = data.sources && Array.isArray(data.sources);
      const hasSuggestions = data.suggestions && Array.isArray(data.suggestions);
      const hasNews = data.news && Array.isArray(data.news);
      const hasPublications = data.publications && Array.isArray(data.publications);
      const hasTraitHierarchy = data.traitHierarchy && Array.isArray(data.traitHierarchy);
      const hasTraitHabitat = data.traitHabitat && Array.isArray(data.traitHabitat);
      const hasTraitCrossCut = data.traitCrossCut && Array.isArray(data.traitCrossCut);

      const needDropSuggestionFKs = (hasNodes || hasEdges) && !hasSuggestions;

      const BATCH = 100;
      async function insertBatched(tx: any, table: any, rows: any[]) {
        for (let i = 0; i < rows.length; i += BATCH) {
          await tx.insert(table).values(rows.slice(i, i + BATCH)).onConflictDoNothing();
        }
        return rows.length;
      }

      await db.transaction(async (tx) => {
        if (needDropSuggestionFKs) {
          await tx.execute(sql`ALTER TABLE suggestions DROP CONSTRAINT IF EXISTS suggestions_node_id_nodes_id_fk`);
          await tx.execute(sql`ALTER TABLE suggestions DROP CONSTRAINT IF EXISTS suggestions_suggestion_source_node_id_nodes_id_fk`);
          await tx.execute(sql`ALTER TABLE suggestions DROP CONSTRAINT IF EXISTS suggestions_suggestion_target_node_id_nodes_id_fk`);
          await tx.execute(sql`ALTER TABLE suggestions DROP CONSTRAINT IF EXISTS suggestions_edge_id_edges_id_fk`);
        }

        if (hasSuggestions) await tx.delete(suggestions);
        if (hasEdges) await tx.delete(edges);
        if (hasSources) await tx.delete(sources);
        if (hasNodes) await tx.delete(nodes);
        if (hasPublications) await tx.delete(publications);
        if (hasNews) await tx.delete(news);
        if (hasProjects) await tx.delete(projects);

        if (hasProjects) {
          counts.projects = await insertBatched(tx, projects, data.projects);
        }

        if (hasNodes) {
          counts.nodes = await insertBatched(tx, nodes, data.nodes);
        }

        if (hasEdges) {
          counts.edges = await insertBatched(tx, edges, data.edges);
        }

        if (hasSources) {
          for (const source of data.sources) {
            if (source.createdAt && typeof source.createdAt === 'string') {
              source.createdAt = new Date(source.createdAt);
            }
          }
          counts.sources = await insertBatched(tx, sources, data.sources);
        }

        if (hasSuggestions) {
          for (const suggestion of data.suggestions) {
            if (suggestion.createdAt && typeof suggestion.createdAt === 'string') {
              suggestion.createdAt = new Date(suggestion.createdAt);
            }
          }
          counts.suggestions = await insertBatched(tx, suggestions, data.suggestions);
        }

        if (hasNews) {
          for (const item of data.news) {
            if (item.publishedAt && typeof item.publishedAt === 'string') {
              item.publishedAt = new Date(item.publishedAt);
            }
            if (item.date && typeof item.date === 'string') {
              item.date = new Date(item.date);
            }
          }
          counts.news = await insertBatched(tx, news, data.news);
        }

        if (hasPublications) {
          counts.publications = await insertBatched(tx, publications, data.publications);
        }

        if (hasTraitHierarchy) {
          if (hasTraitHabitat) await tx.delete(traitHabitat);
          await tx.delete(traitHierarchy);
          (counts as any).traitHierarchy = await insertBatched(tx, traitHierarchy, data.traitHierarchy);
        }

        if (hasTraitHabitat) {
          if (!hasTraitHierarchy) await tx.delete(traitHabitat);
          (counts as any).traitHabitat = await insertBatched(tx, traitHabitat, data.traitHabitat);
        }

        if (hasTraitCrossCut) {
          await tx.delete(traitCrossCut);
          (counts as any).traitCrossCut = await insertBatched(tx, traitCrossCut, data.traitCrossCut);
        }

        if (needDropSuggestionFKs) {
          await tx.execute(sql`UPDATE suggestions SET node_id = NULL WHERE node_id IS NOT NULL AND node_id NOT IN (SELECT id FROM nodes)`);
          await tx.execute(sql`UPDATE suggestions SET suggestion_source_node_id = NULL WHERE suggestion_source_node_id IS NOT NULL AND suggestion_source_node_id NOT IN (SELECT id FROM nodes)`);
          await tx.execute(sql`UPDATE suggestions SET suggestion_target_node_id = NULL WHERE suggestion_target_node_id IS NOT NULL AND suggestion_target_node_id NOT IN (SELECT id FROM nodes)`);
          await tx.execute(sql`UPDATE suggestions SET edge_id = NULL WHERE edge_id IS NOT NULL AND edge_id NOT IN (SELECT id FROM edges)`);

          await tx.execute(sql`ALTER TABLE suggestions ADD CONSTRAINT suggestions_node_id_nodes_id_fk FOREIGN KEY (node_id) REFERENCES nodes(id)`);
          await tx.execute(sql`ALTER TABLE suggestions ADD CONSTRAINT suggestions_suggestion_source_node_id_nodes_id_fk FOREIGN KEY (suggestion_source_node_id) REFERENCES nodes(id)`);
          await tx.execute(sql`ALTER TABLE suggestions ADD CONSTRAINT suggestions_suggestion_target_node_id_nodes_id_fk FOREIGN KEY (suggestion_target_node_id) REFERENCES nodes(id)`);
          await tx.execute(sql`ALTER TABLE suggestions ADD CONSTRAINT suggestions_edge_id_edges_id_fk FOREIGN KEY (edge_id) REFERENCES edges(id)`);
        }

        if (hasProjects) await tx.execute(sql`SELECT setval('projects_id_seq', GREATEST((SELECT COALESCE(MAX(id), 0) FROM projects), 1))`);
        if (hasNodes) await tx.execute(sql`SELECT setval('nodes_id_seq', GREATEST((SELECT COALESCE(MAX(id), 0) FROM nodes), 1))`);
        if (hasEdges) await tx.execute(sql`SELECT setval('edges_id_seq', GREATEST((SELECT COALESCE(MAX(id), 0) FROM edges), 1))`);
        if (hasSources) await tx.execute(sql`SELECT setval('sources_id_seq', GREATEST((SELECT COALESCE(MAX(id), 0) FROM sources), 1))`);
        if (hasSuggestions) await tx.execute(sql`SELECT setval('suggestions_id_seq', GREATEST((SELECT COALESCE(MAX(id), 0) FROM suggestions), 1))`);
        if (hasNews) await tx.execute(sql`SELECT setval('news_id_seq', GREATEST((SELECT COALESCE(MAX(id), 0) FROM news), 1))`);
        if (hasPublications) await tx.execute(sql`SELECT setval('publications_id_seq', GREATEST((SELECT COALESCE(MAX(id), 0) FROM publications), 1))`);
        if (hasTraitHierarchy) await tx.execute(sql`SELECT setval('trait_hierarchy_id_seq', GREATEST((SELECT COALESCE(MAX(id), 0) FROM trait_hierarchy), 1))`);
      });

      res.json({ success: true, imported: counts });
    } catch (err) {
      console.error("Import error:", err);
      res.status(500).json({ error: "Import failed: " + (err instanceof Error ? err.message : "Unknown error") });
    }
  });

  app.get("/api/suggestions/export", requireEditor, async (_req, res) => {
    const allSuggestions = await storage.getSuggestions();
    res.setHeader("Content-Disposition", `attachment; filename=shadows-suggestions-${new Date().toISOString().slice(0, 10)}.json`);
    res.setHeader("Content-Type", "application/json");
    res.json({
      exportedAt: new Date().toISOString(),
      suggestions: allSuggestions,
    });
  });

  app.post("/api/suggestions/import", requireEditor, async (req, res) => {
    try {
      const data = req.body;
      if (!data || !data.suggestions || !Array.isArray(data.suggestions)) {
        return res.status(400).json({ error: "Invalid file: must contain a suggestions array" });
      }

      const allNodes = await storage.getNodes();
      const allEdges = await storage.getEdges();
      const nodeIds = new Set(allNodes.map(n => n.id));
      const edgeIds = new Set(allEdges.map(e => e.id));

      let imported = 0;
      let skipped = 0;

      for (const suggestion of data.suggestions) {
        if (suggestion.createdAt && typeof suggestion.createdAt === 'string') {
          suggestion.createdAt = new Date(suggestion.createdAt);
        }

        const nodeIdValid = !suggestion.nodeId || nodeIds.has(suggestion.nodeId);
        const sourceNodeValid = !suggestion.sourceNodeId || nodeIds.has(suggestion.sourceNodeId);
        const targetNodeValid = !suggestion.targetNodeId || nodeIds.has(suggestion.targetNodeId);
        const edgeIdValid = !suggestion.edgeId || edgeIds.has(suggestion.edgeId);

        if (nodeIdValid && sourceNodeValid && targetNodeValid && edgeIdValid) {
          try {
            await db.insert(suggestions).values(suggestion).onConflictDoNothing();
            imported++;
          } catch {
            skipped++;
          }
        } else {
          skipped++;
        }
      }

      res.json({ success: true, imported, skipped });
    } catch (err) {
      console.error("Suggestions import error:", err);
      res.status(500).json({ error: "Import failed: " + (err instanceof Error ? err.message : "Unknown error") });
    }
  });

  app.get("/api/graph", async (_req, res) => {
    const allNodes = await storage.getNodes();
    const allEdges = await storage.getEdges();
    res.json({ nodes: allNodes, edges: allEdges });
  });

  app.get("/api/nodes", async (_req, res) => {
    const allNodes = await storage.getNodes();
    res.json(allNodes);
  });

  app.get("/api/edges", async (_req, res) => {
    const allEdges = await storage.getEdges();
    res.json(allEdges);
  });

  app.get("/api/news", async (_req, res) => {
    const newsItems = await storage.getNews();
    res.json(newsItems);
  });

  app.get("/api/publications", async (_req, res) => {
    const pubs = await storage.getPublications();
    res.json(pubs);
  });

  app.post("/api/admin/login", (req, res) => {
    const { password } = req.body;
    const adminPassword = process.env.SESSION_SECRET || "shadows-admin-2024";
    if (password === adminPassword) {
      req.session.isAdmin = true;
      res.json({ success: true, token: ADMIN_TOKEN });
    } else {
      res.status(401).json({ message: "Invalid password" });
    }
  });

  app.post("/api/admin/logout", (req, res) => {
    req.session.destroy(() => {
      res.json({ success: true });
    });
  });

  app.post("/api/admin/projects", requireAdmin, async (req, res) => {
    try {
      const project = await storage.createProject(req.body);
      res.json(project);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.delete("/api/admin/projects/:id", requireAdmin, async (req, res) => {
    await storage.deleteProject(parseInt(req.params.id));
    res.json({ success: true });
  });

  app.post("/api/admin/nodes", requireAdmin, async (req, res) => {
    try {
      const data = { ...req.body, projectId: parseInt(req.body.projectId) };
      const node = await storage.createNode(data);
      res.json(node);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.patch("/api/admin/nodes/:id", requireAdmin, async (req, res) => {
    try {
      const node = await storage.updateNode(parseInt(req.params.id), req.body);
      res.json(node);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.delete("/api/admin/nodes/:id", requireAdmin, async (req, res) => {
    await storage.deleteNode(parseInt(req.params.id));
    res.json({ success: true });
  });

  app.post("/api/admin/edges", requireAdmin, async (req, res) => {
    try {
      const data = {
        ...req.body,
        projectId: parseInt(req.body.projectId),
        sourceNodeId: parseInt(req.body.sourceNodeId),
        targetNodeId: parseInt(req.body.targetNodeId),
        weight: req.body.weight ? parseInt(req.body.weight) : 1,
      };
      const edge = await storage.createEdge(data);
      res.json(edge);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.delete("/api/admin/edges/:id", requireAdmin, async (req, res) => {
    await storage.deleteEdge(parseInt(req.params.id));
    res.json({ success: true });
  });

  app.post("/api/admin/news", requireAdmin, async (req, res) => {
    try {
      const newsItem = await storage.createNews(req.body);
      res.json(newsItem);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.delete("/api/admin/news/:id", requireAdmin, async (req, res) => {
    await storage.deleteNews(parseInt(req.params.id));
    res.json({ success: true });
  });

  app.post("/api/admin/publications", requireAdmin, async (req, res) => {
    try {
      const pub = await storage.createPublication(req.body);
      res.json(pub);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.delete("/api/admin/publications/:id", requireAdmin, async (req, res) => {
    await storage.deletePublication(parseInt(req.params.id));
    res.json({ success: true });
  });

  app.get("/api/nodes/:id", async (req, res) => {
    const node = await storage.getNodeById(parseInt(req.params.id));
    if (!node) return res.status(404).json({ message: "Node not found" });
    res.json(node);
  });

  app.put("/api/editor/nodes/:id", requireEditor, async (req, res) => {
    try {
      const allowedFields = [
        "tradition", "gender", "domain", "object", "animals",
        "characterTrait", "physicalCharacteristics", "significantEvent",
        "symbolism", "neumannArchetype", "birthCircumstances", "deathCircumstances",
      ];
      const data: Record<string, any> = {};
      for (const key of allowedFields) {
        if (key in req.body) data[key] = req.body[key];
      }
      const node = await storage.updateNode(parseInt(req.params.id), data);
      res.json(node);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.delete("/api/editor/nodes/:id", requireEditor, async (req, res) => {
    await storage.deleteNode(parseInt(req.params.id));
    res.json({ success: true });
  });

  app.put("/api/editor/edges/:id", requireEditor, async (req, res) => {
    try {
      const edge = await storage.updateEdge(parseInt(req.params.id), req.body);
      res.json(edge);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.delete("/api/editor/edges/:id", requireEditor, async (req, res) => {
    await storage.deleteEdge(parseInt(req.params.id));
    res.json({ success: true });
  });

  app.get("/api/suggestions", async (_req, res) => {
    const items = await storage.getSuggestions();
    res.json(items);
  });

  app.post("/api/suggestions", async (req, res) => {
    try {
      const { type, submitterName, source, nodeId, field, currentValue, suggestedValue, sourceNodeId, targetNodeId, relationType, edgeId } = req.body;
      if (!type || !submitterName || !source) {
        return res.status(400).json({ message: "type, submitterName, and source are required" });
      }
      const suggestion = await storage.createSuggestion({
        type,
        submitterName,
        source,
        status: "pending",
        nodeId: nodeId || null,
        field: field || null,
        currentValue: currentValue || null,
        suggestedValue: suggestedValue || null,
        sourceNodeId: sourceNodeId || null,
        targetNodeId: targetNodeId || null,
        relationType: relationType || null,
        edgeId: edgeId || null,
      });
      res.json(suggestion);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.put("/api/editor/suggestions/:id/status", requireEditor, async (req, res) => {
    try {
      const { status } = req.body;
      if (!["approved", "rejected", "pending"].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }
      await storage.updateSuggestionStatus(parseInt(req.params.id), status);
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.delete("/api/editor/suggestions/:id", requireEditor, async (req, res) => {
    await storage.deleteSuggestion(parseInt(req.params.id));
    res.json({ success: true });
  });

  app.get("/api/trait-hierarchy", async (_req, res) => {
    const items = await db.select().from(traitHierarchy).orderBy(traitHierarchy.id);
    res.json(items);
  });

  app.get("/api/trait-habitat", async (_req, res) => {
    const items = await db.select().from(traitHabitat).orderBy(traitHabitat.id);
    res.json(items);
  });

  app.get("/api/trait-cross-cut", async (_req, res) => {
    const items = await db.select().from(traitCrossCut).orderBy(traitCrossCut.id);
    res.json(items);
  });

  app.get("/api/sources", async (_req, res) => {
    const items = await storage.getSources();
    res.json(items);
  });

  app.post("/api/editor/sources", requireEditor, async (req, res) => {
    try {
      const { title, author, url, description } = req.body;
      if (!title) {
        return res.status(400).json({ message: "title is required" });
      }
      const source = await storage.createSource({
        title,
        author: author || null,
        url: url || null,
        description: description || null,
      });
      res.json(source);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.delete("/api/editor/sources/:id", requireEditor, async (req, res) => {
    await storage.deleteSource(parseInt(req.params.id));
    res.json({ success: true });
  });

  app.post("/api/database/login", (req, res) => {
    const { password } = req.body;
    const editorPassword = process.env.DB_EDITOR_PASSWORD || "shadows-editor-2024";
    if (password === editorPassword) {
      req.session.isEditor = true;
      res.json({ success: true, token: EDITOR_TOKEN });
    } else {
      res.status(401).json({ message: "Invalid password" });
    }
  });

  app.post("/api/database/logout", (req, res) => {
    if (req.session) {
      req.session.isEditor = false;
    }
    res.json({ success: true });
  });

  registerHunterRoutes(app, requireEditor);

  app.get("/api/database/auth-status", (req, res) => {
    res.json({
      isEditor: hasEditor(req),
      isAdmin: hasAdmin(req),
    });
  });

  return httpServer;
}
