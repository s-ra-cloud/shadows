/**
 * Conservative, evidence-backed copyright and reuse assessment.
 * Faithful port of rights.py.
 */

import { coerceAssessedAt, isoFormat } from "./dateUtil.js";

const UNLOCKED_STATUSES = new Set(["public_domain", "open_license"]);

/** Loosely-typed candidate mapping (mirrors Python dicts). */
export type Candidate = Record<string, unknown>;
/** Loosely-typed collection policy mapping. */
export type Policy = Record<string, unknown>;

function joinedRightsText(candidate: Candidate, embeddedNotice: string): string {
  const rights = (candidate.rights as Record<string, unknown>) ?? {};
  const values = [
    rights.statement,
    rights.license,
    rights.license_url,
    rights.rights_url,
    embeddedNotice,
  ];
  return values
    .filter((v) => v)
    .map((v) => String(v))
    .join(" ")
    .toLowerCase();
}

function territoryCovers(territories: string[], targetJurisdiction: string): boolean {
  const normalized = new Set(territories.map((item) => item.toUpperCase()));
  const target = targetJurisdiction.toUpperCase();
  if (normalized.has("WORLDWIDE") || normalized.has(target)) {
    return true;
  }
  return target === "FR" && normalized.has("EU");
}

interface CcAssessment {
  status: string;
  license?: string;
  translation_allowed: boolean;
  obligations: string[];
}

function ccAssessment(text: string): CcAssessment | null {
  if (text.includes("creativecommons.org/publicdomain/zero") || /\bcc0(?:\s|\/|$)/.test(text)) {
    return { status: "public_domain", license: "CC0", translation_allowed: true, obligations: [] };
  }
  if (
    text.includes("creativecommons.org/publicdomain/mark") ||
    text.includes("public domain mark")
  ) {
    return {
      status: "public_domain",
      license: "Public Domain Mark",
      translation_allowed: true,
      obligations: [],
    };
  }
  if (!text.includes("creative commons") && !text.includes("creativecommons.org/licenses/")) {
    return null;
  }
  const noDerivatives =
    text.includes("/by-nd/") ||
    text.includes("/by-nc-nd/") ||
    text.includes("cc by-nd") ||
    text.includes("cc by-nc-nd") ||
    text.includes("no derivatives") ||
    text.includes("noderivatives");
  const noncommercial =
    text.includes("/by-nc") || text.includes("cc by-nc") || text.includes("noncommercial");
  const shareAlike =
    text.includes("/by-sa/") || text.includes("cc by-sa") || text.includes("sharealike");
  if (noDerivatives || noncommercial) {
    const obligations = ["attribution"];
    if (noDerivatives) obligations.push("no_derivatives");
    if (noncommercial) obligations.push("noncommercial_only");
    if (shareAlike) obligations.push("share_alike");
    return {
      status: "restricted_license",
      license: "Creative Commons restricted licence",
      translation_allowed: !noDerivatives,
      obligations,
    };
  }
  if (shareAlike) {
    return {
      status: "open_license",
      license: "CC BY-SA",
      translation_allowed: true,
      obligations: ["attribution", "share_alike"],
    };
  }
  if (text.includes("/by/") || /\bcc by(?:\s|$)/.test(text)) {
    return {
      status: "open_license",
      license: "CC BY",
      translation_allowed: true,
      obligations: ["attribution"],
    };
  }
  return null;
}

interface StandardStatement {
  status: string;
  translation_allowed: boolean;
  obligations: string[];
  territories?: string[];
}

function standardRightsStatement(text: string): StandardStatement | null {
  if (text.includes("rightsstatements.org/vocab/inc")) {
    return {
      status: "copyrighted",
      translation_allowed: false,
      obligations: ["do_not_publish_without_permission"],
    };
  }
  if (
    text.includes("rightsstatements.org/vocab/noc-nc") ||
    text.includes("rightsstatements.org/vocab/noc-oklr") ||
    text.includes("rightsstatements.org/vocab/noc-cr")
  ) {
    return {
      status: "restricted_license",
      translation_allowed: false,
      obligations: ["review_known_restrictions"],
    };
  }
  if (text.includes("rightsstatements.org/vocab/noc-us")) {
    return {
      status: "public_domain_jurisdictional",
      translation_allowed: true,
      obligations: ["public_domain_determination_is_us_only"],
      territories: ["US"],
    };
  }
  return null;
}

interface RightsResultArgs {
  status: string;
  confidence: string;
  basis: string;
  targetJurisdiction: string;
  territories: string[];
  statement: string;
  licenseName: string | null;
  rightsUrl: string | null;
  licenseUrl: string | null;
  translationAllowed: boolean;
  obligations: string[];
  reasons: string[];
  assessedAt: Date;
  unlockLikely: boolean;
}

