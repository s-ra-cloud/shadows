import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowRight, Network } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Project } from "@shared/schema";

export default function ProjectsPage() {
  const { data: projects, isLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  return (
    <div className="min-h-screen bg-[#0B0626] pt-24 pb-16">
      <div className="max-w-5xl mx-auto px-6">
        <h1 className="font-serif text-4xl md:text-5xl text-shadows-text tracking-wide mb-4" data-testid="text-projects-title">
          Research Modules
        </h1>
        <p className="text-shadows-text/50 max-w-2xl mb-16 leading-relaxed">
          Each module is an interactive graph exploration mapping archetypal patterns, mythological figures,
          and symbolic motifs within a specific comparative framework.
        </p>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {[1, 2].map((i) => (
              <div key={i} className="rounded-md border border-[#350A8C]/20 bg-[#0C0042]/20 p-8">
                <div className="h-10 w-10 bg-[#350A8C]/20 rounded mb-6 animate-pulse" />
                <div className="h-6 w-48 bg-[#350A8C]/15 rounded mb-3 animate-pulse" />
                <div className="h-3 w-full bg-[#350A8C]/10 rounded mb-2 animate-pulse" />
                <div className="h-3 w-3/4 bg-[#350A8C]/10 rounded mb-6 animate-pulse" />
                <div className="h-8 w-28 bg-[#350A8C]/10 rounded animate-pulse" />
              </div>
            ))}
          </div>
        ) : projects && projects.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {projects.map((project) => (
              <div
                key={project.id}
                className="group relative rounded-md border border-[#350A8C]/30 bg-[#0C0042]/30 p-8 transition-all duration-300 hover:border-[#8F00FF]/60"
                data-testid={`card-project-${project.slug}`}
              >
                <div className="absolute inset-0 rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                  style={{ boxShadow: "inset 0 0 40px rgba(143, 0, 255, 0.06)" }}
                />
                <div className="relative">
                  <Network className="w-10 h-10 text-[#8F00FF]/50 group-hover:text-[#8F00FF] transition-colors mb-6" />
                  <h2 className="font-serif text-2xl text-shadows-text mb-3" data-testid={`text-project-title-${project.slug}`}>
                    {project.title}
                  </h2>
                  <p className="text-shadows-text/50 text-sm leading-relaxed mb-8">
                    {project.description}
                  </p>
                  <Link href={`/projects/${project.slug}`}>
                    <Button
                      variant="outline"
                      className="border-[#8F00FF]/40 text-shadows-text/80 no-default-hover-elevate no-default-active-elevate hover:border-[#03FF9B] hover:text-[#03FF9B] transition-all duration-300"
                      data-testid={`button-open-graph-${project.slug}`}
                    >
                      Open Graph
                      <ArrowRight className="ml-2 w-4 h-4" />
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <p className="text-shadows-text/30 text-sm" data-testid="text-projects-empty">No research modules available.</p>
          </div>
        )}
      </div>
    </div>
  );
}
