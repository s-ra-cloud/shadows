import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import * as d3 from "d3";
import { X, Search, Filter, ArrowLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Link } from "wouter";
import type { Node, Edge } from "@shared/schema";

const TRADITION_COLORS: Record<string, string> = {
  "Greek": "#8F00FF",
  "Norse": "#4A7BFF",
  "Egyptian": "#FFB800",
  "Hindu": "#FF6B35",
  "Shinto": "#FF4081",
  "Sumerian": "#03FF9B",
  "Aztec": "#00BCD4",
  "Celtic": "#7FFF00",
  "Roman": "#FF8A65",
  "Mythological": "#B388FF",
  "Fairy Tale": "#F8BBD0",
};

const CATEGORY_COLORS: Record<string, string> = {
  gender: "#E0DCE6",
  domain: "#03FF9B",
  object: "#FFB800",
  animals: "#FF6B35",
  characterTrait: "#FF4081",
  physicalCharacteristics: "#4A7BFF",
  significantEvent: "#8F00FF",
  birthCircumstances: "#00BCD4",
  deathCircumstances: "#E53935",
};

const CATEGORY_LABELS: Record<string, string> = {
  gender: "Gender",
  domain: "Domain",
  object: "Object",
  animals: "Animals",
  characterTrait: "Trait",
  physicalCharacteristics: "Physical",
  significantEvent: "Event",
  birthCircumstances: "Birth",
  deathCircumstances: "Death",
};

function getTraditionColor(tradition: string | null) {
  if (!tradition) return "#8F00FF";
  return TRADITION_COLORS[tradition] || "#8F00FF";
}

function tokenize(text: string | null): string[] {
  if (!text) return [];
  return text.split(/[,;]+/).map(s => s.trim().toLowerCase()).filter(s => s.length > 1 && s.length < 40);
}

interface GraphData {
  nodes: Node[];
  edges: Edge[];
}

interface TraitNode {
  id: string;
  label: string;
  category: string;
  count: number;
  isCharacter: false;
}

interface CharNode {
  id: string;
  nodeId: number;
  label: string;
  tradition: string | null;
  isCharacter: true;
  original: Node;
}

type GraphNode = TraitNode | CharNode;

interface GraphLink {
  source: string;
  target: string;
  category: string;
}

function buildGraph(figures: Node[], minShared = 3) {
  const traitFields: { key: keyof Node; category: string }[] = [
    { key: "gender", category: "gender" },
    { key: "domain", category: "domain" },
    { key: "object", category: "object" },
    { key: "animals", category: "animals" },
    { key: "characterTrait", category: "characterTrait" },
    { key: "physicalCharacteristics", category: "physicalCharacteristics" },
    { key: "significantEvent", category: "significantEvent" },
    { key: "birthCircumstances", category: "birthCircumstances" },
    { key: "deathCircumstances", category: "deathCircumstances" },
  ];

  const traitCounts = new Map<string, { label: string; category: string; count: number }>();
  const figureTraits = new Map<number, string[]>();

  for (const fig of figures) {
    const traits: string[] = [];
    for (const field of traitFields) {
      const val = fig[field.key] as string | null;
      const tokens = tokenize(val);
      for (const token of tokens) {
        const traitId = `${field.category}::${token}`;
        traits.push(traitId);
        const existing = traitCounts.get(traitId);
        if (existing) {
          existing.count++;
        } else {
          traitCounts.set(traitId, { label: token, category: field.category, count: 1 });
        }
      }
    }
    figureTraits.set(fig.id, traits);
  }

  const sharedTraits = new Map<string, { label: string; category: string; count: number }>();
  for (const [id, data] of traitCounts) {
    if (data.count >= minShared) {
      sharedTraits.set(id, data);
    }
  }

  const graphNodes: GraphNode[] = [];
  const graphLinks: GraphLink[] = [];
  const connectedFigureIds = new Set<number>();

  for (const fig of figures) {
    const traits = figureTraits.get(fig.id) || [];
    for (const traitId of traits) {
      if (sharedTraits.has(traitId)) {
        connectedFigureIds.add(fig.id);
        graphLinks.push({
          source: `fig-${fig.id}`,
          target: traitId,
          category: sharedTraits.get(traitId)!.category,
        });
      }
    }
  }

  for (const fig of figures) {
    if (connectedFigureIds.has(fig.id)) {
      graphNodes.push({
        id: `fig-${fig.id}`,
        nodeId: fig.id,
        label: fig.name,
        tradition: fig.tradition,
        isCharacter: true,
        original: fig,
      });
    }
  }

  for (const [traitId, data] of sharedTraits) {
    graphNodes.push({
      id: traitId,
      label: data.label,
      category: data.category,
      count: data.count,
      isCharacter: false,
    });
  }

  return { graphNodes, graphLinks };
}

