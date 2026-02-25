import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import { storage } from "./storage";
import { seedDatabase } from "./seed";

declare module "express-session" {
  interface SessionData {
    isAdmin: boolean;
  }
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.session && req.session.isAdmin) {
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

  app.get("/api/export", async (_req, res) => {
    const projects = await storage.getProjects();
    const allNodes = await storage.getNodes();
    const allEdges = await storage.getEdges();
    const newsItems = await storage.getNews();
    const publications = await storage.getPublications();
    res.setHeader("Content-Disposition", "attachment; filename=shadows-database.json");
    res.setHeader("Content-Type", "application/json");
    res.json({ projects, nodes: allNodes, edges: allEdges, news: newsItems, publications });
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

  return httpServer;
}
