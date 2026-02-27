import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Node, Edge, Suggestion, Source } from "@shared/schema";
import {
  Search, Lock, Unlock, ChevronDown, ChevronRight, Plus, Pencil, Trash2,
  MessageSquarePlus, BookOpen, X, Check, AlertCircle, ArrowUpDown, ExternalLink
} from "lucide-react";

type Tab = "nodes" | "relations" | "suggestions" | "sources";
type NodeCategory = "characters" | "gender" | "domain" | "object" | "animals" | "characterTrait" | "physicalCharacteristics" | "significantEvent" | "symbolism" | "neumannArchetype" | "eventTypes" | "birthTypes" | "deathTypes" | "familyRoles";

const NODE_CATEGORIES: { key: NodeCategory; label: string; isArray?: boolean }[] = [
  { key: "characters", label: "Characters" },
  { key: "gender", label: "Gender" },
  { key: "domain", label: "Domain" },
  { key: "object", label: "Object" },
  { key: "animals", label: "Animals" },
  { key: "characterTrait", label: "Character Trait" },
  { key: "physicalCharacteristics", label: "Physical Characteristics" },
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
  { key: "characterTrait", label: "Character Trait" },
  { key: "physicalCharacteristics", label: "Physical Characteristics" },
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
  const [editingNode, setEditingNode] = useState<{ id: number; field: string; value: string } | null>(null);
  const [sortField, setSortField] = useState<string>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [traditionFilter, setTraditionFilter] = useState<string>("");
  const { toast } = useToast();

  const { data: nodes = [], isLoading } = useQuery<Node[]>({
    queryKey: ["/api/nodes"],
  });

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
    nodes.forEach((n) => {
      if (catInfo.isArray) {
        const arr = (n as any)[category] as string[] | null;
        if (arr) arr.forEach((v) => {
          if (!valueMap.has(v)) valueMap.set(v, []);
          valueMap.get(v)!.push(n.id);
        });
      } else {
        const val = (n as any)[category] as string | null;
        if (val) {
          if (!valueMap.has(val)) valueMap.set(val, []);
          valueMap.get(val)!.push(n.id);
        }
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
        {!isEditor && category === "characters" && (
          <button
            onClick={() => onSuggest({ type: "add_character" })}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#350A8C]/30 border border-[#350A8C]/40 text-sm text-[#E0DCE6]/70 hover:border-[#8F00FF]/50 transition-colors"
            data-testid="button-suggest-character"
          >
            <MessageSquarePlus size={14} /> Suggest Character
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
      ) : (
        <>
          <div className="text-xs text-[#E0DCE6]/40 mb-3">
            {traitData?.length || 0} unique {catLabel.toLowerCase()} value{(traitData?.length || 0) !== 1 ? "s" : ""}
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
                <div key={entry.value} className="border-b border-[#350A8C]/10 last:border-0">
                  <div
                    className="grid grid-cols-[1fr_100px] gap-0 px-4 py-2.5 text-sm cursor-pointer hover:bg-[#130D30]/50 transition-colors"
                    onClick={() => setExpandedTrait(expandedTrait === entry.value ? null : entry.value)}
                    data-testid={`row-trait-${entry.value.replace(/\s+/g, "-").toLowerCase()}`}
                  >
                    <div className="flex items-center gap-2">
                      {expandedTrait === entry.value
                        ? <ChevronDown size={14} className="text-[#8F00FF]" />
                        : <ChevronRight size={14} className="text-[#E0DCE6]/30" />}
                      <span className="font-medium">{entry.value}</span>
                    </div>
                    <span className="text-[#E0DCE6]/60">{entry.count}</span>
                  </div>

                  {expandedTrait === entry.value && (
                    <div className="px-4 pb-3 pl-10 bg-[#0B0626]/50">
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