function NodePanel({ node, relatedNodes, edges, onClose }: { node: Node; relatedNodes: Node[]; edges: Edge[]; onClose: () => void }) {
  const detailFields: { key: keyof Node; label: string }[] = [
    { key: "tradition", label: "Tradition" },
    { key: "gender", label: "Gender" },
    { key: "domain", label: "Domain" },
    { key: "object", label: "Object" },
    { key: "animals", label: "Animals" },
    { key: "characterTrait", label: "Character Trait" },
    { key: "physicalCharacteristics", label: "Physical Characteristics" },
    { key: "significantEvent", label: "Significant Event" },
    { key: "birthCircumstances", label: "Circumstances of Birth" },
    { key: "deathCircumstances", label: "Circumstances of Death" },
  ];

  return (
    <div className="absolute top-0 right-0 h-full w-80 lg:w-96 bg-[#0B0626]/95 backdrop-blur-xl border-l border-[#350A8C]/30 z-20 overflow-hidden flex flex-col" data-testid="panel-node-detail">
      <div className="flex items-center justify-between p-4 border-b border-[#350A8C]/20">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-3 h-3 rounded-full flex-shrink-0 bg-[#E0DCE6]" />
          <h3 className="font-serif text-lg text-shadows-text truncate" data-testid="text-node-name">{node.name}</h3>
        </div>
        <button onClick={onClose} className="text-shadows-text/40 hover:text-shadows-text transition-colors flex-shrink-0" data-testid="button-close-panel">
          <X size={18} />
        </button>
      </div>
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {detailFields.map(({ key, label }) => {
            const value = node[key] as string | null;
            if (!value) return null;
            return (
              <div key={key}>
                <span className="text-xs uppercase tracking-wider text-shadows-text/40">{label}</span>
                <p className="text-sm text-shadows-text/80 mt-1 leading-relaxed">{value}</p>
              </div>
            );
          })}
          {relatedNodes.length > 0 && (
            <div>
              <span className="text-xs uppercase tracking-wider text-shadows-text/40">Relationships</span>
              <div className="mt-2 space-y-2">
                {relatedNodes.map((rn) => {
                  const edge = edges.find(
                    (e) =>
                      (e.sourceNodeId === node.id && e.targetNodeId === rn.id) ||
                      (e.targetNodeId === node.id && e.sourceNodeId === rn.id)
                  );
                  return (
                    <div key={rn.id} className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full flex-shrink-0 bg-[#E0DCE6]" />
                      <span className="text-xs text-shadows-text/70">
                        {edge?.relationType ? `${edge.relationType} — ` : ""}{rn.name}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function FilterSidebar({
  filters,
  activeFilters,
  onToggleFilter,
  isOpen,
  onToggle,
  nodeCount,
  totalCount,
}: {
  filters: { traditions: string[]; categories: string[] };
  activeFilters: Record<string, Set<string>>;
  onToggleFilter: (category: string, value: string) => void;
  isOpen: boolean;
  onToggle: () => void;
  nodeCount: number;
  totalCount: number;
}) {
  const sections = [
    {
      key: "traditions",
      label: "Tradition",
      values: filters.traditions,
      getColor: (val: string) => getTraditionColor(val),
    },
    {
      key: "categories",
      label: "Attribute Category",
      values: filters.categories,
      getColor: (val: string) => CATEGORY_COLORS[val] || "#8F00FF",
    },
  ];

  return (
    <>
      <button
        className="absolute top-4 left-4 z-20 p-2 rounded-md bg-[#0B0626]/80 border border-[#350A8C]/30 text-shadows-text/60 hover:text-shadows-text transition-colors lg:hidden"
        onClick={onToggle}
        data-testid="button-toggle-filters"
      >
        <Filter size={18} />
      </button>

      <div
        className={`absolute top-0 left-0 h-full w-64 bg-[#0B0626]/95 backdrop-blur-xl border-r border-[#350A8C]/30 z-10 transition-transform duration-300 ${
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
        data-testid="panel-filters"
      >
        <div className="p-4 border-b border-[#350A8C]/20 flex items-center justify-between">
          <h3 className="font-serif text-sm text-shadows-text tracking-wider">Filters</h3>
          <Link href="/">
            <Button variant="ghost" size="sm" className="text-shadows-text/40 hover:text-shadows-text p-1 h-auto" data-testid="button-back-home">
              <ArrowLeft size={16} />
            </Button>
          </Link>
        </div>
        <div className="px-4 py-2 border-b border-[#350A8C]/10">
          <span className="text-[10px] text-shadows-text/30 font-mono">{nodeCount} figures shown / {totalCount} total</span>
        </div>
        <ScrollArea className="h-[calc(100%-90px)]">
          <div className="p-4 space-y-5">
            {sections.map((section) =>
              section.values.length > 0 ? (
                <div key={section.key}>
                  <h4 className="text-xs uppercase tracking-wider text-shadows-text/40 mb-2">{section.label}</h4>
                  <div className="space-y-1.5">
                    {section.values.map((val) => (
                      <div key={val} className="flex items-center gap-2">
                        <Checkbox
                          id={`${section.key}-${val}`}
                          checked={activeFilters[section.key]?.has(val) || false}
                          onCheckedChange={() => onToggleFilter(section.key, val)}
                          className="border-[#350A8C]/40 data-[state=checked]:bg-[#8F00FF] data-[state=checked]:border-[#8F00FF]"
                          data-testid={`checkbox-filter-${section.key}-${val}`}
                        />
                        <Label
                          htmlFor={`${section.key}-${val}`}
                          className="text-xs text-shadows-text/60 cursor-pointer flex items-center gap-1.5"
                        >
                          <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: section.getColor(val) }} />
                          {section.key === "categories" ? CATEGORY_LABELS[val] || val : val}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null
            )}
          </div>
        </ScrollArea>
      </div>
    </>
  );
}

export default function GraphPage() {
  const { data, isLoading } = useQuery<GraphData>({
    queryKey: ["/api/graph"],
  });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState<Record<string, Set<string>>>({});
  const [hoveredNode, setHoveredNode] = useState<any>(null);
  const simulationRef = useRef<d3.Simulation<any, any> | null>(null);
  const transformRef = useRef(d3.zoomIdentity);
  const simNodesRef = useRef<any[]>([]);
  const simLinksRef = useRef<any[]>([]);

  const { graphNodes, graphLinks } = useMemo(() => {
    if (!data?.nodes) return { graphNodes: [], graphLinks: [] };
    return buildGraph(data.nodes, 2);
  }, [data?.nodes]);

  const filters = useMemo(() => {
    const traditions: string[] = [];
    const categories = [...new Set(graphNodes.filter(n => !n.isCharacter).map(n => (n as TraitNode).category))];
    return { traditions, categories };
  }, [graphNodes]);

  const toggleFilter = useCallback((category: string, value: string) => {
    setActiveFilters((prev) => {
      const next = { ...prev };
      if (!next[category]) next[category] = new Set();
      const s = new Set(next[category]);
      if (s.has(value)) s.delete(value);
      else s.add(value);
      next[category] = s;
      return next;
    });
  }, []);

  const filteredGraphNodes = useMemo(() => {
    return graphNodes.filter((n) => {
      if (n.isCharacter) {
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          if (!n.label.toLowerCase().includes(q)) return false;
        }
        return true;
      } else {
        const catFilter = activeFilters["categories"];
        if (catFilter && catFilter.size > 0) {
          if (!catFilter.has(n.category)) return false;
        }
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          if (!n.label.toLowerCase().includes(q)) return false;
        }
        return true;
      }
    });
  }, [graphNodes, activeFilters, searchQuery]);

  const filteredNodeIds = useMemo(() => new Set(filteredGraphNodes.map(n => n.id)), [filteredGraphNodes]);

  const filteredLinks = useMemo(() => {
    return graphLinks.filter(l => filteredNodeIds.has(l.source) && filteredNodeIds.has(l.target));
  }, [graphLinks, filteredNodeIds]);

  const relatedNodes = selectedNode
    ? data?.nodes.filter((n) => {
        if (n.id === selectedNode.id) return false;
        return data?.edges.some(
          (e) =>
            (e.sourceNodeId === selectedNode.id && e.targetNodeId === n.id) ||
            (e.targetNodeId === selectedNode.id && e.sourceNodeId === n.id)
        );
      }) || []
    : [];

  useEffect(() => {
    if (!canvasRef.current || filteredGraphNodes.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const container = canvas.parentElement;
    if (!container) return;
    const dpr = window.devicePixelRatio || 1;
    const width = container.clientWidth;
    const height = container.clientHeight;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    ctx.scale(dpr, dpr);

    const simNodes = filteredGraphNodes.map((n) => ({
      ...n,
      x: width / 2 + (Math.random() - 0.5) * Math.min(width, 800),
      y: height / 2 + (Math.random() - 0.5) * Math.min(height, 600),
    }));
    const simNodeMap = new Map<string, any>();
    simNodes.forEach((n) => simNodeMap.set(n.id, n));

    const simLinks = filteredLinks
      .map((l) => ({
        ...l,
        source: simNodeMap.get(l.source),
        target: simNodeMap.get(l.target),
      }))
      .filter((l) => l.source && l.target);

    simNodesRef.current = simNodes;
    simLinksRef.current = simLinks;

    const charCount = simNodes.filter(n => n.isCharacter).length;
    const linkDist = charCount > 200 ? 60 : charCount > 100 ? 80 : 100;
    const chargeStr = charCount > 200 ? -50 : charCount > 100 ? -100 : -200;

    const simulation = d3.forceSimulation(simNodes)
      .force("link", d3.forceLink(simLinks).id((d: any) => d.id).distance(linkDist).strength(0.3))
      .force("charge", d3.forceManyBody().strength((d: any) => d.isCharacter ? chargeStr : chargeStr * 0.3))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius((d: any) => d.isCharacter ? 8 : 4))
      .alphaDecay(0.03)
      .velocityDecay(0.4);

    simulationRef.current = simulation;

    let currentHovered: any = null;

    function draw() {
      ctx.save();
      ctx.clearRect(0, 0, width, height);

      const grad = ctx.createLinearGradient(0, 0, width, height);
      grad.addColorStop(0, "#0B0626");
      grad.addColorStop(1, "#0C0042");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      const t = transformRef.current;
      ctx.translate(t.x, t.y);
      ctx.scale(t.k, t.k);

      const hoveredId = currentHovered?.id;
      const connectedIds = new Set<string>();
      if (hoveredId) {
        for (const l of simLinks) {
          if (l.source.id === hoveredId) connectedIds.add(l.target.id);
          if (l.target.id === hoveredId) connectedIds.add(l.source.id);
        }
      }

      for (const l of simLinks) {
        const isHighlighted = hoveredId && (l.source.id === hoveredId || l.target.id === hoveredId);
        const color = CATEGORY_COLORS[l.category] || "#350A8C";
        ctx.beginPath();
        ctx.moveTo(l.source.x, l.source.y);
        ctx.lineTo(l.target.x, l.target.y);
        ctx.strokeStyle = color;
        ctx.globalAlpha = isHighlighted ? 0.7 : hoveredId ? 0.03 : 0.15;
        ctx.lineWidth = isHighlighted ? 1.5 : 0.5;
        ctx.stroke();
      }

      ctx.globalAlpha = 1;

      for (const n of simNodes) {
        const isHovered = n.id === hoveredId;
        const isConnected = connectedIds.has(n.id);
        const dimmed = hoveredId && !isHovered && !isConnected;

        if (n.isCharacter) {
          const color = "#E0DCE6";
          const r = isHovered ? 10 : 6;
          ctx.beginPath();
          ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.globalAlpha = dimmed ? 0.08 : 0.85;
          ctx.fill();
          if (isHovered || isConnected) {
            ctx.strokeStyle = "#8F00FF";
            ctx.lineWidth = 1.5;
            ctx.globalAlpha = 0.6;
            ctx.stroke();
          }
        } else {
          const color = CATEGORY_COLORS[n.category] || "#350A8C";
          const r = isHovered ? 5 : 3;
          ctx.beginPath();
          ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.globalAlpha = dimmed ? 0.05 : 0.5;
          ctx.fill();
        }
      }

      ctx.globalAlpha = 1;

      const showLabels = t.k > 0.6;
      if (showLabels) {
        for (const n of simNodes) {
          const isHovered = n.id === hoveredId;
          const isConnected = connectedIds.has(n.id);
          const dimmed = hoveredId && !isHovered && !isConnected;

          if (n.isCharacter) {
            if (dimmed && !isConnected) continue;
            ctx.font = isHovered ? "bold 11px 'Playfair Display', serif" : "9px 'Playfair Display', serif";
            ctx.fillStyle = "#E0DCE6";
            ctx.globalAlpha = isHovered ? 1 : isConnected ? 0.9 : (t.k > 1.5 ? 0.7 : 0.4);
            ctx.textAlign = "center";
            ctx.fillText(n.label, n.x, n.y - (isHovered ? 14 : 10));
          } else if (isHovered || isConnected) {
            ctx.font = "8px 'DM Sans', sans-serif";
            ctx.fillStyle = CATEGORY_COLORS[n.category] || "#E0DCE6";
            ctx.globalAlpha = 0.8;
            ctx.textAlign = "center";
            ctx.fillText(n.label, n.x, n.y - 7);
          }
        }
      }

      ctx.globalAlpha = 1;
      ctx.restore();
    }

    simulation.on("tick", draw);

    const zoomBehavior = d3.zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([0.1, 8])
      .on("zoom", (event) => {
        transformRef.current = event.transform;
        draw();
      });

    d3.select(canvas).call(zoomBehavior);

    function getNodeAt(px: number, py: number) {
      const t = transformRef.current;
      const x = (px - t.x) / t.k;
      const y = (py - t.y) / t.k;
      for (let i = simNodes.length - 1; i >= 0; i--) {
        const n = simNodes[i];
        const r = n.isCharacter ? 8 : 5;
        const dx = x - n.x;
        const dy = y - n.y;
        if (dx * dx + dy * dy < r * r * 4) return n;
      }
      return null;
    }

    canvas.onmousemove = (e) => {
      const rect = canvas.getBoundingClientRect();
      const node = getNodeAt(e.clientX - rect.left, e.clientY - rect.top);
      currentHovered = node;
      setHoveredNode(node);
      canvas.style.cursor = node ? "pointer" : "default";
      draw();
    };

    canvas.onclick = (e) => {
      const rect = canvas.getBoundingClientRect();
      const node = getNodeAt(e.clientX - rect.left, e.clientY - rect.top);
      if (node?.isCharacter && node.original) {
        setSelectedNode(node.original);
      }
    };

    canvas.onmouseleave = () => {
      currentHovered = null;
      setHoveredNode(null);
      draw();
    };

    return () => {
      simulation.stop();
      canvas.onmousemove = null;
      canvas.onclick = null;
      canvas.onmouseleave = null;
    };
  }, [filteredGraphNodes, filteredLinks]);

  const charNodeCount = useMemo(() => filteredGraphNodes.filter(n => n.isCharacter).length, [filteredGraphNodes]);

  if (isLoading) {
    return (
      <div className="h-screen bg-gradient-to-br from-[#0B0626] to-[#0C0042] flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#8F00FF] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-shadows-text/50 text-sm">Loading graph data...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="h-screen bg-gradient-to-br from-[#0B0626] to-[#0C0042] flex items-center justify-center">
        <p className="text-shadows-text/40" data-testid="text-graph-not-found">No data available.</p>
      </div>
    );
  }

  return (
    <div className="h-screen relative overflow-hidden" data-testid="page-graph">
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 w-80 lg:w-96">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-shadows-text/30" />
          <Input
            type="search"
            placeholder="Search figures or traits..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-[#0B0626]/80 backdrop-blur-xl border-[#350A8C]/30 text-shadows-text text-sm focus:border-[#03FF9B]/50 focus:ring-[#03FF9B]/20 transition-all"
            data-testid="input-search-nodes"
          />
        </div>
      </div>

      <div className="absolute top-4 right-4 z-20 flex flex-col gap-2 bg-[#0B0626]/60 backdrop-blur-sm rounded-md p-3 border border-[#350A8C]/15 max-h-[80vh] overflow-y-auto">
        <span className="text-[10px] uppercase tracking-wider text-shadows-text/30 mb-0.5">Attributes</span>
        {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
          <div key={key} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[key] }} />
            <span className="text-[10px] text-shadows-text/40">{label}</span>
          </div>
        ))}
      </div>

      {hoveredNode && hoveredNode.isCharacter && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 bg-[#0B0626]/90 backdrop-blur-sm border border-[#350A8C]/30 rounded-lg px-4 py-2 pointer-events-none">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-[#E0DCE6]" />
            <span className="text-sm text-shadows-text font-serif">{hoveredNode.label}</span>
          </div>
          {hoveredNode.original?.domain && (
            <p className="text-[10px] text-shadows-text/50 mt-0.5 ml-5">{hoveredNode.original.domain}</p>
          )}
        </div>
      )}

      <FilterSidebar
        filters={filters}
        activeFilters={activeFilters}
        onToggleFilter={toggleFilter}
        isOpen={filtersOpen}
        onToggle={() => setFiltersOpen(!filtersOpen)}
        nodeCount={charNodeCount}
        totalCount={data.nodes.length}
      />

      <div className="absolute inset-0 lg:left-64">
        <canvas ref={canvasRef} className="w-full h-full" />
      </div>

      {selectedNode && (
        <NodePanel
          node={selectedNode}
          relatedNodes={relatedNodes}
          edges={data.edges}
          onClose={() => setSelectedNode(null)}
        />
      )}
    </div>
  );
}
