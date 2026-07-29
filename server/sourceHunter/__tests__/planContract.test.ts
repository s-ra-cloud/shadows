/**
 * Contract test: the shape of /api/hunter/plan/latest entries.
 * The Sources page (client/src/pages/sources.tsx, HunterPlan) consumes
 * CandidatePlan objects as { candidate, rights_assessment, selection }.
 * This guards against regressions in the fields the UI reads.
 */
import { describe, expect, it } from "vitest";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { planCandidates } from "../planning";
import { loadPolicy, loadCandidates } from "../fulltextValidation";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const NOW = "2026-07-29T12:00:00+00:00";

describe("plan entry contract (consumed by the Sources UI)", () => {
  it("entries expose candidate / rights_assessment / selection with UI fields", async () => {
    const policy = await loadPolicy(
      path.join(HERE, "..", "data", "config", "collection-policy.json"),
    );
    const candidates = await loadCandidates(
      path.join(HERE, "fulltext-candidates.jsonl"),
    );
    const entries = planCandidates(candidates, policy, { assessedAt: NOW });
    expect(entries.length).toBeGreaterThan(0);
    for (const entry of entries) {
      // Candidate identity fields shown in the plan card header.
      expect(typeof entry.candidate.work_id).toBe("string");
      expect(typeof entry.candidate.edition_id).toBe("string");
      // Rights fields used for the status badge and details.
      const rights = entry.rights_assessment;
      expect(typeof rights.status).toBe("string");
      expect(typeof rights.confidence).toBe("string");
      expect(typeof rights.basis).toBe("string");
      expect(typeof rights.publication_allowed).toBe("boolean");
      expect(typeof rights.locked).toBe("boolean");
      expect(typeof rights.do_not_publish).toBe("boolean");
      expect(Array.isArray(rights.reasons)).toBe(true);
      // Selection fields used for the Selected/Skipped footer.
      expect(typeof entry.selection.selected).toBe("boolean");
      expect(typeof entry.selection.reason).toBe("string");
    }
    // Statuses are rights statuses, never a synthetic "publishable" label.
    const statuses = entries.map((e) => e.rights_assessment.status);
    expect(statuses).not.toContain("publishable");
  });
});
