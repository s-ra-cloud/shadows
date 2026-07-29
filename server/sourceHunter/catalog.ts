/**
 * Entity-catalog loading, including SHADOWS export compatibility.
 * Faithful port of catalog.py.
 */

import { promises as fs } from "node:fs";
import * as path from "node:path";
import { normalizeSpace } from "./normalization.js";

/** A religious or mythological figure and its matchable names. */
export interface Entity {
  name: string;
  tradition: string;
  gender: string;
  aliases: string[];
}

// Confirmed noise in the supplied reference corpus. Narrow, auditable exception.
const REJECTED_IMPORTED_ALIAS_PAIRS = new Set<string>(["hera\u0000here"]);

function normalizedGender(value: unknown): string {
  const gender = normalizeSpace(value).toLowerCase();
  return gender || "unknown";
}

function stringAliases(value: unknown): string[] {
  if (typeof value === "string") {
    return value
      .split("|")
      .map((part) => part.trim())
      .filter((part) => part.length > 0);
  }
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string")
      .map((item) => normalizeSpace(item))
      .filter((item) => item.length > 0);
  }
  return [];
}

/** Build an Entity from a mapping accepting several field aliases. */
export function entityFromMapping(item: Record<string, unknown>): Entity {
  const name = normalizeSpace(item.name ?? item.deity);
  if (!name) {
    throw new Error("catalog entity is missing name/deity");
  }
  const tradition = normalizeSpace(item.tradition) || "Unknown";
  const rawAliases = [name];
  rawAliases.push(...stringAliases(item.aliases));
  rawAliases.push(...stringAliases(item.alternativeNames));
  rawAliases.push(...stringAliases(item.alternative_names));
  // dict.fromkeys ordered dedupe on normalized values, dropping empties.
  const seen = new Set<string>();
  const aliases: string[] = [];
  for (const alias of rawAliases) {
    const normalized = normalizeSpace(alias);
    if (!normalized) {
      continue;
    }
    if (!seen.has(normalized)) {
      seen.add(normalized);
      aliases.push(normalized);
    }
  }
  return {
    name,
    tradition,
    gender: normalizedGender(item.gender),
    aliases,
  };
}

/** Read a SHADOWS export, catalog document, or simple list. */
export function entitiesFromDocument(document: unknown): Entity[] {
  let rows: unknown[];
  if (document && typeof document === "object" && !Array.isArray(document)) {
    const obj = document as Record<string, unknown>;
    if (Array.isArray(obj.nodes)) {
      rows = obj.nodes;
    } else if (Array.isArray(obj.entities)) {
      rows = obj.entities;
    } else {
      throw new Error("catalog object must contain nodes or entities");
    }
  } else if (Array.isArray(document)) {
    rows = document;
  } else {
    throw new Error("catalog must be a JSON object or array");
  }

  const entities: Entity[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      continue;
    }
    try {
      entities.push(entityFromMapping(row as Record<string, unknown>));
    } catch {
      continue;
    }
  }
  return mergeEntities(entities);
}

/** Build catalog entities and aliases from compatible resource JSONL text. */
export function entitiesFromJsonlText(text: string, source = "<jsonl>"): Entity[] {
  const grouped = new Map<string, Record<string, unknown> & { aliases: string[] }>();
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.trim()) {
      continue;
    }
    const value = JSON.parse(line);
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error(`${source}:${i + 1}: record is not an object`);
    }
    const record = value as Record<string, unknown>;
    const name = normalizeSpace(record.deity);
    const tradition = normalizeSpace(record.tradition) || "Unknown";
    if (!name) {
      continue;
    }
    const key = `${name.toLowerCase()}\u0000${tradition.toLowerCase()}`;
    let group = grouped.get(key);
    if (!group) {
      group = {
        name,
        tradition,
        gender: record.gender,
        aliases: [],
      };
      grouped.set(key, group);
    }
    const alias = normalizeSpace(record.matched_alias);
    const pair = `${name.toLowerCase()}\u0000${alias.toLowerCase()}`;
    if (alias && !REJECTED_IMPORTED_ALIAS_PAIRS.has(pair)) {
      group.aliases.push(alias);
    }
  }
  return Array.from(grouped.values()).map((item) => entityFromMapping(item));
}

/** Build catalog entities from a JSONL file path. */
export async function entitiesFromJsonl(filePath: string): Promise<Entity[]> {
  const text = await fs.readFile(filePath, "utf-8");
  return entitiesFromJsonlText(text, filePath);
}

/** Merge duplicate name/tradition entries while retaining every alias. */
export function mergeEntities(entities: Iterable<Entity>): Entity[] {
  const grouped = new Map<string, Record<string, unknown> & { aliases: string[] }>();
  const order: string[] = [];
  for (const entity of Array.from(entities)) {
    const key = `${entity.name.toLowerCase()}\u0000${entity.tradition.toLowerCase()}`;
    let group = grouped.get(key);
    if (!group) {
      order.push(key);
      group = {
        name: entity.name,
        tradition: entity.tradition,
        gender: entity.gender,
        aliases: [...entity.aliases],
      };
      grouped.set(key, group);
    } else {
      group.aliases.push(...entity.aliases);
      if (group.gender === "unknown" && entity.gender !== "unknown") {
        group.gender = entity.gender;
      }
    }
  }
  return order.map((key) => entityFromMapping(grouped.get(key)!));
}

/** Load a catalog from a JSON or JSONL file path. */
export async function loadCatalog(filePath: string): Promise<Entity[]> {
  if (path.extname(filePath).toLowerCase() === ".jsonl") {
    return entitiesFromJsonl(filePath);
  }
  const text = await fs.readFile(filePath, "utf-8");
  return entitiesFromDocument(JSON.parse(text));
}

/** Build the serializable catalog document. */
export function catalogDocument(entities: Iterable<Entity>): Record<string, unknown> {
  return {
    schema_version: "1.0.0",
    entities: Array.from(entities, (entity) => ({
      name: entity.name,
      tradition: entity.tradition,
      gender: entity.gender,
      aliases: [...entity.aliases],
    })),
  };
}

/** Write a catalog document to disk (indent=2, trailing newline). */
export async function writeCatalog(filePath: string, entities: Iterable<Entity>): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const doc = catalogDocument(entities);
  await fs.writeFile(filePath, JSON.stringify(doc, null, 2) + "\n", "utf-8");
}
