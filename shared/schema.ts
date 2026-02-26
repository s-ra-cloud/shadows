import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  slug: text("slug").notNull().unique(),
});

export const nodes = pgTable("nodes", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id),
  name: text("name").notNull(),
  tradition: text("tradition"),
  gender: text("gender"),
  domain: text("domain"),
  object: text("object"),
  animals: text("animals"),
  characterTrait: text("character_trait"),
  physicalCharacteristics: text("physical_characteristics"),
  significantEvent: text("significant_event"),
  symbolism: text("symbolism"),
  neumannArchetype: text("neumann_archetype"),
  mentionCount: integer("mention_count"),
  eventTypes: text("event_types").array(),
  birthTypes: text("birth_types").array(),
  deathTypes: text("death_types").array(),
  familyRoles: text("family_roles").array(),
  birthCircumstances: text("birth_circumstances"),
  deathCircumstances: text("death_circumstances"),
});

export const edges = pgTable("edges", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id),
  sourceNodeId: integer("source_node_id").notNull().references(() => nodes.id),
  targetNodeId: integer("target_node_id").notNull().references(() => nodes.id),
  relationType: text("relation_type"),
  weight: integer("weight").default(1),
});

export const news = pgTable("news", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  date: timestamp("date").defaultNow().notNull(),
});

export const publications = pgTable("publications", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  authors: text("authors").notNull(),
  venue: text("venue"),
  abstract: text("abstract"),
  doi: text("doi"),
  pdfUrl: text("pdf_url"),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertProjectSchema = createInsertSchema(projects).omit({ id: true });
export const insertNodeSchema = createInsertSchema(nodes).omit({ id: true });
export const insertEdgeSchema = createInsertSchema(edges).omit({ id: true });
export const insertNewsSchema = createInsertSchema(news).omit({ id: true });
export const insertPublicationSchema = createInsertSchema(publications).omit({ id: true });

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Node = typeof nodes.$inferSelect;
export type InsertNode = z.infer<typeof insertNodeSchema>;
export type Edge = typeof edges.$inferSelect;
export type InsertEdge = z.infer<typeof insertEdgeSchema>;
export type News = typeof news.$inferSelect;
export type InsertNews = z.infer<typeof insertNewsSchema>;
export type Publication = typeof publications.$inferSelect;
export type InsertPublication = z.infer<typeof insertPublicationSchema>;
