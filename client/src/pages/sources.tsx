import { useState, useEffect, useMemo } from "react";
import { geoNaturalEarth1, geoPath } from "d3";
import { feature } from "topojson-client";
import { HUNTER_REGIONS, type HunterRegion } from "@shared/hunterRegions";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient, setEditorToken, authHeaders } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Lock, Unlock, ChevronDown, ChevronRight, Plus, Pencil, Trash2,
  BookOpen, X, Check, AlertCircle, ExternalLink,
  Download, Upload, Play, RefreshCw, FileText, ShieldCheck, ShieldAlert,
  Clock, Database, Code
} from "lucide-react";
import ReactMarkdown from "react-markdown";

type Tab = "library" | "hunter";
type HunterTab = "map" | "cycles" | "candidates" | "plan" | "corpus" | "verify" | "catalog" | "runs" | "policy" | "registry";

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
}

function LibraryTab() {
  const { data: entries, isLoading } = useQuery<LibraryEntry[]>({
    queryKey: ["/api/hunter/library"],
  });
  const [readingId, setReadingId] = useState<number | null>(null);

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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((entry) => (
          <button
            key={entry.id}
            onClick={() => setReadingId(entry.id)}
            className="text-left p-5 rounded-xl border border-[#350A8C]/30 bg-[#130D30]/50 hover:border-[#8F00FF]/50 hover:bg-[#130D30] transition-all group"
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
            <div className="text-xs text-[#E0DCE6]/40 mt-3">
              {(entry.byteCount / 1024).toFixed(1)} KB
            </div>
          </button>
        ))}
      </div>
      {readingId !== null && (
        <LibraryReader entryId={readingId} onClose={() => setReadingId(null)} />
      )}
    </div>
  );
}