/** The assessment object; keys and shape match the Python output exactly. */
export interface RightsAssessment {
  status: string;
  confidence: string;
  basis: string;
  target_jurisdiction: string;
  territories: string[];
  territory_covered: boolean;
  statement: string;
  license: string | null;
  rights_url: string | null;
  license_url: string | null;
  publication_allowed: boolean;
  translation_allowed: boolean;
  locked: boolean;
  do_not_publish: boolean;
  review_required: boolean;
  obligations: string[];
  reasons: string[];
  assessed_at: string;
  not_legal_advice: boolean;
}

function result(args: RightsResultArgs): RightsAssessment {
  let territoryCovered = territoryCovers(args.territories, args.targetJurisdiction);
  const explicitlyFree = UNLOCKED_STATUSES.has(args.status);
  const likelyUnlocked = args.status === "public_domain_likely" && args.unlockLikely;
  let publicationAllowed = (explicitlyFree && territoryCovered) || likelyUnlocked;
  if (args.status === "open_license") {
    publicationAllowed = true;
    territoryCovered = true;
  }
  const locked = !publicationAllowed;
  const reviewRequired = args.confidence !== "high" || locked;
  return {
    status: args.status,
    confidence: args.confidence,
    basis: args.basis,
    target_jurisdiction: args.targetJurisdiction,
    territories: args.territories,
    territory_covered: territoryCovered,
    statement: args.statement,
    license: args.licenseName,
    rights_url: args.rightsUrl,
    license_url: args.licenseUrl,
    publication_allowed: publicationAllowed,
    translation_allowed: args.translationAllowed && publicationAllowed,
    locked,
    do_not_publish: locked,
    review_required: reviewRequired,
    obligations: args.obligations,
    reasons: args.reasons,
    assessed_at: isoFormat(args.assessedAt),
    not_legal_advice: true,
  };
}

/**
 * Assess one edition; unknown or jurisdiction-mismatched means locked.
 * `assessedAt` accepts an ISO string or Date (defaults to now).
 */
