import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertCircle, Check, Download, Lock, Pause, Play, RefreshCw, X } from "lucide-react";
import { apiRequest, authHeaders, queryClient, setEditorToken } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

type RoutineMode = "query" | "benchmark";
type Routine = { enabled: number; localTime: string; timezone: string; recipient: string; mode?: RoutineMode; weekday?: number | null };
type Execution = {
  id: number; scheduledDate: string; timezone: string; status: string; hunterRunId: number | null;
  emailStatus: string; error: string | null; startedAt: string; finishedAt: string | null;
  review: {
    mode?: RoutineMode;
    benchmark?: { list: string; coverage: number | null; total: number; fetched: number; fetched_locked: number; not_found: number; failed: number };
    outcomes?: Record<string, number>;
    usefulDiscoveries?: { newCandidates?: number; downloadedPublic?: number; downloadedLocked?: number };
    blockers?: { reason: string; count: number }[];
  } | null;
};
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const selectClass = "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";
type Proposal = {
  id: number; executionId: number; title: string; summary: string; status: string;
  evidence: Record<string, unknown>; decisionNote: string | null;
};
type DailyData = { routine: Routine; executions: Execution[]; proposals: Proposal[]; deploymentNote: string };

function Login({ onSuccess }: { onSuccess: () => void }) {
  const [password, setPassword] = useState("");
  const { toast } = useToast();
  return <main className="min-h-screen bg-[#0B0626] text-[#E0DCE6] flex items-center justify-center p-6">
    <form className="w-full max-w-sm space-y-4 rounded-lg border border-[#350A8C]/40 bg-[#0C0042]/30 p-6" onSubmit={async (event) => {
      event.preventDefault();
      try {
        const result = await apiRequest("POST", "/api/database/login", { password });
        const json = await result.json();
        if (json.token) setEditorToken(json.token);
        onSuccess();
      } catch {
        toast({ title: "Editor access required", description: "The password was not accepted.", variant: "destructive" });
      }
    }}>
      <Lock className="text-[#8F00FF]" />
      <h1 className="font-serif text-2xl">Daily Hunter</h1>
      <p className="text-sm text-[#E0DCE6]/60">Enter the editor password to manage this routine.</p>
      <Input value={password} onChange={(event) => setPassword(event.target.value)} type="password" required data-testid="input-daily-hunter-password" />
      <Button className="w-full bg-[#8F00FF]" type="submit">Continue</Button>
    </form>
  </main>;
}

