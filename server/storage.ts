import {
  type User, type InsertUser,
  type Project, type InsertProject,
  type Node, type InsertNode,
  type Edge, type InsertEdge,
  type News, type InsertNews,
  type Publication, type InsertPublication,
  type Suggestion, type InsertSuggestion,
  type Source, type InsertSource,
  users, projects, nodes, edges, news, publications, suggestions, sources,
} from "@shared/schema";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, desc } from "drizzle-orm";
import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool);

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  getProjects(): Promise<Project[]>;
  getProjectBySlug(slug: string): Promise<Project | undefined>;
  createProject(project: InsertProject): Promise<Project>;
  deleteProject(id: number): Promise<void>;

  getNodes(projectId?: number): Promise<Node[]>;
  getNodesByProject(projectId: number): Promise<Node[]>;
  createNode(node: InsertNode): Promise<Node>;
  deleteNode(id: number): Promise<void>;

  getEdges(projectId?: number): Promise<Edge[]>;
  getEdgesByProject(projectId: number): Promise<Edge[]>;
  createEdge(edge: InsertEdge): Promise<Edge>;
  deleteEdge(id: number): Promise<void>;

  getNews(): Promise<News[]>;
  createNews(item: InsertNews): Promise<News>;
  deleteNews(id: number): Promise<void>;

  getPublications(): Promise<Publication[]>;
  createPublication(pub: InsertPublication): Promise<Publication>;
  deletePublication(id: number): Promise<void>;

  getNodeById(id: number): Promise<Node | undefined>;
  updateNode(id: number, data: Partial<InsertNode>): Promise<Node>;

  getSuggestions(): Promise<Suggestion[]>;
  createSuggestion(suggestion: InsertSuggestion): Promise<Suggestion>;
  updateSuggestionStatus(id: number, status: string): Promise<void>;
  deleteSuggestion(id: number): Promise<void>;

  getSources(): Promise<Source[]>;
  createSource(source: InsertSource): Promise<Source>;
  deleteSource(id: number): Promise<void>;

  updateEdge(id: number, data: Partial<InsertEdge>): Promise<Edge>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username));
    return result[0];
  }

  async createUser(user: InsertUser): Promise<User> {
    const result = await db.insert(users).values(user).returning();
    return result[0];
  }

  async getProjects(): Promise<Project[]> {
    return db.select().from(projects);
  }

  async getProjectBySlug(slug: string): Promise<Project | undefined> {
    const result = await db.select().from(projects).where(eq(projects.slug, slug));
    return result[0];
  }

  async createProject(project: InsertProject): Promise<Project> {
    const result = await db.insert(projects).values(project).returning();
    return result[0];
  }

  async deleteProject(id: number): Promise<void> {
    await db.delete(projects).where(eq(projects.id, id));
  }

  async getNodes(projectId?: number): Promise<Node[]> {
    if (projectId) return this.getNodesByProject(projectId);
    return db.select().from(nodes);
  }

  async getNodesByProject(projectId: number): Promise<Node[]> {
    return db.select().from(nodes).where(eq(nodes.projectId, projectId));
  }

  async createNode(node: InsertNode): Promise<Node> {
    const result = await db.insert(nodes).values(node).returning();
    return result[0];
  }

  async deleteNode(id: number): Promise<void> {
    await db.delete(edges).where(eq(edges.sourceNodeId, id));
    await db.delete(edges).where(eq(edges.targetNodeId, id));
    await db.delete(nodes).where(eq(nodes.id, id));
  }

  async getEdges(projectId?: number): Promise<Edge[]> {
    if (projectId) return this.getEdgesByProject(projectId);
    return db.select().from(edges);
  }

  async getEdgesByProject(projectId: number): Promise<Edge[]> {
    return db.select().from(edges).where(eq(edges.projectId, projectId));
  }

  async createEdge(edge: InsertEdge): Promise<Edge> {
    const result = await db.insert(edges).values(edge).returning();
    return result[0];
  }

  async deleteEdge(id: number): Promise<void> {
    await db.delete(edges).where(eq(edges.id, id));
  }

  async getNews(): Promise<News[]> {
    return db.select().from(news).orderBy(desc(news.date));
  }

  async createNews(item: InsertNews): Promise<News> {
    const result = await db.insert(news).values(item).returning();
    return result[0];
  }

  async deleteNews(id: number): Promise<void> {
    await db.delete(news).where(eq(news.id, id));
  }

  async getPublications(): Promise<Publication[]> {
    return db.select().from(publications);
  }

  async createPublication(pub: InsertPublication): Promise<Publication> {
    const result = await db.insert(publications).values(pub).returning();
    return result[0];
  }

  async deletePublication(id: number): Promise<void> {
    await db.delete(publications).where(eq(publications.id, id));
  }

  async getNodeById(id: number): Promise<Node | undefined> {
    const result = await db.select().from(nodes).where(eq(nodes.id, id));
    return result[0];
  }

  async updateNode(id: number, data: Partial<InsertNode>): Promise<Node> {
    const result = await db.update(nodes).set(data).where(eq(nodes.id, id)).returning();
    return result[0];
  }

  async getSuggestions(): Promise<Suggestion[]> {
    return db.select().from(suggestions).orderBy(desc(suggestions.createdAt));
  }

  async createSuggestion(suggestion: InsertSuggestion): Promise<Suggestion> {
    const result = await db.insert(suggestions).values(suggestion).returning();
    return result[0];
  }

  async updateSuggestionStatus(id: number, status: string): Promise<void> {
    await db.update(suggestions).set({ status }).where(eq(suggestions.id, id));
  }

  async deleteSuggestion(id: number): Promise<void> {
    await db.delete(suggestions).where(eq(suggestions.id, id));
  }

  async getSources(): Promise<Source[]> {
    return db.select().from(sources).orderBy(desc(sources.createdAt));
  }

  async createSource(source: InsertSource): Promise<Source> {
    const result = await db.insert(sources).values(source).returning();
    return result[0];
  }

  async deleteSource(id: number): Promise<void> {
    await db.delete(sources).where(eq(sources.id, id));
  }

  async updateEdge(id: number, data: Partial<InsertEdge>): Promise<Edge> {
    const result = await db.update(edges).set(data).where(eq(edges.id, id)).returning();
    return result[0];
  }
}

export const storage = new DatabaseStorage();
