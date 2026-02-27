import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import { storage, db } from "./storage";
import { seedDatabase } from "./seed";
import { nodes, edges, sources, suggestions, news, publications, projects } from "@shared/schema";

declare module "express-session" {
  interface SessionData {
    isAdmin: boolean;
    isEditor: boolean;
  }
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.session && req.session.isAdmin) {
    next();
  } else {
    res.status(401).json({ message: "Unauthorized" });
  }
}

function requireEditor(req: Request, res: Response, next: NextFunction) {
  if (req.session && (req.session.isEditor || req.session.isAdmin)) {
    next();
  } else {
    res.status(401).json({ message: "Unauthorized" });
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "shadows-dev-secret",
      resave: false,
      saveUninitialized: false,
      cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 },
    })
  );

  await seedDatabase();

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

  app.get("/api/export", requireEditor, async (_req, res) => {
    const allProjects = await storage.getProjects();
    const allNodes = await storage.getNodes();
    const allEdges = await storage.getEdges();
    const newsItems = await storage.getNews();
    const allPublications = await storage.getPublications();
    const allSources = await storage.getSources();
    const allSuggestions = await storage.getSuggestions();
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
    });
  });

  app.post("/api/import", requireEditor, async (req, res) => {
    try {
      const data = req.body;
      if (!data || !data.nodes || !data.edges) {
        return res.status(400).json({ error: "Invalid import file: must contain nodes and edges" });
      }

      const { sql } = await import("drizzle-orm");
      let nodesImported = 0;
      let edgesImported = 0;
      let sourcesImported = 0;

      await db.transaction(async (tx) => {
        await tx.delete(edges);
        await tx.delete(suggestions);
        await tx.delete(sources);
        await tx.delete(nodes);

        if (data.nodes && Array.isArray(data.nodes)) {
          for (const node of data.nodes) {
            await tx.insert(nodes).values(node).onConflictDoNothing();
            nodesImported++;
          }
        }

        if (data.edges && Array.isArray(data.edges)) {
          for (const edge of data.edges) {
            await tx.insert(edges).values(edge).onConflictDoNothing();
            edgesImported++;
          }
        }

        if (data.sources && Array.isArray(data.sources)) {
          for (const source of data.sources) {
            await tx.insert(sources).values(source).onConflictDoNothing();
            sourcesImported++;
          }
        }

        await tx.execute(sql`SELECT setval('nodes_id_seq', GREATEST((SELECT COALESCE(MAX(id), 0) FROM nodes), 1))`);
        await tx.execute(sql`SELECT setval('edges_id_seq', GREATEST((SELECT COALESCE(MAX(id), 0) FROM edges), 1))`);
        await tx.execute(sql`SELECT setval('sources_id_seq', GREATEST((SELECT COALESCE(MAX(id), 0) FROM sources), 1))`);
      });

      res.json({
        success: true,
        imported: { nodes: nodesImported, edges: edgesImported, sources: sourcesImported },
      });
    } catch (err) {
      console.error("Import error:", err);
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
      res.json({ success: true });
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
      res.json({ success: true });
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

  app.get("/api/database/auth-status", (req, res) => {
    res.json({ isEditor: !!(req.session && (req.session.isEditor || req.session.isAdmin)) });
  });

  return httpServer;
}
