/**
 * Language and rights prioritization for complete text editions.
 * Faithful port of planning.py.
 */

import type { Candidate, Policy } from "./rights.js";
import { assessRights, type RightsAssessment } from "./rights.js";
import { coerceAssessedAt } from "./dateUtil.js";

/** A planning selection decision for one candidate. */
export interface PlanSelection {
  selected: boolean;
  reason: string;
  rank: number;
}

/** A candidate plan combining rights assessment and selection state. */
export interface CandidatePlan {
  candidate: Candidate;
  rights_assessment: RightsAssessment;
  selection: PlanSelection;
}

const RIGHTS_RANK: Record<string, number> = {
  public_domain: 0,
  open_license: 1,
  public_domain_likely: 2,
  public_domain_jurisdictional: 3,
  restricted_license: 4,
  copyrighted: 5,
  conflicting: 6,
  unknown: 7,
};

function formatRank(candidate: Candidate, policy: Policy): number {
  const formats = policy.preferred_formats as unknown[];
  const index = formats.indexOf(candidate.format);
  return index === -1 ? formats.length : index;
}

/** Composite sort key: [rightsRank, formatRank, edition_id]. */
function candidateSortKey(plan: CandidatePlan, policy: Policy): [number, number, string] {
  const assessment = plan.rights_assessment;
  const rightsRank = RIGHTS_RANK[assessment.status] ?? 8;
  const candidate = plan.candidate;
  return [rightsRank, formatRank(candidate, policy), String(candidate.edition_id)];
}

function compareTuples(a: readonly (number | string)[], b: readonly (number | string)[]): number {
  for (let i = 0; i < Math.min(a.length, b.length); i += 1) {
    if (a[i] < b[i]) return -1;
    if (a[i] > b[i]) return 1;
  }
  return a.length - b.length;
}

/** Return the item with the minimal key, keeping first-seen on ties (like Python min). */
function minBy<T>(items: T[], key: (item: T) => readonly (number | string)[]): T {
  let best = items[0];
  let bestKey = key(best);
  for (let i = 1; i < items.length; i += 1) {
    const candidateKey = key(items[i]);
    if (compareTuples(candidateKey, bestKey) < 0) {
      best = items[i];
      bestKey = candidateKey;
    }
  }
  return best;
}

function mark(plan: CandidatePlan, reason: string, rank: number): void {
  const current = plan.selection;
  if (!current.selected || rank < current.rank) {
    plan.selection = { selected: true, reason, rank };
  }
}

/**
 * Choose English + original, then an AI-translatable open fallback,
 * finally locked research copies. `assessedAt` accepts an ISO string or Date.
 */
export function planCandidates(
  candidates: Iterable<Candidate>,
  policy: Policy,
  options: { assessedAt?: string | Date } = {},
): CandidatePlan[] {
  const assessedAt = coerceAssessedAt(options.assessedAt);
  const plans: CandidatePlan[] = [];
  for (const candidate of Array.from(candidates)) {
    plans.push({
      candidate,
      rights_assessment: assessRights(candidate, policy, { assessedAt }),
      selection: { selected: false, reason: "not_selected", rank: 999 },
    });
  }

  const groups = new Map<string, CandidatePlan[]>();
  for (const plan of plans) {
    const workId = String(plan.candidate.work_id);
    const bucket = groups.get(workId) ?? [];
    bucket.push(plan);
    groups.set(workId, bucket);
  }

  const aiLanguages = policy.ai_translatable_languages as string[];

  for (const workPlans of Array.from(groups.values())) {
    const available = workPlans.filter((plan) => {
      const access = plan.candidate.access as Record<string, unknown>;
      return Boolean(access.download_allowed) && !access.requires_auth;
    });
    const openPlans = available.filter((plan) => plan.rights_assessment.publication_allowed);
    const openEnglish = openPlans.filter(
      (plan) => String(plan.candidate.language).toLowerCase() === "en",
    );
    const openOriginal = openPlans.filter(
      (plan) => plan.candidate.language_role === "original",
    );
    if (openEnglish.length > 0) {
      mark(minBy(openEnglish, (item) => candidateSortKey(item, policy)), "preferred_open_english", 1);
    }
    if (openOriginal.length > 0) {
      mark(minBy(openOriginal, (item) => candidateSortKey(item, policy)), "preferred_open_original", 2);
    }

    if (openEnglish.length === 0) {
      let fallback = openPlans.filter(
        (plan) =>
          aiLanguages.includes(String(plan.candidate.language)) &&
          plan.candidate.language_role !== "original",
      );
      if (fallback.length === 0) {
        fallback = openPlans.filter((plan) =>
          aiLanguages.includes(String(plan.candidate.language)),
        );
      }
      if (fallback.length > 0) {
        const fallbackKey = (item: CandidatePlan): readonly (number | string)[] => {
          const language = String(item.candidate.language);
          return [aiLanguages.indexOf(language), ...candidateSortKey(item, policy)];
        };
        mark(minBy(fallback, fallbackKey), "fallback_open_ai_translatable", 3);
      }
    }

    const locked = available.filter((plan) => !plan.rights_assessment.publication_allowed);
    if (openEnglish.length === 0) {
      const lockedEnglish = locked.filter(
        (plan) => String(plan.candidate.language).toLowerCase() === "en",
      );
      if (lockedEnglish.length > 0) {
        mark(
          minBy(lockedEnglish, (item) => candidateSortKey(item, policy)),
          "locked_english_reference",
          10,
        );
      }
    }
    if (openOriginal.length === 0) {
      const lockedOriginal = locked.filter((plan) => plan.candidate.language_role === "original");
      if (lockedOriginal.length > 0) {
        mark(
          minBy(lockedOriginal, (item) => candidateSortKey(item, policy)),
          "locked_original_reference",
          11,
        );
      }
    }
    if (!workPlans.some((plan) => plan.selection.selected)) {
      if (available.length > 0) {
        mark(
          minBy(available, (item) => candidateSortKey(item, policy)),
          "only_authorized_candidate",
          20,
        );
      }
    }
  }
  return plans;
}
