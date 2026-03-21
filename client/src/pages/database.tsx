import { useState, useMemo, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Node, Edge, Suggestion, Source, TraitHierarchy, TraitCrossCut } from "@shared/schema";
import {
  Search, Lock, Unlock, ChevronDown, ChevronRight, Plus, Pencil, Trash2,
  MessageSquarePlus, BookOpen, X, Check, AlertCircle, ArrowUpDown, ExternalLink,
  Download, Upload, FolderTree, Layers
} from "lucide-react";

type Tab = "nodes" | "relations" | "suggestions" | "sources";
type NodeCategory = "characters" | "gender" | "domain" | "object" | "animals" | "characterTrait" | "physicalCharacteristics" | "significantEvent" | "symbolism" | "neumannArchetype" | "eventTypes" | "birthTypes" | "deathTypes" | "familyRoles";

const NODE_CATEGORIES: { key: NodeCategory; label: string; isArray?: boolean; commaSplit?: boolean }[] = [
  { key: "characters", label: "Characters" },
  { key: "gender", label: "Gender" },
  { key: "domain", label: "Domain", commaSplit: true },
  { key: "object", label: "Object", commaSplit: true },
  { key: "animals", label: "Animals", commaSplit: true },
  { key: "characterTrait", label: "Character Trait", commaSplit: true },
  { key: "physicalCharacteristics", label: "Physical Characteristics", commaSplit: true },
  { key: "significantEvent", label: "Significant Event" },
  { key: "symbolism", label: "Symbolism" },
  { key: "neumannArchetype", label: "Neumann Archetype" },
  { key: "eventTypes", label: "Event Types", isArray: true },
  { key: "birthTypes", label: "Birth Types", isArray: true },
  { key: "deathTypes", label: "Death Types", isArray: true },
  { key: "familyRoles", label: "Family Roles", isArray: true },
];

const TRAIT_FIELDS = [
  { key: "tradition", label: "Tradition" },
  { key: "gender", label: "Gender" },
  { key: "domain", label: "Domain" },
  { key: "object", label: "Object" },
  { key: "animals", label: "Animals" },
  { key: "characterTrait", label: "Character Trait", commaSplit: true },
  { key: "physicalCharacteristics", label: "Physical Characteristics", commaSplit: true },
  { key: "significantEvent", label: "Significant Event" },
  { key: "symbolism", label: "Symbolism" },
  { key: "neumannArchetype", label: "Neumann Archetype" },
  { key: "birthCircumstances", label: "Birth Circumstances" },
  { key: "deathCircumstances", label: "Death Circumstances" },
] as const;

const ARRAY_FIELDS = [
  { key: "eventTypes", label: "Event Types" },
  { key: "birthTypes", label: "Birth Types" },
  { key: "deathTypes", label: "Death Types" },
  { key: "familyRoles", label: "Family Roles" },
] as const;

