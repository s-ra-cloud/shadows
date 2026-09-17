import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, serial, jsonb } from "drizzle-orm/pg-core";
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
  objectProvenance: text("object_provenance"),
  originalDescriptions: jsonb("original_descriptions"),
  sourceAttributions: jsonb("source_attributions").$type<Record<string, string>>(),
  identification: text("identification").array(),
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

export const suggestions = pgTable("suggestions", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(),
  status: text("status").notNull().default("pending"),
  submitterName: text("submitter_name").notNull(),
  source: text("source").notNull(),
  nodeId: integer("node_id").references(() => nodes.id),
  field: text("field"),
  currentValue: text("current_value"),
  suggestedValue: text("suggested_value"),
  sourceNodeId: integer("suggestion_source_node_id").references(() => nodes.id),
  targetNodeId: integer("suggestion_target_node_id").references(() => nodes.id),
  relationType: text("suggestion_relation_type"),
  edgeId: integer("edge_id").references(() => edges.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const traitHierarchy = pgTable("trait_hierarchy", {
  id: serial("id").primaryKey(),
  categoryField: text("category_field").notNull(),
  traitName: text("trait_name").notNull(),
  parentId: integer("parent_id"),
  isLeaf: integer("is_leaf").notNull().default(0),
});

export const traitHabitat = pgTable("trait_habitat", {
  id: serial("id").primaryKey(),
  traitHierarchyId: integer("trait_hierarchy_id").notNull(),
  habitat: text("habitat").notNull(),
});

export const traitCrossCut = pgTable("trait_cross_cut", {
  id: serial("id").primaryKey(),
  crossCutName: text("cross_cut_name").notNull(),
  traitHierarchyId: integer("trait_hierarchy_id"),
  standaloneTrait: text("standalone_trait"),
  categoryField: text("category_field").notNull().default("physical_characteristics"),
});

export const sources = pgTable("sources", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  author: text("author"),
  url: text("url"),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// --- Source Hunter (rights-aware full-text collector) ---
// `data` columns hold snake_case JSON matching the original hunter tool's
// schemas (fulltext-candidate, plan entries, corpus records, etc.).
export const hunterCandidates = pgTable("hunter_candidates", {
  id: serial("id").primaryKey(),
  workId: text("work_id").notNull(),
  editionId: text("edition_id").notNull().unique(),
  data: jsonb("data").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const hunterRuns = pgTable("hunter_runs", {
  id: serial("id").primaryKey(),
  kind: text("kind").notNull(), // plan | download | verify | catalog
  status: text("status").notNull().default("running"), // running | completed | failed
  startedAt: timestamp("started_at").defaultNow().notNull(),
  finishedAt: timestamp("finished_at"),
  result: jsonb("result"),
  error: text("error"),
});

export const hunterCorpusFiles = pgTable("hunter_corpus_files", {
  id: serial("id").primaryKey(),
  workId: text("work_id").notNull(),
  editionId: text("edition_id").notNull(),
  language: text("language"),
  partition: text("partition").notNull(), // public | locked
  path: text("path").notNull().unique(),
  byteCount: integer("byte_count"),
  sha256: text("sha256"),
  record: jsonb("record"),
  // Provenance: the hunter run (cycle/download/retry) that produced this file.
  // Null for files collected before run tracking existed ("unknown run").
  runId: integer("run_id").references(() => hunterRuns.id),
  downloadedAt: timestamp("downloaded_at").defaultNow().notNull(),
});

// Blockers recorded by hunting cycles: anything that stopped the hunter from
// discovering or downloading a text (robots.txt, auth walls, rights locks,
// fetch failures, unregistered sources...). Persist across cycles until an
// editor resolves or dismisses them.
export const hunterBlockers = pgTable("hunter_blockers", {
  id: serial("id").primaryKey(),
  runId: integer("run_id").references(() => hunterRuns.id),
  sourceId: text("source_id"),
  url: text("url"),
  reason: text("reason").notNull(), // robots_disallowed | requires_auth | rights_locked | fetch_failed | unregistered_source | discovery_unsupported | download_not_authorized | invalid_candidate | too_large
  detail: text("detail"),
  workId: text("work_id"),
  editionId: text("edition_id"),
  status: text("status").notNull().default("open"), // open | resolved | dismissed
  // Automatic link repair (Internet Archive today): a download URL confirmed
  // against the source itself, the item's human-facing page, and the outcome
  // of the repair attempt so Manual Fetch never shows an unchecked link.
  resolvedUrl: text("resolved_url"),
  itemUrl: text("item_url"),
  repairState: text("repair_state"), // in_progress | repaired | not_repairable
  repairDetail: text("repair_detail"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// AI primary/secondary screening verdicts persisted across hunting cycles,
// keyed by normalized title. Recurring leads reuse the cached verdict instead
// of paying for another model request.
export const hunterScreenVerdicts = pgTable("hunter_screen_verdicts", {
  id: serial("id").primaryKey(),
  titleKey: text("title_key").notNull().unique(), // normalized title (screenCacheKey)
  title: text("title").notNull(), // original title, for editor auditing
  classification: text("classification").notNull(), // primary | secondary
  justification: text("justification").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Auditable manual rights determinations recorded by editors reviewing
// locked corpus files. Approving a review moves the file to the public
// partition; the review row is the permanent audit record.
export const hunterRightsReviews = pgTable("hunter_rights_reviews", {
  id: serial("id").primaryKey(),
  corpusFileId: integer("corpus_file_id").references(() => hunterCorpusFiles.id),
  workId: text("work_id").notNull(),
  editionId: text("edition_id").notNull(),
  decision: text("decision").notNull(), // approve_public | keep_locked
  determinedStatus: text("determined_status"), // public_domain | open_license (approve only)
  basis: text("basis").notNull(), // editor's stated basis for the determination
  notes: text("notes"),
  previousStatus: text("previous_status"), // rights status before review
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// The daily routine deliberately has one configuration row. Executions and
// proposals are separate audit records so changing the schedule never erases
// what a previous invocation did or what an editor decided.
export const dailyHunterRoutines = pgTable("daily_hunter_routines", {
  id: integer("id").primaryKey(),
  enabled: integer("enabled").notNull().default(0),
  localTime: text("local_time").notNull().default("09:00"),
  timezone: text("timezone").notNull().default("Europe/Paris"),
  recipient: text("recipient").notNull().default("duparclaura.pro@gmail.com"),
  // What the routine hunts: the fixed discovery query ("query") or the
  // checked-in benchmark corpus list ("benchmark", see docs/benchmark-loop.md).
  mode: text("mode").notNull().default("query"),
  // Restrict runs to one local weekday (0 = Sunday … 6 = Saturday); null runs
  // every day. Benchmark runs are long, so weekly is the intended cadence.
  weekday: integer("weekday"),
  // A compare-and-set claim prevents two different calendar-day workers from
  // overlapping when one hunt runs longer than a day.
  activeExecutionId: integer("active_execution_id"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const dailyHunterExecutions = pgTable("daily_hunter_executions", {
  id: serial("id").primaryKey(),
  routineId: integer("routine_id").notNull().references(() => dailyHunterRoutines.id),
  // One local calendar-day execution is allowed, even if a scheduled worker
  // retries after a timeout or a new web process starts.
  executionKey: text("execution_key").notNull().unique(),
  scheduledDate: text("scheduled_date").notNull(),
  timezone: text("timezone").notNull(),
  // Snapshot the authorized report recipient at claim time. Later schedule
  // edits must never redirect a delayed/recovered report.
  recipient: text("recipient").notNull().default("duparclaura.pro@gmail.com"),
  status: text("status").notNull().default("running"), // running | completed | failed | skipped
  hunterRunId: integer("hunter_run_id").references(() => hunterRuns.id),
  review: jsonb("review"),
  emailStatus: text("email_status").notNull().default("pending"), // pending | sending | sent | unknown | skipped
  emailMessageId: text("email_message_id"),
  emailAttemptedAt: timestamp("email_attempted_at"),
  error: text("error"),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  finishedAt: timestamp("finished_at"),
});

export const dailyHunterProposals = pgTable("daily_hunter_proposals", {
  id: serial("id").primaryKey(),
  executionId: integer("execution_id").notNull().references(() => dailyHunterExecutions.id),
  kind: text("kind").notNull().default("engineering_task"), // engineering_task only; never an executable change
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  evidence: jsonb("evidence").notNull(),
  status: text("status").notNull().default("pending"), // pending | approved | rejected
  decisionNote: text("decision_note"),
  decidedAt: timestamp("decided_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
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
export const insertSuggestionSchema = createInsertSchema(suggestions).omit({ id: true, createdAt: true });
export const insertTraitHierarchySchema = createInsertSchema(traitHierarchy).omit({ id: true });
export const insertTraitHabitatSchema = createInsertSchema(traitHabitat).omit({ id: true });
export const insertTraitCrossCutSchema = createInsertSchema(traitCrossCut).omit({ id: true });
export const insertSourceSchema = createInsertSchema(sources).omit({ id: true, createdAt: true });
export const insertHunterCandidateSchema = createInsertSchema(hunterCandidates).omit({ id: true, createdAt: true, updatedAt: true });
export const insertHunterRunSchema = createInsertSchema(hunterRuns).omit({ id: true, startedAt: true });
export const insertHunterCorpusFileSchema = createInsertSchema(hunterCorpusFiles).omit({ id: true, downloadedAt: true });
export const insertHunterBlockerSchema = createInsertSchema(hunterBlockers).omit({ id: true, createdAt: true, updatedAt: true });
export const insertHunterRightsReviewSchema = createInsertSchema(hunterRightsReviews).omit({ id: true, createdAt: true });
export const insertDailyHunterRoutineSchema = createInsertSchema(dailyHunterRoutines).omit({ id: true, updatedAt: true });
export const insertDailyHunterExecutionSchema = createInsertSchema(dailyHunterExecutions).omit({ id: true, startedAt: true, finishedAt: true });
export const insertDailyHunterProposalSchema = createInsertSchema(dailyHunterProposals).omit({ id: true, createdAt: true, decidedAt: true });

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
export type Suggestion = typeof suggestions.$inferSelect;
export type InsertSuggestion = z.infer<typeof insertSuggestionSchema>;
export type TraitHierarchy = typeof traitHierarchy.$inferSelect;
export type InsertTraitHierarchy = z.infer<typeof insertTraitHierarchySchema>;
export type TraitHabitatEntry = typeof traitHabitat.$inferSelect;
export type InsertTraitHabitat = z.infer<typeof insertTraitHabitatSchema>;
export type TraitCrossCut = typeof traitCrossCut.$inferSelect;
export type InsertTraitCrossCut = z.infer<typeof insertTraitCrossCutSchema>;
export type Source = typeof sources.$inferSelect;
export type InsertSource = z.infer<typeof insertSourceSchema>;
export type HunterCandidate = typeof hunterCandidates.$inferSelect;
export type InsertHunterCandidate = z.infer<typeof insertHunterCandidateSchema>;
export type HunterRun = typeof hunterRuns.$inferSelect;
export type InsertHunterRun = z.infer<typeof insertHunterRunSchema>;
export type HunterCorpusFile = typeof hunterCorpusFiles.$inferSelect;
export type InsertHunterCorpusFile = z.infer<typeof insertHunterCorpusFileSchema>;
export type HunterBlocker = typeof hunterBlockers.$inferSelect;
export type InsertHunterBlocker = z.infer<typeof insertHunterBlockerSchema>;
export type HunterRightsReview = typeof hunterRightsReviews.$inferSelect;
export type InsertHunterRightsReview = z.infer<typeof insertHunterRightsReviewSchema>;
export type DailyHunterRoutine = typeof dailyHunterRoutines.$inferSelect;
export type DailyHunterExecution = typeof dailyHunterExecutions.$inferSelect;
export type DailyHunterProposal = typeof dailyHunterProposals.$inferSelect;
