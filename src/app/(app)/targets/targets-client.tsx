"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Flag, Target, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { MemberRow, DailyStatRow, TargetRow } from "@/types/supabase";

export default function TargetsClient({
  members,
  todayStats,
  monthStats,
  teamTargets,
  monthClientsClosed,
}: {
  members: Array<Pick<MemberRow, "id" | "full_name" | "position" | "daily_research_target" | "daily_touch_target" | "points">>;
  todayStats: DailyStatRow[];
  monthStats: DailyStatRow[];
  teamTargets: TargetRow[];
  monthClientsClosed: number;
}) {
  const [busy, setBusy] = useState(false);
  const [research, setResearch] = useState<Record<string, string>>({});
  const [touch, setTouch] = useState<Record<string, string>>({});
  const [teamClients, setTeamClients] = useState(String(teamTargets.find((t) => t.period === "MONTHLY" && t.metric === "clients_closed")?.value ?? 5));
  const [teamMrr, setTeamMrr] = useState(String(teamTargets.find((t) => t.period === "MONTHLY" && t.metric === "mrr")?.value ?? 10000));

  const statFor = (id: string) => todayStats.find((s) => s.member_id === id);
  const monthTouchesFor = (id: string) => monthStats.filter((s) => s.member_id === id).reduce((a, s) => a + s.touches_sent, 0);
  const monthTargetFor = (id: string) => {
    const m = members.find((x) => x.id === id);
    return (m?.daily_touch_target ?? 45) * 30;
  };

  async function call(body: Record<string, unknown>) {
    const res = await fetch("/api/admin/targets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
  }

  async function saveMember(m: typeof members[number]) {
    setBusy(true);
    try {
      await call({
        action: "setMemberTargets",
        memberId: m.id,
        dailyResearchTarget: research[m.id] ?? m.daily_research_target,
        dailyTouchTarget: touch[m.id] ?? m.daily_touch_target,
      });
      toast.success(`Targets saved for ${m.full_name}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function saveTeam() {
    setBusy(true);
    try {
      await call({ action: "setTeamTarget", period: "MONTHLY", metric: "clients_closed", value: Number(teamClients) });
      await call({ action: "setTeamTarget", period: "MONTHLY", metric: "mrr", value: Number(teamMrr) });
      toast.success("Team monthly targets saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  const TargetHit = ({ value, target }: { value: number; target: number }) => (
    <span className="inline-flex items-center gap-1 text-sm tabular-nums">
      {value}/{target}
      {value >= target ? <CheckCircle2 className="h-4 w-4 text-success" /> : <XCircle className="h-4 w-4 text-destructive" />}
    </span>
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Flag className="h-6 w-6 text-primary" /> Targets
        </h1>
        <p className="text-sm text-muted-foreground">Per-member daily targets and monthly team goals.</p>
      </div>

      {/* Daily member targets */}
      <section className="rounded-xl border bg-card">
        <div className="border-b bg-muted/40 px-4 py-2 text-sm font-semibold">Daily targets — today&apos;s progress</div>
        <div className="divide-y">
          {members.map((m) => {
            const s = statFor(m.id);
            return (
              <div key={m.id} className="flex flex-wrap items-center gap-3 p-3">
                <div className="min-w-36 flex-1">
                  <p className="text-sm font-medium">{m.full_name}</p>
                  <p className="text-xs text-muted-foreground">{m.position}</p>
                </div>
                <div className="text-sm">
                  <p className="text-[11px] text-muted-foreground">Research</p>
                  <TargetHit value={s?.leads_researched ?? 0} target={m.daily_research_target} />
                </div>
                <div className="text-sm">
                  <p className="text-[11px] text-muted-foreground">Touches</p>
                  <TargetHit value={s?.touches_sent ?? 0} target={m.daily_touch_target} />
                </div>
                <div className="text-sm">
                  <p className="text-[11px] text-muted-foreground">Month touches</p>
                  <TargetHit value={monthTouchesFor(m.id)} target={monthTargetFor(m.id)} />
                </div>
                <div className="flex items-end gap-2">
                  <div>
                    <label className="block text-[11px] text-muted-foreground">Research/day</label>
                    <Input
                      className="h-8 w-20"
                      type="number"
                      value={research[m.id] ?? String(m.daily_research_target)}
                      onChange={(e) => setResearch((r) => ({ ...r, [m.id]: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-muted-foreground">Touches/day</label>
                    <Input
                      className="h-8 w-20"
                      type="number"
                      value={touch[m.id] ?? String(m.daily_touch_target)}
                      onChange={(e) => setTouch((t) => ({ ...t, [m.id]: e.target.value }))}
                    />
                  </div>
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => saveMember(m)}>
                    Save
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Monthly team targets */}
      <section className="rounded-xl border bg-card p-4">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold"><Target className="h-4 w-4" /> Monthly team targets</h2>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs text-muted-foreground">Clients closed (target)</label>
            <Input className="w-28" type="number" value={teamClients} onChange={(e) => setTeamClients(e.target.value)} />
            <p className="mt-1 text-xs">Achieved: <span className={cn("font-bold", monthClientsClosed >= Number(teamClients) ? "text-success" : "text-destructive")}>{monthClientsClosed}</span></p>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground">MRR target ($)</label>
            <Input className="w-36" type="number" value={teamMrr} onChange={(e) => setTeamMrr(e.target.value)} />
          </div>
          <Button onClick={saveTeam} disabled={busy}>Save team targets</Button>
        </div>
      </section>
    </div>
  );
}
