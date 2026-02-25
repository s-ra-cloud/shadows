import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Plus, LogOut, Lock, Download } from "lucide-react";
import type { Project, Node, Edge, News, Publication } from "@shared/schema";

function LoginForm({ onLogin }: { onLogin: (password: string) => void }) {
  const [password, setPassword] = useState("");

  return (
    <div className="min-h-screen bg-[#0B0626] flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Lock className="w-8 h-8 text-[#8F00FF]/60 mx-auto mb-4" />
          <h1 className="font-serif text-2xl text-shadows-text tracking-wide mb-2">Admin Access</h1>
          <p className="text-shadows-text/40 text-sm">Enter the admin password to continue.</p>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onLogin(password);
          }}
          className="space-y-4"
        >
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="bg-[#0C0042]/50 border-[#350A8C]/30 text-shadows-text focus:border-[#8F00FF] focus:ring-[#8F00FF]/20"
            data-testid="input-admin-password"
          />
          <Button
            type="submit"
            className="w-full bg-[#8F00FF] text-white no-default-hover-elevate no-default-active-elevate hover:bg-[#8F00FF]/80 transition-colors"
            data-testid="button-admin-login"
          >
            Log In
          </Button>
        </form>
      </div>
    </div>
  );
}

function CrudSection<T extends { id: number }>({
  title,
  queryKey,
  fields,
  data,
  isLoading,
}: {
  title: string;
  queryKey: string;
  fields: { key: string; label: string; type: "text" | "textarea" }[];
  data: T[] | undefined;
  isLoading: boolean;
}) {
  const { toast } = useToast();
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, string>) => {
      const res = await apiRequest("POST", `/api/admin/${queryKey}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/${queryKey}`] });
      setFormData({});
      toast({ title: `${title} created` });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/admin/${queryKey}/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/${queryKey}`] });
      toast({ title: `${title} deleted` });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-6">
      <div className="rounded-md border border-[#350A8C]/20 bg-[#0C0042]/20 p-4">
        <h3 className="text-sm font-medium text-shadows-text mb-4 flex items-center gap-2">
          <Plus className="w-4 h-4 text-[#8F00FF]" />
          Add {title}
        </h3>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate(formData);
          }}
          className="space-y-3"
        >
          {fields.map((field) => (
            <div key={field.key}>
              <Label className="text-xs text-shadows-text/50 mb-1 block">{field.label}</Label>
              {field.type === "textarea" ? (
                <Textarea
                  value={formData[field.key] || ""}
                  onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                  className="bg-[#0B0626]/50 border-[#350A8C]/20 text-shadows-text text-sm min-h-[60px]"
                  data-testid={`input-admin-${queryKey}-${field.key}`}
                />
              ) : (
                <Input
                  value={formData[field.key] || ""}
                  onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                  className="bg-[#0B0626]/50 border-[#350A8C]/20 text-shadows-text text-sm"
                  data-testid={`input-admin-${queryKey}-${field.key}`}
                />
              )}
            </div>
          ))}
          <Button
            type="submit"
            size="sm"
            disabled={createMutation.isPending}
            className="bg-[#8F00FF] text-white no-default-hover-elevate no-default-active-elevate hover:bg-[#8F00FF]/80"
            data-testid={`button-admin-create-${queryKey}`}
          >
            {createMutation.isPending ? "Creating..." : "Create"}
          </Button>
        </form>
      </div>

      <div className="space-y-2">
        {isLoading ? (
          <div className="text-shadows-text/30 text-sm py-4 text-center">Loading...</div>
        ) : data && data.length > 0 ? (
          data.map((item: any) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-3 rounded-md border border-[#350A8C]/10 bg-[#0C0042]/10 px-4 py-3"
              data-testid={`item-admin-${queryKey}-${item.id}`}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm text-shadows-text truncate">
                  {item.title || item.name || `#${item.id}`}
                </p>
                {item.tradition && <p className="text-xs text-shadows-text/30">{item.tradition}</p>}
                {item.slug && <p className="text-xs text-shadows-text/30">/{item.slug}</p>}
                {item.relationType && <p className="text-xs text-shadows-text/30">{item.relationType}</p>}
              </div>
              <button
                onClick={() => setDeleteId(item.id)}
                className="text-shadows-text/30 hover:text-red-400 transition-colors flex-shrink-0"
                data-testid={`button-delete-${queryKey}-${item.id}`}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))
        ) : (
          <p className="text-shadows-text/20 text-sm text-center py-4">No items yet.</p>
        )}
      </div>

      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="bg-[#0B0626] border-[#350A8C]/30">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-shadows-text">Confirm Deletion</AlertDialogTitle>
            <AlertDialogDescription className="text-shadows-text/50">
              This action cannot be undone. Are you sure you want to delete this {title.toLowerCase()}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-[#350A8C]/30 text-shadows-text/60">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => {
                if (deleteId !== null) {
                  deleteMutation.mutate(deleteId);
                  setDeleteId(null);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [authError, setAuthError] = useState("");
  const { toast } = useToast();

  const loginMutation = useMutation({
    mutationFn: async (password: string) => {
      const res = await apiRequest("POST", "/api/admin/login", { password });
      return res.json();
    },
    onSuccess: () => {
      setAuthenticated(true);
      setAuthError("");
    },
    onError: () => {
      setAuthError("Invalid password");
      toast({ title: "Authentication failed", variant: "destructive" });
    },
  });

  const { data: projects, isLoading: loadingProjects } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
    enabled: authenticated,
  });

  const { data: allNodes, isLoading: loadingNodes } = useQuery<Node[]>({
    queryKey: ["/api/nodes"],
    enabled: authenticated,
  });

  const { data: allEdges, isLoading: loadingEdges } = useQuery<Edge[]>({
    queryKey: ["/api/edges"],
    enabled: authenticated,
  });

  const { data: newsItems, isLoading: loadingNews } = useQuery<News[]>({
    queryKey: ["/api/news"],
    enabled: authenticated,
  });

  const { data: publications, isLoading: loadingPubs } = useQuery<Publication[]>({
    queryKey: ["/api/publications"],
    enabled: authenticated,
  });

  if (!authenticated) {
    return (
      <>
        <LoginForm onLogin={(pw) => loginMutation.mutate(pw)} />
        {authError && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 text-red-400 text-sm bg-red-900/20 px-4 py-2 rounded-md">
            {authError}
          </div>
        )}
      </>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0626] pt-24 pb-16">
      <div className="max-w-4xl mx-auto px-6">
        <div className="flex items-center justify-between mb-8">
          <h1 className="font-serif text-3xl text-shadows-text tracking-wide" data-testid="text-admin-title">
            Admin Dashboard
          </h1>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                window.location.href = "/api/export";
              }}
              className="border-[#350A8C]/30 text-shadows-text/50 no-default-hover-elevate no-default-active-elevate"
              data-testid="button-download-db"
            >
              <Download className="w-3.5 h-3.5 mr-1.5" />
              Download DB
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                try { await apiRequest("POST", "/api/admin/logout"); } catch {}
                setAuthenticated(false);
              }}
              className="border-[#350A8C]/30 text-shadows-text/50 no-default-hover-elevate no-default-active-elevate"
              data-testid="button-admin-logout"
            >
              <LogOut className="w-3.5 h-3.5 mr-1.5" />
              Logout
            </Button>
          </div>
        </div>

        <Tabs defaultValue="figures">
          <TabsList className="bg-[#0C0042]/30 border border-[#350A8C]/20 mb-6">
            <TabsTrigger value="figures" className="data-[state=active]:bg-[#8F00FF]/20 data-[state=active]:text-shadows-text text-shadows-text/50" data-testid="tab-admin-figures">Figures</TabsTrigger>
            <TabsTrigger value="edges" className="data-[state=active]:bg-[#8F00FF]/20 data-[state=active]:text-shadows-text text-shadows-text/50" data-testid="tab-admin-edges">Relationships</TabsTrigger>
            <TabsTrigger value="projects" className="data-[state=active]:bg-[#8F00FF]/20 data-[state=active]:text-shadows-text text-shadows-text/50" data-testid="tab-admin-projects">Projects</TabsTrigger>
            <TabsTrigger value="news" className="data-[state=active]:bg-[#8F00FF]/20 data-[state=active]:text-shadows-text text-shadows-text/50" data-testid="tab-admin-news">News</TabsTrigger>
            <TabsTrigger value="publications" className="data-[state=active]:bg-[#8F00FF]/20 data-[state=active]:text-shadows-text text-shadows-text/50" data-testid="tab-admin-publications">Publications</TabsTrigger>
          </TabsList>

          <TabsContent value="figures">
            <CrudSection
              title="Figure"
              queryKey="nodes"
              fields={[
                { key: "projectId", label: "Project ID", type: "text" },
                { key: "name", label: "Name", type: "text" },
                { key: "tradition", label: "Tradition", type: "text" },
                { key: "gender", label: "Gender", type: "text" },
                { key: "domain", label: "Domain (comma-separated)", type: "text" },
                { key: "object", label: "Object (associated objects/symbols)", type: "text" },
                { key: "animals", label: "Animals", type: "text" },
                { key: "characterTrait", label: "Character Trait", type: "text" },
                { key: "physicalCharacteristics", label: "Physical Characteristics", type: "text" },
                { key: "significantEvent", label: "Significant Event", type: "textarea" },
                { key: "birthCircumstances", label: "Circumstances of Birth", type: "textarea" },
                { key: "deathCircumstances", label: "Circumstances of Death", type: "textarea" },
              ]}
              data={allNodes}
              isLoading={loadingNodes}
            />
          </TabsContent>

          <TabsContent value="edges">
            <CrudSection
              title="Relationship"
              queryKey="edges"
              fields={[
                { key: "projectId", label: "Project ID", type: "text" },
                { key: "sourceNodeId", label: "Source Figure ID", type: "text" },
                { key: "targetNodeId", label: "Target Figure ID", type: "text" },
                { key: "relationType", label: "Relation Type (e.g., parent of, married to, sibling of, adversary of)", type: "text" },
                { key: "weight", label: "Weight", type: "text" },
              ]}
              data={allEdges}
              isLoading={loadingEdges}
            />
          </TabsContent>

          <TabsContent value="projects">
            <CrudSection
              title="Project"
              queryKey="projects"
              fields={[
                { key: "title", label: "Title", type: "text" },
                { key: "slug", label: "Slug", type: "text" },
                { key: "description", label: "Description", type: "textarea" },
              ]}
              data={projects}
              isLoading={loadingProjects}
            />
          </TabsContent>

          <TabsContent value="news">
            <CrudSection
              title="News Article"
              queryKey="news"
              fields={[
                { key: "title", label: "Title", type: "text" },
                { key: "content", label: "Content", type: "textarea" },
              ]}
              data={newsItems}
              isLoading={loadingNews}
            />
          </TabsContent>

          <TabsContent value="publications">
            <CrudSection
              title="Publication"
              queryKey="publications"
              fields={[
                { key: "title", label: "Title", type: "text" },
                { key: "authors", label: "Authors", type: "text" },
                { key: "venue", label: "Venue", type: "text" },
                { key: "abstract", label: "Abstract", type: "textarea" },
                { key: "doi", label: "DOI", type: "text" },
                { key: "pdfUrl", label: "PDF URL", type: "text" },
              ]}
              data={publications}
              isLoading={loadingPubs}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
