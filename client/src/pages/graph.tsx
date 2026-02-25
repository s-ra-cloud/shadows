import { useEffect, useRef, useState, useCallback } from "react";
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

function getTraditionColor(tradition: string | null) {
  if (!tradition) return "#8F00FF";
  return TRADITION_COLORS[tradition] || "#8F00FF";
}

function tokenize(text: string | null): string[] {
  if (!text) return [];
  return text.toLowerCase().split(/[,;/]+/).map(s => s.trim()).filter(Boolean);
}

function computeSimilarity(a: Node, b: Node): number {
  let score = 0;
  let maxScore = 0;

  const fields: { key: keyof Node; weight: number; exact?: boolean }[] = [
    { key: "gender", weight: 2, exact: true },
    { key: "domain", weight: 3 },
    { key: "object", weight: 2 },
    { key: "animals", weight: 2 },
    { key: "characterTrait", weight: 2 },
    { key: "physicalCharacteristics", weight: 1 },
    { key: "significantEvent", weight: 2 },
    { key: "birthCircumstances", weight: 1 },
    { key: "deathCircumstances", weight: 1 },
  ];

  for (const field of fields) {
    const valA = a[field.key] as string | null;
    const valB = b[field.key] as string | null;
    maxScore += field.weight;

    if (!valA || !valB) continue;

    if (field.exact) {
      if (valA.toLowerCase().trim() === valB.toLowerCase().trim()) {
        score += field.weight;
      }
    } else {
      const tokensA = tokenize(valA);
      const tokensB = tokenize(valB);
      if (tokensA.length === 0 || tokensB.length === 0) continue;
      const setA = new Set(tokensA);
      const setB = new Set(tokensB);
      const intersection = [...setA].filter(t => setB.has(t)).length;
      const union = new Set([...setA, ...setB]).size;
      if (union > 0) {
        score += field.weight * (intersection / union);
      }
    }
  }

  return maxScore > 0 ? score / maxScore : 0;
}