export function assessRights(
  candidate: Candidate,
  policy: Policy,
  options: { embeddedNotice?: string; assessedAt?: string | Date } = {},
): RightsAssessment {
  const embeddedNotice = options.embeddedNotice ?? "";
  const assessedAt = coerceAssessedAt(options.assessedAt);
  const rights = (candidate.rights as Record<string, unknown>) ?? {};
  const statement = String(rights.statement || "");
  const licenseName = (rights.license as string | null | undefined) ?? null;
  const licenseUrl = (rights.license_url as string | null | undefined) ?? null;
  const rightsUrl = (rights.rights_url as string | null | undefined) ?? null;
  const territories = ((rights.territories as unknown[]) ?? []).map((item) =>
    String(item).toUpperCase(),
  );
  const target = String(policy.target_jurisdiction).toUpperCase();
  const unlockLikely = Boolean(policy.unlock_likely_public_domain);
  const text = joinedRightsText(candidate, embeddedNotice);
  const basis = String(rights.basis || "unknown");
  const claim = String(rights.status_claim || "unknown");

  const cc = ccAssessment(text);
  const strongCopyrightMarker =
    claim === "copyrighted" ||
    text.includes("all rights reserved") ||
    text.includes("posted with permission of the copyright holder") ||
    text.includes("not in the public domain") ||
    text.includes("not public domain");
  if (cc && strongCopyrightMarker) {
    return result({
      status: "conflicting",
      confidence: "low",
      basis,
      targetJurisdiction: target,
      territories,
      statement,
      licenseName,
      rightsUrl,
      licenseUrl,
      translationAllowed: false,
      obligations: ["resolve_conflicting_rights_evidence"],
      reasons: ["open licence marker conflicts with restrictive copyright evidence"],
      assessedAt,
      unlockLikely,
    });
  }
  if (cc) {
    return result({
      status: cc.status,
      confidence: "high",
      basis,
      targetJurisdiction: target,
      territories: ["WORLDWIDE"],
      statement,
      licenseName: licenseName || cc.license || null,
      rightsUrl,
      licenseUrl,
      translationAllowed: cc.translation_allowed,
      obligations: cc.obligations,
      reasons: ["standardized Creative Commons marker"],
      assessedAt,
      unlockLikely,
    });
  }

  const standard = standardRightsStatement(text);
  if (standard) {
    return result({
      status: standard.status,
      confidence: "high",
      basis,
      targetJurisdiction: target,
      territories: standard.territories ?? territories,
      statement,
      licenseName,
      rightsUrl,
      licenseUrl,
      translationAllowed: standard.translation_allowed,
      obligations: standard.obligations,
      reasons: ["standardized RightsStatements.org marker"],
      assessedAt,
      unlockLikely,
    });
  }

  const strongRestriction =
    claim === "copyrighted" ||
    text.includes("all rights reserved") ||
    text.includes("posted with permission of the copyright holder") ||
    text.includes("one of the few individual works restricted by copyright") ||
    text.includes("not in the public domain") ||
    text.includes("not public domain");
  if (strongRestriction) {
    return result({
      status: "copyrighted",
      confidence: "high",
      basis,
      targetJurisdiction: target,
      territories,
      statement,
      licenseName,
      rightsUrl,
      licenseUrl,
      translationAllowed: false,
      obligations: ["do_not_publish_without_permission"],
      reasons: ["explicit copyright restriction"],
      assessedAt,
      unlockLikely,
    });
  }

  const usOnlyMarker =
    text.includes("not restricted by u.s. copyright law") ||
    text.includes("public domain in the united states") ||
    text.includes("not protected by copyright in the united states");
  if (usOnlyMarker) {
    return result({
      status: target === "US" ? "public_domain" : "public_domain_jurisdictional",
      confidence: "high",
      basis,
      targetJurisdiction: target,
      territories: ["US"],
      statement,
      licenseName,
      rightsUrl,
      licenseUrl,
      translationAllowed: true,
      obligations: ["verify_status_outside_the_united_states"],
      reasons: ["explicit United States-only public-domain statement"],
      assessedAt,
      unlockLikely,
    });
  }

  const copyrightMarkers = [
    "all rights reserved",
    "restricted by copyright",
    "protected by copyright",
    "copyrighted work",
    "posted with permission of the copyright holder",
    "not in the public domain",
    "not public domain",
  ];
  if (copyrightMarkers.some((marker) => text.includes(marker))) {
    return result({
      status: "copyrighted",
      confidence: "high",
      basis,
      targetJurisdiction: target,
      territories,
      statement,
      licenseName,
      rightsUrl,
      licenseUrl,
      translationAllowed: false,
      obligations: ["do_not_publish_without_permission"],
      reasons: ["explicit copyright restriction"],
      assessedAt,
      unlockLikely,
    });
  }

  const publicDomainMarker =
    claim === "public_domain" ||
    text.includes("public domain") ||
    text.includes("no known copyright");
  if (publicDomainMarker) {
    const effectiveTerritories = territories.length > 0 ? territories : ["UNSPECIFIED"];
    const status = territoryCovers(effectiveTerritories, target)
      ? "public_domain"
      : "public_domain_jurisdictional";
    return result({
      status,
      confidence: territories.length > 0 ? "high" : "medium",
      basis,
      targetJurisdiction: target,
      territories: effectiveTerritories,
      statement,
      licenseName,
      rightsUrl,
      licenseUrl,
      translationAllowed: true,
      obligations: status === "public_domain" ? [] : ["verify_target_jurisdiction"],
      reasons: ["explicit public-domain claim"],
      assessedAt,
      unlockLikely,
    });
  }

  if (claim === "open_license") {
    return result({
      status: "unknown",
      confidence: "low",
      basis,
      targetJurisdiction: target,
      territories,
      statement,
      licenseName,
      rightsUrl,
      licenseUrl,
      translationAllowed: false,
      obligations: ["identify_exact_open_license"],
      reasons: ["open-license claim lacks a recognized licence marker"],
      assessedAt,
      unlockLikely,
    });
  }

  const deathYear = candidate.copyright_author_death_year;
  const currentYear = Number(policy.current_year);
  if (
    (target === "FR" || target === "EU") &&
    typeof deathYear === "number" &&
    Number.isInteger(deathYear) &&
    deathYear <= currentYear - 71
  ) {
    return result({
      status: "public_domain_likely",
      confidence: "medium",
      basis: "term_heuristic",
      targetJurisdiction: target,
      territories: [target],
      statement,
      licenseName,
      rightsUrl,
      licenseUrl,
      translationAllowed: true,
      obligations: ["human_review_of_authorship_and_term_exceptions"],
      reasons: ["edition copyright author death year exceeds life-plus-70"],
      assessedAt,
      unlockLikely,
    });
  }

  const publicationYear = candidate.publication_year;
  if (
    target === "US" &&
    typeof publicationYear === "number" &&
    Number.isInteger(publicationYear) &&
    publicationYear <= currentYear - 96
  ) {
    return result({
      status: "public_domain_likely",
      confidence: "medium",
      basis: "term_heuristic",
      targetJurisdiction: target,
      territories: ["US"],
      statement,
      licenseName,
      rightsUrl,
      licenseUrl,
      translationAllowed: true,
      obligations: ["human_review_of_us_publication_history"],
      reasons: ["publication date exceeds conservative 95-year term"],
      assessedAt,
      unlockLikely,
    });
  }

  return result({
    status: "unknown",
    confidence: "low",
    basis,
    targetJurisdiction: target,
    territories,
    statement,
    licenseName,
    rightsUrl,
    licenseUrl,
    translationAllowed: false,
    obligations: ["rights_review_required"],
    reasons: ["no conclusive rights evidence"],
    assessedAt,
    unlockLikely,
  });
}

/** Return only boundary text likely to contain an edition rights notice. */
export function extractEmbeddedNotice(payload: Buffer, fileFormat: string): string {
  if (!["txt", "tei_xml", "xml", "html", "json"].includes(fileFormat)) {
    return "";
  }
  let boundary = payload.subarray(0, 65536);
  if (payload.length > 65536) {
    boundary = Buffer.concat([boundary, Buffer.from("\n"), payload.subarray(payload.length - 65536)]);
  }
  return boundary.toString("utf-8");
}