export default function DatabasePage() {
  const [activeTab, setActiveTab] = useState<Tab>("nodes");
  const [isEditor, setIsEditor] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showSuggestionModal, setShowSuggestionModal] = useState(false);
  const [suggestionTarget, setSuggestionTarget] = useState<{
    type: string;
    nodeId?: number;
    nodeName?: string;
    field?: string;
    currentValue?: string;
    edgeId?: number;
  } | null>(null);
  const { toast } = useToast();
  const importFileRef = useRef<HTMLInputElement>(null);
  const suggestionsImportRef = useRef<HTMLInputElement>(null);

  const { data: authStatus } = useQuery<{ isEditor: boolean }>({
    queryKey: ["/api/database/auth-status"],
  });

  const editorMode = isEditor || authStatus?.isEditor;

  const tabs: { key: Tab; label: string }[] = [
    { key: "nodes", label: "Nodes" },
    { key: "relations", label: "Relations" },
    { key: "suggestions", label: "Suggestions" },
    { key: "sources", label: "Sources" },
  ];

  function openSuggestion(target: typeof suggestionTarget) {
    setSuggestionTarget(target);
    setShowSuggestionModal(true);
  }

  return (
    <div className="min-h-screen bg-[#0B0626] text-[#E0DCE6]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-20 pb-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1
              className="text-3xl font-bold tracking-wide"
              style={{ fontFamily: "'Cinzel Decorative', serif" }}
              data-testid="text-database-title"
            >
              Database
            </h1>
            <p className="text-[#E0DCE6]/60 mt-1 text-sm">
              1,131 mythological figures · 401 relationships · Browse, suggest, or edit
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/api/download"
              download="shadows-database.json"
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all bg-[#03FF9B]/10 text-[#03FF9B]/70 border border-[#03FF9B]/20 hover:border-[#03FF9B]/40 hover:text-[#03FF9B]"
              data-testid="button-download-open-data"
            >
              <Download size={16} />
              Download open data
            </a>
            {editorMode && (
              <>
                <button
                  onClick={async () => {
                    try {
                      const res = await fetch("/api/export", { credentials: "include" });
                      if (!res.ok) throw new Error("Export failed");
                      const blob = await res.blob();
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `shadows-export-${new Date().toISOString().slice(0, 10)}.json`;
                      a.click();
                      URL.revokeObjectURL(url);
                      toast({ title: "Database exported" });
                    } catch {
                      toast({ title: "Export failed", variant: "destructive" });
                    }
                  }}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all bg-[#350A8C]/30 text-[#E0DCE6]/70 border border-[#350A8C]/40 hover:border-[#8F00FF]/50"
                  data-testid="button-export-db"
                >
                  <Download size={16} />
                  Export
                </button>
                <input
                  ref={importFileRef}
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      const text = await file.text();
                      const data = JSON.parse(text);
                      if (!Array.isArray(data.nodes) || !Array.isArray(data.edges)) {
                        toast({ title: "Invalid file: must contain nodes and edges arrays", variant: "destructive" });
                        return;
                      }
                      const presentTables: string[] = [];
                      if (data.projects) presentTables.push(`${data.projects.length} projects`);
                      presentTables.push(`${data.nodes.length} nodes`);
                      presentTables.push(`${data.edges.length} edges`);
                      if (data.sources) presentTables.push(`${data.sources.length} sources`);
                      if (data.suggestions) presentTables.push(`${data.suggestions.length} suggestions`);
                      if (data.news) presentTables.push(`${data.news.length} news`);
                      if (data.publications) presentTables.push(`${data.publications.length} publications`);
                      if (!confirm(`This will replace the following tables:\n${presentTables.map(t => `• ${t}`).join("\n")}\n\nTables not present in the file will be left untouched.\nThis action cannot be undone. Continue?`)) return;
                      const res = await apiRequest("POST", "/api/import", data);
                      const result = await res.json();
                      if (!res.ok) {
                        toast({ title: result.error || "Import failed", variant: "destructive" });
                        return;
                      }
                      toast({ title: `Imported ${result.imported.nodes} nodes, ${result.imported.edges} edges` });
                      queryClient.invalidateQueries();
                    } catch (err) {
                      toast({ title: "Import failed: " + (err instanceof Error ? err.message : "Unknown error"), variant: "destructive" });
                    }
                    if (importFileRef.current) importFileRef.current.value = "";
                  }}
                  data-testid="input-import-file"
                />
                <button
                  onClick={() => importFileRef.current?.click()}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all bg-[#350A8C]/30 text-[#E0DCE6]/70 border border-[#350A8C]/40 hover:border-[#8F00FF]/50"
                  data-testid="button-import-db"
                >
                  <Upload size={16} />
                  Import
                </button>
                <button
                  onClick={async () => {
                    try {
                      const res = await fetch("/api/suggestions/export", { credentials: "include" });
                      if (!res.ok) throw new Error("Export failed");
                      const blob = await res.blob();
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `shadows-suggestions-${new Date().toISOString().slice(0, 10)}.json`;
                      a.click();
                      URL.revokeObjectURL(url);
                      toast({ title: "Suggestions exported" });
                    } catch {
                      toast({ title: "Export failed", variant: "destructive" });
                    }
                  }}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all bg-[#350A8C]/30 text-[#E0DCE6]/70 border border-[#350A8C]/40 hover:border-[#8F00FF]/50"
                  data-testid="button-export-suggestions"
                >
                  <Download size={16} />
                  Export Suggestions
                </button>
                <input
                  ref={suggestionsImportRef}
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      const text = await file.text();
                      const data = JSON.parse(text);
                      if (!data.suggestions || !Array.isArray(data.suggestions)) {
                        toast({ title: "Invalid file: must contain a suggestions array", variant: "destructive" });
                        return;
                      }
                      if (!confirm(`This will import ${data.suggestions.length} suggestions.\nSuggestions referencing missing nodes or edges will be skipped.\nContinue?`)) return;
                      const res = await apiRequest("POST", "/api/suggestions/import", data);
                      const result = await res.json();
                      if (!res.ok) {
                        toast({ title: result.error || "Import failed", variant: "destructive" });
                        return;
                      }
                      toast({ title: `Imported ${result.imported} suggestions, skipped ${result.skipped}` });
                      queryClient.invalidateQueries();
                    } catch (err) {
                      toast({ title: "Import failed: " + (err instanceof Error ? err.message : "Unknown error"), variant: "destructive" });
                    }
                    if (suggestionsImportRef.current) suggestionsImportRef.current.value = "";
                  }}
                  data-testid="input-import-suggestions-file"
                />
                <button
                  onClick={() => suggestionsImportRef.current?.click()}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all bg-[#350A8C]/30 text-[#E0DCE6]/70 border border-[#350A8C]/40 hover:border-[#8F00FF]/50"
                  data-testid="button-import-suggestions"
                >
                  <Upload size={16} />
                  Import Suggestions
                </button>
              </>
            )}
            <button
              onClick={() => {
                if (editorMode) {
                  setIsEditor(false);
                  apiRequest("POST", "/api/database/logout");
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
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
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

        {activeTab === "nodes" && (
          <NodesTab
            isEditor={!!editorMode}
            onSuggest={openSuggestion}
          />
        )}
        {activeTab === "relations" && (
          <RelationsTab
            isEditor={!!editorMode}
            onSuggest={openSuggestion}
          />
        )}
        {activeTab === "suggestions" && (
          <SuggestionsTab isEditor={!!editorMode} />
        )}
        {activeTab === "sources" && (
          <SourcesTab isEditor={!!editorMode} />
        )}
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

      {showSuggestionModal && suggestionTarget && (
        <SuggestionModal
          target={suggestionTarget}
          onClose={() => {
            setShowSuggestionModal(false);
            setSuggestionTarget(null);
          }}
        />
      )}
    </div>
  );
}

function TraitRow({ entry, nodes, expandedTrait, setExpandedTrait, isEditor, onSuggest, catLabel, depth }: {
  entry: { value: string; count: number; nodeIds: number[] };
  nodes: Node[];
  expandedTrait: string | null;
  setExpandedTrait: (t: string | null) => void;
  isEditor: boolean;
  onSuggest: (t: any) => void;
  catLabel: string;
  depth: number;
}) {
  const traitKey = `${entry.value}-d${depth}`;
  return (
    <div className="border-b border-[#350A8C]/10 last:border-0">
      <div
        className="flex items-center gap-2 px-4 py-2 text-sm cursor-pointer hover:bg-[#130D30]/50 transition-colors"
        style={{ paddingLeft: `${depth * 16 + 16}px` }}
        onClick={() => setExpandedTrait(expandedTrait === traitKey ? null : traitKey)}
        data-testid={`row-trait-${entry.value.replace(/\s+/g, "-").toLowerCase()}`}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {expandedTrait === traitKey
            ? <ChevronDown size={14} className="text-[#8F00FF] shrink-0" />
            : <ChevronRight size={14} className="text-[#E0DCE6]/30 shrink-0" />}
          <span className="text-[#E0DCE6]/80">{entry.value}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-[#03FF9B]/60 text-xs tabular-nums">{entry.count}</span>
          {!isEditor && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSuggest({ type: "edit_trait", field: catLabel, currentValue: entry.value });
              }}
              className="p-1 rounded hover:bg-[#350A8C]/40 text-[#E0DCE6]/20 hover:text-[#8F00FF] transition-colors"
              title="Suggest feedback"
              data-testid={`button-suggest-trait-${entry.value.replace(/\s+/g, "-").toLowerCase()}`}
            >
              <MessageSquarePlus size={13} />
            </button>
          )}
        </div>
      </div>

      {expandedTrait === traitKey && (
        <div className="px-4 pb-3 bg-[#0B0626]/50" style={{ paddingLeft: `${depth * 16 + 40}px` }}>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {entry.nodeIds.map((nid) => {
              const n = nodes.find((nd) => nd.id === nid);
              return n ? (
                <span
                  key={nid}
                  className="inline-flex items-center px-2 py-0.5 rounded bg-[#130D30] border border-[#350A8C]/20 text-xs text-[#E0DCE6]/70"
                  data-testid={`trait-character-${nid}`}
                >
                  {n.name}
                  {n.tradition && <span className="text-[#E0DCE6]/30 ml-1">({n.tradition})</span>}
                </span>
              ) : null;
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function HierarchyGroupRow({ group, depth, nodes, expandedHierarchy, setExpandedHierarchy, expandedTrait, setExpandedTrait, isEditor, onSuggest, catLabel }: {
  group: any;
  depth: number;
  nodes: Node[];
  expandedHierarchy: Set<number>;
  setExpandedHierarchy: (s: Set<number>) => void;
  expandedTrait: string | null;
  setExpandedTrait: (t: string | null) => void;
  isEditor: boolean;
  onSuggest: (t: any) => void;
  catLabel: string;
}) {
  const isExpanded = expandedHierarchy.has(group.id);
  const hasContent = group.children.length > 0 || group.leafTraits.length > 0;

  if (group.isLeaf) {
    const entry = group.leafTraits.length > 0
      ? group.leafTraits[0]
      : { value: group.traitName, count: 0, nodeIds: [] };
    return (
      <TraitRow
        entry={entry}
        nodes={nodes}
        expandedTrait={expandedTrait}
        setExpandedTrait={setExpandedTrait}
        isEditor={isEditor}
        onSuggest={onSuggest}
        catLabel={catLabel}
        depth={depth}
      />
    );
  }

  function toggle() {
    const next = new Set(expandedHierarchy);
    if (next.has(group.id)) next.delete(group.id);
    else next.add(group.id);
    setExpandedHierarchy(next);
  }

  return (
    <div className={depth === 0 ? "border-b border-[#350A8C]/15 last:border-0" : ""}>
      <div
        className={`flex items-center gap-2 py-2 cursor-pointer transition-colors hover:bg-[#130D30]/40 ${depth === 0 ? "px-4 bg-[#130D30]/20" : "px-4"}`}
        style={{ paddingLeft: `${depth * 16 + 16}px` }}
        onClick={toggle}
        data-testid={`hierarchy-group-${group.traitName}-${group.id}`}
      >
        {isExpanded
          ? <ChevronDown size={14} className="text-[#8F00FF] shrink-0" />
          : <ChevronRight size={14} className="text-[#E0DCE6]/40 shrink-0" />}
        <FolderTree size={13} className={`shrink-0 ${depth === 0 ? "text-[#8F00FF]" : "text-[#8F00FF]/60"}`} />
        <span className={`text-sm ${depth === 0 ? "font-semibold text-[#E0DCE6]" : "font-medium text-[#E0DCE6]/90"}`}>
          {group.traitName}
        </span>
        <span className="ml-auto text-xs tabular-nums text-[#03FF9B]/50">
          {group.totalCount} {group.totalCount === 1 ? "figure" : "figures"}
        </span>
      </div>

      {isExpanded && hasContent && (
        <div>
          {group.children.map((child: any) => (
            <HierarchyGroupRow
              key={child.id}
              group={child}
              depth={depth + 1}
              nodes={nodes}
              expandedHierarchy={expandedHierarchy}
              setExpandedHierarchy={setExpandedHierarchy}
              expandedTrait={expandedTrait}
              setExpandedTrait={setExpandedTrait}
              isEditor={isEditor}
              onSuggest={onSuggest}
              catLabel={catLabel}
            />
          ))}
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
    mutationFn: () => apiRequest("POST", "/api/database/login", { password }),
    onSuccess: () => {
      toast({ title: "Edit mode activated" });
      onSuccess();
    },
    onError: () => setError("Invalid password"),
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#130D30] border border-[#350A8C]/40 rounded-xl p-6 w-full max-w-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold" style={{ fontFamily: "'Cinzel Decorative', serif" }}>
            Enter Edit Mode
          </h3>
          <button onClick={onClose} data-testid="button-close-login">
            <X size={18} className="text-[#E0DCE6]/50" />
          </button>
        </div>
        <p className="text-sm text-[#E0DCE6]/60 mb-4">
          Enter the editor password to make changes directly.
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

function SuggestionModal({ target, onClose }: {
  target: { type: string; nodeId?: number; nodeName?: string; field?: string; currentValue?: string; edgeId?: number };
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [source, setSource] = useState("");
  const [value, setValue] = useState("");
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/suggestions", {
        type: target.type,
        submitterName: name,
        source,
        nodeId: target.nodeId || null,
        field: target.field || null,
        currentValue: target.currentValue || null,
        suggestedValue: value || null,
        edgeId: target.edgeId || null,
        status: "pending",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/suggestions"] });
      toast({ title: "Suggestion submitted", description: "Thank you! Your suggestion will be reviewed." });
      onClose();
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const typeLabel =
    target.type === "edit_trait" ? `Edit ${target.field} for ${target.nodeName}` :
    target.type === "add_relation" ? "Suggest new relation" :
    target.type === "edit_relation" ? "Edit relation" :
    target.type === "delete_relation" ? "Delete relation" :
    target.type === "add_character" ? "Suggest new character" :
    "Suggestion";

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#130D30] border border-[#350A8C]/40 rounded-xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold" style={{ fontFamily: "'Cinzel Decorative', serif" }}>
            {typeLabel}
          </h3>
          <button onClick={onClose} data-testid="button-close-suggestion">
            <X size={18} className="text-[#E0DCE6]/50" />
          </button>
        </div>

        {target.currentValue && (
          <div className="mb-3 px-3 py-2 rounded bg-[#0B0626] border border-[#350A8C]/20 text-xs text-[#E0DCE6]/50">
            Current: {target.currentValue}
          </div>
        )}

        <div className="space-y-3">
          <div>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name *"
              className="w-full px-3 py-2 rounded-lg bg-[#0B0626] border border-[#350A8C]/40 text-[#E0DCE6] text-sm focus:outline-none focus:border-[#8F00FF]/60"
              data-testid="input-suggestion-name"
            />
            <p className="text-[10px] text-[#E0DCE6]/40 mt-1 pl-1" data-testid="text-contributor-note">
              You will be listed as a contributor if your suggestion is accepted.
            </p>
          </div>
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Your suggestion *"
            rows={3}
            className="w-full px-3 py-2 rounded-lg bg-[#0B0626] border border-[#350A8C]/40 text-[#E0DCE6] text-sm focus:outline-none focus:border-[#8F00FF]/60 resize-none"
            data-testid="input-suggestion-value"
          />
          <input
            type="text"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="Source / reference *"
            className="w-full px-3 py-2 rounded-lg bg-[#0B0626] border border-[#350A8C]/40 text-[#E0DCE6] text-sm focus:outline-none focus:border-[#8F00FF]/60"
            data-testid="input-suggestion-source"
          />
        </div>

        <button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending || !name || !source || !value}
          className="w-full mt-4 py-2 rounded-lg bg-[#8F00FF] text-white text-sm font-medium hover:bg-[#7B00E0] disabled:opacity-50 transition-colors"
          data-testid="button-submit-suggestion"
        >
          {mutation.isPending ? "Submitting..." : "Submit Suggestion"}
        </button>
      </div>
    </div>
  );
}

function NodesTab({ isEditor, onSuggest }: {
  isEditor: boolean;
  onSuggest: (t: any) => void;
}) {
  const [category, setCategory] = useState<NodeCategory>("characters");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [expandedTrait, setExpandedTrait] = useState<string | null>(null);
  const [expandedHierarchy, setExpandedHierarchy] = useState<Set<number>>(new Set());
  const [hierarchyView, setHierarchyView] = useState(true);
  const [editingNode, setEditingNode] = useState<{ id: number; field: string; value: string } | null>(null);
  const [sortField, setSortField] = useState<string>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [traditionFilter, setTraditionFilter] = useState<string>("");
  const { toast } = useToast();

  const { data: nodes = [], isLoading } = useQuery<Node[]>({
    queryKey: ["/api/nodes"],
  });

  const { data: hierarchyData = [] } = useQuery<TraitHierarchy[]>({
    queryKey: ["/api/trait-hierarchy"],
  });

  const { data: crossCutData = [] } = useQuery<TraitCrossCut[]>({
    queryKey: ["/api/trait-cross-cut"],
  });

  const [crossCutView, setCrossCutView] = useState(false);
  const [expandedCrossCut, setExpandedCrossCut] = useState<string | null>(null);

  const traditions = useMemo(() => {
    const set = new Set<string>();
    nodes.forEach((n) => n.tradition && set.add(n.tradition));
    return Array.from(set).sort();
  }, [nodes]);

  const filtered = useMemo(() => {
    let result = nodes;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (n) =>
          n.name.toLowerCase().includes(q) ||
          n.tradition?.toLowerCase().includes(q) ||
          n.domain?.toLowerCase().includes(q)
      );
    }
    if (traditionFilter) {
      result = result.filter((n) => n.tradition === traditionFilter);
    }
    result = [...result].sort((a, b) => {
      const aVal = (a as any)[sortField] || "";
      const bVal = (b as any)[sortField] || "";
      const cmp = String(aVal).localeCompare(String(bVal));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return result;
  }, [nodes, search, traditionFilter, sortField, sortDir]);

  const traitData = useMemo(() => {
    if (category === "characters") return null;
    const catInfo = NODE_CATEGORIES.find((c) => c.key === category);
    if (!catInfo) return null;
    const valueMap = new Map<string, number[]>();
    const addValue = (v: string, id: number) => {
      const trimmed = v.trim();
      if (!trimmed) return;
      if (!valueMap.has(trimmed)) valueMap.set(trimmed, []);
      valueMap.get(trimmed)!.push(id);
    };
    nodes.forEach((n) => {
      if (catInfo.isArray) {
        const arr = (n as any)[category] as string[] | null;
        if (arr) arr.forEach((v) => addValue(v, n.id));
      } else if (catInfo.commaSplit) {
        const val = (n as any)[category] as string | null;
        if (val) val.split(",").forEach((v) => addValue(v, n.id));
      } else {
        const val = (n as any)[category] as string | null;
        if (val) addValue(val, n.id);
      }
    });
    let entries = Array.from(valueMap.entries()).map(([value, ids]) => ({ value, count: ids.length, nodeIds: ids }));
    if (search) {
      const q = search.toLowerCase();
      entries = entries.filter((e) => e.value.toLowerCase().includes(q));
    }
    entries.sort((a, b) => {
      if (sortField === "count") {
        return sortDir === "asc" ? a.count - b.count : b.count - a.count;
      }
      const cmp = a.value.localeCompare(b.value);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return entries;
  }, [nodes, category, search, sortField, sortDir]);

  const categoryHierarchy = useMemo(() => {
    if (!hierarchyData.length) return null;
    const fieldMap: Record<string, string> = { physicalCharacteristics: "physical_characteristics", object: "object", animals: "animals" };
    const dbField = fieldMap[category];
    if (!dbField) return null;
    const relevant = hierarchyData.filter((h) => h.categoryField === dbField);
    if (!relevant.length) return null;
    return relevant;
  }, [hierarchyData, category]);

  const categoryCrossCuts = useMemo(() => {
    if (!crossCutData.length || !traitData) return null;
    const fieldMap: Record<string, string> = { physicalCharacteristics: "physical_characteristics", object: "object", animals: "animals" };
    const dbField = fieldMap[category];
    if (!dbField) return null;
    const relevant = crossCutData.filter((cc) => cc.categoryField === dbField);
    if (!relevant.length) return null;

    const traitMap = new Map<string, { value: string; count: number; nodeIds: number[] }>();
    traitData.forEach((t) => traitMap.set(t.value, t));

    const groups = new Map<string, { traits: Set<string>; uniqueNodeIds: Set<number>; entries: { value: string; count: number; nodeIds: number[] }[] }>();
    for (const cc of relevant) {
      const name = cc.crossCutName;
      if (!groups.has(name)) groups.set(name, { traits: new Set(), uniqueNodeIds: new Set(), entries: [] });
      const g = groups.get(name)!;
      const traitName = cc.standaloneTrait || (cc.traitHierarchyId ? hierarchyData.find(h => h.id === cc.traitHierarchyId)?.traitName : null);
      if (traitName && !g.traits.has(traitName)) {
        g.traits.add(traitName);
        const t = traitMap.get(traitName);
        if (t) {
          g.entries.push(t);
          t.nodeIds.forEach(id => g.uniqueNodeIds.add(id));
        } else {
          g.entries.push({ value: traitName, count: 0, nodeIds: [] });
        }
      }
    }

    return Array.from(groups.entries())
      .map(([name, g]) => ({ name, entries: g.entries.sort((a, b) => b.count - a.count), totalCount: g.uniqueNodeIds.size }))
      .filter(g => g.entries.length > 0)
      .sort((a, b) => b.totalCount - a.totalCount);
  }, [crossCutData, hierarchyData, traitData, category]);

  interface HierarchyGroup {
    id: number;
    traitName: string;
    isLeaf: boolean;
    parentId: number | null;
    children: HierarchyGroup[];
    leafTraits: { value: string; count: number; nodeIds: number[] }[];
    totalCount: number;
  }

  const hierarchyTree = useMemo(() => {
    if (!categoryHierarchy || !traitData) return null;
    const traitMap = new Map<string, { value: string; count: number; nodeIds: number[] }>();
    traitData.forEach((t) => traitMap.set(t.value, t));

    const byId = new Map<number, HierarchyGroup>();
    const roots: HierarchyGroup[] = [];

    for (const item of categoryHierarchy) {
      const group: HierarchyGroup = {
        id: item.id,
        traitName: item.traitName,
        isLeaf: item.isLeaf === 1,
        parentId: item.parentId,
        children: [],
        leafTraits: [],
        totalCount: 0,
      };
      if (item.isLeaf === 1) {
        const t = traitMap.get(item.traitName);
        if (t) group.leafTraits = [t];
      }
      byId.set(item.id, group);
    }

    for (const item of categoryHierarchy) {
      const group = byId.get(item.id)!;
      if (item.parentId === null) {
        roots.push(group);
      } else {
        const parent = byId.get(item.parentId);
        if (parent) parent.children.push(group);
      }
    }

    function collectLeafTraits(g: HierarchyGroup): { value: string; count: number; nodeIds: number[] }[] {
      if (g.isLeaf) return g.leafTraits;
      const all: { value: string; count: number; nodeIds: number[] }[] = [];
      for (const child of g.children) {
        all.push(...collectLeafTraits(child));
      }
      return all;
    }

    function computeTotal(g: HierarchyGroup): number {
      if (g.isLeaf) {
        g.totalCount = g.leafTraits.reduce((s, t) => s + t.count, 0);
        return g.totalCount;
      }
      let total = 0;
      for (const child of g.children) {
        total += computeTotal(child);
      }
      g.totalCount = total;
      return total;
    }
    roots.forEach(computeTotal);

    const traitsCoveredByHierarchy = new Set<string>();
    function collectNames(g: HierarchyGroup) {
      if (g.isLeaf) {
        traitsCoveredByHierarchy.add(g.traitName);
        g.leafTraits.forEach((t) => traitsCoveredByHierarchy.add(t.value));
      }
      g.children.forEach(collectNames);
    }
    roots.forEach(collectNames);

    const uncategorized = traitData.filter((t) => !traitsCoveredByHierarchy.has(t.value));

    roots.sort((a, b) => b.totalCount - a.totalCount);

    return { roots, uncategorized };
  }, [categoryHierarchy, traitData]);

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      apiRequest("PUT", `/api/editor/nodes/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nodes"] });
      setEditingNode(null);
      toast({ title: "Updated successfully" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/editor/nodes/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nodes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/edges"] });
      toast({ title: "Character deleted" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  function toggleSort(field: string) {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  }

  if (isLoading) {
    return <LoadingState />;
  }

  const catLabel = NODE_CATEGORIES.find((c) => c.key === category)?.label || "Characters";

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-4 pb-3 border-b border-[#350A8C]/15">
        {NODE_CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            onClick={() => {
              setCategory(cat.key);
              setSearch("");
              setExpandedId(null);
              setExpandedTrait(null);
              setSortField(cat.key === "characters" ? "name" : "value");
              setSortDir("asc");
            }}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              category === cat.key
                ? "bg-[#8F00FF]/20 text-[#8F00FF] border border-[#8F00FF]/30"
                : "text-[#E0DCE6]/40 hover:text-[#E0DCE6]/70 border border-transparent hover:border-[#350A8C]/30"
            }`}
            data-testid={`button-category-${cat.key}`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#E0DCE6]/40" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={category === "characters" ? "Search characters..." : `Search ${catLabel.toLowerCase()}...`}
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-[#130D30] border border-[#350A8C]/30 text-sm text-[#E0DCE6] focus:outline-none focus:border-[#8F00FF]/60"
            data-testid="input-search-characters"
          />
        </div>
        {category === "characters" && (
          <select
            value={traditionFilter}
            onChange={(e) => setTraditionFilter(e.target.value)}
            className="px-3 py-2 rounded-lg bg-[#130D30] border border-[#350A8C]/30 text-sm text-[#E0DCE6] focus:outline-none focus:border-[#8F00FF]/60"
            data-testid="select-tradition-filter"
          >
            <option value="">All Traditions</option>
            {traditions.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        )}
        {!isEditor && (
          <button
            onClick={() => onSuggest({ type: category === "characters" ? "add_character" : "edit_trait", field: catLabel })}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#350A8C]/30 border border-[#350A8C]/40 text-sm text-[#E0DCE6]/70 hover:border-[#8F00FF]/50 transition-colors"
            data-testid="button-suggest-category"
          >
            <MessageSquarePlus size={14} /> {category === "characters" ? "Suggest Character" : "Suggest Feedback"}
          </button>
        )}
      </div>

      {category === "characters" ? (
        <>
          <div className="text-xs text-[#E0DCE6]/40 mb-3">
            {filtered.length} character{filtered.length !== 1 ? "s" : ""} found
          </div>

          <div className="border border-[#350A8C]/20 rounded-xl overflow-hidden">
            <div className="grid grid-cols-[1fr_140px_140px_80px] gap-0 bg-[#130D30]/80 border-b border-[#350A8C]/20 px-4 py-2.5 text-xs font-medium text-[#E0DCE6]/50 uppercase tracking-wider">
              <button onClick={() => toggleSort("name")} className="flex items-center gap-1 text-left" data-testid="sort-name">
                Name <ArrowUpDown size={12} />
              </button>
              <button onClick={() => toggleSort("tradition")} className="flex items-center gap-1 text-left" data-testid="sort-tradition">
                Tradition <ArrowUpDown size={12} />
              </button>
              <button onClick={() => toggleSort("domain")} className="flex items-center gap-1 text-left" data-testid="sort-domain">
                Domain <ArrowUpDown size={12} />
              </button>
              <span></span>
            </div>

            <div className="max-h-[60vh] overflow-y-auto">
              {filtered.map((node) => (
                <div key={node.id} className="border-b border-[#350A8C]/10 last:border-0">
                  <div
                    className="grid grid-cols-[1fr_140px_140px_80px] gap-0 px-4 py-2.5 text-sm cursor-pointer hover:bg-[#130D30]/50 transition-colors"
                    onClick={() => setExpandedId(expandedId === node.id ? null : node.id)}
                    data-testid={`row-character-${node.id}`}
                  >
                    <div className="flex items-center gap-2">
                      {expandedId === node.id ? <ChevronDown size={14} className="text-[#8F00FF]" /> : <ChevronRight size={14} className="text-[#E0DCE6]/30" />}
                      <span className="font-medium">{node.name}</span>
                    </div>
                    <span className="text-[#E0DCE6]/60">{node.tradition || "—"}</span>
                    <span className="text-[#E0DCE6]/60">{node.domain || "—"}</span>
                    <div className="flex items-center gap-1 justify-end">
                      {!isEditor && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSuggest({ type: "edit_trait", nodeId: node.id, nodeName: node.name });
                          }}
                          className="p-1 rounded hover:bg-[#350A8C]/40 text-[#E0DCE6]/40 hover:text-[#8F00FF] transition-colors"
                          title="Suggest edit"
                          data-testid={`button-suggest-node-${node.id}`}
                        >
                          <MessageSquarePlus size={14} />
                        </button>
                      )}
                      {isEditor && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`Delete ${node.name}?`)) deleteMutation.mutate(node.id);
                          }}
                          className="p-1 rounded hover:bg-red-500/20 text-[#E0DCE6]/40 hover:text-red-400 transition-colors"
                          title="Delete"
                          data-testid={`button-delete-node-${node.id}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>

                  {expandedId === node.id && (
                    <div className="px-4 pb-4 pl-10 bg-[#0B0626]/50">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                        {TRAIT_FIELDS.map(({ key, label }) => {
                          const val = (node as any)[key] || "";
                          const isEditing = editingNode?.id === node.id && editingNode.field === key;
                          return (
                            <div key={key} className="flex items-start gap-2 text-sm">
                              <span className="text-[#E0DCE6]/40 min-w-[130px] text-xs pt-0.5">{label}:</span>
                              {isEditing ? (
                                <div className="flex items-center gap-1 flex-1">
                                  <input
                                    type="text"
                                    value={editingNode.value}
                                    onChange={(e) => setEditingNode({ ...editingNode, value: e.target.value })}
                                    className="flex-1 px-2 py-0.5 rounded bg-[#130D30] border border-[#8F00FF]/40 text-xs text-[#E0DCE6] focus:outline-none"
                                    data-testid={`input-edit-${key}-${node.id}`}
                                    autoFocus
                                  />
                                  <button
                                    onClick={() => updateMutation.mutate({ id: node.id, data: { [key]: editingNode.value || null } })}
                                    className="text-[#03FF9B]"
                                    data-testid={`button-save-${key}-${node.id}`}
                                  >
                                    <Check size={14} />
                                  </button>
                                  <button onClick={() => setEditingNode(null)} className="text-[#E0DCE6]/40">
                                    <X size={14} />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1 flex-1">
                                  <span className="text-[#E0DCE6]/80 text-xs">{val || "—"}</span>
                                  {isEditor && (
                                    <button
                                      onClick={() => setEditingNode({ id: node.id, field: key, value: val })}
                                      className="p-0.5 rounded hover:bg-[#350A8C]/40 text-[#E0DCE6]/30 hover:text-[#8F00FF] ml-1"
                                      data-testid={`button-edit-${key}-${node.id}`}
                                    >
                                      <Pencil size={11} />
                                    </button>
                                  )}
                                  {!isEditor && (
                                    <button
                                      onClick={() => onSuggest({ type: "edit_trait", nodeId: node.id, nodeName: node.name, field: label, currentValue: val })}
                                      className="p-0.5 rounded hover:bg-[#350A8C]/40 text-[#E0DCE6]/20 hover:text-[#8F00FF] ml-1"
                                      data-testid={`button-suggest-${key}-${node.id}`}
                                    >
                                      <MessageSquarePlus size={11} />
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                        {ARRAY_FIELDS.map(({ key, label }) => {
                          const val = (node as any)[key] as string[] | null;
                          return (
                            <div key={key} className="flex items-start gap-2 text-sm">
                              <span className="text-[#E0DCE6]/40 min-w-[130px] text-xs pt-0.5">{label}:</span>
                              <span className="text-[#E0DCE6]/80 text-xs">
                                {val && val.length > 0 ? val.join(", ") : "—"}
                              </span>
                            </div>
                          );
                        })}
                        {node.mentionCount != null && (
                          <div className="flex items-start gap-2 text-sm">
                            <span className="text-[#E0DCE6]/40 min-w-[130px] text-xs pt-0.5">Mention Count:</span>
                            <span className="text-[#E0DCE6]/80 text-xs">{node.mentionCount}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      ) : hierarchyTree && hierarchyView ? (
        <>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-xs text-[#E0DCE6]/40">
              <FolderTree size={14} className="text-[#8F00FF]" />
              <span>{hierarchyTree.roots.length} metacategories · {traitData?.length || 0} trait values</span>
            </div>
            <div className="flex items-center gap-2">
              {categoryCrossCuts && categoryCrossCuts.length > 0 && (
                <button
                  onClick={() => setCrossCutView(!crossCutView)}
                  className={`flex items-center gap-1.5 text-xs transition-colors px-2 py-1 rounded border ${crossCutView ? "text-[#03FF9B] border-[#03FF9B]/30 bg-[#03FF9B]/10" : "text-[#E0DCE6]/40 hover:text-[#E0DCE6]/70 border-[#350A8C]/20 hover:border-[#350A8C]/40"}`}
                  data-testid="button-toggle-crosscut-view"
                >
                  <Layers size={12} />
                  Cross-cutting ({categoryCrossCuts.length})
                </button>
              )}
              <button
                onClick={() => setHierarchyView(false)}
                className="text-xs text-[#E0DCE6]/40 hover:text-[#E0DCE6]/70 transition-colors px-2 py-1 rounded border border-[#350A8C]/20 hover:border-[#350A8C]/40"
                data-testid="button-toggle-flat-view"
              >
                Flat view
              </button>
            </div>
          </div>

          {crossCutView && categoryCrossCuts && (
            <div className="mb-4 border border-[#03FF9B]/20 rounded-xl overflow-hidden bg-[#0B0626]/80">
              <div className="px-4 py-2.5 bg-[#03FF9B]/5 border-b border-[#03FF9B]/15 flex items-center gap-2">
                <Layers size={14} className="text-[#03FF9B]" />
                <span className="text-xs font-semibold text-[#03FF9B]/80 uppercase tracking-wider">Cross-cutting classifications</span>
                <span className="ml-auto text-xs text-[#E0DCE6]/30">Traits spanning multiple hierarchy branches</span>
              </div>
              <div className="max-h-[40vh] overflow-y-auto">
                {categoryCrossCuts.map((group) => {
                  const isOpen = expandedCrossCut === group.name;
                  return (
                    <div key={group.name} className="border-b border-[#03FF9B]/10 last:border-0">
                      <div
                        className="flex items-center gap-2 py-2 px-4 cursor-pointer transition-colors hover:bg-[#03FF9B]/5"
                        onClick={() => setExpandedCrossCut(isOpen ? null : group.name)}
                        data-testid={`crosscut-group-${group.name}`}
                      >
                        {isOpen
                          ? <ChevronDown size={14} className="text-[#03FF9B] shrink-0" />
                          : <ChevronRight size={14} className="text-[#E0DCE6]/30 shrink-0" />}
                        <Layers size={13} className="text-[#03FF9B]/60 shrink-0" />
                        <span className="text-sm font-medium text-[#E0DCE6]/90">{group.name}</span>
                        <span className="ml-auto text-xs tabular-nums text-[#03FF9B]/50">
                          {group.entries.length} trait{group.entries.length !== 1 ? "s" : ""} · {group.totalCount} figure{group.totalCount !== 1 ? "s" : ""}
                        </span>
                      </div>
                      {isOpen && (
                        <div className="pb-1">
                          {group.entries.map((entry) => (
                            <TraitRow
                              key={`cc-${group.name}-${entry.value}`}
                              entry={entry}
                              nodes={nodes}
                              expandedTrait={expandedTrait}
                              setExpandedTrait={setExpandedTrait}
                              isEditor={isEditor}
                              onSuggest={onSuggest}
                              catLabel={catLabel}
                              depth={1}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="border border-[#350A8C]/20 rounded-xl overflow-hidden">
            <div className="max-h-[60vh] overflow-y-auto">
              {hierarchyTree.roots.map((root) => (
                <HierarchyGroupRow
                  key={root.id}
                  group={root}
                  depth={0}
                  nodes={nodes}
                  expandedHierarchy={expandedHierarchy}
                  setExpandedHierarchy={setExpandedHierarchy}
                  expandedTrait={expandedTrait}
                  setExpandedTrait={setExpandedTrait}
                  isEditor={isEditor}
                  onSuggest={onSuggest}
                  catLabel={catLabel}
                />
              ))}
              {hierarchyTree.uncategorized.length > 0 && (
                <>
                  <div className="px-4 py-2 bg-[#130D30]/40 border-t border-[#350A8C]/20">
                    <span className="text-xs font-medium text-[#E0DCE6]/40 uppercase tracking-wider">Other traits</span>
                  </div>
                  {hierarchyTree.uncategorized.map((entry) => (
                    <TraitRow
                      key={entry.value}
                      entry={entry}
                      nodes={nodes}
                      expandedTrait={expandedTrait}
                      setExpandedTrait={setExpandedTrait}
                      isEditor={isEditor}
                      onSuggest={onSuggest}
                      catLabel={catLabel}
                      depth={0}
                    />
                  ))}
                </>
              )}
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs text-[#E0DCE6]/40">
              {traitData?.length || 0} unique {catLabel.toLowerCase()} value{(traitData?.length || 0) !== 1 ? "s" : ""}
            </div>
            {hierarchyTree && (
              <button
                onClick={() => setHierarchyView(true)}
                className="flex items-center gap-1.5 text-xs text-[#E0DCE6]/40 hover:text-[#E0DCE6]/70 transition-colors px-2 py-1 rounded border border-[#350A8C]/20 hover:border-[#350A8C]/40"
                data-testid="button-toggle-hierarchy-view"
              >
                <FolderTree size={12} />
                Hierarchy view
              </button>
            )}
          </div>

          <div className="border border-[#350A8C]/20 rounded-xl overflow-hidden">
            <div className="grid grid-cols-[1fr_100px] gap-0 bg-[#130D30]/80 border-b border-[#350A8C]/20 px-4 py-2.5 text-xs font-medium text-[#E0DCE6]/50 uppercase tracking-wider">
              <button onClick={() => toggleSort("value")} className="flex items-center gap-1 text-left" data-testid="sort-trait-value">
                Value <ArrowUpDown size={12} />
              </button>
              <button onClick={() => toggleSort("count")} className="flex items-center gap-1 text-left" data-testid="sort-trait-count">
                Characters <ArrowUpDown size={12} />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto">
              {traitData?.map((entry) => (
                <TraitRow
                  key={entry.value}
                  entry={entry}
                  nodes={nodes}
                  expandedTrait={expandedTrait}
                  setExpandedTrait={setExpandedTrait}
                  isEditor={isEditor}
                  onSuggest={onSuggest}
                  catLabel={catLabel}
                  depth={0}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function RelationsTab({ isEditor, onSuggest }: {
  isEditor: boolean;
  onSuggest: (t: any) => void;
}) {
  const [search, setSearch] = useState("");
  const { toast } = useToast();

  const { data: edges = [], isLoading: edgesLoading } = useQuery<Edge[]>({
    queryKey: ["/api/edges"],
  });

  const { data: nodes = [] } = useQuery<Node[]>({
    queryKey: ["/api/nodes"],
  });

  const nodeMap = useMemo(() => {
    const m = new Map<number, string>();
    nodes.forEach((n) => m.set(n.id, n.name));
    return m;
  }, [nodes]);

  const filtered = useMemo(() => {
    if (!search) return edges;
    const q = search.toLowerCase();
    return edges.filter((e) => {
      const src = nodeMap.get(e.sourceNodeId)?.toLowerCase() || "";
      const tgt = nodeMap.get(e.targetNodeId)?.toLowerCase() || "";
      const rel = e.relationType?.toLowerCase() || "";
      return src.includes(q) || tgt.includes(q) || rel.includes(q);
    });
  }, [edges, search, nodeMap]);

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/editor/edges/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/edges"] });
      toast({ title: "Relation deleted" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (edgesLoading) return <LoadingState />;

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#E0DCE6]/40" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search relations..."
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-[#130D30] border border-[#350A8C]/30 text-sm text-[#E0DCE6] focus:outline-none focus:border-[#8F00FF]/60"
            data-testid="input-search-relations"
          />
        </div>
        {!isEditor && (
          <button
            onClick={() => onSuggest({ type: "add_relation" })}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#350A8C]/30 border border-[#350A8C]/40 text-sm text-[#E0DCE6]/70 hover:border-[#8F00FF]/50 transition-colors"
            data-testid="button-suggest-relation"
          >
            <MessageSquarePlus size={14} /> Suggest Relation
          </button>
        )}
      </div>

      <div className="text-xs text-[#E0DCE6]/40 mb-3">
        {filtered.length} relation{filtered.length !== 1 ? "s" : ""} found
      </div>

      <div className="border border-[#350A8C]/20 rounded-xl overflow-hidden">
        <div className="grid grid-cols-[1fr_1fr_160px_60px_60px] gap-0 bg-[#130D30]/80 border-b border-[#350A8C]/20 px-4 py-2.5 text-xs font-medium text-[#E0DCE6]/50 uppercase tracking-wider">
          <span>Source</span>
          <span>Target</span>
          <span>Relation Type</span>
          <span>Weight</span>
          <span></span>
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          {filtered.map((edge) => (
            <div
              key={edge.id}
              className="grid grid-cols-[1fr_1fr_160px_60px_60px] gap-0 px-4 py-2.5 text-sm border-b border-[#350A8C]/10 last:border-0 hover:bg-[#130D30]/30 transition-colors"
              data-testid={`row-edge-${edge.id}`}
            >
              <span className="text-[#E0DCE6]">{nodeMap.get(edge.sourceNodeId) || `#${edge.sourceNodeId}`}</span>
              <span className="text-[#E0DCE6]">{nodeMap.get(edge.targetNodeId) || `#${edge.targetNodeId}`}</span>
              <span className="text-[#E0DCE6]/60">{edge.relationType || "—"}</span>
              <span className="text-[#E0DCE6]/60">{edge.weight ?? 1}</span>
              <div className="flex items-center gap-1 justify-end">
                {!isEditor && (
                  <button
                    onClick={() => onSuggest({ type: "edit_relation", edgeId: edge.id, currentValue: `${nodeMap.get(edge.sourceNodeId)} → ${nodeMap.get(edge.targetNodeId)} (${edge.relationType})` })}
                    className="p-1 rounded hover:bg-[#350A8C]/40 text-[#E0DCE6]/40 hover:text-[#8F00FF] transition-colors"
                    data-testid={`button-suggest-edge-${edge.id}`}
                  >
                    <MessageSquarePlus size={14} />
                  </button>
                )}
                {isEditor && (
                  <button
                    onClick={() => {
                      if (confirm("Delete this relation?")) deleteMutation.mutate(edge.id);
                    }}
                    className="p-1 rounded hover:bg-red-500/20 text-[#E0DCE6]/40 hover:text-red-400 transition-colors"
                    data-testid={`button-delete-edge-${edge.id}`}
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SuggestionsTab({ isEditor }: { isEditor: boolean }) {
  const { toast } = useToast();

  const { data: suggestions = [], isLoading } = useQuery<Suggestion[]>({
    queryKey: ["/api/suggestions"],
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      apiRequest("PUT", `/api/editor/suggestions/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/suggestions"] });
      toast({ title: "Status updated" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/editor/suggestions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/suggestions"] });
      toast({ title: "Suggestion deleted" });
    },
  });

  if (isLoading) return <LoadingState />;

  if (suggestions.length === 0) {
    return (
      <div className="text-center py-16 text-[#E0DCE6]/40">
        <AlertCircle size={32} className="mx-auto mb-3 opacity-40" />
        <p className="text-sm">No suggestions yet</p>
        <p className="text-xs mt-1">Use the Characters or Relations tabs to submit suggestions</p>
      </div>
    );
  }

  const statusColor = (s: string) =>
    s === "approved" ? "text-[#03FF9B]" :
    s === "rejected" ? "text-red-400" :
    "text-yellow-400";

  return (
    <div className="space-y-3">
      {suggestions.map((s) => (
        <div
          key={s.id}
          className="border border-[#350A8C]/20 rounded-xl p-4 bg-[#130D30]/30"
          data-testid={`card-suggestion-${s.id}`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-xs font-medium uppercase ${statusColor(s.status)}`}>
                  {s.status}
                </span>
                <span className="text-xs text-[#E0DCE6]/30">·</span>
                <span className="text-xs text-[#E0DCE6]/40">{s.type.replace(/_/g, " ")}</span>
                <span className="text-xs text-[#E0DCE6]/30">·</span>
                <span className="text-xs text-[#E0DCE6]/40">by {s.submitterName}</span>
              </div>
              {s.field && (
                <p className="text-xs text-[#E0DCE6]/50 mb-1">Field: {s.field}</p>
              )}
              {s.currentValue && (
                <p className="text-xs text-[#E0DCE6]/30 mb-1">Current: {s.currentValue}</p>
              )}
              {s.suggestedValue && (
                <p className="text-sm text-[#E0DCE6]/80">{s.suggestedValue}</p>
              )}
              <p className="text-xs text-[#E0DCE6]/40 mt-1 flex items-center gap-1">
                <BookOpen size={11} /> {s.source}
              </p>
            </div>
            {isEditor && s.status === "pending" && (
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => statusMutation.mutate({ id: s.id, status: "approved" })}
                  className="p-1.5 rounded hover:bg-[#03FF9B]/20 text-[#E0DCE6]/40 hover:text-[#03FF9B] transition-colors"
                  title="Approve"
                  data-testid={`button-approve-suggestion-${s.id}`}
                >
                  <Check size={16} />
                </button>
                <button
                  onClick={() => statusMutation.mutate({ id: s.id, status: "rejected" })}
                  className="p-1.5 rounded hover:bg-red-500/20 text-[#E0DCE6]/40 hover:text-red-400 transition-colors"
                  title="Reject"
                  data-testid={`button-reject-suggestion-${s.id}`}
                >
                  <X size={16} />
                </button>
                <button
                  onClick={() => deleteMutation.mutate(s.id)}
                  className="p-1.5 rounded hover:bg-red-500/20 text-[#E0DCE6]/40 hover:text-red-400 transition-colors"
                  title="Delete"
                  data-testid={`button-delete-suggestion-${s.id}`}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function SourcesTab({ isEditor }: { isEditor: boolean }) {
  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const { toast } = useToast();

  const { data: sourcesList = [], isLoading } = useQuery<Source[]>({
    queryKey: ["/api/sources"],
  });

  const addMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/editor/sources", {
        title,
        author: author || null,
        url: url || null,
        description: description || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sources"] });
      setTitle(""); setAuthor(""); setUrl(""); setDescription("");
      setShowAdd(false);
      toast({ title: "Source added" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/editor/sources/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sources"] });
      toast({ title: "Source deleted" });
    },
  });

  if (isLoading) return <LoadingState />;

  return (
    <div>
      {isEditor && (
        <div className="mb-4">
          {!showAdd ? (
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#350A8C]/30 border border-[#350A8C]/40 text-sm text-[#E0DCE6]/70 hover:border-[#8F00FF]/50 transition-colors"
              data-testid="button-add-source"
            >
              <Plus size={14} /> Add Source
            </button>
          ) : (
            <div className="border border-[#350A8C]/30 rounded-xl p-4 bg-[#130D30]/30 space-y-2">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Title *"
                className="w-full px-3 py-2 rounded-lg bg-[#0B0626] border border-[#350A8C]/40 text-sm text-[#E0DCE6] focus:outline-none focus:border-[#8F00FF]/60"
                data-testid="input-source-title"
              />
              <input
                type="text"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="Author"
                className="w-full px-3 py-2 rounded-lg bg-[#0B0626] border border-[#350A8C]/40 text-sm text-[#E0DCE6] focus:outline-none focus:border-[#8F00FF]/60"
                data-testid="input-source-author"
              />
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="URL"
                className="w-full px-3 py-2 rounded-lg bg-[#0B0626] border border-[#350A8C]/40 text-sm text-[#E0DCE6] focus:outline-none focus:border-[#8F00FF]/60"
                data-testid="input-source-url"
              />
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Description"
                rows={2}
                className="w-full px-3 py-2 rounded-lg bg-[#0B0626] border border-[#350A8C]/40 text-sm text-[#E0DCE6] focus:outline-none focus:border-[#8F00FF]/60 resize-none"
                data-testid="input-source-description"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => addMutation.mutate()}
                  disabled={!title || addMutation.isPending}
                  className="px-4 py-1.5 rounded-lg bg-[#8F00FF] text-white text-sm font-medium hover:bg-[#7B00E0] disabled:opacity-50 transition-colors"
                  data-testid="button-save-source"
                >
                  Save
                </button>
                <button
                  onClick={() => setShowAdd(false)}
                  className="px-4 py-1.5 rounded-lg text-[#E0DCE6]/50 text-sm hover:text-[#E0DCE6] transition-colors"
                  data-testid="button-cancel-source"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {sourcesList.length === 0 ? (
        <div className="text-center py-16 text-[#E0DCE6]/40">
          <BookOpen size={32} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">No sources listed yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sourcesList.map((src) => (
            <div
              key={src.id}
              className="border border-[#350A8C]/20 rounded-xl p-4 bg-[#130D30]/30 flex items-start justify-between gap-3"
              data-testid={`card-source-${src.id}`}
            >
              <div>
                <h4 className="text-sm font-medium text-[#E0DCE6]">{src.title}</h4>
                {src.author && <p className="text-xs text-[#E0DCE6]/50 mt-0.5">{src.author}</p>}
                {src.description && <p className="text-xs text-[#E0DCE6]/60 mt-1">{src.description}</p>}
                {src.url && (
                  <a
                    href={src.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-[#8F00FF] hover:underline mt-1 flex items-center gap-1"
                    data-testid={`link-source-${src.id}`}
                  >
                    <ExternalLink size={11} /> {src.url}
                  </a>
                )}
              </div>
              {isEditor && (
                <button
                  onClick={() => {
                    if (confirm("Delete this source?")) deleteMutation.mutate(src.id);
                  }}
                  className="p-1 rounded hover:bg-red-500/20 text-[#E0DCE6]/40 hover:text-red-400 transition-colors shrink-0"
                  data-testid={`button-delete-source-${src.id}`}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="w-6 h-6 border-2 border-[#8F00FF]/30 border-t-[#8F00FF] rounded-full animate-spin" />
    </div>
  );
}