export default function DailyHunterPage() {
  const { toast } = useToast();
  const [authenticated, setAuthenticated] = useState(false);
  const [form, setForm] = useState<{ enabled: boolean; localTime: string; timezone: string; recipient: string; mode: RoutineMode; weekday: number | null }>({
    enabled: false, localTime: "09:00", timezone: "Europe/Paris", recipient: "duparclaura.pro@gmail.com", mode: "query", weekday: null,
  });
  const [notes, setNotes] = useState<Record<number, string>>({});
  const authQuery = useQuery<{ isEditor: boolean }>({ queryKey: ["/api/database/auth-status"], staleTime: 0 });
  const auth = authQuery.data;
  const canRead = authenticated || !!auth?.isEditor;
  const daily = useQuery<DailyData>({ queryKey: ["/api/hunter/daily"], enabled: canRead, staleTime: 0 });

  useEffect(() => {
    if (daily.data?.routine) {
      const routine = daily.data.routine;
      setForm({
        enabled: Boolean(routine.enabled), localTime: routine.localTime, timezone: routine.timezone, recipient: routine.recipient,
        mode: routine.mode === "benchmark" ? "benchmark" : "query", weekday: typeof routine.weekday === "number" ? routine.weekday : null,
      });
    }
  }, [daily.data?.routine]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["/api/hunter/daily"] });
  const save = useMutation({
    mutationFn: () => apiRequest("PUT", "/api/hunter/daily", form),
    onSuccess: () => { refresh(); toast({ title: form.enabled ? "Daily Hunter resumed" : "Daily Hunter paused" }); },
    onError: (error: Error) => toast({ title: "Could not save routine", description: error.message, variant: "destructive" }),
  });
  const decide = useMutation({
    mutationFn: ({ id, decision }: { id: number; decision: "approve" | "reject" }) =>
      apiRequest("POST", `/api/hunter/daily/proposals/${id}/${decision}`, { note: notes[id] || "" }),
    onSuccess: () => { refresh(); toast({ title: "Proposal decision recorded" }); },
    onError: (error: Error) => toast({ title: "Could not record decision", description: error.message, variant: "destructive" }),
  });

  if (!authenticated && authQuery.isLoading) return <main className="min-h-screen bg-[#0B0626] text-[#E0DCE6] p-24">Checking editor access…</main>;
  if (!canRead) return <Login onSuccess={() => { setAuthenticated(true); queryClient.invalidateQueries({ queryKey: ["/api/database/auth-status"] }); }} />;
  if (daily.isLoading) return <main className="min-h-screen bg-[#0B0626] text-[#E0DCE6] p-24">Loading daily Hunter…</main>;

  const proposalsFor = (executionId: number) => daily.data?.proposals.filter((proposal) => proposal.executionId === executionId) ?? [];
  const exportBrief = async (id: number) => {
    try {
      const response = await fetch(`/api/hunter/daily/proposals/${id}/brief`, { headers: authHeaders(), credentials: "include" });
      if (!response.ok) throw new Error(await response.text());
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url; link.download = `daily-hunter-proposal-${id}.md`; link.click(); URL.revokeObjectURL(url);
    } catch (error) {
      toast({ title: "Could not export brief", description: error instanceof Error ? error.message : undefined, variant: "destructive" });
    }
  };

  return <main className="min-h-screen bg-[#0B0626] text-[#E0DCE6] pt-24 pb-16">
    <div className="max-w-5xl mx-auto px-6 space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl">Daily Hunter</h1>
          <p className="mt-2 max-w-3xl text-sm text-[#E0DCE6]/60">A durable, evidence-based review loop. It runs the existing Hunter cycle and can only prepare engineering briefs—never code, rights, or source-policy changes.</p>
        </div>
        <Button variant="outline" onClick={refresh} className="border-[#350A8C]/50 text-[#E0DCE6]"><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button>
      </header>

      <section className="rounded-lg border border-[#350A8C]/40 bg-[#0C0042]/30 p-6 space-y-5">
        <div className="flex items-center justify-between gap-4">
          <div><h2 className="font-serif text-xl">Schedule</h2><p className="text-sm text-[#E0DCE6]/55">Default is paused. The scheduled worker honors this saved pause state.</p></div>
          <span className={`rounded-full px-3 py-1 text-sm ${form.enabled ? "bg-[#03FF9B]/15 text-[#03FF9B]" : "bg-[#E0DCE6]/10 text-[#E0DCE6]/60"}`}>{form.enabled ? "Active" : "Paused"}</span>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div><Label>Local time</Label><Input type="time" value={form.localTime} onChange={(event) => setForm({ ...form, localTime: event.target.value })} data-testid="input-daily-hunter-time" /></div>
          <div><Label>Timezone (IANA)</Label><Input value={form.timezone} onChange={(event) => setForm({ ...form, timezone: event.target.value })} data-testid="input-daily-hunter-timezone" /></div>
          <div><Label>Report recipient</Label><Input type="email" value={form.recipient} onChange={(event) => setForm({ ...form, recipient: event.target.value })} data-testid="input-daily-hunter-recipient" /></div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label>What to hunt</Label>
            <select className={selectClass} value={form.mode} onChange={(event) => setForm({ ...form, mode: event.target.value === "benchmark" ? "benchmark" : "query" })} data-testid="select-daily-hunter-mode">
              <option value="query">Standard discovery query</option>
              <option value="benchmark">Benchmark corpus list (shadows-benchmark)</option>
            </select>
          </div>
          <div>
            <Label>Run on</Label>
            <select className={selectClass} value={form.weekday === null ? "" : String(form.weekday)} onChange={(event) => setForm({ ...form, weekday: event.target.value === "" ? null : Number(event.target.value) })} data-testid="select-daily-hunter-weekday">
              <option value="">Every day</option>
              {WEEKDAYS.map((name, index) => <option key={name} value={index}>{name}s only</option>)}
            </select>
          </div>
          <p className="self-end text-xs text-[#E0DCE6]/50">{form.mode === "benchmark" ? "A benchmark run hunts the checked-in list (about an hour) and reports coverage; weekly is the intended cadence." : "The standard query runs a short discovery cycle."}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => save.mutate()} disabled={save.isPending} className="bg-[#8F00FF]" data-testid="button-save-daily-hunter">
            {form.enabled ? <Pause className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}{save.isPending ? "Saving…" : form.enabled ? "Save active routine" : "Save paused routine"}
          </Button>
          <Button variant="outline" onClick={() => { setForm({ ...form, enabled: !form.enabled }); }} className="border-[#350A8C]/50 text-[#E0DCE6]">
            {form.enabled ? "Pause before saving" : "Resume before saving"}
          </Button>
        </div>
        <p className="flex gap-2 rounded-md bg-amber-500/10 p-3 text-xs text-amber-100/80"><AlertCircle className="h-4 w-4 shrink-0" />{daily.data?.deploymentNote}</p>
      </section>

      <section>
        <h2 className="mb-4 font-serif text-xl">Execution history</h2>
        <div className="space-y-4">
          {daily.data?.executions.length ? daily.data.executions.map((execution) => <article key={execution.id} className="rounded-lg border border-[#350A8C]/25 bg-[#0C0042]/20 p-5">
            <div className="flex flex-wrap justify-between gap-3">
              <div><h3 className="font-medium">{execution.scheduledDate} · {execution.timezone}</h3><p className="mt-1 text-sm text-[#E0DCE6]/60">Status: <b>{execution.status}</b> · Email: <b>{execution.emailStatus}</b></p></div>
              {execution.hunterRunId && <a className="text-sm text-[#03FF9B] hover:underline" href={`/api/hunter/runs/${execution.hunterRunId}`} target="_blank" rel="noreferrer">Open Hunter run #{execution.hunterRunId}</a>}
            </div>
            {execution.error && <p className="mt-3 rounded bg-red-500/10 p-3 text-sm text-red-200">{execution.error}</p>}
            {execution.review?.benchmark && <p className="mt-3 text-sm text-[#03FF9B]/90">Benchmark {execution.review.benchmark.list}: coverage {execution.review.benchmark.coverage == null ? "n/a" : `${Math.round(execution.review.benchmark.coverage * 100)}%`} ({execution.review.benchmark.fetched} fetched + {execution.review.benchmark.fetched_locked} locked of {execution.review.benchmark.total}; {execution.review.benchmark.not_found} not found, {execution.review.benchmark.failed} failed).</p>}
            {execution.review?.outcomes && <p className="mt-3 text-sm text-[#E0DCE6]/65">Discovered {execution.review.outcomes.discovered ?? 0}; new candidates {execution.review.usefulDiscoveries?.newCandidates ?? 0}; public downloads {execution.review.usefulDiscoveries?.downloadedPublic ?? 0}; blockers {execution.review.outcomes.blockers ?? 0}; failures {execution.review.outcomes.failed ?? 0}.</p>}
            {execution.review?.blockers?.length ? <p className="mt-2 text-xs text-[#E0DCE6]/50">Blockers: {execution.review.blockers.map((blocker) => `${blocker.reason} (${blocker.count})`).join(", ")}</p> : null}
            {proposalsFor(execution.id).map((proposal) => <div key={proposal.id} className="mt-4 border-t border-[#350A8C]/20 pt-4">
              <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="font-medium text-[#E0DCE6]">{proposal.title}</h4><span className="text-xs uppercase text-[#03FF9B]">{proposal.status}</span></div>
              <p className="mt-1 text-sm text-[#E0DCE6]/60">{proposal.summary}</p>
              <details className="mt-2 text-xs text-[#E0DCE6]/55"><summary className="cursor-pointer">Evidence</summary><pre className="mt-2 overflow-auto rounded bg-black/20 p-2">{JSON.stringify(proposal.evidence, null, 2)}</pre></details>
              {proposal.status === "pending" && <div className="mt-3 flex flex-wrap gap-2"><Textarea className="min-h-9 max-w-md text-sm" placeholder="Decision note (optional)" value={notes[proposal.id] || ""} onChange={(event) => setNotes({ ...notes, [proposal.id]: event.target.value })} /><Button size="sm" onClick={() => decide.mutate({ id: proposal.id, decision: "approve" })}><Check className="mr-1 h-4 w-4" />Approve brief</Button><Button size="sm" variant="outline" onClick={() => decide.mutate({ id: proposal.id, decision: "reject" })}><X className="mr-1 h-4 w-4" />Reject</Button></div>}
              {proposal.status === "approved" && <Button size="sm" variant="outline" className="mt-3" onClick={() => exportBrief(proposal.id)}><Download className="mr-1 h-4 w-4" />Export engineering brief</Button>}
            </div>)}
          </article>) : <p className="rounded-lg border border-dashed border-[#350A8C]/30 p-6 text-sm text-[#E0DCE6]/50">No scheduled executions yet. The routine is paused by default.</p>}
        </div>
      </section>
    </div>
  </main>;
}