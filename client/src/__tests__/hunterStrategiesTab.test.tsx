/**
 * Strategies tab: renders a row per registered source, marks manual-only
 * sources distinctly, and is visible without edit mode.
 */
import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SourceHunterTab } from "../pages/sources";

function renderStrategies(isEditor: boolean): string {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity, queryFn: async () => null } },
  });
  qc.setQueryData(["/api/hunter/map"], []);
  qc.setQueryData(["/api/hunter/cycles"], []);
  qc.setQueryData(["/api/hunter/blockers"], []);
  qc.setQueryData(["/api/hunter/corpus"], []);
  qc.setQueryData(["/api/hunter/extraction/jobs"], []);
  qc.setQueryData(["/api/hunter/verify/latest"], { run: null, report: null });
  qc.setQueryData(["/api/hunter/policy"], {});
  qc.setQueryData(["/api/hunter/runs"], []);
  qc.setQueryData(["/api/hunter/manual-fetch"], []);
  qc.setQueryData(["/api/hunter/registry"], {
    schema_version: "1.0.0",
    sources: [
      {
        source_id: "source:test-auto",
        name: "Auto Search Source",
        local_only: false,
        allowed_hosts: ["example.org"],
        allowed_path_prefixes: ["/api/"],
        automated_download_allowed: true,
        terms_url: null,
        robots_mode: "target_origin",
        requests_per_second: 0.5,
        rights_notes: "",
        discovery: {
          kind: "api_search",
          searches: "Full-text API search across the example catalogue",
          reason: null,
        },
      },
      {
        source_id: "source:test-manual",
        name: "Manual Only Source",
        local_only: false,
        allowed_hosts: ["manual.example.org"],
        allowed_path_prefixes: [],
        automated_download_allowed: true,
        terms_url: null,
        robots_mode: "target_origin",
        requests_per_second: 0.25,
        rights_notes: "",
        discovery: {
          kind: "manual_only",
          searches: null,
          reason: "Site blocks all automated requests; no machine-readable catalogue exists.",
        },
      },
    ],
  });
  return renderToString(
    <QueryClientProvider client={qc}>
      <SourceHunterTab isEditor={isEditor} initialTab="strategies" />
    </QueryClientProvider>,
  );
}

describe("Source Strategies tab", () => {
  it("renders a row for the automated-discovery source (editor view)", () => {
    const html = renderStrategies(true);
    expect(html).toContain('data-testid="strategies-row-source:test-auto"');
    expect(html).toContain("Auto Search Source");
    expect(html).toContain('data-testid="strategies-badge-auto-source:test-auto"');
    expect(html).toContain("Full-text API search across the example catalogue");
  });

  it("renders a row for the manual-only source with the manual badge (editor view)", () => {
    const html = renderStrategies(true);
    expect(html).toContain('data-testid="strategies-row-source:test-manual"');
    expect(html).toContain("Manual Only Source");
    expect(html).toContain('data-testid="strategies-badge-manual-source:test-manual"');
    expect(html).toContain("Site blocks all automated requests");
  });

  it("is hidden from viewers (edit mode required)", () => {
    const viewer = renderStrategies(false);
    // Strategies tab is editor-only; the tab button must not appear for viewers
    expect(viewer).not.toContain('data-testid="tab-hunter-strategies"');
    // The table itself should not be rendered either
    expect(viewer).not.toContain('data-testid="strategies-table"');
  });

  it("is visible to editors", () => {
    const editor = renderStrategies(true);
    expect(editor).toContain('data-testid="tab-hunter-strategies"');
    expect(editor).toContain('data-testid="strategies-table"');
  });
});
