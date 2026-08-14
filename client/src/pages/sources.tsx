import { useState, useEffect, useMemo } from "react";
import { geoNaturalEarth1, geoPath } from "d3";
import { feature } from "topojson-client";
import { HUNTER_REGIONS, type HunterRegion } from "@shared/hunterRegions";
import { TRADITIONS, FAMILIES, familyForTradition } from "@shared/traditions";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient, setEditorToken, authHeaders } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Lock, Unlock, ChevronDown, ChevronRight, Plus, Pencil, Trash2,
  BookOpen, X, Check, AlertCircle, ExternalLink,
  Download, Upload, Play, RefreshCw, FileText, ShieldCheck, ShieldAlert,
  Clock, Database, Code, Globe, ScanLine, Wand2, FileType
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { RunErrorReport } from "@/components/RunErrorReport";

type Tab = "library" | "hunter";
type HunterTab = "map" | "cycles" | "candidates" | "plan" | "corpus" | "extractors" | "verify" | "catalog" | "manual" | "runs" | "policy" | "registry" | "strategies" | "verdicts";

export default function SourcesPage() {
  const [activeTab, setActiveTab] = useState<Tab>("library");
  const [isEditor, setIsEditor] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const { toast } = useToast();

  const { data: authStatus } = useQuery<{ isEditor: boolean; isAdmin: boolean }>({
    queryKey: ["/api/database/auth-status"],
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  const editorMode = isEditor || !!authStatus?.isEditor;

  return (
    <div className="min-h-screen bg-[#0B0626] text-[#E0DCE6]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-20 pb-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1
              className="text-3xl font-bold tracking-wide"
              style={{ fontFamily: "'Cinzel Decorative', serif" }}
              data-testid="text-sources-title"
            >
              Sources
            </h1>
            <p className="text-[#E0DCE6]/60 mt-1 text-sm">
              Primary texts, collections, and rights-aware source management
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (editorMode) {
                  setIsEditor(false);
                  setEditorToken(null);
                  apiRequest("POST", "/api/database/logout").catch(() => {});
                  queryClient.invalidateQueries({ queryKey: ["/api/database/auth-status"] });
                  toast({ title: "Exited edit mode" });
                } else {
                  setShowLoginModal(true);
                }
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                editorMode
                  ? "bg-[#03FF9B]/20 text-[#03FF9B] border border-[#03FF9B]/30"
                  : "bg-[#350A8C]/30 text-[#E0DCE6]/70 border border-[#350A8C]/40 hover:border-[#8F00FF]/50"
              }`}
              data-testid="button-toggle-edit-mode"
            >
              {editorMode ? <Unlock size={16} /> : <Lock size={16} />}
              {editorMode ? "Edit Mode" : "Enter Edit Mode"}
            </button>
          </div>
        </div>

        <div className="flex gap-1 mb-6 border-b border-[#350A8C]/30">
          {[
            { key: "library", label: "Library" },
            { key: "hunter", label: "Source Hunter" }
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as Tab)}
              className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeTab === tab.key
                  ? "border-[#8F00FF] text-[#E0DCE6]"
                  : "border-transparent text-[#E0DCE6]/50 hover:text-[#E0DCE6]/80"
              }`}
              data-testid={`tab-${tab.key}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "library" && <LibraryTab />}
        {activeTab === "hunter" && <SourceHunterTab isEditor={editorMode} />}
      </div>

      {showLoginModal && (
        <LoginModal
          onClose={() => setShowLoginModal(false)}
          onSuccess={() => {
            setIsEditor(true);
            setShowLoginModal(false);
            queryClient.invalidateQueries({ queryKey: ["/api/database/auth-status"] });
          }}
        />
      )}
    </div>
  );
}

interface LibraryEntry {
  id: number;
  workId: string;
  editionId: string;
  language: string | null;
  byteCount: number;
  title: string;
  author: string | null;
  translator: string | null;
  format: string | null;
  tradition: string;
  traditionLabel: string;
  family: string;
  familyLabel: string;
  compositionYear: number | null;
  eraLabel: string | null;
}

function LibraryTab() {
  const { data: entries, isLoading } = useQuery<LibraryEntry[]>({
    queryKey: ["/api/hunter/library"],
  });

  if (isLoading) {
    return <div className="py-12 text-center text-[#E0DCE6]/50 text-sm">Loading the library...</div>;
  }

  const items = Array.isArray(entries) ? entries : [];

  if (items.length === 0) {
    return (
      <div className="py-24 flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 rounded-full bg-[#130D30] border border-[#350A8C]/40 flex items-center justify-center mb-6">
          <BookOpen className="text-[#8F00FF]/50" size={32} />
        </div>
        <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: "'Cinzel Decorative', serif" }}>
          The Library
        </h2>
        <p className="text-[#E0DCE6]/60 max-w-md" data-testid="text-library-empty">
          No rights-cleared texts have been collected yet. Once the Source Hunter downloads
          publishable editions, they will appear here for reading.
        </p>
      </div>
    );
  }

  const sectionMap = new Map<string, LibraryEntry[]>();
  for (const entry of items) {
    const key = entry.tradition || "unclassified";
    const list = sectionMap.get(key) ?? [];
    list.push(entry);
    sectionMap.set(key, list);
  }
  const sections = Array.from(sectionMap.entries())
    .map(([tradition, sectionEntries]) => {
      const info = TRADITIONS[tradition] ?? TRADITIONS.unclassified;
      const familyInfo = FAMILIES[sectionEntries[0]?.family ?? ""] ?? familyForTradition(tradition);
      return {
        tradition,
        label: sectionEntries[0]?.traditionLabel ?? info.label,
        order: info.order,
        family: familyInfo,
        entries: sectionEntries.slice().sort((a, b) => {
          const ay = a.compositionYear ?? Number.POSITIVE_INFINITY;
          const by = b.compositionYear ?? Number.POSITIVE_INFINITY;
          if (ay !== by) return ay - by;
          return a.title.localeCompare(b.title);
        }),
      };
    })
    .sort((a, b) => a.order - b.order);

  const familyMap = new Map<string, { family: (typeof sections)[number]["family"]; sections: typeof sections }>();
  for (const section of sections) {
    let group = familyMap.get(section.family.id);
    if (!group) {
      group = { family: section.family, sections: [] };
      familyMap.set(section.family.id, group);
    }
    group.sections.push(section);
  }
  const familySections = Array.from(familyMap.values()).sort(
    (a, b) => (a.family.order ?? 99) - (b.family.order ?? 99),
  );

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold" style={{ fontFamily: "'Cinzel Decorative', serif" }}>
          The Library
        </h2>
        <p className="text-sm text-[#E0DCE6]/60 mt-1">
          {items.length} rights-cleared {items.length === 1 ? "text" : "texts"} available to read
        </p>
      </div>
      {familySections.map((familySection) => (
        <div key={familySection.family.id} className="mb-12" data-testid={`section-library-family-${familySection.family.id}`}>
          <div className="flex items-baseline gap-2 mb-5 pb-2 border-b border-[#350A8C]/30">
            <h3
              className="text-xl font-bold text-[#E0DCE6]"
              style={{ fontFamily: "'Cinzel Decorative', serif" }}
              data-testid={`text-library-family-${familySection.family.id}`}
            >
              {familySection.family.label}
            </h3>
            <span className="text-xs text-[#E0DCE6]/40">
              {familySection.sections.reduce((n, s) => n + s.entries.length, 0)}{" "}
              {familySection.sections.reduce((n, s) => n + s.entries.length, 0) === 1 ? "text" : "texts"}
            </span>
          </div>
          {familySection.sections.map((section) => (
        <div key={section.tradition} className="mb-10" data-testid={`section-library-${section.tradition}`}>
          <div className="flex items-baseline gap-2 mb-4">
            <h3
              className="text-lg font-semibold text-[#E0DCE6]"
              style={{ fontFamily: "'Cinzel Decorative', serif" }}
              data-testid={`text-library-section-${section.tradition}`}
            >
              {section.label}
            </h3>
            <span className="text-xs text-[#E0DCE6]/40">
              {section.entries.length} {section.entries.length === 1 ? "text" : "texts"}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {section.entries.map((entry) => (
              <a
                key={entry.id}
                href={`/read/${entry.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-left p-5 rounded-xl border border-[#350A8C]/30 bg-[#130D30]/50 hover:border-[#8F00FF]/50 hover:bg-[#130D30] transition-all group"
                data-testid={`card-library-${entry.id}`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <BookOpen size={18} className="text-[#8F00FF]/60 group-hover:text-[#8F00FF] transition-colors shrink-0 mt-0.5" />
                  {entry.language && (
                    <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-[#350A8C]/40 text-[#8F00FF]">
                      {entry.language}
                    </span>
                  )}
                </div>
                <div className="font-medium text-[#E0DCE6] mb-1" data-testid={`text-library-title-${entry.id}`}>
                  {entry.title}
                </div>
                <div className="text-sm text-[#E0DCE6]/60">
                  {entry.author && <span>By {entry.author}</span>}
                  {entry.translator && <span>{entry.author ? " • " : ""}Tr: {entry.translator}</span>}
                  {!entry.author && !entry.translator && <span className="italic text-[#E0DCE6]/40">Anonymous</span>}
                </div>
                <div className="flex items-center justify-between text-xs text-[#E0DCE6]/40 mt-3">
                  <span>{(entry.byteCount / 1024).toFixed(1)} KB</span>
                  {entry.eraLabel && (
                    <span className="text-[#E0DCE6]/50" data-testid={`text-library-era-${entry.id}`}>
                      {entry.eraLabel}
                    </span>
                  )}
                </div>
              </a>
            ))}
          </div>
        </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function SourceHunterTab({ isEditor, initialTab = "map" }: { isEditor: boolean; initialTab?: HunterTab }) {
  const [activeHunterTab, setActiveHunterTab] = useState<HunterTab>(initialTab);

  // editorOnly: true  → tab is hidden unless the user is in edit mode.
  // Do not reset HIDDEN_TABS or editorOnly flags during merges.
  const tabs: { key: HunterTab; label: string; description: string; editorOnly?: boolean }[] = [
    {
      key: "map",
      label: "World Map",
      description:
        "A world map of mythological regions sized by hunting activity. Click any region to see its download history and, as an editor, launch a targeted search for texts from that area.",
    },
    {
      key: "cycles",
      label: "Hunting Cycles",
      editorOnly: true,
      description:
        "Run automated searches that find and download eligible texts from registered sources. Past cycles expand to show what was found, what was blocked, and any issues that need resolving before a retry.",
    },
    {
      key: "candidates",
      label: "Candidates",
      editorOnly: true,
      description:
        "The shortlist of editions being tracked for potential download — title, format, author, language, and rights claim. Editors can add new candidates, edit existing ones, or remove entries that are no longer relevant.",
    },
    {
      key: "plan",
      label: "Download Plan",
      editorOnly: true,
      description:
        "An automated rights-and-suitability assessment of every candidate: which will be downloaded, which are skipped, and the reasons why. Editors can re-run the assessment after updating candidates or policy.",
    },
    {
      key: "corpus",
      label: "Corpus",
      description:
        "All downloaded raw files — public (rights-cleared) or locked (under review) — with provenance, size, and extraction status. Editors can trigger downloads, extract a clean readable version, stop a running extraction, and review rights for locked files.",
    },
    {
      key: "extractors",
      label: "Extractors",
      editorOnly: true,
      description:
        "The six extraction recipes that turn raw downloads into clean, readable Markdown. Each recipe targets a different file type or source shape. Editors choose a recipe per corpus file; the auto-detect picks the most likely one.",
    },
    {
      key: "verify",
      label: "Verification",
      editorOnly: true,
      description:
        "Checks that every corpus file is exactly as it was downloaded, with no accidental modifications. Shows the last verification timestamp and flags any anomalies. Editors can run a fresh check at any time.",
    },
    {
      key: "catalog",
      label: "Catalog Builder",
      editorOnly: true,
      description:
        "Import candidate metadata in bulk from an external catalog feed (XML or JSON). Paste or point to a feed URL and the builder parses it into candidate records ready to review and add.",
    },
    {
      key: "manual",
      label: "Manual Fetch",
      editorOnly: true,
      description:
        "Texts the hunter cannot download automatically — the source's robots.txt forbids it, the site is marked manual-only, or a login is required. Open each source page yourself, save the text, and upload it here; every upload still goes through the normal rights review.",
    },
    {
      key: "runs",
      label: "Runs History",
      editorOnly: true,
      description:
        "A timestamped log of every background operation — hunting cycles, downloads, extraction jobs — with status and duration. Click any run for a full breakdown of files produced and blockers raised.",
    },
    {
      key: "policy",
      label: "Policy",
      editorOnly: true,
      description:
        "The JSON ruleset that governs what the hunter considers eligible to assess and download: rights requirements, format preferences, and exclusion rules. Editors can update the policy and save it.",
    },
    {
      key: "registry",
      label: "Source Registry",
      description:
        "The list of trusted websites the hunter is allowed to download from, with per-site rate limits, allowed URL path prefixes, and rights notes. Editors can add or edit entries as raw JSON.",
    },
    {
      key: "strategies",
      label: "Source Strategies",
      editorOnly: true,
      description:
        "Which sources the hunter can search automatically and which require manual candidate entry. Each row shows the discovery method, download permission, robots handling, and request rate for one registered source.",
    },
    {
      key: "verdicts",
      label: "AI Verdicts",
      editorOnly: true,
      description:
        "Cached AI primary/secondary screening verdicts. When a cycle decides a title is secondary literature it stores the verdict here so future cycles skip the model call. Delete or flip any entry that was wrong — the next cycle will honour the correction.",
    },
  ];

  // Tabs deliberately hidden from the UI regardless of edit mode (workflows not
  // ready). Do not reset this list during merges.
  const HIDDEN_TABS: HunterTab[] = ["candidates", "plan", "catalog"];

  const visibleTabs = tabs.filter(
    (tab) => !HIDDEN_TABS.includes(tab.key) && (!tab.editorOnly || isEditor),
  );

  useEffect(() => {
    const stillVisible = visibleTabs.some((t) => t.key === activeHunterTab);
    if (!stillVisible) setActiveHunterTab("map");
  }, [isEditor, activeHunterTab]);

  return (
    <div className="bg-[#130D30]/50 border border-[#350A8C]/20 rounded-xl overflow-hidden">
      <div className="flex gap-1 border-b border-[#350A8C]/30 overflow-x-auto px-4 pt-2">
        {visibleTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveHunterTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap ${
              activeHunterTab === tab.key
                ? "border-[#03FF9B] text-[#03FF9B]"
                : "border-transparent text-[#E0DCE6]/50 hover:text-[#E0DCE6]/80"
            }`}
            data-testid={`tab-hunter-${tab.key}`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {(() => {
        const active = visibleTabs.find((t) => t.key === activeHunterTab);
        return active ? (
          <p className="px-6 py-2.5 text-xs text-[#E0DCE6]/45 border-b border-[#350A8C]/20 bg-[#0B0626]/20 leading-relaxed">
            {active.description}
          </p>
        ) : null;
      })()}
      <div className="p-6">
        {activeHunterTab === "map" && <HunterWorldMap isEditor={isEditor} />}
        {activeHunterTab === "cycles" && isEditor && <HunterCycles isEditor={isEditor} />}
        {activeHunterTab === "candidates" && isEditor && <HunterCandidates isEditor={isEditor} />}
        {activeHunterTab === "plan" && isEditor && <HunterPlan isEditor={isEditor} />}
        {activeHunterTab === "corpus" && <HunterCorpus isEditor={isEditor} />}
        {activeHunterTab === "extractors" && isEditor && <HunterExtractors />}
        {activeHunterTab === "verify" && isEditor && <HunterVerify isEditor={isEditor} />}
        {activeHunterTab === "catalog" && isEditor && <HunterCatalog />}
        {activeHunterTab === "manual" && isEditor && <HunterManualFetch />}
        {activeHunterTab === "runs" && isEditor && <HunterRuns />}
        {activeHunterTab === "policy" && isEditor && <HunterPolicy isEditor={isEditor} />}
        {activeHunterTab === "registry" && <HunterRegistry isEditor={isEditor} />}
        {activeHunterTab === "strategies" && isEditor && <HunterStrategies />}
        {activeHunterTab === "verdicts" && isEditor && <HunterScreenVerdicts isEditor={isEditor} />}
      </div>
    </div>
  );
}

// --- Source Hunter Sub-components ---

/** Per-file failures from the automatic post-download readable extraction. */
function AutoExtractionFailures({ failures }: { failures?: { edition_id: string; error: string }[] }) {
  if (!Array.isArray(failures) || failures.length === 0) return null;
  return (
    <div
      className="text-xs border border-orange-400/30 bg-orange-400/5 rounded-lg p-3 space-y-2"
      data-testid="text-auto-extract-failures"
    >
      <div className="text-orange-400 flex items-center gap-1.5 font-medium">
        <AlertCircle size={12} /> Automatic extraction could not start for {failures.length}{" "}
        {failures.length === 1 ? "file" : "files"}
      </div>
      <ul className="space-y-2">
        {failures.map((f, i) => (
          <li key={i} className="space-y-1">
            <span className="font-mono text-[#E0DCE6]/60">{f.edition_id}</span>
            <RunErrorReport error={f.error} testId={`text-auto-extract-failure-${i}`} />
          </li>
        ))}
      </ul>
      <div className="text-[#E0DCE6]/40">
        You can retry from the Corpus tab with "Extract readable text".
      </div>
    </div>
  );
}

const BLOCKER_REASON_LABELS: Record<string, string> = {
  robots_disallowed: "Blocked by robots.txt",
  requires_auth: "Login / auth required",
  rights_locked: "Rights locked (not publishable)",
  fetch_failed: "Fetch failed",
  unregistered_source: "Host not in trusted registry",
  discovery_unsupported: "No discovery strategy yet",
  download_not_authorized: "Automated download not authorized",
  invalid_candidate: "Invalid candidate data",
  secondary_source: "Secondary source (not an original text)",
  too_large: "File exceeds size limit",
};

interface RegionStats {
  cycles: number;
  successes: number; // texts downloaded (public or locked)
  failures: number; // metadata_only + failed download attempts
  failedRuns: number;
  texts: number; // downloaded corpus texts attributed to this region
}

function successColor(rate: number | null): string {
  if (rate === null) return "#8F00FF";
  if (rate >= 0.66) return "#03FF9B";
  if (rate >= 0.33) return "#FFB020";
  return "#FF4D6D";
}

function HunterWorldMap({ isEditor }: { isEditor: boolean }) {
  const [world, setWorld] = useState<any>(null);
  const [selected, setSelected] = useState<HunterRegion | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(10);
  const [useAi, setUseAi] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetch("/countries-110m.json")
      .then((r) => r.json())
      .then(setWorld)
      .catch(() => setWorld(null));
  }, []);

  const { data: mapData } = useQuery<any>({
    queryKey: ["/api/hunter/map"],
    refetchInterval: (q) => {
      const d: any = q.state.data;
      const runs = Array.isArray(d) ? d : d?.runs;
      return Array.isArray(runs) && runs.some((r: any) => r.status === "running") ? 2000 : false;
    },
  });
  // The endpoint returns { runs, region_texts }; tolerate the older bare
  // array shape so a stale client/server mix never blanks the map.
  const cycles: any[] = Array.isArray(mapData) ? mapData : (mapData?.runs ?? []);
  const regionTexts: Record<string, number> = Array.isArray(mapData)
    ? {}
    : (mapData?.region_texts ?? {});
  const running = cycles.some((r) => r.status === "running");

  const statsByRegion = useMemo(() => {
    const map = new Map<string, RegionStats>();
    const emptyStats = (): RegionStats => ({
      cycles: 0,
      successes: 0,
      failures: 0,
      failedRuns: 0,
      texts: 0,
    });
    for (const run of cycles) {
      const result = run.result ?? {};
      // Region is stored under result.scope (seeded at creation) for all runs.
      // Fall back to progress.region for any legacy rows written before this fix.
      const regionId = result.scope?.region?.id ?? result.progress?.region?.id;
      if (!regionId) continue;
      const stats = map.get(regionId) ?? emptyStats();
      stats.cycles += 1;
      if (run.status === "failed") stats.failedRuns += 1;
      // Aggregate download/failure counters when available (completed runs).
      stats.successes += (result.downloaded_public ?? 0) + (result.downloaded_locked ?? 0);
      stats.failures += (result.metadata_only ?? 0) + (result.failed ?? 0) + (result.invalid ?? 0);
      map.set(regionId, stats);
    }
    // Downloaded corpus texts count toward the map even when their run had no
    // region (the server attributes them per region for us).
    for (const [regionId, count] of Object.entries(regionTexts)) {
      const stats = map.get(regionId) ?? emptyStats();
      stats.texts += count;
      map.set(regionId, stats);
    }
    return map;
  }, [cycles, regionTexts]);

  const width = 960;
  const height = 480;
  const { countriesPath, project } = useMemo(() => {
    const projection = geoNaturalEarth1().fitSize([width, height], { type: "Sphere" } as any);
    const pathGen = geoPath(projection);
    let countries: string | null = null;
    if (world?.objects?.countries) {
      const geo = feature(world, world.objects.countries) as any;
      countries = pathGen(geo);
    }
    return {
      countriesPath: countries,
      project: (coords: [number, number]) => projection(coords) as [number, number] | null,
    };
  }, [world]);

  const launchMutation = useMutation({
    mutationFn: (region: HunterRegion) =>
      apiRequest("POST", "/api/hunter/cycles", {
        query: query.trim(),
        limit,
        use_ai: useAi,
        region_id: region.id,
      }),
    onSuccess: (_d, region) => {
      toast({ title: `Hunting cycle launched for ${region.label}` });
      queryClient.invalidateQueries({ queryKey: ["/api/hunter/cycles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hunter/map"] });
    },
    onError: (e: Error) =>
      toast({ title: "Could not launch cycle", description: e.message, variant: "destructive" }),
  });

  const selectedStats = selected ? statsByRegion.get(selected.id) : undefined;
  const selectedRate =
    selectedStats && selectedStats.successes + selectedStats.failures > 0
      ? selectedStats.successes / (selectedStats.successes + selectedStats.failures)
      : null;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-[#E0DCE6] mb-1">Hunting World Map</h3>
        <p className="text-sm text-[#E0DCE6]/60">
          Each marker is a mythological region. Size shows how many cycles have hunted there;
          color shows the download success rate. {isEditor ? "Click a region to launch a cycle scoped to it." : "Enter edit mode to launch region cycles."}
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1 rounded-xl border border-[#350A8C]/30 bg-[#0B0626]/50 overflow-hidden">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto block" data-testid="svg-hunter-map">
            <rect width={width} height={height} fill="#0B0626" />
            {countriesPath ? (
              <path d={countriesPath} fill="#130D30" stroke="#350A8C" strokeOpacity={0.45} strokeWidth={0.5} />
            ) : (
              <text x={width / 2} y={height / 2} textAnchor="middle" fill="#E0DCE6" opacity={0.4} fontSize={14}>
                Loading map...
              </text>
            )}
            {HUNTER_REGIONS.map((region) => {
              const pos = project(region.coordinates);
              if (!pos) return null;
              const stats = statsByRegion.get(region.id);
              const attempts = (stats?.successes ?? 0) + (stats?.failures ?? 0);
              const rate = stats && attempts > 0 ? stats.successes / attempts : null;
              // Size reflects cycles and (more gently) downloaded texts, so
              // regions with library texts but no tracked cycles still show.
              const r = 5 + Math.min(10, (stats?.cycles ?? 0) * 2.5 + (stats?.texts ?? 0) * 0.5);
              const isActive = selected?.id === region.id || hovered === region.id;
              return (
                <g
                  key={region.id}
                  transform={`translate(${pos[0]},${pos[1]})`}
                  onClick={() => setSelected(region)}
                  onMouseEnter={() => setHovered(region.id)}
                  onMouseLeave={() => setHovered(null)}
                  style={{ cursor: "pointer" }}
                  data-testid={`marker-region-${region.id}`}
                >
                  <circle r={r + 6} fill={successColor(rate)} opacity={isActive ? 0.25 : 0.1} />
                  <circle
                    r={r}
                    fill={stats ? successColor(rate) : "#350A8C"}
                    opacity={stats ? 0.9 : 0.7}
                    stroke={isActive ? "#E0DCE6" : "#0B0626"}
                    strokeWidth={1.2}
                  />
                  {stats && (
                    <text y={4} textAnchor="middle" fontSize={10} fontWeight={700} fill="#0B0626">
                      {stats.cycles > 0 ? stats.cycles : stats.texts}
                    </text>
                  )}
                  {isActive && (
                    <text y={-r - 10} textAnchor="middle" fontSize={12} fill="#E0DCE6">
                      {region.label}
                      {rate !== null ? ` · ${Math.round(rate * 100)}% success` : ""}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
          <div className="flex items-center gap-4 px-4 py-2 border-t border-[#350A8C]/20 text-[11px] text-[#E0DCE6]/50">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#03FF9B]" /> ≥66% success</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#FFB020]" /> 33–66%</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#FF4D6D]" /> &lt;33%</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#350A8C]" /> not hunted yet</span>
            <span className="ml-auto">success = texts downloaded / attempts (locked + public both count)</span>
          </div>
        </div>

        <div className="w-full lg:w-80 shrink-0">
          {selected ? (
            <div className="rounded-xl border border-[#350A8C]/30 bg-[#0B0626]/50 p-4 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-[#E0DCE6] font-medium">{selected.label}</div>
                  <div className="text-xs text-[#E0DCE6]/50 mt-0.5">{selected.terms}</div>
                </div>
                <button onClick={() => setSelected(null)} className="text-[#E0DCE6]/40 hover:text-[#E0DCE6]">
                  <X size={16} />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="p-2 rounded-lg bg-[#130D30] border border-[#350A8C]/20">
                  <div className="text-[#E0DCE6] text-base font-medium">{selectedStats?.cycles ?? 0}</div>
                  <div className="text-[#E0DCE6]/50">cycles</div>
                </div>
                <div className="p-2 rounded-lg bg-[#130D30] border border-[#350A8C]/20">
                  <div className="text-[#03FF9B] text-base font-medium">{selectedStats?.successes ?? 0}</div>
                  <div className="text-[#E0DCE6]/50">downloads</div>
                </div>
                <div className="p-2 rounded-lg bg-[#130D30] border border-[#350A8C]/20">
                  <div className="text-[#FF4D6D] text-base font-medium">{selectedStats?.failures ?? 0}</div>
                  <div className="text-[#E0DCE6]/50">blocked/failed</div>
                </div>
              </div>
              {(selectedStats?.texts ?? 0) > 0 && (
                <div className="text-xs text-[#E0DCE6]/60" data-testid="text-region-library-texts">
                  {selectedStats!.texts} text{selectedStats!.texts === 1 ? "" : "s"} in the library from this region
                </div>
              )}
              {selectedRate !== null && (
                <div className="text-xs text-[#E0DCE6]/60">
                  Success rate:{" "}
                  <span style={{ color: successColor(selectedRate) }} className="font-medium">
                    {Math.round(selectedRate * 100)}%
                  </span>
                </div>
              )}

              {isEditor && (
                <div className="space-y-3 pt-2 border-t border-[#350A8C]/20">
                  <div>
                    <label className="block text-xs text-[#E0DCE6]/50 mb-1">
                      Extra keywords (optional — region terms used if empty)
                    </label>
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="e.g. flood myth, creation epic"
                      className="w-full px-3 py-2 rounded-lg bg-[#130D30] border border-[#350A8C]/40 text-sm text-[#E0DCE6] focus:outline-none focus:border-[#8F00FF]/60"
                      data-testid="input-region-query"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <div>
                      <label className="block text-xs text-[#E0DCE6]/50 mb-1">Max per source</label>
                      <input
                        type="number"
                        min={1}
                        max={25}
                        value={limit}
                        onChange={(e) => setLimit(Math.max(1, Math.min(25, Number(e.target.value) || 10)))}
                        className="w-20 px-3 py-2 rounded-lg bg-[#130D30] border border-[#350A8C]/40 text-sm text-[#E0DCE6] focus:outline-none focus:border-[#8F00FF]/60"
                      />
                    </div>
                    <label className="flex items-center gap-2 text-sm text-[#E0DCE6]/70 mt-4 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={useAi}
                        onChange={(e) => setUseAi(e.target.checked)}
                        className="accent-[#8F00FF]"
                      />
                      AI leads
                    </label>
                  </div>
                  <button
                    onClick={() => launchMutation.mutate(selected)}
                    disabled={launchMutation.isPending || running}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm bg-[#8F00FF] text-white hover:bg-[#7B00E0] disabled:opacity-50 transition-colors"
                    data-testid="button-launch-region-cycle"
                  >
                    {running ? <RefreshCw size={16} className="animate-spin" /> : <Play size={16} />}
                    {running ? "A cycle is running..." : `Hunt ${selected.label}`}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-[#350A8C]/20 bg-[#0B0626]/30 p-6 text-center text-sm text-[#E0DCE6]/50">
              Select a region on the map to see its hunting record{isEditor ? " and launch a cycle" : ""}.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const CORPUS_ITEM_STATUS: Record<string, { label: string; className: string }> = {
  fetched: { label: "Fetched", className: "bg-[#03FF9B]/15 text-[#03FF9B]" },
  fetched_locked: { label: "Fetched (locked)", className: "bg-orange-400/15 text-orange-400" },
  metadata_only: { label: "No download allowed", className: "bg-yellow-400/15 text-yellow-400" },
  failed: { label: "Failed", className: "bg-red-400/15 text-red-400" },
  not_found: { label: "Not found", className: "bg-[#E0DCE6]/10 text-[#E0DCE6]/60" },
  skipped: { label: "Skipped", className: "bg-[#350A8C]/30 text-[#E0DCE6]/50" },
};

const blockerReasonLabel = (reason: string) =>
  BLOCKER_REASON_LABELS[reason] ?? reason.replace(/_/g, " ");

/**
 * For each blocker reason: is there a realistic way to still get the text,
 * and what would it take? Shown in the corpus report so editors can see
 * where a fetch is still possible.
 */
const BLOCKER_FIX_HINTS: Record<string, { hint: string; fixable: boolean }> = {
  download_not_authorized: {
    fixable: true,
    hint: "The site is read-online only (HTML pages, no bulk download). Another edition on a download-friendly source (Gutenberg, Sacred-Texts, Wikisource…) may exist — retry after adding one to the registry.",
  },
  robots_disallowed: {
    fixable: true,
    hint: "The site's robots.txt forbids automated fetching — we respect that. Look for the same text on a source that allows it, or download it manually and upload it.",
  },
  requires_auth: {
    fixable: true,
    hint: "Needs a login. If you have access, download manually and upload; otherwise look for an open mirror.",
  },
  unregistered_source: {
    fixable: true,
    hint: "The host just isn't in the trusted registry yet. Add it as a source, then use Retry missing.",
  },
  rights_locked: {
    fixable: true,
    hint: "The text WAS fetched but rights are unclear. Review it in the locked partition — approving it makes it available.",
  },
  too_large: {
    fixable: true,
    hint: "File exceeds the policy's size cap. Raise maximum_file_bytes or find a plain-text edition.",
  },
  fetch_failed: {
    fixable: true,
    hint: "Often transient (network hiccup, temporary block). Retry missing usually resolves these.",
  },
  invalid_candidate: {
    fixable: false,
    hint: "The lead's metadata was unusable; a retry only helps if discovery finds a better lead.",
  },
  secondary_source: {
    fixable: false,
    hint: "Only books ABOUT the work were found, not the text itself. Try a more precise title or the original-language title.",
  },
  discovery_unsupported: {
    fixable: false,
    hint: "This source can't be crawled automatically yet; texts from it must be uploaded manually.",
  },
};

/** End-of-cycle report for corpus-list cycles: which sources were fetched. */
function CorpusListReport({
  corpusList,
  isEditor = false,
  runId,
  running = false,
  retryRunning = false,
  useAi = true,
}: {
  corpusList: any;
  isEditor?: boolean;
  runId?: number;
  running?: boolean;
  /** True when a child retry cycle for this list is already in progress. */
  retryRunning?: boolean;
  useAi?: boolean;
}) {
  const { toast } = useToast();
  const retryMissingMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/hunter/cycles/corpus/${runId}/retry`, {
        use_ai: useAi,
      });
      return res.json();
    },
    onSuccess: (d: any) => {
      toast({
        title: `Retry cycle "${d.corpus_list?.name ?? ""}" launched`,
        description: `${d.corpus_list?.items ?? 0} missing source${d.corpus_list?.items === 1 ? "" : "s"} to re-hunt.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/hunter/cycles"] });
    },
    onError: (e: Error) =>
      toast({ title: "Could not launch retry", description: e.message, variant: "destructive" }),
  });

  if (!corpusList || !Array.isArray(corpusList.items) || corpusList.items.length === 0) return null;
  const fetchedCount = (corpusList.fetched ?? 0) + (corpusList.fetched_locked ?? 0);
  const missingCount =
    (corpusList.not_found ?? 0) + (corpusList.failed ?? 0) + (corpusList.metadata_only ?? 0);
  const canRetry = isEditor && !running && !retryRunning && missingCount > 0 && runId != null;
  const blockedReasons: [string, number][] = Object.entries(corpusList.blocked_reasons ?? {});

  return (
    <div data-testid="corpus-list-report">
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="text-xs text-[#E0DCE6]/50">
          Corpus list report — {fetchedCount}/{corpusList.total ?? corpusList.items.length} sources fetched
        </div>
        {retryRunning && !running && (
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] bg-[#350A8C]/20 border border-[#8F00FF]/20 text-[#E0DCE6]/50 shrink-0"
            data-testid={`text-retry-running-${runId}`}
          >
            <RefreshCw size={11} className="animate-spin" />
            Retry running…
          </span>
        )}
        {canRetry && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              retryMissingMutation.mutate();
            }}
            disabled={retryMissingMutation.isPending || running}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] bg-[#350A8C]/40 border border-[#8F00FF]/40 text-[#E0DCE6] hover:bg-[#350A8C]/60 disabled:opacity-50 transition-colors shrink-0"
            data-testid={`button-retry-missing-${runId}`}
          >
            {retryMissingMutation.isPending ? (
              <RefreshCw size={11} className="animate-spin" />
            ) : (
              <RefreshCw size={11} />
            )}
            Retry missing ({missingCount})
          </button>
        )}
      </div>
      {blockedReasons.length > 0 && (
        <div className="mb-2 p-2.5 rounded-lg border border-yellow-400/20 bg-yellow-400/5" data-testid="corpus-blocked-summary">
          <div className="text-[10px] uppercase font-bold text-yellow-400/80 mb-1">
            Why sources were blocked — and where a fetch is still possible
          </div>
          <div className="space-y-1.5">
            {blockedReasons.map(([reason, count]) => {
              const fix = BLOCKER_FIX_HINTS[reason];
              return (
                <div key={reason} className="text-xs" data-testid={`blocked-reason-${reason}`}>
                  <div className="text-[#E0DCE6]/70">
                    <span className="text-yellow-400 font-medium">{count}×</span> {blockerReasonLabel(reason)}
                    {fix && (
                      <span
                        className={`ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                          fix.fixable ? "bg-[#03FF9B]/15 text-[#03FF9B]" : "bg-[#E0DCE6]/10 text-[#E0DCE6]/50"
                        }`}
                      >
                        {fix.fixable ? "Fetch still possible" : "Needs a different lead"}
                      </span>
                    )}
                  </div>
                  {fix && <div className="text-[11px] text-[#E0DCE6]/45 mt-0.5 pl-4">{fix.hint}</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}
      <div className="border border-[#350A8C]/20 rounded-lg overflow-hidden divide-y divide-[#350A8C]/15">
        {corpusList.items.map((item: any, i: number) => {
          const status = CORPUS_ITEM_STATUS[item.status] ?? CORPUS_ITEM_STATUS.not_found;
          return (
            <div key={i} className="flex items-start gap-3 p-2.5 text-xs bg-[#130D30]/50" data-testid={`corpus-list-item-${i}`}>
              <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold shrink-0 ${status.className}`}>
                {status.label}
              </span>
              <div className="min-w-0 flex-1">
                <span className="text-[#E0DCE6]">{item.title}</span>
                {item.author && <span className="text-[#E0DCE6]/50"> — {item.author}</span>}
                {item.languages?.length > 0 && (
                  <span className={`ml-2 ${item.english ? "text-[#03FF9B]" : "text-yellow-400"}`}>
                    [{item.languages.join(", ")}]
                  </span>
                )}
                {item.detail && <div className="text-[#E0DCE6]/45 mt-0.5">{item.detail}</div>}
                {Array.isArray(item.blockers) && item.blockers.length > 0 && (
                  <div className="mt-1 space-y-0.5">
                    {item.blockers.map((b: any, j: number) => (
                      <div key={j} className="text-[11px] text-yellow-400/80 flex items-start gap-1">
                        <span className="shrink-0">⛔</span>
                        <span>
                          {blockerReasonLabel(b.reason)}
                          {b.url && (
                            <span className="text-[#E0DCE6]/40 break-all"> — {b.url}</span>
                          )}
                          {b.detail && b.detail !== blockerReasonLabel(b.reason) && (
                            <span className="text-[#E0DCE6]/40"> ({b.detail})</span>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function HunterCycles({ isEditor }: { isEditor: boolean }) {
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(10);
  const [useAi, setUseAi] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [detailRunId, setDetailRunId] = useState<number | null>(null);
  const { toast } = useToast();

  const { data: cycles } = useQuery<any[]>({
    queryKey: ["/api/hunter/cycles"],
    refetchInterval: (q) =>
      Array.isArray(q.state.data) && q.state.data.some((r: any) => r.status === "running")
        ? 2000
        : false,
  });
  const running = Array.isArray(cycles) && cycles.some((r) => r.status === "running");

  const { data: blockers } = useQuery<any[]>({
    queryKey: ["/api/hunter/blockers"],
    refetchInterval: running ? 3000 : false,
  });

  useEffect(() => {
    if (!running) {
      setStoppingId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/hunter/blockers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hunter/candidates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hunter/corpus"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hunter/library"] });
    }
  }, [running]);

  const launchMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/hunter/cycles", { query, limit, use_ai: useAi }),
    onSuccess: () => {
      toast({ title: "Hunting cycle launched" });
      queryClient.invalidateQueries({ queryKey: ["/api/hunter/cycles"] });
    },
    onError: (e: Error) =>
      toast({ title: "Could not launch cycle", description: e.message, variant: "destructive" }),
  });

  const [stoppingId, setStoppingId] = useState<number | null>(null);

  const stopCorpusMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/hunter/cycles/${id}/stop`);
      return res.json();
    },
    onSuccess: (_d, id) => {
      setStoppingId(id);
      toast({ title: "Stop requested", description: "The cycle will finish its current item then stop." });
    },
    onError: (e: Error) =>
      toast({ title: "Could not stop cycle", description: e.message, variant: "destructive" }),
  });

  const corpusListMutation = useMutation({
    mutationFn: async (file: File) => {
      const content = await file.text();
      const res = await apiRequest("POST", "/api/hunter/cycles/corpus", {
        filename: file.name,
        content,
        use_ai: useAi,
      });
      return res.json();
    },
    onSuccess: (d: any) => {
      toast({
        title: `Corpus cycle "${d.corpus_list?.name ?? ""}" launched`,
        description: `${d.corpus_list?.items ?? 0} sources to hunt.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/hunter/cycles"] });
    },
    onError: (e: Error) =>
      toast({ title: "Could not launch corpus cycle", description: e.message, variant: "destructive" }),
  });

  const pickCorpusList = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv,.json,.txt";
    input.onchange = () => {
      const file = input.files?.[0];
      if (file) corpusListMutation.mutate(file);
    };
    input.click();
  };

  const blockerMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      apiRequest("PATCH", `/api/hunter/blockers/${id}`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/hunter/blockers"] }),
    onError: (e: Error) =>
      toast({ title: "Update failed", description: e.message, variant: "destructive" }),
  });

  const retryMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/hunter/blockers/${id}/retry`);
      return res.json();
    },
    onSuccess: (d: any) => {
      if (d.outcome === "downloaded") {
        toast({ title: "Retry succeeded", description: "The text was downloaded and added to the corpus." });
      } else if (d.outcome === "locked") {
        toast({ title: "Downloaded to locked partition", description: "The text was fetched but stays locked pending rights review." });
      } else {
        toast({
          title: "Retry still blocked",
          description: `A fresh blocker was recorded (${BLOCKER_REASON_LABELS[d.new_blocker_reason] ?? d.new_blocker_reason ?? "unknown"}).`,
          variant: "destructive",
        });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/hunter/blockers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hunter/corpus"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hunter/library"] });
    },
    onError: (e: Error) =>
      toast({ title: "Retry failed", description: e.message, variant: "destructive" }),
  });

  const [uploadingId, setUploadingId] = useState<number | null>(null);
  const uploadMutation = useMutation({
    mutationFn: async ({ id, file }: { id: number; file: File }) => {
      const text = await file.text();
      const res = await fetch(`/api/hunter/blockers/${id}/upload`, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "text/plain" },
        body: text,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || `Upload failed (${res.status})`);
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Text uploaded",
        description:
          data.partition === "public"
            ? "Rights cleared — the text is now readable in the Library."
            : "Rights still unclear — the text was saved to the locked research partition.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/hunter/blockers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hunter/corpus"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hunter/library"] });
    },
    onError: (e: Error) =>
      toast({ title: "Upload failed", description: e.message, variant: "destructive" }),
    onSettled: () => setUploadingId(null),
  });

  const pickFileFor = (id: number) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".txt,.text,.html,.htm,.xml,.md";
    input.onchange = () => {
      const file = input.files?.[0];
      if (file) {
        setUploadingId(id);
        uploadMutation.mutate({ id, file });
      }
    };
    input.click();
  };

  const MANUAL_UPLOAD_REASONS = new Set([
    "robots_disallowed",
    "download_not_authorized",
    "requires_auth",
    "fetch_failed",
    "too_large",
  ]);

  const cycleItems = Array.isArray(cycles) ? cycles : [];
  const blockerItems = Array.isArray(blockers) ? blockers : [];
  const openBlockers = blockerItems.filter((b) => b.status === "open");

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-medium text-[#E0DCE6] mb-1">Hunting Cycles</h3>
        <p className="text-sm text-[#E0DCE6]/60 mb-4">
          Launch an autonomous cycle: the hunter crawls the trusted source registries, asks the AI
          for extra leads, downloads everything it can (cleared texts to the public Library, all
          others to the locked research partition) and records every blocker it hits.
        </p>
        {isEditor ? (
          <div className="p-4 rounded-xl border border-[#350A8C]/30 bg-[#0B0626]/50 flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[220px]">
              <label className="block text-xs text-[#E0DCE6]/50 mb-1">Scope (tradition, deity, keyword...)</label>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder='e.g. "Enuma Elish", "Orphic hymns", "Norse Edda"'
                className="w-full px-3 py-2 rounded-lg bg-[#130D30] border border-[#350A8C]/40 text-sm text-[#E0DCE6] focus:outline-none focus:border-[#8F00FF]/60"
                data-testid="input-cycle-query"
              />
            </div>
            <div>
              <label className="block text-xs text-[#E0DCE6]/50 mb-1">Max per source</label>
              <input
                type="number"
                min={1}
                max={25}
                value={limit}
                onChange={(e) => setLimit(Math.max(1, Math.min(25, Number(e.target.value) || 10)))}
                className="w-24 px-3 py-2 rounded-lg bg-[#130D30] border border-[#350A8C]/40 text-sm text-[#E0DCE6] focus:outline-none focus:border-[#8F00FF]/60"
                data-testid="input-cycle-limit"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-[#E0DCE6]/70 pb-2 cursor-pointer">
              <input
                type="checkbox"
                checked={useAi}
                onChange={(e) => setUseAi(e.target.checked)}
                className="accent-[#8F00FF]"
                data-testid="checkbox-cycle-ai"
              />
              AI lead search
            </label>
            <button
              onClick={() => launchMutation.mutate()}
              disabled={launchMutation.isPending || running || !query.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-[#8F00FF] text-white hover:bg-[#7B00E0] disabled:opacity-50 transition-colors"
              data-testid="button-launch-cycle"
            >
              {running ? <RefreshCw size={16} className="animate-spin" /> : <Play size={16} />}
              {running ? "Cycle running..." : "Launch Cycle"}
            </button>
            <div className="w-full border-t border-[#350A8C]/20 pt-3 mt-1 flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-[260px]">
                <div className="text-xs text-[#E0DCE6]/70 font-medium">Or hunt from a corpus list</div>
                <p className="text-xs text-[#E0DCE6]/45 mt-0.5">
                  Upload a .csv, .json or .txt list of sources — the file's name becomes the cycle's
                  name. The hunter fetches each one complete and in English when possible, falling
                  back to AI-translatable languages, and reports what it could and couldn't fetch.
                </p>
              </div>
              <button
                onClick={pickCorpusList}
                disabled={corpusListMutation.isPending || running}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-[#350A8C]/40 border border-[#8F00FF]/40 text-[#E0DCE6] hover:bg-[#350A8C]/60 disabled:opacity-50 transition-colors"
                data-testid="button-upload-corpus-list"
              >
                {corpusListMutation.isPending ? (
                  <RefreshCw size={16} className="animate-spin" />
                ) : (
                  <Upload size={16} />
                )}
                Upload corpus list
              </button>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-lg border border-[#350A8C]/20 bg-[#0B0626]/40 text-sm text-[#E0DCE6]/50">
            Enter edit mode to launch a hunting cycle.
          </div>
        )}
      </div>

      <div>
        <h4 className="text-sm font-medium text-[#E0DCE6]/80 mb-3">Past cycles</h4>
        {cycleItems.length === 0 ? (
          <div className="p-6 text-center border border-[#350A8C]/20 rounded-xl bg-[#0B0626]/30 text-sm text-[#E0DCE6]/50">
            No hunting cycles have been launched yet.
          </div>
        ) : (
          <div className="border border-[#350A8C]/30 rounded-xl overflow-hidden bg-[#0B0626]/50">
            {cycleItems.map((run: any) => {
              const result = run.result ?? {};
              const progress = result.progress ?? (result.scope ? result : null);
              const isExpanded = expandedId === run.id;
              const summary = result.scope ? result : progress?.phase === "completed" ? progress : null;
              return (
                <div key={run.id} className="border-b border-[#350A8C]/20 last:border-0">
                  <div
                    className="flex items-center gap-4 p-4 hover:bg-[#130D30]/50 transition-colors cursor-pointer"
                    onClick={() => setExpandedId(isExpanded ? null : run.id)}
                    data-testid={`row-cycle-${run.id}`}
                  >
                    {isExpanded ? (
                      <ChevronDown size={16} className="text-[#8F00FF] shrink-0" />
                    ) : (
                      <ChevronRight size={16} className="text-[#E0DCE6]/40 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-[#E0DCE6] truncate">
                        {result.corpus_list?.name || progress?.corpus_list
                          ? `Corpus list: ${result.corpus_list?.name ?? (typeof progress?.corpus_list === "string" ? progress.corpus_list : progress?.corpus_list?.name)}`
                          : (summary?.scope?.query ?? progress?.query)
                            ? `“${summary?.scope?.query ?? progress?.query}”`
                            : `Cycle #${run.id}`}
                      </div>
                      <div className="text-xs text-[#E0DCE6]/50 mt-0.5">
                        {new Date(run.startedAt).toLocaleString()}
                        {run.status === "running" && progress?.phase === "corpus_item" && (
                          <span className="text-[#03FF9B] ml-2">
                            hunting {progress.item_index}/{progress.item_total}: “{progress.current_title}”
                            {progress.item_phase ? ` — ${String(progress.item_phase).replace(/_/g, " ")}` : ""}...
                          </span>
                        )}
                        {run.status === "running" && progress?.phase && progress.phase !== "corpus_item" && (
                          <span className="text-[#03FF9B] ml-2">{String(progress.phase).replace(/_/g, " ")}...</span>
                        )}
                      </div>
                    </div>
                    {run.status === "running" && (() => {
                      const isCorpusCycle = !!(result.corpus_list?.name || progress?.corpus_list);
                      const isStopping = stoppingId === run.id;
                      return (
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="inline-flex items-center gap-1.5 text-xs text-[#03FF9B]">
                            <RefreshCw size={12} className="animate-spin" />
                            {isStopping ? "Stopping…" : "Running"}
                          </span>
                          {isEditor && isCorpusCycle && !isStopping && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                stopCorpusMutation.mutate(run.id);
                              }}
                              disabled={stopCorpusMutation.isPending}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] bg-red-900/30 border border-red-500/40 text-red-400 hover:bg-red-900/50 transition-colors disabled:opacity-50"
                              data-testid={`button-stop-corpus-${run.id}`}
                            >
                              <X size={11} /> Stop
                            </button>
                          )}
                        </div>
                      );
                    })()}
                    {run.status === "failed" && (
                      <span className="inline-flex items-center gap-1 text-xs text-red-400">
                        <X size={12} /> Failed
                      </span>
                    )}
                    {run.status === "completed" && summary && (
                      <div className="flex items-center gap-3 text-xs shrink-0">
                        <span className="text-[#E0DCE6]/60">{summary.discovered ?? 0} found</span>
                        <span className="text-[#03FF9B]">{summary.downloaded_public ?? 0} public</span>
                        <span className="text-orange-400">{summary.downloaded_locked ?? 0} locked</span>
                        <span className="text-red-400">{summary.blockers ?? 0} blockers</span>
                      </div>
                    )}
                  </div>
                  {isExpanded && (
                    <div className="p-4 bg-[#0B0626] border-t border-[#350A8C]/10 space-y-3">
                      {run.error && (
                        <RunErrorReport error={run.error} testId={`run-error-${run.id}`} />
                      )}
                      {summary && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                          {[
                            ["Discovered", summary.discovered],
                            ["Candidates created", summary.created],
                            ["Duplicates skipped", summary.duplicates],
                            ["Invalid leads", summary.invalid],
                            ["Secondary sources skipped", summary.secondary],
                            ["Downloaded (public)", summary.downloaded_public],
                            ["Downloaded (locked)", summary.downloaded_locked],
                            ["Metadata only", summary.metadata_only],
                            ["Failed", summary.failed],
                            ["Extractions queued", summary.auto_extraction?.queued],
                          ].map(([label, value]) => (
                            <div key={String(label)} className="p-2 rounded-lg bg-[#130D30] border border-[#350A8C]/20">
                              <div className="text-[#E0DCE6]/50">{label}</div>
                              <div className="text-[#E0DCE6] text-base font-medium">{value ?? 0}</div>
                            </div>
                          ))}
                        </div>
                      )}
                      <CorpusListReport
                        corpusList={result.corpus_list ?? progress?.corpus_list}
                        isEditor={isEditor}
                        runId={run.id}
                        running={run.status === "running"}
                        retryRunning={(() => {
                          // Derive the expected retry-cycle name for this run and
                          // check whether any currently-running cycle uses it.
                          const listName =
                            result.corpus_list?.name ??
                            (typeof progress?.corpus_list === "string"
                              ? progress.corpus_list
                              : progress?.corpus_list?.name);
                          if (!listName || !Array.isArray(cycles)) return false;
                          const retryName = listName.endsWith(" (retry)")
                            ? listName
                            : `${listName} (retry)`;
                          return cycles.some(
                            (c: any) =>
                              c.status === "running" &&
                              (c.result?.scope?.corpusList === retryName ||
                                c.result?.corpus_list?.name === retryName),
                          );
                        })()}
                        useAi={useAi}
                      />
                      <AutoExtractionFailures failures={summary?.auto_extraction?.failed} />
                      {(summary?.auto_extraction?.queued ?? 0) > 0 && (
                        <p className="text-xs text-[#E0DCE6]/50" data-testid={`text-auto-extract-note-${run.id}`}>
                          Readable extraction was queued automatically for {summary.auto_extraction.queued}{" "}
                          new {summary.auto_extraction.queued === 1 ? "download" : "downloads"} — track
                          progress in the Corpus tab.
                        </p>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDetailRunId(run.id);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-[#350A8C]/30 border border-[#350A8C]/40 text-[#E0DCE6] hover:bg-[#350A8C]/50 transition-colors"
                        data-testid={`button-cycle-detail-${run.id}`}
                      >
                        <FileText size={12} /> View run output (files & blockers)
                      </button>
                      {Array.isArray(summary?.discovery) && summary.discovery.length > 0 && (
                        <div>
                          <div className="text-xs text-[#E0DCE6]/50 mb-2">New candidates & where they came from</div>
                          <ul className="space-y-1 text-xs">
                            {summary.discovery.map((d: any, i: number) => (
                              <li key={i} className="flex items-start gap-2">
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold shrink-0 ${
                                    d.origin === "ai_search"
                                      ? "bg-[#8F00FF]/20 text-[#8F00FF]"
                                      : "bg-[#03FF9B]/15 text-[#03FF9B]"
                                  }`}
                                >
                                  {d.origin === "ai_search" ? "AI" : "Registry"}
                                </span>
                                <span className="text-[#E0DCE6]/80">{d.title}</span>
                                <span className="text-[#E0DCE6]/40 truncate">{d.originDetail}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium text-[#E0DCE6]/80">
            Blocker ledger{" "}
            <span className="text-[#E0DCE6]/40 font-normal">
              ({openBlockers.length} open / {blockerItems.length} total)
            </span>
          </h4>
        </div>
        {blockerItems.length === 0 ? (
          <div className="p-6 text-center border border-[#350A8C]/20 rounded-xl bg-[#0B0626]/30 text-sm text-[#E0DCE6]/50">
            No blockers recorded yet.
          </div>
        ) : (
          <div className="border border-[#350A8C]/30 rounded-xl overflow-hidden bg-[#0B0626]/50">
            <table className="w-full text-sm text-left">
              <thead className="bg-[#130D30] border-b border-[#350A8C]/30 text-[#E0DCE6]/60">
                <tr>
                  <th className="px-4 py-3 font-medium">Reason</th>
                  <th className="px-4 py-3 font-medium">Detail</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  {isEditor && <th className="px-4 py-3 font-medium text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#350A8C]/10">
                {blockerItems.map((b: any) => (
                  <tr key={b.id} className={`transition-colors ${b.status !== "open" ? "opacity-50" : "hover:bg-[#130D30]/30"}`} data-testid={`row-blocker-${b.id}`}>
                    <td className="px-4 py-3 align-top">
                      <span className="inline-flex px-2 py-1 rounded-md bg-red-500/10 text-red-300 text-xs font-medium whitespace-nowrap">
                        {BLOCKER_REASON_LABELS[b.reason] ?? b.reason}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-top text-xs text-[#E0DCE6]/70 max-w-md">
                      <div>{b.detail}</div>
                      {b.url && (
                        <a
                          href={b.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[#8F00FF] hover:underline mt-1 break-all"
                          data-testid={`link-blocker-manual-${b.id}`}
                        >
                          <ExternalLink size={11} className="shrink-0" />
                          {b.status === "open" && MANUAL_UPLOAD_REASONS.has(b.reason)
                            ? "Download manually: "
                            : ""}
                          {b.url}
                        </a>
                      )}
                      {b.editionId && <div className="font-mono text-[#E0DCE6]/40 mt-1">{b.editionId}</div>}
                    </td>
                    <td className="px-4 py-3 align-top text-xs text-[#E0DCE6]/60 capitalize">{b.status}</td>
                    {isEditor && (
                      <td className="px-4 py-3 align-top text-right whitespace-nowrap">
                        {b.status === "open" ? (
                          <>
                            {MANUAL_UPLOAD_REASONS.has(b.reason) && b.editionId && (
                              <button
                                onClick={() => pickFileFor(b.id)}
                                disabled={uploadingId === b.id}
                                className="px-2 py-1 rounded text-xs text-[#8F00FF] hover:bg-[#8F00FF]/10 transition-colors disabled:opacity-50 inline-flex items-center gap-1"
                                data-testid={`button-upload-blocker-${b.id}`}
                              >
                                {uploadingId === b.id ? (
                                  <RefreshCw size={11} className="animate-spin" />
                                ) : (
                                  <Upload size={11} />
                                )}
                                Upload text
                              </button>
                            )}
                            <button
                              onClick={() => blockerMutation.mutate({ id: b.id, status: "resolved" })}
                              className="px-2 py-1 rounded text-xs text-[#03FF9B] hover:bg-[#03FF9B]/10 transition-colors"
                              data-testid={`button-resolve-blocker-${b.id}`}
                            >
                              Resolve
                            </button>
                            <button
                              onClick={() => blockerMutation.mutate({ id: b.id, status: "dismissed" })}
                              className="px-2 py-1 rounded text-xs text-[#E0DCE6]/50 hover:bg-[#350A8C]/30 transition-colors"
                              data-testid={`button-dismiss-blocker-${b.id}`}
                            >
                              Dismiss
                            </button>
                          </>
                        ) : (
                          <>
                            {b.status === "resolved" && (
                              <button
                                onClick={() => retryMutation.mutate(b.id)}
                                disabled={retryMutation.isPending}
                                className="px-2 py-1 rounded text-xs text-[#03FF9B] hover:bg-[#03FF9B]/10 disabled:opacity-50 transition-colors inline-flex items-center gap-1"
                                data-testid={`button-retry-blocker-${b.id}`}
                              >
                                {retryMutation.isPending && retryMutation.variables === b.id ? (
                                  <RefreshCw size={11} className="animate-spin" />
                                ) : (
                                  <RefreshCw size={11} />
                                )}
                                Retry
                              </button>
                            )}
                            <button
                              onClick={() => blockerMutation.mutate({ id: b.id, status: "open" })}
                              className="px-2 py-1 rounded text-xs text-[#E0DCE6]/50 hover:bg-[#350A8C]/30 transition-colors"
                            >
                              Reopen
                            </button>
                          </>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {detailRunId !== null && (
        <RunDetailModal runId={detailRunId} onClose={() => setDetailRunId(null)} />
      )}
    </div>
  );
}

function HunterCandidates({ isEditor }: { isEditor: boolean }) {
  const { data: candidates, isLoading } = useQuery({ queryKey: ["/api/hunter/candidates"] });
  const [editingCandidate, setEditingCandidate] = useState<any | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const { toast } = useToast();

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/hunter/candidates/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hunter/candidates"] });
      toast({ title: "Candidate deleted" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" })
  });

  if (isLoading) return <div className="text-[#E0DCE6]/50 text-sm">Loading candidates...</div>;

  const items = Array.isArray(candidates) ? candidates : [];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium text-[#E0DCE6]">Candidate Editions</h3>
        {isEditor && (
          <button
            onClick={() => setEditingCandidate({})}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm bg-[#8F00FF] text-white hover:bg-[#7B00E0] transition-colors"
          >
            <Plus size={14} /> Add Candidate
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="text-sm text-[#E0DCE6]/50 p-4 border border-[#350A8C]/20 rounded-lg bg-[#0B0626]/50">
          No candidates found.
        </div>
      ) : (
        <div className="border border-[#350A8C]/30 rounded-lg overflow-hidden bg-[#0B0626]/50">
          {items.map((cand: any) => {
            const d = cand.data || {};
            const isExpanded = expandedId === cand.id;
            return (
              <div key={cand.id} className="border-b border-[#350A8C]/20 last:border-0">
                <div 
                  className="flex items-start gap-4 p-4 hover:bg-[#130D30]/50 transition-colors cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : cand.id)}
                >
                  <div className="mt-1">
                    {isExpanded ? <ChevronDown size={16} className="text-[#8F00FF]" /> : <ChevronRight size={16} className="text-[#E0DCE6]/40" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-[#E0DCE6] truncate">{d.title || "Untitled"}</span>
                      {d.format && (
                        <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-[#350A8C]/40 text-[#8F00FF]">
                          {d.format}
                        </span>
                      )}
                      {d.rights?.status_claim && (
                        <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                          d.rights.status_claim === "public_domain" ? "bg-[#03FF9B]/20 text-[#03FF9B]" : "bg-orange-500/20 text-orange-400"
                        }`}>
                          {d.rights.status_claim}
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-[#E0DCE6]/60 truncate">
                      {d.author && `By ${d.author}`}
                      {d.translator && ` • Tr: ${d.translator}`}
                      {d.language && ` • ${d.language.toUpperCase()}`}
                      {d.publication_year && ` • ${d.publication_year}`}
                    </div>
                  </div>
                  {isEditor && (
                    <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => setEditingCandidate(cand)}
                        className="p-1.5 rounded hover:bg-[#350A8C]/40 text-[#E0DCE6]/40 hover:text-[#8F00FF] transition-colors"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm("Delete this candidate?")) deleteMutation.mutate(cand.id);
                        }}
                        className="p-1.5 rounded hover:bg-red-500/20 text-[#E0DCE6]/40 hover:text-red-400 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
                {isExpanded && (
                  <div className="p-4 bg-[#0B0626] border-t border-[#350A8C]/10 text-xs overflow-x-auto">
                    <pre className="text-[#E0DCE6]/70 font-mono">
                      {JSON.stringify(cand, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {editingCandidate && (
        <CandidateModal 
          candidate={editingCandidate} 
          onClose={() => setEditingCandidate(null)} 
        />
      )}
    </div>
  );
}

function CandidateModal({ candidate, onClose }: { candidate: any; onClose: () => void }) {
  const isNew = !candidate.id;
  const [dataStr, setDataStr] = useState(() => JSON.stringify(candidate.data || {}, null, 2));
  const { toast } = useToast();

  const saveMutation = useMutation({
    mutationFn: async () => {
      let parsed;
      try {
        parsed = JSON.parse(dataStr);
      } catch (e) {
        throw new Error("Invalid JSON");
      }
      if (isNew) {
        return apiRequest("POST", "/api/hunter/candidates", { data: parsed });
      } else {
        return apiRequest("PUT", `/api/hunter/candidates/${candidate.id}`, { data: parsed });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hunter/candidates"] });
      toast({ title: isNew ? "Candidate added" : "Candidate updated" });
      onClose();
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" })
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#130D30] border border-[#350A8C]/40 rounded-xl p-6 w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between mb-4 shrink-0">
          <h3 className="text-lg font-semibold text-[#E0DCE6]">
            {isNew ? "Add Candidate" : "Edit Candidate"}
          </h3>
          <button onClick={onClose}>
            <X size={18} className="text-[#E0DCE6]/50 hover:text-[#E0DCE6]" />
          </button>
        </div>
        <p className="text-xs text-[#E0DCE6]/50 mb-4 shrink-0">
          Edit the candidate JSON directly. Ensure fields like work_id, edition_id, title, author, and format are present.
        </p>
        <textarea
          value={dataStr}
          onChange={e => setDataStr(e.target.value)}
          className="flex-1 w-full p-4 rounded-lg bg-[#0B0626] border border-[#350A8C]/40 text-[#E0DCE6] text-sm font-mono focus:outline-none focus:border-[#8F00FF]/60 min-h-[300px]"
          spellCheck={false}
        />
        <div className="flex justify-end gap-2 mt-4 shrink-0">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-[#E0DCE6]/70 hover:bg-[#350A8C]/20 transition-colors">
            Cancel
          </button>
          <button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="px-4 py-2 rounded-lg bg-[#8F00FF] text-white text-sm font-medium hover:bg-[#7B00E0] disabled:opacity-50 transition-colors"
          >
            {saveMutation.isPending ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function HunterPlan({ isEditor }: { isEditor: boolean }) {
  const { data, isLoading } = useQuery<any>({ queryKey: ["/api/hunter/plan/latest"] });
  const { toast } = useToast();

  const planMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/hunter/plan"),
    onSuccess: () => {
      toast({ title: "Assessment completed" });
      queryClient.invalidateQueries({ queryKey: ["/api/hunter/plan/latest"] });
    },
    onError: (e: Error) => toast({ title: "Assessment failed", description: e.message, variant: "destructive" })
  });

  if (isLoading) return <div className="text-[#E0DCE6]/50 text-sm">Loading plan...</div>;

  const run = data?.run;
  const entries = Array.isArray(data?.entries) ? data.entries : [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-lg font-medium text-[#E0DCE6] mb-1">Download Plan</h3>
          {run ? (
            <p className="text-sm text-[#E0DCE6]/60">
              Last run: {new Date(run.startedAt).toLocaleString()} 
              {run.status === "completed" && <span className="text-[#03FF9B] ml-2 inline-flex items-center gap-1"><Check size={14}/> Completed</span>}
              {run.status === "failed" && <span className="text-red-400 ml-2 inline-flex items-center gap-1"><X size={14}/> Failed</span>}
            </p>
          ) : (
            <p className="text-sm text-[#E0DCE6]/60">No rights assessments run yet.</p>
          )}
        </div>
        {isEditor && (
          <button
            onClick={() => planMutation.mutate()}
            disabled={planMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-[#8F00FF] text-white hover:bg-[#7B00E0] disabled:opacity-50 transition-colors"
          >
            {planMutation.isPending ? <RefreshCw size={16} className="animate-spin" /> : <Play size={16} />}
            Run Assessment
          </button>
        )}
      </div>

      {entries.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {entries.map((entry: any, i: number) => {
            // /api/hunter/plan/latest entries are CandidatePlan objects:
            // { candidate, rights_assessment, selection } (snake_case fields).
            const candidate = entry?.candidate ?? {};
            const rights = entry?.rights_assessment ?? {};
            const selection = entry?.selection ?? {};
            const isPublishable = rights.publication_allowed === true;
            const isLocked = rights.locked === true || rights.do_not_publish === true;

            return (
              <div key={i} className="p-4 rounded-xl border border-[#350A8C]/30 bg-[#0B0626]/50 flex flex-col">
                <div className="flex justify-between items-start mb-2">
                  <div className="font-mono text-xs text-[#E0DCE6]/50 truncate max-w-[200px]" title={candidate.edition_id}>
                    {candidate.work_id} / {candidate.edition_id}
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold shrink-0 ${
                    isPublishable ? "bg-[#03FF9B]/20 text-[#03FF9B]" : 
                    isLocked ? "bg-red-500/20 text-red-400" : 
                    "bg-orange-500/20 text-orange-400"
                  }`}>
                    {rights.status || "unknown"}{isLocked ? " · locked" : ""}
                  </span>
                </div>
                
                <div className="flex-1 mt-2">
                  <p className="text-sm text-[#E0DCE6] mb-1">
                    Basis: <span className="text-[#E0DCE6]/70">{rights.basis || "Unknown"}</span>
                  </p>
                  {rights.reasons && rights.reasons.length > 0 && (
                    <ul className="text-xs text-[#E0DCE6]/50 list-disc pl-4 mt-2 space-y-1">
                      {rights.reasons.map((r: string, idx: number) => <li key={idx}>{r}</li>)}
                    </ul>
                  )}
                </div>
                
                <div className="mt-4 pt-3 border-t border-[#350A8C]/20 flex justify-between items-center text-xs text-[#E0DCE6]/40">
                  <span>Confidence: {rights.confidence ?? "unknown"}</span>
                  {selection.selected ? (
                    <span className="text-[#03FF9B]/70 flex items-center gap-1">
                      <Check size={12} /> Selected
                    </span>
                  ) : (
                    <span className="text-[#E0DCE6]/30">Skipped</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// hint: Logic changed on both sides. Requires understanding intent of each change.
function HunterCorpus({ isEditor }: { isEditor: boolean }) {
  const { data: corpus, isLoading } = useQuery({ queryKey: ["/api/hunter/corpus"] });
  const { toast } = useToast();
  const [reviewingId, setReviewingId] = useState<number | null>(null);
  const [extractingFile, setExtractingFile] = useState<any | null>(null);
  const [detailRunId, setDetailRunId] = useState<number | null>(null);
  const [viewingReadable, setViewingReadable] = useState<{ id: number; title: string } | null>(null);
  
  const [isPolling, setIsPolling] = useState(false);
  const { data: runs } = useQuery({
    queryKey: ["/api/hunter/runs"],
    refetchInterval: isPolling ? 2000 : false,
  });

  useEffect(() => {
    const hasRunning = Array.isArray(runs) && runs.some(r => r.status === "running");
    if (hasRunning && !isPolling) setIsPolling(true);
    else if (!hasRunning && isPolling) {
      setIsPolling(false);
      queryClient.invalidateQueries({ queryKey: ["/api/hunter/corpus"] });
    }
  }, [runs, isPolling]);

  const downloadMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/hunter/download"),
    onSuccess: () => {
      toast({ title: "Download started" });
      setIsPolling(true);
      queryClient.invalidateQueries({ queryKey: ["/api/hunter/runs"] });
    },
    onError: (e: Error) => toast({ title: "Failed to start", description: e.message, variant: "destructive" })
  });

  // Extraction jobs (including ones auto-started after a download) so rows can
  // show a running extraction and let the editor stop it without the modal.
  const { data: extractionJobs } = useQuery<any[]>({
    queryKey: ["/api/hunter/extraction/jobs"],
    enabled: isEditor,
    refetchInterval: (q) =>
      Array.isArray(q.state.data) && q.state.data.some((j: any) => j.status === "running")
        ? 2000
        : 10000,
  });
  const jobsByFileId = useMemo(() => {
    const map = new Map<number, any>();
    for (const job of Array.isArray(extractionJobs) ? extractionJobs : []) {
      map.set(job.corpusFileId, job);
    }
    return map;
  }, [extractionJobs]);

  const cancelExtractionMutation = useMutation({
    mutationFn: (fileId: number) =>
      apiRequest("POST", `/api/hunter/corpus/${fileId}/extract/cancel`, {}),
    onSuccess: () => {
      toast({ title: "Extraction cancelled" });
      queryClient.invalidateQueries({ queryKey: ["/api/hunter/extraction/jobs"] });
    },
    onError: (e: Error) =>
      toast({ title: "Could not cancel extraction", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return <div className="text-[#E0DCE6]/50 text-sm">Loading corpus...</div>;

  const items = Array.isArray(corpus) ? corpus : [];
  const totalSize = items.reduce((acc, item) => acc + (item.byteCount || 0), 0);

  // Group rows by family, then religious tradition (both resolved
  // server-side from the curated map).
  const familyGroups = (() => {
    const byId = new Map<string, { tradition: any; family: any; files: any[] }>();
    for (const file of items) {
      const tradition = file.tradition ?? { id: "unclassified", label: "Unclassified", order: 99 };
      const family = file.family ?? { id: "unclassified", label: "Unclassified", order: 99 };
      let group = byId.get(tradition.id);
      if (!group) {
        group = { tradition, family, files: [] };
        byId.set(tradition.id, group);
      }
      group.files.push(file);
    }
    const traditionGroups = Array.from(byId.values()).sort(
      (a, b) => (a.tradition.order ?? 99) - (b.tradition.order ?? 99),
    );
    const byFamily = new Map<string, { family: any; groups: typeof traditionGroups }>();
    for (const group of traditionGroups) {
      let fam = byFamily.get(group.family.id);
      if (!fam) {
        fam = { family: group.family, groups: [] };
        byFamily.set(group.family.id, fam);
      }
      fam.groups.push(group);
    }
    return Array.from(byFamily.values()).sort((a, b) => (a.family.order ?? 99) - (b.family.order ?? 99));
  })();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-lg font-medium text-[#E0DCE6] mb-1">Downloaded Corpus</h3>
          <p className="text-sm text-[#E0DCE6]/60">
            {items.length} files • {(totalSize / 1024 / 1024).toFixed(2)} MB total
          </p>
        </div>
        {isEditor ? (
          <button
            onClick={() => downloadMutation.mutate()}
            disabled={downloadMutation.isPending || isPolling}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-[#8F00FF] text-white hover:bg-[#7B00E0] disabled:opacity-50 transition-colors"
            data-testid="button-download-planned"
          >
            {isPolling ? <RefreshCw size={16} className="animate-spin" /> : <Download size={16} />}
            {isPolling ? "Downloading..." : "Download Planned Editions"}
          </button>
        ) : (
          <div className="text-xs text-[#E0DCE6]/50" data-testid="hint-corpus-edit-mode">
            Enter edit mode to download or extract texts.
          </div>
        )}
      </div>

      {items.length > 0 ? (
        <div className="bg-[#0B0626]/50 border border-[#350A8C]/30 rounded-xl overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-[#130D30] border-b border-[#350A8C]/30 text-[#E0DCE6]/60">
              <tr>
                <th className="px-4 py-3 font-medium">Work / Edition</th>
                <th className="px-4 py-3 font-medium">Language</th>
                <th className="px-4 py-3 font-medium">Partition</th>
                <th className="px-4 py-3 font-medium">Run</th>
                <th className="px-4 py-3 font-medium text-right">Size</th>
                {isEditor && <th className="px-4 py-3 font-medium text-right">Rights</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#350A8C]/10">
              {familyGroups.map((familyGroup) => [
                <tr key={`family-${familyGroup.family.id}`} className="bg-[#1B1140]">
                  <td colSpan={isEditor ? 6 : 5} className="px-4 py-2.5">
                    <span
                      className="inline-flex items-center gap-2 text-sm font-bold text-[#E0DCE6]"
                      data-testid={`header-family-${familyGroup.family.id}`}
                    >
                      {familyGroup.family.label}
                      <span className="px-1.5 py-0.5 rounded-md bg-[#8F00FF]/15 text-[#8F00FF] text-[11px] font-medium">
                        {familyGroup.groups.reduce((n: number, g: any) => n + g.files.length, 0)}
                      </span>
                    </span>
                  </td>
                </tr>,
                ...familyGroup.groups.flatMap((group: any) => [
                <tr key={`tradition-${group.tradition.id}`} className="bg-[#130D30]/60">
                  <td colSpan={isEditor ? 6 : 5} className="px-4 py-2">
                    <span
                      className="inline-flex items-center gap-2 text-[13px] font-semibold text-[#E0DCE6]"
                      data-testid={`header-tradition-${group.tradition.id}`}
                    >
                      {group.tradition.label}
                      <span className="px-1.5 py-0.5 rounded-md bg-[#8F00FF]/15 text-[#8F00FF] text-[11px] font-medium">
                        {group.files.length}
                      </span>
                    </span>
                  </td>
                </tr>,
                ...group.files.map((file: any) => (
                <tr key={file.id} className="hover:bg-[#130D30]/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-[#E0DCE6]">{file.title ?? file.workId}</div>
                    <div className="text-xs text-[#E0DCE6]/50 font-mono mt-0.5">
                      {file.workId} · {file.editionId}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[#E0DCE6]/70 uppercase">{file.language}</td>
                  <td className="px-4 py-3">
                    {file.partition === "locked" ? (
                      <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-orange-500/10 text-orange-400 text-xs font-medium">
                        <Lock size={12} /> Restricted
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#03FF9B]/10 text-[#03FF9B] text-xs font-medium">
                        <Unlock size={12} /> Public
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {file.runId ? (
                      <button
                        onClick={() => setDetailRunId(file.runId)}
                        className="inline-flex items-center gap-1 text-xs text-[#8F00FF] hover:underline"
                        data-testid={`link-corpus-run-${file.id}`}
                      >
                        <Clock size={11} /> Run #{file.runId}
                      </button>
                    ) : (
                      <span className="text-xs text-[#E0DCE6]/40 italic" data-testid={`text-corpus-run-unknown-${file.id}`}>
                        Unknown run
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-[#E0DCE6]/50 font-mono text-xs">
                    {(file.byteCount / 1024).toFixed(1)} KB
                  </td>
                  {isEditor && (
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {jobsByFileId.get(file.id)?.status === "running" && (
                          <>
                            <span
                              className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#8F00FF]/10 text-[#8F00FF] text-[11px] font-medium"
                              title={`Extraction running (recipe: ${jobsByFileId.get(file.id)?.recipeId})`}
                              data-testid={`badge-extracting-${file.id}`}
                            >
                              <RefreshCw size={11} className="animate-spin" /> Extracting…
                            </span>
                            <button
                              onClick={() => cancelExtractionMutation.mutate(file.id)}
                              disabled={cancelExtractionMutation.isPending}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 disabled:opacity-50 transition-colors"
                              data-testid={`button-stop-extraction-${file.id}`}
                            >
                              <X size={13} /> Stop
                            </button>
                          </>
                        )}
                        {jobsByFileId.get(file.id)?.status === "cancelled" && (
                          <span
                            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-orange-500/10 text-orange-400 text-[11px] font-medium"
                            data-testid={`badge-extraction-cancelled-${file.id}`}
                          >
                            <X size={11} /> Extraction cancelled
                          </span>
                        )}
                        {file.readable ? (
                          <button
                            onClick={() => setViewingReadable({ id: file.id, title: file.title ?? file.editionId ?? "Text" })}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-[#03FF9B]/10 text-[#03FF9B] text-[11px] font-medium hover:bg-[#03FF9B]/20 transition-colors cursor-pointer"
                            title={`Extracted with ${file.readable.recipe_id} on ${new Date(file.readable.extracted_at).toLocaleString()} — click to read`}
                            data-testid={`badge-readable-${file.id}`}
                          >
                            <FileText size={11} /> Readable
                          </button>
                        ) : null}
                        <button
                          onClick={() => setExtractingFile(file)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#350A8C]/40 text-[#E0DCE6]/80 border border-[#350A8C]/50 hover:border-[#8F00FF]/60 hover:text-[#E0DCE6] transition-colors"
                          data-testid={`button-extract-${file.id}`}
                        >
                          <FileText size={13} /> {file.readable ? "Re-extract" : "Extract readable text"}
                        </button>
                        {file.partition === "locked" && (
                          <button
                            onClick={() => setReviewingId(file.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#350A8C]/40 text-[#E0DCE6]/80 border border-[#350A8C]/50 hover:border-[#8F00FF]/60 hover:text-[#E0DCE6] transition-colors"
                            data-testid={`button-review-rights-${file.id}`}
                          >
                            <ShieldCheck size={13} /> Review rights
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
                )),
                ]),
              ])}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="p-8 text-center border border-[#350A8C]/20 rounded-xl bg-[#0B0626]/30">
          <Database size={32} className="mx-auto mb-3 text-[#E0DCE6]/20" />
          <p className="text-[#E0DCE6]/60 text-sm">No files in corpus yet.</p>
        </div>
      )}
      {reviewingId !== null && (
        <RightsReviewModal fileId={reviewingId} onClose={() => setReviewingId(null)} />
      )}
      {extractingFile !== null && (
        <ExtractReadableModal file={extractingFile} onClose={() => setExtractingFile(null)} />
      )}
      {viewingReadable !== null && (
        <CorpusReadableReader
          fileId={viewingReadable.id}
          title={viewingReadable.title}
          onClose={() => setViewingReadable(null)}
        />
      )}
      {detailRunId !== null && (
        <RunDetailModal runId={detailRunId} onClose={() => setDetailRunId(null)} />
      )}
    </div>
  );
}

/** Read extracted Markdown for any corpus file (public or locked) via the editor-authenticated endpoint. */
function CorpusReadableReader({
  fileId,
  title,
  onClose,
}: {
  fileId: number;
  title: string;
  onClose: () => void;
}) {
  const { data, isLoading, error } = useQuery<{ id: number; markdown: string }>({
    queryKey: [`/api/hunter/corpus/${fileId}/readable`],
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#130D30] border border-[#350A8C]/40 rounded-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-start justify-between p-6 pb-4 border-b border-[#350A8C]/30 shrink-0">
          <h3
            className="text-lg font-semibold text-[#E0DCE6] truncate min-w-0"
            style={{ fontFamily: "'Cinzel Decorative', serif" }}
          >
            {title}
          </h3>
          <button onClick={onClose} className="shrink-0 ml-4">
            <X size={20} className="text-[#E0DCE6]/50 hover:text-[#E0DCE6]" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading && <div className="text-[#E0DCE6]/50 text-sm">Loading text…</div>}
          {error && (
            <div className="text-red-400 text-sm flex items-center gap-2">
              <AlertCircle size={16} /> Could not load this text.
            </div>
          )}
          {data?.markdown && (
            <div className="reader-markdown text-[#E0DCE6]/90 text-[15px] leading-relaxed font-serif [&_h1]:text-xl [&_h1]:font-bold [&_h1]:mt-6 [&_h1]:mb-3 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mt-5 [&_h2]:mb-2 [&_h3]:font-semibold [&_h3]:mt-4 [&_h3]:mb-2 [&_p]:my-3 [&_hr]:my-6 [&_hr]:border-[#350A8C]/40 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_blockquote]:border-l-2 [&_blockquote]:border-[#8F00FF]/50 [&_blockquote]:pl-4 [&_a]:text-[#8F00FF]">
              <ReactMarkdown>{data.markdown}</ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Editor dialog to run an extraction recipe on a corpus file: pick (or accept
 * the suggested) recipe, run it, and watch progress while linked pages are
 * crawled. The raw file is never modified; the result is a readable Markdown
 * sibling that the Library reader prefers automatically.
 */
function ExtractReadableModal({ file, onClose }: { file: any; onClose: () => void }) {
  const { toast } = useToast();
  const { data: recipes } = useQuery<{ id: string; label: string; description: string }[]>({
    queryKey: ["/api/hunter/extraction/recipes"],
  });
  const [recipeId, setRecipeId] = useState<string>(file.suggested_recipe ?? file.readable?.recipe_id ?? "");
  const [ocrLanguage, setOcrLanguage] = useState<string>("");
  const [running, setRunning] = useState(false);

  const effectiveRecipe = recipeId || file.suggested_recipe || "";
  const isPdfRecipe = effectiveRecipe === "pdf-text" || effectiveRecipe === "pdf-ocr";
  const { data: ocrLangs } = useQuery<string[]>({
    queryKey: ["/api/hunter/extraction/ocr-languages"],
    enabled: isPdfRecipe,
  });

  // Timestamp of the last "start extraction" success; only status errors that
  // arrive *after* this moment are treated as a lost job. This keeps the
  // harmless 404 from the initial fetch (no job started yet) from poisoning a
  // freshly started run.
  const [startedAtMs, setStartedAtMs] = useState<number | null>(null);

  const statusQueryKey = [`/api/hunter/corpus/${file.id}/extract/status`];
  const { data: job, error: jobError, errorUpdatedAt } = useQuery<any>({
    queryKey: statusQueryKey,
    // Always fetch once so an "interrupted" job (server restarted mid-run)
    // is surfaced when the dialog opens; poll only while a run is active.
    // A 404 just means no extraction has been started for this file.
    refetchInterval: running ? 1500 : false,
    retry: false,
  });

  useEffect(() => {
    if (!running) return;
    // The status endpoint lost track of the job (e.g. the server restarted
    // mid-run) — stop polling and tell the editor instead of spinning forever.
    // Errors from before this run started (the harmless "no job yet" 404) are
    // ignored; only a failure observed after the run began is fatal.
    if (jobError && startedAtMs !== null && errorUpdatedAt > startedAtMs) {
      setRunning(false);
      toast({
        title: "Extraction status lost",
        description: "The server may have restarted while it was running. You can start it again.",
        variant: "destructive",
      });
      return;
    }
    if (!job) return;
    if (job.status === "done") {
      setRunning(false);
      toast({ title: "Extraction complete", description: "A readable version is now available." });
      queryClient.invalidateQueries({ queryKey: ["/api/hunter/corpus"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hunter/library"] });
    } else if (job.status === "error" || job.status === "cancelled" || job.status === "interrupted") {
      setRunning(false);
    }
  }, [job, jobError, errorUpdatedAt, startedAtMs, running, toast]);

  const startMutation = useMutation({
    mutationFn: async () =>
      apiRequest("POST", `/api/hunter/corpus/${file.id}/extract`, {
        ...(recipeId ? { recipe_id: recipeId } : {}),
        ...(isPdfRecipe && ocrLanguage ? { ocr_language: ocrLanguage } : {}),
      }),
    onSuccess: () => {
      // Drop any stale status (e.g. the initial 404 or an old interrupted
      // job) so polling starts from a clean slate for the new run.
      queryClient.removeQueries({ queryKey: statusQueryKey });
      setStartedAtMs(Date.now());
      setRunning(true);
    },
    onError: (e: Error) =>
      toast({ title: "Could not start extraction", description: e.message, variant: "destructive" }),
  });

  const cancelMutation = useMutation({
    mutationFn: async () => apiRequest("POST", `/api/hunter/corpus/${file.id}/extract/cancel`, {}),
    onError: (e: Error) =>
      toast({ title: "Could not cancel extraction", description: e.message, variant: "destructive" }),
  });

  const recipeList = Array.isArray(recipes) ? recipes : [];
  const selected = recipeList.find((r) => r.id === recipeId);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#130D30] border border-[#350A8C]/40 rounded-xl w-full max-w-lg flex flex-col">
        <div className="flex items-start justify-between p-6 pb-4 border-b border-[#350A8C]/30">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-[#E0DCE6]" style={{ fontFamily: "'Cinzel Decorative', serif" }}>
              Extract Readable Text
            </h3>
            <p className="text-sm text-[#E0DCE6]/60 mt-1 truncate">{file.record?.title ?? file.editionId}</p>
          </div>
          <button onClick={onClose} className="shrink-0 ml-4" data-testid="button-close-extract">
            <X size={20} className="text-[#E0DCE6]/50 hover:text-[#E0DCE6]" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#E0DCE6]/60 mb-1.5">Recipe</label>
            <select
              value={recipeId}
              onChange={(e) => setRecipeId(e.target.value)}
              disabled={running}
              className="w-full bg-[#0B0626] border border-[#350A8C]/50 rounded-lg px-3 py-2 text-sm text-[#E0DCE6] focus:border-[#8F00FF] outline-none"
              data-testid="select-extract-recipe"
            >
              <option value="">Auto-detect</option>
              {recipeList.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                  {r.id === file.suggested_recipe ? " (suggested)" : ""}
                </option>
              ))}
            </select>
            {selected && <p className="text-xs text-[#E0DCE6]/50 mt-1.5">{selected.description}</p>}
          </div>
          {isPdfRecipe && (
            <div>
              <label className="block text-xs font-medium text-[#E0DCE6]/60 mb-1.5">OCR language (for scans)</label>
              <select
                value={ocrLanguage}
                onChange={(e) => setOcrLanguage(e.target.value)}
                disabled={running}
                className="w-full bg-[#0B0626] border border-[#350A8C]/50 rounded-lg px-3 py-2 text-sm text-[#E0DCE6] focus:border-[#8F00FF] outline-none"
                data-testid="select-ocr-language"
              >
                <option value="">
                  Auto{file.language ? ` (from work metadata: ${file.language})` : " (default: eng)"}
                </option>
                {(ocrLangs ?? []).map((lang) => (
                  <option key={lang} value={lang}>
                    {lang}
                  </option>
                ))}
              </select>
              <p className="text-xs text-[#E0DCE6]/50 mt-1.5">
                Only used when the PDF is a scan that needs OCR. Pick the language of the printed text (e.g. grc
                for ancient Greek, lat for Latin).
              </p>
            </div>
          )}
          <p className="text-xs text-[#E0DCE6]/50">
            The original download is kept untouched as rights evidence; the readable Markdown version is stored
            alongside it and shown in the Library.
          </p>
          {running && (
            <div className="flex items-center gap-2 text-sm text-[#E0DCE6]/70" data-testid="text-extract-progress">
              <RefreshCw size={14} className="animate-spin text-[#8F00FF]" />
              {job?.progress?.pagesFetched
                ? `Fetching pages... ${job.progress.pagesFetched}${job.progress.totalPages ? ` / ~${job.progress.totalPages}` : ""} (${job.progress.note})`
                : "Extracting..."}
            </div>
          )}
          {job?.status === "cancelled" && !running && (
            <div className="text-yellow-400/80 text-sm" data-testid="text-extract-cancelled">
              Extraction cancelled. No readable version was written; you can run it again anytime.
            </div>
          )}
          {job?.status === "interrupted" && !running && (
            <div className="text-yellow-400/80 text-sm flex items-start gap-2" data-testid="text-extract-interrupted">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              The server restarted while this extraction was running, so it did not finish. Run it again to
              extract the readable version.
            </div>
          )}
          {job?.status === "error" && !running && job.error && (
            <RunErrorReport error={job.error} testId="text-extract-error" />
          )}
          {job?.status === "done" && (
            <div className="text-[#03FF9B] text-sm space-y-1" data-testid="text-extract-done">
              <div>
                Done — {(job.provenance?.markdown_bytes / 1024).toFixed(1)} KB of readable text
                {job.provenance?.pages_fetched ? ` compiled from ${job.provenance.pages_fetched} pages` : ""}.
              </div>
              {job.provenance?.warnings?.length > 0 && (
                <div className="text-yellow-400/80 text-xs">
                  {job.provenance.warnings.length} page(s) had problems — check the ledger below the text if
                  something looks missing.
                </div>
              )}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-3 p-6 pt-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-[#E0DCE6]/70 hover:text-[#E0DCE6] transition-colors"
          >
            Close
          </button>
          {running && (
            <button
              onClick={() => cancelMutation.mutate()}
              disabled={cancelMutation.isPending}
              className="px-4 py-2 rounded-lg text-sm border border-red-400/40 text-red-400 hover:bg-red-400/10 disabled:opacity-50 transition-colors"
              data-testid="button-cancel-extraction"
            >
              {cancelMutation.isPending ? "Cancelling..." : "Cancel"}
            </button>
          )}
          <button
            onClick={() => startMutation.mutate()}
            disabled={running || startMutation.isPending}
            className="px-4 py-2 rounded-lg text-sm bg-[#8F00FF] text-white hover:bg-[#7B00E0] disabled:opacity-50 transition-colors"
            data-testid="button-run-extraction"
          >
            {running ? "Running..." : "Run extraction"}
          </button>
        </div>
      </div>
    </div>
  );
}

function RightsReviewModal({ fileId, onClose }: { fileId: number; onClose: () => void }) {
  const { toast } = useToast();
  const [status, setStatus] = useState<"public_domain" | "open_license">("public_domain");
  const [basis, setBasis] = useState("");
  const [notes, setNotes] = useState("");

  const { data, isLoading, error } = useQuery<any>({
    queryKey: [`/api/hunter/corpus/${fileId}/rights`],
  });

  const reviewMutation = useMutation({
    mutationFn: (decision: "approve_public" | "keep_locked") =>
      apiRequest("POST", `/api/hunter/corpus/${fileId}/review`, {
        decision,
        status,
        basis,
        notes: notes || undefined,
      }),
    onSuccess: (_res, decision) => {
      toast({
        title:
          decision === "approve_public"
            ? "Text cleared for publication"
            : "Determination recorded; text stays locked",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/hunter/corpus"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hunter/library"] });
      queryClient.invalidateQueries({ queryKey: [`/api/hunter/corpus/${fileId}/rights`] });
      onClose();
    },
    onError: (e: Error) =>
      toast({ title: "Review failed", description: e.message, variant: "destructive" }),
  });

  const rights = data?.rights ?? {};
  const reasons: string[] = Array.isArray(rights.reasons) ? rights.reasons : [];
  const reviews: any[] = Array.isArray(data?.reviews) ? data.reviews : [];

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#130D30] border border-[#350A8C]/40 rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-start justify-between p-6 pb-4 border-b border-[#350A8C]/30 shrink-0">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-[#E0DCE6]" data-testid="text-review-title">
              Rights Review
            </h3>
            <p className="text-sm text-[#E0DCE6]/60 mt-1 truncate">
              {data?.title ?? "Loading..."}
              {data?.author ? ` — ${data.author}` : ""}
            </p>
          </div>
          <button onClick={onClose} className="shrink-0 ml-4" data-testid="button-close-review">
            <X size={20} className="text-[#E0DCE6]/50 hover:text-[#E0DCE6]" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {isLoading && <div className="text-[#E0DCE6]/50 text-sm">Loading rights assessment...</div>}
          {error && (
            <div className="text-red-400 text-sm flex items-center gap-2">
              <AlertCircle size={16} /> Could not load the rights assessment.
            </div>
          )}
          {data && (
            <>
              <div className="p-4 rounded-lg bg-orange-500/5 border border-orange-500/20">
                <div className="flex items-center gap-2 text-sm font-medium text-orange-300 mb-2">
                  <Lock size={14} /> Why this text is locked
                </div>
                <div className="text-xs text-[#E0DCE6]/70 space-y-1">
                  <div>
                    Status: <span className="font-mono">{String(rights.status ?? "unknown")}</span>
                    {rights.confidence && (
                      <span className="text-[#E0DCE6]/40"> ({String(rights.confidence)} confidence)</span>
                    )}
                  </div>
                  {reasons.length > 0 && (
                    <ul className="list-disc list-inside" data-testid="list-rights-reasons">
                      {reasons.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  )}
                  {rights.statement && (
                    <div className="text-[#E0DCE6]/50 italic mt-1">“{String(rights.statement)}”</div>
                  )}
                  {data.sourceReference && (
                    <div className="mt-1 break-all">
                      Source: <span className="font-mono">{data.sourceReference}</span>
                    </div>
                  )}
                </div>
              </div>

              {data.aiClaims && (
                <div className="p-4 rounded-lg bg-[#8F00FF]/5 border border-[#8F00FF]/20">
                  <div className="flex items-center gap-2 text-sm font-medium text-[#8F00FF] mb-2">
                    <AlertCircle size={14} /> Unverified AI claims (hints only — never trust without checking)
                  </div>
                  <div className="text-xs text-[#E0DCE6]/70 space-y-1" data-testid="text-ai-claims">
                    {data.aiClaims.statement && <div>Claimed rights: {String(data.aiClaims.statement)}</div>}
                    {data.aiClaims.license_url && (
                      <div className="break-all">Claimed license URL: {String(data.aiClaims.license_url)}</div>
                    )}
                  </div>
                </div>
              )}

              {reviews.length > 0 && (
                <div>
                  <div className="text-sm font-medium text-[#E0DCE6]/80 mb-2">Previous determinations</div>
                  <div className="space-y-2">
                    {reviews.map((r) => (
                      <div key={r.id} className="p-3 rounded-lg bg-[#0B0626]/60 border border-[#350A8C]/20 text-xs text-[#E0DCE6]/70">
                        <div className="flex items-center justify-between">
                          <span className={r.decision === "approve_public" ? "text-[#03FF9B]" : "text-orange-300"}>
                            {r.decision === "approve_public" ? "Approved for publication" : "Kept locked"}
                          </span>
                          <span className="text-[#E0DCE6]/40">{new Date(r.createdAt).toLocaleString()}</span>
                        </div>
                        <div className="mt-1">Basis: {r.basis}</div>
                        {r.notes && <div className="text-[#E0DCE6]/50">Notes: {r.notes}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-3 pt-2 border-t border-[#350A8C]/20">
                <div className="text-sm font-medium text-[#E0DCE6]/80">Manual determination</div>
                <div>
                  <label className="block text-xs text-[#E0DCE6]/50 mb-1">Determined status (if approving)</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as "public_domain" | "open_license")}
                    className="w-full px-3 py-2 rounded-lg bg-[#0B0626] border border-[#350A8C]/40 text-sm text-[#E0DCE6] focus:outline-none focus:border-[#8F00FF]/60"
                    data-testid="select-review-status"
                  >
                    <option value="public_domain">Public domain</option>
                    <option value="open_license">Open license</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-[#E0DCE6]/50 mb-1">
                    Basis for the determination (required)
                  </label>
                  <input
                    value={basis}
                    onChange={(e) => setBasis(e.target.value)}
                    placeholder="e.g. Author died 1820; verified against source edition page"
                    className="w-full px-3 py-2 rounded-lg bg-[#0B0626] border border-[#350A8C]/40 text-sm text-[#E0DCE6] focus:outline-none focus:border-[#8F00FF]/60"
                    data-testid="input-review-basis"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#E0DCE6]/50 mb-1">Notes (optional)</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 rounded-lg bg-[#0B0626] border border-[#350A8C]/40 text-sm text-[#E0DCE6] focus:outline-none focus:border-[#8F00FF]/60"
                    data-testid="input-review-notes"
                  />
                </div>
              </div>
            </>
          )}
        </div>
        <div className="flex items-center justify-end gap-3 p-6 pt-4 border-t border-[#350A8C]/30 shrink-0">
          <button
            onClick={() => reviewMutation.mutate("keep_locked")}
            disabled={reviewMutation.isPending || !basis.trim()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-[#350A8C]/40 text-[#E0DCE6]/80 border border-[#350A8C]/50 hover:border-orange-400/50 disabled:opacity-50 transition-colors"
            data-testid="button-keep-locked"
          >
            <Lock size={14} /> Keep Locked
          </button>
          <button
            onClick={() => reviewMutation.mutate("approve_public")}
            disabled={reviewMutation.isPending || !basis.trim()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-[#03FF9B]/20 text-[#03FF9B] border border-[#03FF9B]/30 hover:bg-[#03FF9B]/30 disabled:opacity-50 transition-colors"
            data-testid="button-approve-public"
          >
            {reviewMutation.isPending ? <RefreshCw size={14} className="animate-spin" /> : <Unlock size={14} />}
            Approve & Publish
          </button>
        </div>
      </div>
    </div>
  );
}
const RECIPE_META: Record<string, { icon: React.ReactNode; when: string; tip: string }> = {
  "html-index-crawl": {
    icon: <Globe size={22} className="text-[#8F00FF]" />,
    when: "Use when the downloaded file is a table-of-contents page with links to individual chapters or sections.",
    tip: "Follows every in-scope link, strips nav/boilerplate, and stitches the pages together in order. Robots-checked and throttled.",
  },
  "html-single-page": {
    icon: <FileText size={22} className="text-[#8F00FF]" />,
    when: "Use when the whole text sits on one HTML page with no chapter links to follow.",
    tip: "Strips scripts, navigation, headers, footers and ads, then converts the remaining content to clean Markdown.",
  },
  "pdf-text": {
    icon: <FileType size={22} className="text-[#8F00FF]" />,
    when: "Use for most PDFs — especially born-digital ones where the text is already embedded.",
    tip: "Extracts the embedded text layer first. If the layer is too sparse (a scanned image PDF), it automatically falls back to tesseract OCR page by page.",
  },
  "pdf-ocr": {
    icon: <ScanLine size={22} className="text-[#8F00FF]" />,
    when: "Use for scanned-image PDFs where the text layer is missing or full of garbled characters.",
    tip: "Renders every page as an image and runs tesseract on each one — slower but more accurate for pure-image scans. Supports non-English languages.",
  },
  "docx": {
    icon: <Code size={22} className="text-[#8F00FF]" />,
    when: "Use when the downloaded file is a .docx Word document.",
    tip: "Converts the document structure (headings, paragraphs, lists) to Markdown using mammoth. Embedded images are dropped.",
  },
  "ocr-cleanup": {
    icon: <Wand2 size={22} className="text-[#8F00FF]" />,
    when: "Use for plain-text transcriptions from archive.org that are hard-wrapped, full of page numbers, or have garbled hyphenation.",
    tip: "Removes running headers and page-number lines that repeat ≥5 times, repairs mid-word line breaks, and re-flows lines into proper paragraphs.",
  },
};

function HunterExtractors() {
  const { data: recipes, isLoading } = useQuery<
    { id: string; version: string; label: string; description: string }[]
  >({ queryKey: ["/api/hunter/extraction/recipes"] });

  if (isLoading)
    return <div className="text-[#E0DCE6]/50 text-sm py-4">Loading extractors…</div>;

  return (
    <div>
      <div className="mb-5">
        <h2 className="text-base font-semibold text-[#E0DCE6] mb-1">Extraction Recipes</h2>
        <p className="text-xs text-[#E0DCE6]/50 leading-relaxed max-w-2xl">
          When you click <span className="text-[#E0DCE6]/70 font-medium">Extract readable text</span> on
          a corpus file, a recipe converts the raw download into clean Markdown. The auto-detect
          picks the most likely recipe based on file extension and content; you can always override it.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {(recipes ?? []).map((recipe) => {
          const meta = RECIPE_META[recipe.id];
          return (
            <div
              key={recipe.id}
              className="rounded-xl border border-[#350A8C]/30 bg-[#0B0626]/40 p-5 flex flex-col gap-3 hover:border-[#8F00FF]/40 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="shrink-0 mt-0.5 w-9 h-9 rounded-lg bg-[#350A8C]/30 flex items-center justify-center">
                  {meta?.icon ?? <FileText size={22} className="text-[#8F00FF]" />}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-[#E0DCE6] text-sm leading-tight">
                      {recipe.label}
                    </span>
                    <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-[#350A8C]/40 text-[#E0DCE6]/40">
                      {recipe.id}
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs text-[#E0DCE6]/60 leading-relaxed">
                    {recipe.description}
                  </p>
                </div>
              </div>
              {meta && (
                <div className="space-y-2 border-t border-[#350A8C]/20 pt-3">
                  <div className="flex gap-2 text-xs">
                    <span className="shrink-0 text-[#03FF9B]/70 font-medium w-16">When</span>
                    <span className="text-[#E0DCE6]/55 leading-relaxed">{meta.when}</span>
                  </div>
                  <div className="flex gap-2 text-xs">
                    <span className="shrink-0 text-[#8F00FF]/80 font-medium w-16">How</span>
                    <span className="text-[#E0DCE6]/55 leading-relaxed">{meta.tip}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function HunterVerify({ isEditor }: { isEditor: boolean }) {
  const { data, isLoading } = useQuery<any>({ queryKey: ["/api/hunter/verify/latest"] });
  const { toast } = useToast();

  const verifyMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/hunter/verify"),
    onSuccess: () => {
      toast({ title: "Verification complete" });
      queryClient.invalidateQueries({ queryKey: ["/api/hunter/verify/latest"] });
    },
    onError: (e: Error) => toast({ title: "Verification failed", description: e.message, variant: "destructive" })
  });

  if (isLoading) return <div className="text-[#E0DCE6]/50 text-sm">Loading verification status...</div>;

  const run = data?.run;
  const report = data?.report;
  
  const isOk = report?.ok === true || report?.overall_status === "ok";

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-lg font-medium text-[#E0DCE6] mb-1">Corpus Verification</h3>
          {run ? (
            <p className="text-sm text-[#E0DCE6]/60">
              Last verified: {new Date(run.startedAt).toLocaleString()}
            </p>
          ) : (
            <p className="text-sm text-[#E0DCE6]/60">Corpus has not been verified yet.</p>
          )}
        </div>
        {isEditor ? (
          <button
            onClick={() => verifyMutation.mutate()}
            disabled={verifyMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-[#8F00FF] text-white hover:bg-[#7B00E0] disabled:opacity-50 transition-colors"
            data-testid="button-verify-corpus"
          >
            {verifyMutation.isPending ? <RefreshCw size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
            Verify Corpus
          </button>
        ) : (
          <div className="text-xs text-[#E0DCE6]/50" data-testid="hint-verify-edit-mode">
            Enter edit mode to run a verification check.
          </div>
        )}
      </div>

      {report && (
        <div className={`p-6 rounded-xl border ${isOk ? "bg-[#03FF9B]/5 border-[#03FF9B]/20" : "bg-red-500/5 border-red-500/20"}`}>
          <div className="flex items-center gap-3 mb-4">
            {isOk ? <ShieldCheck className="text-[#03FF9B]" size={24} /> : <ShieldAlert className="text-red-400" size={24} />}
            <h4 className={`text-lg font-medium ${isOk ? "text-[#03FF9B]" : "text-red-400"}`}>
              {isOk ? "Corpus is pristine" : "Anomalies detected"}
            </h4>
          </div>
          
          {!isOk && report.problems && report.problems.length > 0 && (
            <ul className="space-y-2 mt-4">
              {report.problems.map((prob: string, i: number) => (
                <li key={i} className="flex items-start gap-2 text-sm text-red-300/80 bg-red-500/10 p-2 rounded">
                  <AlertCircle size={14} className="shrink-0 mt-0.5" />
                  <span>{prob}</span>
                </li>
              ))}
            </ul>
          )}
          
          <div className="mt-6 pt-4 border-t border-white/5">
            <details>
              <summary className="text-xs text-[#E0DCE6]/50 cursor-pointer hover:text-[#E0DCE6]/80 transition-colors">
                View Raw Report
              </summary>
              <pre className="mt-3 p-4 bg-[#0B0626] rounded border border-[#350A8C]/20 text-xs text-[#E0DCE6]/70 font-mono overflow-auto">
                {JSON.stringify(report, null, 2)}
              </pre>
            </details>
          </div>
        </div>
      )}
    </div>
  );
}

function statusText(code: number): string {
  const map: Record<number, string> = {
    200: "OK", 201: "Created", 204: "No Content",
    301: "Moved Permanently", 302: "Found", 303: "See Other", 307: "Temporary Redirect", 308: "Permanent Redirect",
    400: "Bad Request", 401: "Unauthorized", 403: "Forbidden", 404: "Not Found",
    405: "Method Not Allowed", 408: "Request Timeout", 410: "Gone",
    429: "Too Many Requests", 500: "Internal Server Error", 502: "Bad Gateway",
    503: "Service Unavailable", 504: "Gateway Timeout",
  };
  return map[code] ?? "";
}
/**
 * True when the card's direct file URL is one the hunter constructed but the
 * source rejected (repair attempted and gave up) and a real item page exists.
 * Such a URL must not be presented as a usable link.
 */
function isDeadDirectLink(b: any): boolean {
  return Boolean(b?.url) && !b?.resolvedUrl && b?.repairState === "not_repairable" && Boolean(b?.itemUrl);
}

function HunterManualFetch() {
  const { toast } = useToast();

  const { data: items, isLoading } = useQuery<any[]>({
    queryKey: ["/api/hunter/manual-fetch"],
    // While the hunter is repairing links in the background, keep the queue
    // fresh so entries disappear as they resolve.
    refetchInterval: (q) =>
      Array.isArray(q.state.data) &&
      q.state.data.some((b: any) => b?.repair_state === "in_progress" || b?.repairState === "in_progress")
        ? 4000
        : false,
  });

  const [checkStates, setCheckStates] = useState<Record<number, CardCheckState>>({});

  const verifyLink = async (id: number, url: string) => {
    setCheckStates((prev) => ({ ...prev, [id]: { phase: "checking" } }));
    try {
      const res = await fetch(
        `/api/hunter/check-url?id=${encodeURIComponent(id)}`,
        { headers: authHeaders() },
      );
      const data: CheckResult = await res.json();
      setCheckStates((prev) => ({ ...prev, [id]: { phase: "done", result: data } }));
    } catch (e: any) {
      setCheckStates((prev) => ({
        ...prev,
        [id]: {
          phase: "done",
          result: { status: null, ok: false, redirected: false, finalUrl: url, error: String(e?.message ?? e) },
        },
      }));
    }
  };

  const resetCheck = (id: number) =>
    setCheckStates((prev) => ({ ...prev, [id]: { phase: "idle" } }));

  const [bulkCheck, setBulkCheck] = useState<{ running: boolean; done: number; total: number }>({
    running: false,
    done: 0,
    total: 0,
  });

  /** Check every card that has a URL, a few at a time so no site gets hammered. */
  const verifyAllLinks = async (targets: { id: number; url: string }[]) => {
    if (bulkCheck.running || targets.length === 0) return;
    setBulkCheck({ running: true, done: 0, total: targets.length });
    const CONCURRENCY = 3;
    const queue = [...targets];
    const worker = async () => {
      for (;;) {
        const next = queue.shift();
        if (!next) return;
        await verifyLink(next.id, next.url);
        setBulkCheck((prev) => ({ ...prev, done: prev.done + 1 }));
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, targets.length) }, worker));
    setBulkCheck((prev) => ({ ...prev, running: false }));
  };

  const [uploadingId, setUploadingId] = useState<number | null>(null);
  const uploadMutation = useMutation({
    mutationFn: async ({ id, file }: { id: number; file: File }) => {
      const text = await file.text();
      const res = await fetch(`/api/hunter/blockers/${id}/upload`, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "text/plain" },
        body: text,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || `Upload failed (${res.status})`);
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Text uploaded",
        description:
          data.partition === "public"
            ? "Rights cleared — the text is now readable in the Library."
            : "Rights still unclear — the text was saved to the locked research partition.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/hunter/manual-fetch"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hunter/blockers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hunter/corpus"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hunter/library"] });
    },
    onError: (e: Error) =>
      toast({ title: "Upload failed", description: e.message, variant: "destructive" }),
    onSettled: () => setUploadingId(null),
  });

  const pickFileFor = (id: number) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".txt,.text,.html,.htm,.xml,.md";
    input.onchange = () => {
      const file = input.files?.[0];
      if (file) {
        setUploadingId(id);
        uploadMutation.mutate({ id, file });
      }
    };
    input.click();
  };

  const dismissMutation = useMutation({
    mutationFn: ({ id }: { id: number }) =>
      apiRequest("PATCH", `/api/hunter/blockers/${id}`, { status: "dismissed" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hunter/manual-fetch"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hunter/blockers"] });
    },
    onError: (e: Error) =>
      toast({ title: "Update failed", description: e.message, variant: "destructive" }),
  });

  const list = Array.isArray(items) ? items : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex-1 min-w-[240px]">
        <h3 className="text-lg font-medium text-[#E0DCE6] mb-1">Assisted manual fetch</h3>
        <p className="text-sm text-[#E0DCE6]/60">
          These texts can only be obtained by hand: their source forbids automated downloads
          (robots.txt, manual-only policy, or a required login) and no alternative edition could be
          fetched. Open the link in a new tab, save the page or text file, then upload it here — it
          goes through the same rights review as any automated download.
        </p>
        </div>
        {(() => {
          const targets = (Array.isArray(items) ? items : [])
            .filter((b: any) => (b.resolvedUrl || b.url) && !isDeadDirectLink(b))
            .map((b: any) => ({ id: b.id as number, url: (b.resolvedUrl || b.url) as string }));
          if (targets.length < 2) return null;
          return (
            <button
              onClick={() => verifyAllLinks(targets)}
              disabled={bulkCheck.running}
              data-testid="button-verify-all-links"
              className="shrink-0 px-3 py-1.5 rounded-lg text-sm border border-[#350A8C]/40 text-[#E0DCE6]/80 hover:bg-[#350A8C]/20 hover:text-[#E0DCE6] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {bulkCheck.running
                ? `Checking ${bulkCheck.done} of ${bulkCheck.total}…`
                : "Verify all links"}
            </button>
          );
        })()}
      </div>

      {isLoading ? (
        <div className="text-sm text-[#E0DCE6]/40">Loading…</div>
      ) : list.length === 0 ? (
        <div className="p-6 rounded-xl border border-[#350A8C]/30 bg-[#0B0626]/50 text-sm text-[#E0DCE6]/50">
          Nothing needs a manual fetch right now — every blocked text either has a fetched
          alternative edition or its blocker was resolved.
        </div>
      ) : (
        <div className="space-y-2">
          {list.map((b: any) => (
            <div
              key={b.id}
              className="p-4 rounded-xl border border-[#350A8C]/30 bg-[#130D30]/50 flex flex-wrap items-start gap-3"
            >
              <div className="flex-1 min-w-[240px] space-y-1">
                <div className="text-sm text-[#E0DCE6] font-medium">
                  {b.title || b.workId || "Unknown text"}
                  {b.language && (
                    <span className="ml-2 text-xs text-[#E0DCE6]/40 uppercase">{b.language}</span>
                  )}
                </div>
                <div className="text-xs text-[#FF4D6D]">
                  {BLOCKER_REASON_LABELS[b.reason] ?? b.reason}
                  {b.detail ? <span className="text-[#E0DCE6]/40"> — {b.detail}</span> : null}
                </div>
                {b.repairState === "in_progress" && (
                  <div
                    className="text-xs text-[#FFB800]"
                    data-testid={`repair-state-${b.id}`}
                  >
                    Checking this link against the source and retrying the download…
                  </div>
                )}
                {b.repairState === "repaired" && (
                  <div
                    className="text-xs text-[#03FF9B]"
                    data-testid={`repair-state-${b.id}`}
                  >
                    {b.repairDetail || "Link repaired automatically; the text was downloaded."}
                  </div>
                )}
                {b.repairState === "not_repairable" && b.repairDetail && (
                  <div
                    className="text-xs text-[#E0DCE6]/50"
                    data-testid={`repair-state-${b.id}`}
                  >
                    {b.repairDetail}
                  </div>
                )}
                {b.itemUrl && (
                  <a
                    href={b.itemUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="block text-xs text-[#C77DFF] hover:underline break-all"
                    data-testid={`link-item-page-${b.id}`}
                  >
                    {b.itemUrl} ↗
                  </a>
                )}
                {b.resolvedUrl && b.resolvedUrl !== b.url && b.url && (
                  <div className="text-xs text-[#E0DCE6]/30 break-all line-through">
                    was: {b.url}
                  </div>
                )}
                {/* A direct file link we constructed that the source rejected: show it
                    struck through so editors don't mistake it for a usable link. */}
                {isDeadDirectLink(b) && (
                  <div className="text-xs text-[#E0DCE6]/30 break-all line-through" data-testid={`dead-link-${b.id}`}>
                    {b.url}
                  </div>
                )}
                {(b.resolvedUrl || b.url) && !isDeadDirectLink(b) && (
                  <div className="flex flex-wrap items-center gap-2">
                    <a
                      href={b.resolvedUrl || b.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-[#03FF9B] hover:underline break-all"
                    >
                      {b.resolvedUrl || b.url}
                    </a>
                    {(() => {
                      const cs = checkStates[b.id];
                      if (!cs || cs.phase === "idle") {
                        return (
                          <button
                            onClick={() => verifyLink(b.id, b.resolvedUrl || b.url)}
                            className="shrink-0 px-2 py-0.5 rounded text-xs text-[#E0DCE6]/60 border border-[#350A8C]/30 hover:bg-[#350A8C]/20 hover:text-[#E0DCE6]"
                          >
                            Verify link
                          </button>
                        );
                      }
                      if (cs.phase === "checking") {
                        return (
                          <span className="shrink-0 px-2 py-0.5 rounded text-xs text-[#E0DCE6]/40 border border-[#350A8C]/30">
                            Checking…
                          </span>
                        );
                      }
                      // done
                      const r = cs.result!;
                      let color = "#FF4D6D";
                      let label: string;
                      if (r.error) {
                        label = r.error.length > 40 ? r.error.slice(0, 40) + "…" : r.error;
                      } else if (r.redirected) {
                        color = "#FFB800";
                        let shortHost = r.finalUrl;
                        try { shortHost = new URL(r.finalUrl).hostname; } catch {}
                        label = `Redirect → ${shortHost}`;
                      } else if (r.ok) {
                        color = "#03FF9B";
                        label = `${r.status} OK`;
                      } else {
                        label = r.status ? `${r.status} ${statusText(r.status)}` : "Unreachable";
                      }
                      return (
                        <button
                          onClick={() => resetCheck(b.id)}
                          title="Click to re-check"
                          style={{ color, borderColor: color + "55" }}
                          className="shrink-0 px-2 py-0.5 rounded text-xs border bg-transparent hover:opacity-70"
                        >
                          {label}
                        </button>
                      );
                    })()}
                  </div>
                )}
                {b.sourceId && (
                  <div className="text-xs text-[#E0DCE6]/40">Source: {b.sourceId}</div>
                )}
              </div>
              <div className="flex items-center gap-2">
                {b.can_upload ? (
                  <button
                    onClick={() => pickFileFor(b.id)}
                    disabled={uploadingId === b.id}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[#8F00FF]/20 text-[#C77DFF] border border-[#8F00FF]/40 hover:bg-[#8F00FF]/30 disabled:opacity-50"
                  >
                    {uploadingId === b.id ? "Uploading…" : "Upload saved text"}
                  </button>
                ) : (
                  <span className="text-xs text-[#E0DCE6]/40">
                    No candidate attached — add it via Candidates first
                  </span>
                )}
                <button
                  onClick={() => dismissMutation.mutate({ id: b.id })}
                  className="px-3 py-1.5 rounded-lg text-xs text-[#E0DCE6]/50 border border-[#350A8C]/30 hover:bg-[#350A8C]/20"
                >
                  Dismiss
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function HunterCatalog() {
  const [format, setFormat] = useState("tei");
  const [url, setUrl] = useState("");
  const [payload, setPayload] = useState("");
  const [results, setResults] = useState<any>(null);
  const { toast } = useToast();

  const catalogMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/hunter/catalog", { 
        format, 
        url: url || undefined, 
        payload: payload || undefined 
      });
      return res.json();
    },
    onSuccess: (data) => {
      setResults(data);
      toast({ title: "Catalog parsed successfully" });
    },
    onError: (e: Error) => toast({ title: "Catalog parse failed", description: e.message, variant: "destructive" })
  });

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-[#E0DCE6] mb-1">Catalog Builder</h3>
        <p className="text-sm text-[#E0DCE6]/60">
          Parse external metadata feeds into candidate formats.
        </p>
      </div>

      <div className="bg-[#0B0626]/50 border border-[#350A8C]/30 rounded-xl p-5 space-y-4">
        <div>
          <label className="block text-xs text-[#E0DCE6]/60 mb-1">Format</label>
          <select 
            value={format} 
            onChange={e => setFormat(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-[#130D30] border border-[#350A8C]/40 text-[#E0DCE6] text-sm focus:outline-none focus:border-[#8F00FF]/60"
          >
            <option value="oai_dc">OAI-PMH (Dublin Core)</option>
            <option value="tei">TEI XML</option>
            <option value="iiif">IIIF Manifest</option>
            <option value="mediawiki">MediaWiki API</option>
            <option value="plain_text">Plain Text</option>
            <option value="legacy_jsonl">Legacy JSONL</option>
          </select>
        </div>
        
        <div>
          <label className="block text-xs text-[#E0DCE6]/60 mb-1">Endpoint URL (Optional)</label>
          <input 
            type="url"
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="https://..."
            className="w-full px-3 py-2 rounded-lg bg-[#130D30] border border-[#350A8C]/40 text-[#E0DCE6] text-sm focus:outline-none focus:border-[#8F00FF]/60"
          />
        </div>

        <div>
          <label className="block text-xs text-[#E0DCE6]/60 mb-1">Direct Payload (Optional)</label>
          <textarea 
            value={payload}
            onChange={e => setPayload(e.target.value)}
            placeholder="Paste XML or JSON payload here..."
            className="w-full px-3 py-2 rounded-lg bg-[#130D30] border border-[#350A8C]/40 text-[#E0DCE6] text-sm font-mono focus:outline-none focus:border-[#8F00FF]/60 min-h-[100px]"
          />
        </div>

        <button
          onClick={() => catalogMutation.mutate()}
          disabled={catalogMutation.isPending || (!url && !payload)}
          className="px-4 py-2 rounded-lg bg-[#8F00FF] text-white text-sm font-medium hover:bg-[#7B00E0] disabled:opacity-50 transition-colors"
        >
          {catalogMutation.isPending ? "Parsing..." : "Parse Catalog"}
        </button>
      </div>

      {results && (
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-[#E0DCE6]">Parsed Records ({results.records?.length || 0})</h4>
          <div className="bg-[#0B0626] border border-[#350A8C]/30 rounded-xl p-4 overflow-auto max-h-[400px]">
            <pre className="text-xs text-[#E0DCE6]/70 font-mono">
              {JSON.stringify(results.records, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

function RunDetailModal({ runId, onClose }: { runId: number; onClose: () => void }) {
  const { data: run, isLoading, error } = useQuery<any>({
    queryKey: [`/api/hunter/runs/${runId}`],
  });
  const result = run?.result ?? {};
  // Summary shape depends on the run kind: cycles carry a `scope`; download
  // and retry runs have their own flat summaries (only once completed —
  // while running, `result` holds progress, not a summary).
  const kind = String(run?.kind ?? "");
  const summary =
    kind === "cycle"
      ? result.scope
        ? result
        : null
      : run?.status === "completed" && result && Object.keys(result).length > 0
        ? result
        : null;
  const statRows: [string, unknown][] =
    kind === "download"
      ? [
          ["Records", summary?.records],
          ["Downloaded", summary?.downloaded],
          ["Already present", summary?.already_present],
          ["Metadata only", summary?.metadata_only],
          ["Failed", summary?.failed],
          ["Extractions queued", summary?.auto_extraction?.queued],
        ]
      : kind === "retry"
        ? [
            ["Download status", summary?.download_status],
            ["Outcome", summary?.outcome],
            ["Extractions queued", summary?.auto_extraction?.queued],
          ]
        : [
            ["Discovered", summary?.discovered],
            ["Candidates created", summary?.created],
            ["Duplicates skipped", summary?.duplicates],
            ["Invalid leads", summary?.invalid],
            ["Secondary skipped", summary?.secondary],
            ["Downloaded (public)", summary?.downloaded_public],
            ["Downloaded (locked)", summary?.downloaded_locked],
            ["Metadata only", summary?.metadata_only],
            ["Failed", summary?.failed],
            ["Extractions queued", summary?.auto_extraction?.queued],
          ];
  const files = Array.isArray(run?.files) ? run.files : [];
  const blockers = Array.isArray(run?.blockers) ? run.blockers : [];
  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-[#130D30] border border-[#350A8C]/40 rounded-xl w-full max-w-3xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        data-testid="modal-run-detail"
      >
        <div className="flex items-start justify-between p-6 pb-4 border-b border-[#350A8C]/30 shrink-0">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-[#E0DCE6]" data-testid="text-run-detail-title">
              Run #{runId}
              {run && <span className="capitalize text-[#E0DCE6]/60 font-normal"> · {run.kind}</span>}
            </h3>
            {run && (
              <p className="text-sm text-[#E0DCE6]/60 mt-1">
                {new Date(run.startedAt).toLocaleString()}
                {" · "}
                <span
                  className={
                    run.status === "completed"
                      ? "text-[#03FF9B]"
                      : run.status === "failed"
                        ? "text-red-400"
                        : "text-orange-400"
                  }
                >
                  {run.status}
                </span>
                {summary?.scope?.query && <> · “{summary.scope.query}”</>}
              </p>
            )}
          </div>
          <button onClick={onClose} className="shrink-0 ml-4" data-testid="button-close-run-detail">
            <X size={20} className="text-[#E0DCE6]/50 hover:text-[#E0DCE6]" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {isLoading && <div className="text-[#E0DCE6]/50 text-sm">Loading run...</div>}
          {!!error && (
            <div className="text-red-400 text-sm flex items-center gap-2">
              <AlertCircle size={16} /> Could not load this run.
            </div>
          )}
          {run?.error && <RunErrorReport error={run.error} testId={`run-error-detail-${runId}`} />}
          {summary && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              {statRows.map(([label, value]) => (
                <div key={String(label)} className="p-2 rounded-lg bg-[#0B0626] border border-[#350A8C]/20">
                  <div className="text-[#E0DCE6]/50">{label}</div>
                  <div className="text-[#E0DCE6] text-base font-medium">{String(value ?? 0)}</div>
                </div>
              ))}
            </div>
          )}
          {summary && <AutoExtractionFailures failures={summary.auto_extraction?.failed} />}
          {run && (
            <div>
              <h4 className="text-sm font-medium text-[#E0DCE6]/80 mb-2">
                Corpus files produced ({files.length})
              </h4>
              {files.length === 0 ? (
                <div className="text-xs text-[#E0DCE6]/50 p-3 border border-[#350A8C]/20 rounded-lg bg-[#0B0626]/40">
                  No corpus files are recorded for this run.
                </div>
              ) : (
                <div className="border border-[#350A8C]/30 rounded-lg overflow-hidden bg-[#0B0626]/50">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-[#0B0626] border-b border-[#350A8C]/30 text-[#E0DCE6]/60">
                      <tr>
                        <th className="px-3 py-2 font-medium">Work / Edition</th>
                        <th className="px-3 py-2 font-medium">Partition</th>
                        <th className="px-3 py-2 font-medium text-right">Size</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#350A8C]/10">
                      {files.map((f: any) => (
                        <tr key={f.id} data-testid={`row-run-file-${f.id}`}>
                          <td className="px-3 py-2">
                            <div className="text-[#E0DCE6]">{f.workId}</div>
                            <div className="text-[#E0DCE6]/50 font-mono">{f.editionId}</div>
                          </td>
                          <td className="px-3 py-2">
                            {f.partition === "locked" ? (
                              <span className="inline-flex items-center gap-1 text-orange-400"><Lock size={11} /> Locked</span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[#03FF9B]"><Unlock size={11} /> Public</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right text-[#E0DCE6]/50 font-mono">
                            {((f.byteCount ?? 0) / 1024).toFixed(1)} KB
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
          {run && blockers.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-[#E0DCE6]/80 mb-2">
                Blockers recorded ({blockers.length})
              </h4>
              <ul className="space-y-2">
                {blockers.map((b: any) => (
                  <li key={b.id} className="p-3 rounded-lg border border-[#350A8C]/20 bg-[#0B0626]/40 text-xs" data-testid={`row-run-blocker-${b.id}`}>
                    <span className="inline-flex px-2 py-0.5 rounded-md bg-red-500/10 text-red-300 font-medium mr-2">
                      {BLOCKER_REASON_LABELS[b.reason] ?? b.reason}
                    </span>
                    <span className="text-[#E0DCE6]/70">{b.detail}</span>
                    <span className="ml-2 text-[#E0DCE6]/40 capitalize">({b.status})</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
function HunterRuns() {
  const { data: runs, isLoading } = useQuery({ queryKey: ["/api/hunter/runs"] });
  const [detailRunId, setDetailRunId] = useState<number | null>(null);

  if (isLoading) return <div className="text-[#E0DCE6]/50 text-sm">Loading runs...</div>;

  const items = Array.isArray(runs) ? runs : [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-lg font-medium text-[#E0DCE6] mb-1">Runs History</h3>
          <p className="text-sm text-[#E0DCE6]/60">Recent background jobs</p>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="text-sm text-[#E0DCE6]/50 p-4 border border-[#350A8C]/20 rounded-lg bg-[#0B0626]/50">
          No recent runs.
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((run: any) => (
            <div
              key={run.id}
              onClick={() => setDetailRunId(run.id)}
              className="flex items-center justify-between p-3 rounded-lg border border-[#350A8C]/20 bg-[#0B0626]/30 cursor-pointer hover:border-[#8F00FF]/50 transition-colors"
              data-testid={`row-run-${run.id}`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full ${
                  run.status === "completed" ? "bg-[#03FF9B]/10 text-[#03FF9B]" :
                  run.status === "failed" ? "bg-red-500/10 text-red-400" :
                  "bg-orange-500/10 text-orange-400"
                }`}>
                  {run.kind === "plan" ? <Code size={14} /> :
                   run.kind === "download" ? <Download size={14} /> :
                   run.kind === "verify" ? <ShieldCheck size={14} /> : <Clock size={14} />}
                </div>
                <div>
                  <div className="text-sm font-medium text-[#E0DCE6] capitalize">{run.kind} Run</div>
                  <div className="text-xs text-[#E0DCE6]/50">
                    {new Date(run.startedAt).toLocaleString()}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className={`text-xs font-bold uppercase tracking-wider ${
                  run.status === "completed" ? "text-[#03FF9B]" :
                  run.status === "failed" ? "text-red-400" :
                  "text-orange-400"
                }`}>
                  {run.status}
                </div>
                {run.finishedAt && (
                  <div className="text-xs text-[#E0DCE6]/40 mt-0.5">
                    {Math.round((new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime()) / 1000)}s
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {detailRunId !== null && (
        <RunDetailModal runId={detailRunId} onClose={() => setDetailRunId(null)} />
      )}
    </div>
  );
}

function HunterPolicy({ isEditor }: { isEditor: boolean }) {
  const { data: policy, isLoading } = useQuery({ queryKey: ["/api/hunter/policy"] });
  const [editing, setEditing] = useState(false);
  const [policyStr, setPolicyStr] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    if (policy && !editing) {
      setPolicyStr(JSON.stringify(policy, null, 2));
    }
  }, [policy, editing]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      let parsed;
      try {
        parsed = JSON.parse(policyStr);
      } catch (e) {
        throw new Error("Invalid JSON");
      }
      return apiRequest("PUT", "/api/hunter/policy", parsed);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hunter/policy"] });
      setEditing(false);
      toast({ title: "Policy updated" });
    },
    onError: (e: Error) => toast({ title: "Failed to update policy", description: e.message, variant: "destructive" })
  });

  if (isLoading) return <div className="text-[#E0DCE6]/50 text-sm">Loading policy...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-lg font-medium text-[#E0DCE6] mb-1">Collection Policy</h3>
          <p className="text-sm text-[#E0DCE6]/60">Rules governing automated assessment and downloading</p>
        </div>
        {isEditor && !editing && (
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm bg-[#350A8C]/30 border border-[#350A8C]/40 text-[#E0DCE6] hover:bg-[#350A8C]/50 transition-colors"
          >
            <Pencil size={14} /> Edit Policy
          </button>
        )}
      </div>

      <div className="bg-[#0B0626] border border-[#350A8C]/30 rounded-xl overflow-hidden">
        {editing ? (
          <div className="flex flex-col">
            <textarea
              value={policyStr}
              onChange={e => setPolicyStr(e.target.value)}
              className="w-full p-4 bg-transparent text-[#E0DCE6] text-sm font-mono focus:outline-none min-h-[400px]"
              spellCheck={false}
            />
            <div className="p-3 bg-[#130D30] border-t border-[#350A8C]/30 flex justify-end gap-2">
              <button 
                onClick={() => setEditing(false)} 
                className="px-4 py-2 rounded-lg text-sm text-[#E0DCE6]/70 hover:bg-[#350A8C]/20 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
                className="px-4 py-2 rounded-lg bg-[#8F00FF] text-white text-sm font-medium hover:bg-[#7B00E0] disabled:opacity-50 transition-colors"
              >
                {saveMutation.isPending ? "Saving..." : "Save Policy"}
              </button>
            </div>
          </div>
        ) : (
          <pre className="p-5 text-sm text-[#E0DCE6]/80 font-mono overflow-auto">
            {policy ? JSON.stringify(policy, null, 2) : "No policy configured."}
          </pre>
        )}
      </div>
    </div>
  );
}

function HunterRegistry({ isEditor }: { isEditor: boolean }) {
  const { data: registry, isLoading } = useQuery({ queryKey: ["/api/hunter/registry"] });
  const { data: corpusFiles } = useQuery<any[]>({ queryKey: ["/api/hunter/corpus"] });
  const [editing, setEditing] = useState(false);
  const [registryStr, setRegistryStr] = useState("");
  const { toast } = useToast();

  // Count texts per source_id from corpus records
  const textsBySource = useMemo<Record<string, number>>(() => {
    if (!Array.isArray(corpusFiles)) return {};
    const counts: Record<string, number> = {};
    for (const file of corpusFiles) {
      const sid: string | undefined = file?.record?.source_id;
      if (sid) counts[sid] = (counts[sid] ?? 0) + 1;
    }
    return counts;
  }, [corpusFiles]);

  useEffect(() => {
    if (registry && !editing) {
      setRegistryStr(JSON.stringify(registry, null, 2));
    }
  }, [registry, editing]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      let parsed;
      try {
        parsed = JSON.parse(registryStr);
      } catch (e) {
        throw new Error("Invalid JSON");
      }
      const res = await apiRequest("PUT", "/api/hunter/registry", parsed);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hunter/registry"] });
      setEditing(false);
      toast({ title: "Source registry updated" });
    },
    onError: (e: Error) =>
      toast({ title: "Failed to update registry", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return <div className="text-[#E0DCE6]/50 text-sm">Loading source registry...</div>;

  const sources: any[] = Array.isArray((registry as any)?.sources) ? (registry as any).sources : [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-lg font-medium text-[#E0DCE6] mb-1">Trusted Source Registry</h3>
          <p className="text-sm text-[#E0DCE6]/60">
            Reviewed sites downloads are allowed from. A candidate's URL must match one of these
            hosts (and path prefixes) before the hunter will fetch it.
          </p>
        </div>
        {isEditor && !editing && (
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm bg-[#350A8C]/30 border border-[#350A8C]/40 text-[#E0DCE6] hover:bg-[#350A8C]/50 transition-colors"
            data-testid="button-edit-registry"
          >
            <Pencil size={14} /> Edit Registry
          </button>
        )}
      </div>

      {editing ? (
        <div className="bg-[#0B0626] border border-[#350A8C]/30 rounded-xl overflow-hidden flex flex-col">
          <textarea
            value={registryStr}
            onChange={(e) => setRegistryStr(e.target.value)}
            className="w-full p-4 bg-transparent text-[#E0DCE6] text-sm font-mono focus:outline-none min-h-[400px]"
            spellCheck={false}
            data-testid="textarea-registry"
          />
          <div className="p-3 bg-[#130D30] border-t border-[#350A8C]/30 flex justify-end gap-2">
            <button
              onClick={() => setEditing(false)}
              className="px-4 py-2 rounded-lg text-sm text-[#E0DCE6]/70 hover:bg-[#350A8C]/20 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="px-4 py-2 rounded-lg bg-[#8F00FF] text-white text-sm font-medium hover:bg-[#7B00E0] disabled:opacity-50 transition-colors"
              data-testid="button-save-registry"
            >
              {saveMutation.isPending ? "Saving..." : "Save Registry"}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {sources.map((source) => (
            <div
              key={source.source_id}
              className="bg-[#0B0626] border border-[#350A8C]/30 rounded-xl p-4"
              data-testid={`registry-source-${source.source_id}`}
            >
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="text-[#E0DCE6] font-medium">{source.name}</span>
                <span className="text-xs font-mono text-[#E0DCE6]/40">{source.source_id}</span>
                {source.local_only && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-[#350A8C]/40 text-[#E0DCE6]/70">
                    local only
                  </span>
                )}
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    source.automated_download_allowed
                      ? "bg-[#03FF9B]/10 text-[#03FF9B]"
                      : "bg-red-500/10 text-red-400"
                  }`}
                >
                  {source.automated_download_allowed ? "download allowed" : "download blocked"}
                </span>
                {(textsBySource[source.source_id] ?? 0) > 0 && (
                  <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-[#8F00FF]/20 text-[#E0DCE6]/70 whitespace-nowrap">
                    {textsBySource[source.source_id]} {textsBySource[source.source_id] === 1 ? "text" : "texts"}
                  </span>
                )}
              </div>
              <div className="text-sm text-[#E0DCE6]/60 space-y-1">
                {!source.local_only && (
                  <div>
                    <span className="text-[#E0DCE6]/40">Hosts:</span>{" "}
                    <span className="font-mono">{(source.allowed_hosts ?? []).join(", ") || "—"}</span>
                    {(source.allowed_path_prefixes ?? []).length > 0 && (
                      <>
                        {" "}
                        <span className="text-[#E0DCE6]/40">Paths:</span>{" "}
                        <span className="font-mono">{source.allowed_path_prefixes.join(", ")}</span>
                      </>
                    )}
                  </div>
                )}
                <div>
                  <span className="text-[#E0DCE6]/40">Rate limit:</span>{" "}
                  {source.requests_per_second} req/s
                  {source.terms_url && (
                    <>
                      {" · "}
                      <a
                        href={source.terms_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#03FF9B]/80 hover:underline"
                      >
                        Terms of use
                      </a>
                    </>
                  )}
                </div>
                {source.rights_notes && (
                  <p className="text-xs text-[#E0DCE6]/50 pt-1">{source.rights_notes}</p>
                )}
              </div>
            </div>
          ))}
          {sources.length === 0 && (
            <div className="text-sm text-[#E0DCE6]/50">No sources registered.</div>
          )}
        </div>
      )}
    </div>
  );
}

// ---- Source Strategies tab -------------------------------------------------

const DISCOVERY_KIND_LABEL: Record<string, string> = {
  api_search: "API search",
  catalogue_feed: "Catalogue feed",
  github_file_tree: "GitHub file tree",
  manual_only: "Manual only",
};

function HunterStrategies() {
  const { data: registry, isLoading } = useQuery({ queryKey: ["/api/hunter/registry"] });

  if (isLoading) {
    return <div className="text-[#E0DCE6]/50 text-sm">Loading source strategies...</div>;
  }

  const sources: any[] = Array.isArray((registry as any)?.sources) ? (registry as any).sources : [];

  if (sources.length === 0) {
    return (
      <div className="text-sm text-[#E0DCE6]/50" data-testid="strategies-empty">
        No sources registered.
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="strategies-table">
      <div>
        <h3 className="text-lg font-medium text-[#E0DCE6] mb-1">Source Discovery Strategies</h3>
        <p className="text-sm text-[#E0DCE6]/60">
          Which sources the hunter can search automatically and which need manual candidate entry.
          Manual-only sources still support automated download once a candidate URL is added.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-[#350A8C]/40">
              <th className="text-left py-2 pr-4 text-xs font-medium text-[#E0DCE6]/50 whitespace-nowrap">Source</th>
              <th className="text-left py-2 pr-4 text-xs font-medium text-[#E0DCE6]/50 whitespace-nowrap">Discovery</th>
              <th className="text-left py-2 pr-4 text-xs font-medium text-[#E0DCE6]/50 whitespace-nowrap">What it searches</th>
              <th className="text-left py-2 pr-4 text-xs font-medium text-[#E0DCE6]/50 whitespace-nowrap">Auto-download</th>
              <th className="text-left py-2 pr-4 text-xs font-medium text-[#E0DCE6]/50 whitespace-nowrap">Robots mode</th>
              <th className="text-left py-2 text-xs font-medium text-[#E0DCE6]/50 whitespace-nowrap">Rate</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((source) => {
              const discovery = source.discovery ?? {};
              const isManual = discovery.kind === "manual_only" || !discovery.kind;
              const kindLabel = DISCOVERY_KIND_LABEL[discovery.kind] ?? discovery.kind ?? "Unknown";
              return (
                <tr
                  key={source.source_id}
                  className={`border-b border-[#350A8C]/20 align-top ${isManual ? "opacity-70" : ""}`}
                  data-testid={`strategies-row-${source.source_id}`}
                >
                  {/* Source name */}
                  <td className="py-3 pr-4">
                    <div className="font-medium text-[#E0DCE6] whitespace-nowrap">{source.name}</div>
                    <div className="text-xs text-[#E0DCE6]/40 font-mono">{source.source_id}</div>
                  </td>

                  {/* Discovery badge */}
                  <td className="py-3 pr-4 whitespace-nowrap">
                    {isManual ? (
                      <span
                        className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400"
                        data-testid={`strategies-badge-manual-${source.source_id}`}
                      >
                        Manual only
                      </span>
                    ) : (
                      <span
                        className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-[#03FF9B]/10 text-[#03FF9B]"
                        data-testid={`strategies-badge-auto-${source.source_id}`}
                      >
                        {kindLabel}
                      </span>
                    )}
                  </td>

                  {/* What it searches / reason */}
                  <td className="py-3 pr-4 max-w-xs">
                    {isManual ? (
                      <span className="text-[#E0DCE6]/50 italic">
                        {discovery.reason ?? "No automated discovery strategy yet."}
                      </span>
                    ) : (
                      <span className="text-[#E0DCE6]/70">{discovery.searches ?? "—"}</span>
                    )}
                  </td>

                  {/* Auto-download */}
                  <td className="py-3 pr-4 whitespace-nowrap">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        source.automated_download_allowed
                          ? "bg-[#03FF9B]/10 text-[#03FF9B]"
                          : "bg-red-500/10 text-red-400"
                      }`}
                    >
                      {source.automated_download_allowed ? "Allowed" : "Blocked"}
                    </span>
                  </td>

                  {/* Robots mode */}
                  <td className="py-3 pr-4 whitespace-nowrap">
                    <span className="text-xs text-[#E0DCE6]/60 font-mono">
                      {source.robots_mode ?? "—"}
                    </span>
                  </td>

                  {/* Rate */}
                  <td className="py-3 whitespace-nowrap">
                    <span className="text-xs text-[#E0DCE6]/60">
                      {source.local_only ? "—" : `${source.requests_per_second ?? "?"} req/s`}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function HunterScreenVerdicts({ isEditor }: { isEditor: boolean }) {
  const { toast } = useToast();
  const { data: verdicts, isLoading } = useQuery<any[]>({
    queryKey: ["/api/hunter/screen-verdicts"],
    enabled: isEditor,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/hunter/screen-verdicts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hunter/screen-verdicts"] });
      toast({ title: "Verdict deleted — the next cycle will re-screen this title." });
    },
    onError: () => toast({ title: "Failed to delete verdict", variant: "destructive" }),
  });

  const flipMutation = useMutation({
    mutationFn: ({ id, classification }: { id: number; classification: string }) =>
      apiRequest("PATCH", `/api/hunter/screen-verdicts/${id}`, { classification }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hunter/screen-verdicts"] });
      toast({ title: "Verdict updated — the next cycle will honour the correction." });
    },
    onError: () => toast({ title: "Failed to update verdict", variant: "destructive" }),
  });

  if (!isEditor) {
    return (
      <div className="text-sm text-[#E0DCE6]/50">
        Switch to edit mode to view and manage AI screening verdicts.
      </div>
    );
  }

  if (isLoading) {
    return <div className="text-[#E0DCE6]/50 text-sm">Loading verdicts...</div>;
  }

  const rows: any[] = Array.isArray(verdicts) ? verdicts : [];

  return (
    <div className="space-y-4" data-testid="screen-verdicts-panel">
      <div>
        <h3 className="text-lg font-medium text-[#E0DCE6] mb-1">Cached AI Screening Verdicts</h3>
        <p className="text-sm text-[#E0DCE6]/60 max-w-2xl">
          Each entry is a verdict the AI gave to a title in a previous cycle. Future cycles reuse
          these verdicts instead of calling the model again.{" "}
          <span className="text-amber-400">
            Delete a wrong verdict to let the next cycle re-screen from scratch, or flip it to
            override the classification directly.
          </span>
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="text-sm text-[#E0DCE6]/50" data-testid="screen-verdicts-empty">
          No cached verdicts yet — they appear after the first cycle that uses AI screening.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse" data-testid="screen-verdicts-table">
            <thead>
              <tr className="border-b border-[#350A8C]/40">
                <th className="text-left py-2 pr-4 text-xs font-medium text-[#E0DCE6]/50">Title</th>
                <th className="text-left py-2 pr-4 text-xs font-medium text-[#E0DCE6]/50">Classification</th>
                <th className="text-left py-2 pr-4 text-xs font-medium text-[#E0DCE6]/50">Justification</th>
                <th className="text-left py-2 pr-4 text-xs font-medium text-[#E0DCE6]/50">Cached on</th>
                <th className="text-left py-2 text-xs font-medium text-[#E0DCE6]/50">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row: any) => {
                const isPrimary = row.classification === "primary";
                const busy =
                  deleteMutation.isPending || flipMutation.isPending;
                return (
                  <tr
                    key={row.id}
                    className="border-b border-[#350A8C]/20 align-top hover:bg-[#130D30]/30 transition-colors"
                    data-testid={`verdict-row-${row.id}`}
                  >
                    {/* Title */}
                    <td className="py-3 pr-4 max-w-[220px]">
                      <div className="font-medium text-[#E0DCE6] leading-snug">{row.title}</div>
                      <div className="text-xs text-[#E0DCE6]/35 font-mono mt-0.5 truncate">{row.titleKey}</div>
                    </td>

                    {/* Classification badge */}
                    <td className="py-3 pr-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium ${
                          isPrimary
                            ? "bg-[#03FF9B]/10 text-[#03FF9B]"
                            : "bg-red-500/15 text-red-400"
                        }`}
                        data-testid={`verdict-classification-${row.id}`}
                      >
                        {isPrimary ? "Primary" : "Secondary"}
                      </span>
                    </td>

                    {/* Justification */}
                    <td className="py-3 pr-4 max-w-xs">
                      <span className="text-[#E0DCE6]/70 leading-snug line-clamp-3" title={row.justification}>
                        {row.justification}
                      </span>
                    </td>

                    {/* Date */}
                    <td className="py-3 pr-4 whitespace-nowrap text-[#E0DCE6]/50">
                      {row.createdAt ? new Date(row.createdAt).toLocaleDateString() : "—"}
                    </td>

                    {/* Actions */}
                    <td className="py-3 whitespace-nowrap">
                      <div className="flex gap-2">
                        {/* Flip button */}
                        <button
                          onClick={() =>
                            flipMutation.mutate({
                              id: row.id,
                              classification: isPrimary ? "secondary" : "primary",
                            })
                          }
                          disabled={busy}
                          className="text-xs px-2 py-1 rounded bg-[#350A8C]/40 text-[#E0DCE6]/70 hover:bg-[#350A8C]/70 hover:text-[#E0DCE6] disabled:opacity-40 transition-colors"
                          title={`Flip to ${isPrimary ? "secondary" : "primary"}`}
                          data-testid={`button-flip-verdict-${row.id}`}
                        >
                          Flip → {isPrimary ? "Secondary" : "Primary"}
                        </button>
                        {/* Delete button */}
                        <button
                          onClick={() => deleteMutation.mutate(row.id)}
                          disabled={busy}
                          className="text-xs px-2 py-1 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 disabled:opacity-40 transition-colors"
                          title="Delete — next cycle re-screens this title"
                          data-testid={`button-delete-verdict-${row.id}`}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
function LoginModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { toast } = useToast();

  const loginMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/database/login", { password });
      return res.json();
    },
    onSuccess: (data: { token?: string }) => {
      if (data?.token) setEditorToken(data.token);
      toast({ title: "Edit mode activated" });
      onSuccess();
    },
    onError: () => setError("Invalid password"),
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#130D30] border border-[#350A8C]/40 rounded-xl p-6 w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-[#E0DCE6]" style={{ fontFamily: "'Cinzel Decorative', serif" }}>
            Enter Edit Mode
          </h3>
          <button onClick={onClose} data-testid="button-close-login">
            <X size={18} className="text-[#E0DCE6]/50 hover:text-[#E0DCE6]" />
          </button>
        </div>
        <p className="text-sm text-[#E0DCE6]/60 mb-4">
          Enter the editor password to access Source Hunter controls.
        </p>
        <input
          type="password"
          value={password}
          onChange={(e) => { setPassword(e.target.value); setError(""); }}
          onKeyDown={(e) => e.key === "Enter" && loginMutation.mutate()}
          placeholder="Password"
          className="w-full px-3 py-2 rounded-lg bg-[#0B0626] border border-[#350A8C]/40 text-[#E0DCE6] text-sm focus:outline-none focus:border-[#8F00FF]/60 mb-2"
          data-testid="input-editor-password"
          autoFocus
        />
        {error && <p className="text-red-400 text-xs mb-2">{error}</p>}
        <button
          onClick={() => loginMutation.mutate()}
          disabled={loginMutation.isPending || !password}
          className="w-full py-2 rounded-lg bg-[#8F00FF] text-white text-sm font-medium hover:bg-[#7B00E0] disabled:opacity-50 transition-colors"
          data-testid="button-submit-login"
        >
          {loginMutation.isPending ? "Verifying..." : "Unlock"}
        </button>
      </div>
    </div>
  );
}

interface CardCheckState {
  phase: CheckPhase;
  result?: CheckResult;
}

type CheckPhase = "idle" | "checking" | "done";

interface CheckResult {
  status: number | null;
  ok: boolean;
  redirected: boolean;
  finalUrl: string;
  error: string | null;
}
