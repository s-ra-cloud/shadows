/**
 * Regression test: every Source Hunter control that triggers a compute/LLM
 * backend call renders only in edit mode. Renders the hunter tab tree with
 * react-dom/server (no DOM needed) against a pre-seeded query cache and
 * asserts the action buttons are absent for viewers and present for editors.
 */
import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SourceHunterTab } from "../pages/sources";

type HunterTab = React.ComponentProps<typeof SourceHunterTab>["initialTab"];

function renderHunter(tab: NonNullable<HunterTab>, isEditor: boolean): string {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity, queryFn: async () => null } },
  });
  // Seed everything the hunter tabs read so rows (and their per-row action
  // cells) actually render instead of loading states.
  qc.setQueryData(["/api/hunter/map"], []);
  qc.setQueryData(["/api/hunter/cycles"], []);
  qc.setQueryData(["/api/hunter/blockers"], [
    { id: 1, reason: "fetch_failed", detail: "boom", status: "resolved", url: "https://x.test/a" },
  ]);
  qc.setQueryData(["/api/hunter/corpus"], [
    {
      id: 7,
      workId: "work:x",
      editionId: "ed:x",
      language: "en",
      partition: "locked",
      path: "locked/x.txt",
      byteCount: 100,
      runId: null,
      record: { title: "X" },
      readable: null,
    },
  ]);
  qc.setQueryData(["/api/hunter/extraction/jobs"], []);
  qc.setQueryData(["/api/hunter/verify/latest"], { run: null, report: null });
  qc.setQueryData(["/api/hunter/policy"], {});
  qc.setQueryData(["/api/hunter/registry"], {});
  qc.setQueryData(["/api/hunter/runs"], []);
  qc.setQueryData(["/api/hunter/manual-fetch"], []);
  return renderToString(
    <QueryClientProvider client={qc}>
      <SourceHunterTab isEditor={isEditor} initialTab={tab} />
    </QueryClientProvider>,
  );
}

/** [tab, testids of compute/LLM controls that must be edit-mode-only] */
const GATED: Array<[NonNullable<HunterTab>, string[]]> = [
  ["cycles", [
    "button-launch-cycle",
    "button-upload-corpus-list",
    "button-retry-blocker-1",
  ]],
  ["corpus", ["button-download-planned", "button-extract-7", "button-review-rights-7"]],
  ["verify", ["button-verify-corpus"]],
];

describe("hunter compute/LLM buttons are locked to edit mode", () => {
  it.each(GATED)("%s tab hides gated controls for viewers", (tab, testids) => {
    const viewer = renderHunter(tab, false);
    const editor = renderHunter(tab, true);
    for (const id of testids) {
      expect(viewer, `${id} must be hidden for viewers`).not.toContain(`data-testid="${id}"`);
      expect(editor, `${id} must be present for editors`).toContain(`data-testid="${id}"`);
    }
  });

  it("shows edit-mode hints to viewers on tabs that are still visible without edit mode", () => {
    // Corpus and Map are always visible; they show a contextual hint to viewers.
    expect(renderHunter("corpus", false)).toContain('data-testid="hint-corpus-edit-mode"');
    expect(renderHunter("map", false)).toContain("Enter edit mode to launch region cycles");
    // Cycles and Verify are now fully editor-only — no tab button, no content, no hint.
    expect(renderHunter("cycles", false)).not.toContain('data-testid="tab-hunter-cycles"');
    expect(renderHunter("verify", false)).not.toContain('data-testid="tab-hunter-verify"');
  });

  it("hides editor-only tabs from viewers and shows them to editors", () => {
    const viewer = renderHunter("map", false);
    const editor = renderHunter("map", true);
    // These tabs must be invisible to viewers…
    expect(viewer).not.toContain('data-testid="tab-hunter-manual"');
    expect(viewer).not.toContain('data-testid="tab-hunter-catalog"');
    expect(viewer).not.toContain('data-testid="tab-hunter-cycles"');
    expect(viewer).not.toContain('data-testid="tab-hunter-verify"');
    expect(viewer).not.toContain('data-testid="tab-hunter-strategies"');
    // …and visible to editors.
    expect(editor).toContain('data-testid="tab-hunter-manual"');
    expect(editor).toContain('data-testid="tab-hunter-cycles"');
    expect(editor).toContain('data-testid="tab-hunter-strategies"');
    // Map, Corpus, Registry are always visible.
    expect(viewer).toContain('data-testid="tab-hunter-map"');
    expect(viewer).toContain('data-testid="tab-hunter-corpus"');
    expect(viewer).toContain('data-testid="tab-hunter-registry"');
  });
});
