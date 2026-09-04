"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  Activity,
  Building2,
  CheckCircle2,
  DollarSign,
  Handshake,
  MessageSquareReply,
  PhoneCall,
  Send,
  Sparkles,
  Trophy,
  UserPlus,
  XCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn, initials, levelOf } from "@/lib/utils";

type FounderData = Awaited<ReturnType<typeof import("@/lib/queries").getFounderDashboard>>;

const numberFmt = new Intl.NumberFormat("en-US");
const usd = (n: number) => `$${numberFmt.format(n)}`;

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function KpiCard({ label, value, icon: Icon, hint, accent }: { label: string; value: string; icon: typeof Send; hint?: string; accent?: string }) {
  return (
    <Card className="min-w-0">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className={cn("mt-1.5 text-2xl font-bold tabular-nums", accent)}>{value}</p>
            {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
          </div>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TargetCell({ value, target }: { value: number; target: number }) {
  const pct = target ? Math.min(100, Math.round((value / target) * 100)) : 0;
  const state = value >= target && target > 0 ? "ok" : pct >= 80 ? "mid" : "low";
  return (
    <span className="inline-flex items-center gap-1.5 text-sm tabular-nums">
      {value}
      <span className="text-xs text-muted-foreground">/{target}</span>
      {state === "ok" && <CheckCircle2 className="h-4 w-4 text-success" />}
      {state === "mid" && <span className="text-warning">△</span>}
      {state === "low" && <XCircle className="h-4 w-4 text-destructive" />}
    </span>
  );
}

function FunnelBar({ label, value, prev, color, max }: { label: string; value: number; prev: number; color: string; max: number }) {
  const conv = prev ? Math.round((value / prev) * 100) : null;
  const width = max ? Math.max(4, Math.round((value / max) * 100)) : 4;
  return (
    <div className="flex items-center gap-3">
      <div className="w-24 shrink-0 text-xs font-medium text-muted-foreground">{label}</div>
      <div className="relative h-8 flex-1 overflow-hidden rounded-lg bg-muted">
        <div className={cn("h-full rounded-lg transition-all", color)} style={{ width: `${width}%` }} />
      </div>
      <div className="w-12 shrink-0 text-right text-sm font-semibold tabular-nums">{value}</div>
      <div className="w-14 shrink-0 text-right text-[11px] font-medium text-muted-foreground">
        {conv !== null ? `${conv}%` : ""}
      </div>
    </div>
  );
}

function TrendChart({ data, dataKey, color }: { data: { date: string; touches: number; replies: number; researches: number }[]; dataKey: "touches" | "replies" | "researches"; color: string }) {
  const max = Math.max(1, ...data.map((d) => d[dataKey]));
  return (
    <div className="flex h-40 items-end gap-1.5">
      {data.map((d) => (
        <div key={d.date} className="group relative flex-1">
          <div
            className="w-full rounded-t-md transition-all group-hover:opacity-80"
            style={{ height: `${(d[dataKey] / max) * 150}px`, background: color, minHeight: 3 }}
          />
          <span className="absolute -top-6 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-foreground px-1.5 py-0.5 text-[10px] text-background group-hover:block">
            {d.date}: {d[dataKey]}
          </span>
        </div>
      ))}
    </div>
  );
}

function LiveFeedRow({ icon, title, sub, time, tone }: { icon: React.ReactNode; title: string; sub: string; time: string; tone: string }) {
  return (
    <div className="flex items-start gap-3 border-b py-2.5 last:border-0">
      <div className={cn("mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg", tone)}>{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{title}</p>
        <p className="truncate text-xs text-muted-foreground">{sub}</p>
      </div>
      <span className="shrink-0 text-[11px] text-muted-foreground">{time}</span>
    </div>
  );
}

export default function FounderDashboardClient({ data }: { data: FounderData }) {
  const [range, setRange] = useState<"t7" | "t30">("t7");
  const [live, setLive] = useState<FounderData["recentTouches"]>(data.recentTouches);
  const [kpis, setKpis] = useState(data.kpis);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("founder-live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "touches" }, () => {
        // refresh feed + funnel counts via router refresh would re-run server; simple refetch of today aggregates
        fetch("/api/live/today")
          .then((r) => r.json())
          .then((d) => {
            if (d?.kpis) setKpis(d.kpis);
            if (d?.recentTouches) setLive(d.recentTouches);
          })
          .catch(() => {});
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const trend = range === "t7" ? data.trend7 : data.trend30;
  const f = kpis;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Today at a glance</p>
        </div>
        <Badge variant="info" className="gap-1.5 px-2.5 py-1">
          <Activity className="h-3.5 w-3.5" /> Live
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Leads Added" value={numberFmt.format(f.leadsAdded)} icon={UserPlus} />
        <KpiCard label="Touches Sent" value={numberFmt.format(f.touches)} icon={Send} />
        <KpiCard label="Replies" value={numberFmt.format(f.replies)} icon={MessageSquareReply} />
        <KpiCard label="Positive Replies" value={numberFmt.format(f.positives)} icon={Sparkles} accent="text-success" />
        <KpiCard label="Calls Booked" value={numberFmt.format(f.calls)} icon={PhoneCall} />
        <KpiCard label="Active Clients" value={numberFmt.format(f.activeClients)} icon={Handshake} />
        <KpiCard label="MRR" value={usd(f.mrr)} icon={DollarSign} accent="text-success" />
        <KpiCard label="Target Attainment" value={`${f.attainment}%`} icon={Trophy} accent={f.attainment >= 80 ? "text-success" : "text-warning"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle className="text-base">Funnel — Today</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            <FunnelBar label="Touches" value={f.touches} prev={0} max={Math.max(1, f.touches)} color="bg-primary/80" />
            <FunnelBar label="Replies" value={f.replies} prev={f.touches} max={Math.max(1, f.touches)} color="bg-orange-500/80" />
            <FunnelBar label="Positives" value={f.positives} prev={f.replies} max={Math.max(1, f.touches)} color="bg-success/80" />
            <FunnelBar label="Calls" value={f.calls} prev={f.positives} max={Math.max(1, f.touches)} color="bg-indigo-500/80" />
            <FunnelBar label="Proposals" value={f.proposals} prev={f.calls} max={Math.max(1, f.touches)} color="bg-fuchsia-500/80" />
            <FunnelBar label="Wins" value={f.wins} prev={f.proposals} max={Math.max(1, f.touches)} color="bg-emerald-600" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base">Trends</CardTitle>
            <Tabs value={range} onValueChange={(v) => setRange(v as "t7" | "t30")}>
              <TabsList>
                <TabsTrigger value="t7" className="text-xs">7 Days</TabsTrigger>
                <TabsTrigger value="t30" className="text-xs">30 Days</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">Touches</p>
                <TrendChart data={trend} dataKey="touches" color="hsl(24 94% 55%)" />
              </div>
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">Replies</p>
                <TrendChart data={trend} dataKey="replies" color="hsl(199 89% 48%)" />
              </div>
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">Researches</p>
                <TrendChart data={trend} dataKey="researches" color="hsl(142 72% 36%)" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Team — Today vs Targets</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-4 font-semibold">Member</th>
                  <th className="px-3 py-2 font-semibold">Research</th>
                  <th className="px-3 py-2 font-semibold">Touches</th>
                  <th className="px-3 py-2 font-semibold">Replies</th>
                  <th className="px-3 py-2 font-semibold">Positives</th>
                  <th className="px-3 py-2 font-semibold">Points</th>
                  <th className="px-3 py-2 font-semibold">Level</th>
                </tr>
              </thead>
              <tbody>
                {data.memberRows.map((r, i) => {
                  const lvl = levelOf(r.member.points);
                  return (
                    <tr key={r.member.id} className="border-b last:border-0">
                      <td className="py-2.5 pr-4">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-foreground">
                            {initials(r.member.full_name)}
                          </span>
                          <div>
                            <Link href={`/team/${r.member.id}`} className="font-medium hover:underline">{r.member.full_name}</Link>
                            <p className="text-xs text-muted-foreground">{r.member.position}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5"><TargetCell value={r.researched} target={r.member.daily_research_target} /></td>
                      <td className="px-3 py-2.5"><TargetCell value={r.touches} target={r.member.daily_touch_target} /></td>
                      <td className="px-3 py-2.5 tabular-nums">{r.replies}</td>
                      <td className="px-3 py-2.5 tabular-nums">{r.positives}</td>
                      <td className="px-3 py-2.5 font-semibold tabular-nums">{numberFmt.format(r.member.points)}</td>
                      <td className="px-3 py-2.5">
                        <Badge variant={lvl.level >= 4 ? "success" : "secondary"}>L{lvl.level} {lvl.name}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Live Activity</CardTitle>
          </CardHeader>
          <CardContent className="max-h-96 overflow-y-auto">
            {live.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No touches logged yet today.</p>}
            {live.map((t) => (
              <LiveFeedRow
                key={t.id}
                icon={<Send className="h-3.5 w-3.5" />}
                title={`${t.members?.full_name ?? "Someone"} → ${t.leads?.business_name ?? "a lead"}`}
                sub={t.message_summary}
                time={timeAgo(t.occurred_at)}
                tone={t.direction === "IN" ? "bg-success/15 text-success" : "bg-primary/10 text-primary"}
              />
            ))}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2"><Sparkles className="h-4 w-4 text-success" /> Recent Positive Replies</CardTitle>
            </CardHeader>
            <CardContent>
              {data.recentPositive.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">None yet.</p>}
              {data.recentPositive.map((p) => (
                <LiveFeedRow key={p.id} icon={<Sparkles className="h-3.5 w-3.5" />} title={p.business_name} sub={p.owner_name ?? "Owner"} time={timeAgo(p.updated_at)} tone="bg-success/15 text-success" />
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2"><Handshake className="h-4 w-4 text-primary" /> Recent Wins</CardTitle>
            </CardHeader>
            <CardContent>
              {data.recentWins.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">No wins yet.</p>}
              {data.recentWins.map((w) => (
                <LiveFeedRow key={w.id} icon={<Handshake className="h-3.5 w-3.5" />} title={w.business_name} sub={w.monthly_value ? usd(w.monthly_value) + "/mo" : "Won"} time={timeAgo(w.updated_at)} tone="bg-primary/10 text-primary" />
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