interface GraphData {
  nodes: Node[];
  edges: Edge[];
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
  filters: { traditions: string[]; genders: string[]; domains: string[] };
  activeFilters: Record<string, Set<string>>;
  onToggleFilter: (category: string, value: string) => void;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const sections = [
    { key: "traditions", label: "Tradition", values: filters.traditions },
    { key: "genders", label: "Gender", values: filters.genders },
    { key: "domains", label: "Domain", values: filters.domains },
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
                          className="text-xs text-shadows-text/60 cursor-pointer"
                        >
                          {section.key === "traditions" && (
                            <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ backgroundColor: getTraditionColor(val) }} />
                          )}
                          {val}
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

  const filters = {
    traditions: [...new Set(data?.nodes.map((n) => n.tradition).filter(Boolean) as string[])],
    genders: [...new Set(data?.nodes.map((n) => n.gender).filter(Boolean) as string[])],
    domains: [...new Set(data?.nodes.flatMap((n) => tokenize(n.domain)).filter(Boolean))],
  };

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

  const filteredNodes = data?.nodes.filter((n) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!n.name.toLowerCase().includes(q) && !(n.tradition || "").toLowerCase().includes(q)) return false;
    }
    for (const [key, values] of Object.entries(activeFilters)) {
      if (values.size === 0) continue;
      if (key === "traditions") {
        if (!values.has(n.tradition || "")) return false;
      } else if (key === "genders") {
        if (!values.has(n.gender || "")) return false;
      } else if (key === "domains") {
        const nodeDomains = tokenize(n.domain);
        if (!nodeDomains.some(d => values.has(d))) return false;
      }
    }
    return true;
  });

  const filteredNodeIds = new Set(filteredNodes?.map((n) => n.id));

  const filteredEdges = data?.edges.filter(
    (e) => filteredNodeIds.has(e.sourceNodeId) && filteredNodeIds.has(e.targetNodeId)
  );

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
    if (!svgRef.current || !filteredNodes || !filteredEdges) return;

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
      .scaleExtent([0.3, 5])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });

    svg.call(zoom);

    const nodeMap = new Map<number, Node>();
    filteredNodes.forEach((n) => nodeMap.set(n.id, n));

    const simNodes = filteredNodes.map((n) => ({ ...n, x: width / 2, y: height / 2 }));
    const simNodeMap = new Map<number, any>();
    simNodes.forEach((n) => simNodeMap.set(n.id, n));

    const simEdges = filteredEdges
      .map((e) => ({
        ...e,
        source: simNodeMap.get(e.sourceNodeId),
        target: simNodeMap.get(e.targetNodeId),
      }))
      .filter((e) => e.source && e.target);

    const similarityLinks: { source: any; target: any; similarity: number }[] = [];
    for (let i = 0; i < simNodes.length; i++) {
      for (let j = i + 1; j < simNodes.length; j++) {
        const sim = computeSimilarity(simNodes[i] as any, simNodes[j] as any);
        if (sim > 0.1) {
          similarityLinks.push({
            source: simNodes[i],
            target: simNodes[j],
            similarity: sim,
          });
        }
      }
    }

    const simulation = d3.forceSimulation(simNodes)
      .force("similarity", d3.forceLink(similarityLinks)
        .id((d: any) => d.id)
        .distance((d: any) => 300 * (1 - d.similarity))
        .strength((d: any) => d.similarity * 0.5)
      )
      .force("edges", d3.forceLink(simEdges)
        .id((d: any) => d.id)
        .distance(150)
        .strength(0.1)
      )
      .force("charge", d3.forceManyBody().strength(-250))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(35));

    simulationRef.current = simulation;

    const link = g
      .append("g")
      .selectAll("line")
      .data(simEdges)
      .join("line")
      .attr("stroke", "#350A8C")
      .attr("stroke-width", 0.8)
      .attr("stroke-opacity", 0.4);

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
      .attr("r", 8)
      .attr("fill", (d: any) => getTraditionColor(d.tradition))
      .attr("stroke", (d: any) => getTraditionColor(d.tradition))
      .attr("stroke-width", 2)
      .attr("stroke-opacity", 0.3)
      .attr("fill-opacity", 0.8);

    nodeGroup
      .append("text")
      .text((d: any) => d.name)
      .attr("dy", -14)
      .attr("text-anchor", "middle")
      .attr("fill", "#E0DCE6")
      .attr("font-size", "9px")
      .attr("font-family", "Playfair Display, serif")
      .attr("opacity", 0.7);

    nodeGroup
      .on("mouseover", function (_event: any, d: any) {
        d3.select(this).select("circle").attr("stroke-opacity", 0.8).attr("r", 11);
        d3.select(this).select("text").attr("opacity", 1).attr("font-size", "11px");

        const connectedIds = new Set<number>();
        simEdges.forEach((e: any) => {
          if (e.source.id === d.id) connectedIds.add(e.target.id);
          if (e.target.id === d.id) connectedIds.add(e.source.id);
        });

        link
          .attr("stroke-opacity", (l: any) =>
            l.source.id === d.id || l.target.id === d.id ? 0.9 : 0.1
          )
          .attr("stroke", (l: any) =>
            l.source.id === d.id || l.target.id === d.id ? "#03FF9B" : "#350A8C"
          )
          .attr("stroke-width", (l: any) =>
            l.source.id === d.id || l.target.id === d.id ? 1.5 : 0.5
          );

        nodeGroup.selectAll("circle").attr("fill-opacity", (n: any) =>
          n.id === d.id || connectedIds.has(n.id) ? 1 : 0.2
        );
        nodeGroup.selectAll("text").attr("opacity", (n: any) =>
          n.id === d.id || connectedIds.has(n.id) ? 1 : 0.15
        );
      })
      .on("mouseout", function () {
        nodeGroup.selectAll("circle").attr("stroke-opacity", 0.3).attr("r", 8).attr("fill-opacity", 0.8);
        nodeGroup.selectAll("text").attr("opacity", 0.7).attr("font-size", "9px");
        link.attr("stroke-opacity", 0.4).attr("stroke", "#350A8C").attr("stroke-width", 0.8);
      })
      .on("click", (_event: any, d: any) => {
        const original = nodeMap.get(d.id);
        if (original) setSelectedNode(original);
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
  }, [filteredNodes, filteredEdges]);

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
            placeholder="Search figures..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-[#0B0626]/80 backdrop-blur-xl border-[#350A8C]/30 text-shadows-text text-sm focus:border-[#03FF9B]/50 focus:ring-[#03FF9B]/20 transition-all"
            data-testid="input-search-nodes"
          />
        </div>
      </div>

      <div className="absolute top-4 right-4 z-20 flex items-center gap-3 flex-wrap">
        {Object.entries(TRADITION_COLORS).map(([tradition, color]) => (
          <div key={tradition} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-xs text-shadows-text/50">{tradition}</span>
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
