/**
 * Deterministic alias matching against a figure catalog.
 * Faithful port of matching.py.
 */

import type { Entity } from "./catalog.js";
import { normalizedLookup } from "./normalization.js";

/** A matched entity plus the surface alias text that matched. */
export interface EntityMatch {
  entity: Entity;
  alias: string;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Match canonical long names loosely and alternative aliases exactly.
 *
 * Short canonical names and all alternative aliases are case-sensitive. This
 * reduces false positives for Ra, Nut, Pan, Dis, Fortune, Night, and similar
 * strings while canonical names longer than three characters remain
 * case-insensitive.
 */
export class EntityMatcher {
  private insensitive = new Map<string, Array<[Entity, string]>>();
  private sensitive = new Map<string, Array<[Entity, string]>>();
  private insensitivePattern: RegExp | null;
  private sensitivePattern: RegExp | null;

  constructor(entities: Iterable<Entity>) {
    for (const entity of Array.from(entities)) {
      for (const alias of entity.aliases) {
        if (alias.length > 3 && normalizedLookup(alias) === normalizedLookup(entity.name)) {
          const key = normalizedLookup(alias);
          const bucket = this.insensitive.get(key) ?? [];
          bucket.push([entity, alias]);
          this.insensitive.set(key, bucket);
        } else {
          const bucket = this.sensitive.get(alias) ?? [];
          bucket.push([entity, alias]);
          this.sensitive.set(alias, bucket);
        }
      }
    }
    this.insensitivePattern = EntityMatcher.compile(this.insensitive, true);
    this.sensitivePattern = EntityMatcher.compile(this.sensitive, false);
  }

  private static compile(
    aliases: Map<string, Array<[Entity, string]>>,
    ignoreCase: boolean,
  ): RegExp | null {
    if (aliases.size === 0) {
      return null;
    }
    const values: string[] = [];
    for (const bucket of Array.from(aliases.values())) {
      values.push(bucket[0][1]);
    }
    // Sort by length descending (stable) so longer aliases win alternation.
    const sorted = [...values].sort((a, b) => b.length - a.length);
    const alternation = sorted.map(escapeRegex).join("|");
    // Python uses (?<!\w)...(?!\w). JS supports lookbehind in modern engines.
    const flags = "g" + (ignoreCase ? "i" : "");
    return new RegExp(`(?<!\\w)(?:${alternation})(?!\\w)`, flags);
  }

  /** Return matches in the same order/dedup semantics as the Python matcher. */
  find(text: string): EntityMatch[] {
    const found: EntityMatch[] = [];
    const seen = new Set<string>();

    if (this.insensitivePattern) {
      this.insensitivePattern.lastIndex = 0;
      for (const result of Array.from(text.matchAll(this.insensitivePattern))) {
        const surface = result[0];
        const key = normalizedLookup(surface);
        for (const [entity] of this.insensitive.get(key) ?? []) {
          const entityKey = `${entity.name.toLowerCase()}\u0000${entity.tradition.toLowerCase()}`;
          if (!seen.has(entityKey)) {
            seen.add(entityKey);
            found.push({ entity, alias: surface });
          }
        }
      }
    }

    if (this.sensitivePattern) {
      this.sensitivePattern.lastIndex = 0;
      for (const result of Array.from(text.matchAll(this.sensitivePattern))) {
        const surface = result[0];
        for (const [entity, alias] of this.sensitive.get(surface) ?? []) {
          const entityKey = `${entity.name.toLowerCase()}\u0000${entity.tradition.toLowerCase()}`;
          if (!seen.has(entityKey)) {
            seen.add(entityKey);
            found.push({ entity, alias });
          }
        }
      }
    }

    return found;
  }
}
