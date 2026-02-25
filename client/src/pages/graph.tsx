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
  return text.split(/[,;]+/).map(s => s.trim().toLowerCase()).filter(Boolean);
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

function buildGraph(figures: Node[]) {
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
    if (data.count >= 2) {
      sharedTraits.set(id, data);
    }
  }

  const graphNodes: GraphNode[] = [];
  const graphLinks: GraphLink[] = [];

  for (const fig of figures) {
    graphNodes.push({
      id: `fig-${fig.id}`,
      nodeId: fig.id,
      label: fig.name,
      tradition: fig.tradition,
      isCharacter: true,
      original: fig,
    });
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

  for (const fig of figures) {
    const traits = figureTraits.get(fig.id) || [];
    for (const traitId of traits) {
      if (sharedTraits.has(traitId)) {
        graphLinks.push({
          source: `fig-${fig.id}`,
          target: traitId,
          category: sharedTraits.get(traitId)!.category,
        });
      }
    }
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
          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: getTraditionColor(node.tradition) }} />
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
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: getTraditionColor(rn.tradition) }} />
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
}: {
  filters: { traditions: string[]; categories: string[] };
  activeFilters: Record<string, Set<string>>;
  onToggleFilter: (category: string, value: string) => void;
  isOpen: boolean;
  onToggle: () => void;
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
        <ScrollArea className="h-[calc(100%-52px)]">
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

  const svgRef = useRef<SVGSVGElement>(null);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState<Record<string, Set<string>>>({});
  const simulationRef = useRef<d3.Simulation<any, any> | null>(null);

  const { graphNodes, graphLinks } = useMemo(() => {
    if (!data?.nodes) return { graphNodes: [], graphLinks: [] };
    return buildGraph(data.nodes);
  }, [data?.nodes]);

  const filters = useMemo(() => {
    const traditions = [...new Set(data?.nodes.map((n) => n.tradition).filter(Boolean) as string[])];
    const categories = [...new Set(graphNodes.filter(n => !n.isCharacter).map(n => (n as TraitNode).category))];
    return { traditions, categories };
  }, [data?.nodes, graphNodes]);

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
        const tradFilter = activeFilters["traditions"];
        if (tradFilter && tradFilter.size > 0) {
          if (!tradFilter.has(n.tradition || "")) return false;
        }
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
    if (!svgRef.current || filteredGraphNodes.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const container = svgRef.current.parentElement;
    if (!container) return;
    const width = container.clientWidth;
    const height = container.clientHeight;

    svg.attr("width", width).attr("height", height);

    const defs = svg.append("defs");
    const gradient = defs.append("linearGradient").attr("id", "bg-gradient").attr("x1", "0%").attr("y1", "0%").attr("x2", "100%").attr("y2", "100%");
    gradient.append("stop").attr("offset", "0%").attr("stop-color", "#0B0626");
    gradient.append("stop").attr("offset", "100%").attr("stop-color", "#0C0042");

    svg.append("rect").attr("width", width).attr("height", height).attr("fill", "url(#bg-gradient)");

    const g = svg.append("g");

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 5])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });

    svg.call(zoom);

    const simNodes = filteredGraphNodes.map((n) => ({ ...n, x: width / 2 + (Math.random() - 0.5) * 200, y: height / 2 + (Math.random() - 0.5) * 200 }));
    const simNodeMap = new Map<string, any>();
    simNodes.forEach((n) => simNodeMap.set(n.id, n));

    const simLinks = filteredLinks
      .map((l) => ({
        ...l,
        source: simNodeMap.get(l.source),
        target: simNodeMap.get(l.target),
      }))
      .filter((l) => l.source && l.target);

    const simulation = d3.forceSimulation(simNodes)
      .force("link", d3.forceLink(simLinks).id((d: any) => d.id).distance(80).strength(0.4))
      .force("charge", d3.forceManyBody().strength((d: any) => d.isCharacter ? -300 : -80))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius((d: any) => d.isCharacter ? 30 : 15));

    simulationRef.current = simulation;

    const link = g
      .append("g")
      .selectAll("line")
      .data(simLinks)
      .join("line")
      .attr("stroke", (d: any) => CATEGORY_COLORS[d.category] || "#350A8C")
      .attr("stroke-width", 0.6)
      .attr("stroke-opacity", 0.25);

    const nodeGroup = g
      .append("g")
      .selectAll("g")
      .data(simNodes)
      .join("g")
      .attr("cursor", "pointer")
      .call(
        d3.drag<any, any>()
          .on("start", (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on("drag", (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on("end", (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          })
      );

    nodeGroup
      .append("circle")
      .attr("r", (d: any) => d.isCharacter ? 10 : 4)
      .attr("fill", (d: any) => {
        if (d.isCharacter) return getTraditionColor(d.tradition);
        return CATEGORY_COLORS[d.category] || "#350A8C";
      })
      .attr("stroke", (d: any) => {
        if (d.isCharacter) return getTraditionColor(d.tradition);
        return CATEGORY_COLORS[d.category] || "#350A8C";
      })
      .attr("stroke-width", (d: any) => d.isCharacter ? 2 : 1)
      .attr("stroke-opacity", 0.3)
      .attr("fill-opacity", (d: any) => d.isCharacter ? 0.9 : 0.6);

    nodeGroup
      .append("text")
      .text((d: any) => d.label)
      .attr("dy", (d: any) => d.isCharacter ? -16 : -8)
      .attr("text-anchor", "middle")
      .attr("fill", (d: any) => d.isCharacter ? "#E0DCE6" : CATEGORY_COLORS[d.category] || "#E0DCE6")
      .attr("font-size", (d: any) => d.isCharacter ? "10px" : "7px")
      .attr("font-family", (d: any) => d.isCharacter ? "Playfair Display, serif" : "DM Sans, sans-serif")
      .attr("opacity", (d: any) => d.isCharacter ? 0.85 : 0.5);

    nodeGroup
      .on("mouseover", function (_event: any, d: any) {
        d3.select(this).select("circle")
          .attr("stroke-opacity", 0.9)
          .attr("r", d.isCharacter ? 14 : 7);
        d3.select(this).select("text")
          .attr("opacity", 1)
          .attr("font-size", d.isCharacter ? "12px" : "9px");

        const connectedIds = new Set<string>();
        simLinks.forEach((l: any) => {
          if (l.source.id === d.id) connectedIds.add(l.target.id);
          if (l.target.id === d.id) connectedIds.add(l.source.id);
        });

        link
          .attr("stroke-opacity", (l: any) =>
            l.source.id === d.id || l.target.id === d.id ? 0.8 : 0.05
          )
          .attr("stroke-width", (l: any) =>
            l.source.id === d.id || l.target.id === d.id ? 1.5 : 0.3
          );

        nodeGroup.selectAll("circle").attr("fill-opacity", (n: any) =>
          n.id === d.id || connectedIds.has(n.id) ? 1 : 0.1
        );
        nodeGroup.selectAll("text").attr("opacity", (n: any) =>
          n.id === d.id || connectedIds.has(n.id) ? 1 : 0.05
        );
      })
      .on("mouseout", function () {
        nodeGroup.selectAll("circle").each(function(d: any) {
          d3.select(this)
            .attr("stroke-opacity", 0.3)
            .attr("r", d.isCharacter ? 10 : 4)
            .attr("fill-opacity", d.isCharacter ? 0.9 : 0.6);
        });
        nodeGroup.selectAll("text").each(function(d: any) {
          d3.select(this)
            .attr("opacity", d.isCharacter ? 0.85 : 0.5)
            .attr("font-size", d.isCharacter ? "10px" : "7px");
        });
        link.attr("stroke-opacity", 0.25).attr("stroke-width", 0.6);
      })
      .on("click", (_event: any, d: any) => {
        if (d.isCharacter && d.original) {
          setSelectedNode(d.original);
        }
      });

    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      nodeGroup.attr("transform", (d: any) => `translate(${d.x},${d.y})`);
    });

    return () => {
      simulation.stop();
    };
  }, [filteredGraphNodes, filteredLinks]);

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

      <div className="absolute top-4 right-4 z-20 flex flex-col gap-2 bg-[#0B0626]/60 backdrop-blur-sm rounded-md p-3 border border-[#350A8C]/15">
        <span className="text-[10px] uppercase tracking-wider text-shadows-text/30 mb-0.5">Traditions</span>
        {Object.entries(TRADITION_COLORS).map(([tradition, color]) => (
          <div key={tradition} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-[10px] text-shadows-text/50">{tradition}</span>
          </div>
        ))}
        <span className="text-[10px] uppercase tracking-wider text-shadows-text/30 mt-1 mb-0.5">Attributes</span>
        {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
          <div key={key} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[key] }} />
            <span className="text-[10px] text-shadows-text/40">{label}</span>
          </div>
        ))}
      </div>

      <FilterSidebar
        filters={filters}
        activeFilters={activeFilters}
        onToggleFilter={toggleFilter}
        isOpen={filtersOpen}
        onToggle={() => setFiltersOpen(!filtersOpen)}
      />

      <div className="absolute inset-0 lg:left-64">
        <svg ref={svgRef} className="w-full h-full" />
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