function LibraryReader({ entryId, onClose }: { entryId: number; onClose: () => void }) {
  const { data, isLoading, error } = useQuery<{
    id: number;
    title: string;
    author: string | null;
    translator: string | null;
    language: string | null;
    text: string;
    markdown: string | null;
  }>({
    queryKey: [`/api/hunter/library/${entryId}/text`],
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#130D30] border border-[#350A8C]/40 rounded-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-start justify-between p-6 pb-4 border-b border-[#350A8C]/30 shrink-0">
          <div className="min-w-0">
            <h3
              className="text-lg font-semibold text-[#E0DCE6] truncate"
              style={{ fontFamily: "'Cinzel Decorative', serif" }}
              data-testid="text-reader-title"
            >
              {data?.title ?? "Loading..."}
            </h3>
            {data && (
              <p className="text-sm text-[#E0DCE6]/60 mt-1">
                {data.author && `By ${data.author}`}
                {data.translator && ` • Tr: ${data.translator}`}
                {data.language && ` • ${data.language.toUpperCase()}`}
              </p>
            )}
          </div>
          <button onClick={onClose} className="shrink-0 ml-4" data-testid="button-close-reader">
            <X size={20} className="text-[#E0DCE6]/50 hover:text-[#E0DCE6]" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading && <div className="text-[#E0DCE6]/50 text-sm">Loading text...</div>}
          {error && (
            <div className="text-red-400 text-sm flex items-center gap-2">
              <AlertCircle size={16} /> Could not load this text.
            </div>
          )}
          {data && data.markdown ? (
            <div
              className="reader-markdown text-[#E0DCE6]/90 text-[15px] leading-relaxed font-serif [&_h1]:text-xl [&_h1]:font-bold [&_h1]:mt-6 [&_h1]:mb-3 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mt-5 [&_h2]:mb-2 [&_h3]:font-semibold [&_h3]:mt-4 [&_h3]:mb-2 [&_p]:my-3 [&_hr]:my-6 [&_hr]:border-[#350A8C]/40 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_blockquote]:border-l-2 [&_blockquote]:border-[#8F00FF]/50 [&_blockquote]:pl-4 [&_a]:text-[#8F00FF]"
              data-testid="text-reader-body"
            >
              <ReactMarkdown>{data.markdown}</ReactMarkdown>
            </div>
          ) : data ? (
            <pre
              className="whitespace-pre-wrap text-[#E0DCE6]/90 text-[15px] leading-relaxed font-serif"
              data-testid="text-reader-body"
            >
              {data.text}
            </pre>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function SourceHunterTab({ isEditor }: { isEditor: boolean }) {
  const [activeHunterTab, setActiveHunterTab] = useState<HunterTab>("candidates");

  const tabs: { key: HunterTab; label: string }[] = [
    { key: "map", label: "World Map" },
    { key: "cycles", label: "Hunting Cycles" },
    { key: "candidates", label: "Candidates" },
    { key: "plan", label: "Download Plan" },
    { key: "corpus", label: "Corpus" },
    { key: "verify", label: "Verification" },
    ...(isEditor ? [{ key: "catalog" as HunterTab, label: "Catalog Builder" }] : []),
    { key: "runs", label: "Runs History" },
    { key: "policy", label: "Policy" },
    { key: "registry", label: "Source Registry" },
  ];

  useEffect(() => {
    if (activeHunterTab === "catalog" && !isEditor) {
      setActiveHunterTab("candidates");
    }
  }, [isEditor, activeHunterTab]);

  return (
    <div className="bg-[#130D30]/50 border border-[#350A8C]/20 rounded-xl overflow-hidden">
      <div className="flex gap-1 border-b border-[#350A8C]/30 overflow-x-auto px-4 pt-2">
        {tabs.map((tab) => (
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
      <div className="p-6">
        {activeHunterTab === "map" && <HunterWorldMap isEditor={isEditor} />}
        {activeHunterTab === "cycles" && <HunterCycles isEditor={isEditor} />}
        {activeHunterTab === "candidates" && <HunterCandidates isEditor={isEditor} />}
        {activeHunterTab === "plan" && <HunterPlan isEditor={isEditor} />}
        {activeHunterTab === "corpus" && <HunterCorpus isEditor={isEditor} />}
        {activeHunterTab === "verify" && <HunterVerify isEditor={isEditor} />}
        {activeHunterTab === "catalog" && isEditor && <HunterCatalog />}
        {activeHunterTab === "runs" && <HunterRuns />}
        {activeHunterTab === "policy" && <HunterPolicy isEditor={isEditor} />}
        {activeHunterTab === "registry" && <HunterRegistry isEditor={isEditor} />}
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
      className="text-xs border border-orange-400/30 bg-orange-400/5 rounded-lg p-3 space-y-1"
      data-testid="text-auto-extract-failures"
    >
      <div className="text-orange-400 flex items-center gap-1.5 font-medium">
        <AlertCircle size={12} /> Automatic extraction could not start for {failures.length}{" "}
        {failures.length === 1 ? "file" : "files"}
      </div>
      <ul className="text-[#E0DCE6]/60 space-y-0.5 pl-4 list-disc">
        {failures.map((f, i) => (
          <li key={i}>
            <span className="font-mono">{f.edition_id}</span> — {f.error}
          </li>
        ))}
      </ul>
      <div className="text-[#E0DCE6]/40">
        You can retry from the Corpus tab with “Extract readable text”.
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

  const { data: cycles } = useQuery<any[]>({
    queryKey: ["/api/hunter/cycles"],
    refetchInterval: (q) =>
      Array.isArray(q.state.data) && q.state.data.some((r: any) => r.status === "running")
        ? 2000
        : false,
  });
  const running = Array.isArray(cycles) && cycles.some((r) => r.status === "running");

  const statsByRegion = useMemo(() => {
    const map = new Map<string, RegionStats>();
    for (const run of Array.isArray(cycles) ? cycles : []) {
      const result = run.result ?? {};
      const summary = result.scope ? result : null;
      const regionId = summary?.scope?.region?.id ?? result.progress?.region?.id;
      if (!regionId) continue;
      const stats = map.get(regionId) ?? { cycles: 0, successes: 0, failures: 0, failedRuns: 0 };
      stats.cycles += 1;
      if (run.status === "failed") stats.failedRuns += 1;
      if (summary) {
        stats.successes += (summary.downloaded_public ?? 0) + (summary.downloaded_locked ?? 0);
        stats.failures += (summary.metadata_only ?? 0) + (summary.failed ?? 0) + (summary.invalid ?? 0);
      }
      map.set(regionId, stats);
    }
    return map;
  }, [cycles]);

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
              const r = 5 + Math.min(10, (stats?.cycles ?? 0) * 2.5);
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
                      {stats.cycles}
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
                        {(summary?.scope?.query ?? progress?.query) ? `“${summary?.scope?.query ?? progress?.query}”` : `Cycle #${run.id}`}
                      </div>
                      <div className="text-xs text-[#E0DCE6]/50 mt-0.5">
                        {new Date(run.startedAt).toLocaleString()}
                        {run.status === "running" && progress?.phase && (
                          <span className="text-[#03FF9B] ml-2">{String(progress.phase).replace(/_/g, " ")}...</span>
                        )}
                      </div>
                    </div>
                    {run.status === "running" && (
                      <span className="inline-flex items-center gap-1.5 text-xs text-[#03FF9B]">
                        <RefreshCw size={12} className="animate-spin" /> Running
                      </span>
                    )}
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
                        <div className="text-sm text-red-400 flex items-center gap-2">
                          <AlertCircle size={14} /> {run.error}
                        </div>
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-lg font-medium text-[#E0DCE6] mb-1">Downloaded Corpus</h3>
          <p className="text-sm text-[#E0DCE6]/60">
            {items.length} files • {(totalSize / 1024 / 1024).toFixed(2)} MB total
          </p>
        </div>
        {isEditor && (
          <button
            onClick={() => downloadMutation.mutate()}
            disabled={downloadMutation.isPending || isPolling}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-[#8F00FF] text-white hover:bg-[#7B00E0] disabled:opacity-50 transition-colors"
          >
            {isPolling ? <RefreshCw size={16} className="animate-spin" /> : <Download size={16} />}
            {isPolling ? "Downloading..." : "Download Planned Editions"}
          </button>
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
              {items.map((file: any) => (
                <tr key={file.id} className="hover:bg-[#130D30]/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-[#E0DCE6]">{file.workId}</div>
                    <div className="text-xs text-[#E0DCE6]/50 font-mono mt-0.5">{file.editionId}</div>
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
              ))}
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
          {job?.status === "error" && !running && (
            <div className="text-red-400 text-sm flex items-start gap-2" data-testid="text-extract-error">
              <AlertCircle size={16} className="shrink-0 mt-0.5" /> {job.error}
            </div>
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
        {isEditor && (
          <button
            onClick={() => verifyMutation.mutate()}
            disabled={verifyMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-[#8F00FF] text-white hover:bg-[#7B00E0] disabled:opacity-50 transition-colors"
          >
            {verifyMutation.isPending ? <RefreshCw size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
            Verify Corpus
          </button>
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
          {run?.error && (
            <div className="text-sm text-red-400 flex items-start gap-2">
              <AlertCircle size={14} className="shrink-0 mt-0.5" /> {run.error}
            </div>
          )}
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
  const [editing, setEditing] = useState(false);
  const [registryStr, setRegistryStr] = useState("");
  const { toast } = useToast();

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
