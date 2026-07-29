import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient, setEditorToken, authHeaders } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Lock, Unlock, ChevronDown, ChevronRight, Plus, Pencil, Trash2,
  BookOpen, X, Check, AlertCircle, ExternalLink,
  Download, Play, RefreshCw, FileText, ShieldCheck, ShieldAlert,
  Clock, Database, Code
} from "lucide-react";

type Tab = "library" | "hunter";
type HunterTab = "candidates" | "plan" | "corpus" | "verify" | "catalog" | "runs" | "policy" | "registry";

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
          {data && (
            <pre
              className="whitespace-pre-wrap text-[#E0DCE6]/90 text-[15px] leading-relaxed font-serif"
              data-testid="text-reader-body"
            >
              {data.text}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}

function SourceHunterTab({ isEditor }: { isEditor: boolean }) {
  const [activeHunterTab, setActiveHunterTab] = useState<HunterTab>("candidates");

  const tabs: { key: HunterTab; label: string }[] = [
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

function HunterCorpus({ isEditor }: { isEditor: boolean }) {
  const { data: corpus, isLoading } = useQuery({ queryKey: ["/api/hunter/corpus"] });
  const { toast } = useToast();
  
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
                <th className="px-4 py-3 font-medium text-right">Size</th>
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
                  <td className="px-4 py-3 text-right text-[#E0DCE6]/50 font-mono text-xs">
                    {(file.byteCount / 1024).toFixed(1)} KB
                  </td>
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

function HunterRuns() {
  const { data: runs, isLoading } = useQuery({ queryKey: ["/api/hunter/runs"] });

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
            <div key={run.id} className="flex items-center justify-between p-3 rounded-lg border border-[#350A8C]/20 bg-[#0B0626]/30">
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