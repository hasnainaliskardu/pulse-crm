"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { initials, levelOf } from "@/lib/utils";
import type { MemberRow, DailyStatRow, ActivityLogRow, Json } from "@/types/supabase";

export default function MemberDetailClient({
  member,
  stats,
  workloadCount,
  activity,
}: {
  member: MemberRow;
  stats: DailyStatRow[];
  workloadCount: number;
  activity: ActivityLogRow[];
}) {
  const lvl = levelOf(member.points);
  const days: Array<{ date: string; hit: boolean; touches: number }> = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10);
    const s = stats.find((x) => x.date === d);
    days.push({ date: d, hit: (s?.touches_sent ?? 0) >= member.daily_touch_target, touches: s?.touches_sent ?? 0 });
  }
  const hits = days.filter((d) => d.hit).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/team"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-base font-bold text-accent-foreground">
          {initials(member.full_name)}
        </span>
        <div>
          <h1 className="text-xl font-bold tracking-tight">{member.full_name}</h1>
          <p className="text-xs text-muted-foreground">{member.email} · {member.position} · {member.is_active ? "Active" : "Deactivated"}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Badge variant="default">L{lvl.level} {lvl.name}</Badge>
          <Badge variant="secondary">{member.points} pts</Badge>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Current workload</p>
          <p className="text-2xl font-bold tabular-nums">{workloadCount}</p>
          <p className="text-[11px] text-muted-foreground">assigned leads</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Targets hit (14d)</p>
          <p className="text-2xl font-bold tabular-nums">{hits}/14</p>
          <p className="text-[11px] text-muted-foreground">daily touch target {member.daily_touch_target}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Daily targets</p>
          <p className="text-2xl font-bold tabular-nums">{member.daily_research_target}/{member.daily_touch_target}</p>
          <p className="text-[11px] text-muted-foreground">research / touches</p>
        </div>
      </div>

      <section className="rounded-xl border bg-card p-4">
        <h2 className="mb-3 text-sm font-semibold">Last 14 days</h2>
        <div className="flex flex-wrap gap-1.5">
          {days.map((d) => (
            <div
              key={d.date}
              title={`${d.date}: ${d.touches} touches`}
              className={`flex h-9 w-9 items-center justify-center rounded-lg text-[10px] font-bold ${d.hit ? "bg-success/20 text-success" : "bg-destructive/15 text-destructive"}`}
            >
              {d.date.slice(8)}
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border bg-card p-4">
        <h2 className="mb-3 text-sm font-semibold">Recent activity</h2>
        <div className="space-y-1.5">
          {activity.length === 0 && <p className="py-4 text-center text-xs text-muted-foreground">No recent activity.</p>}
          {activity.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-3 border-b py-1.5 text-xs last:border-0">
              <span className="font-medium">{a.action.replace(/_/g, " ")} · {a.entity}</span>
              <span className="truncate text-muted-foreground">{JSON.stringify(a.detail as Json ?? {})?.slice(0, 80)}</span>
              <span className="shrink-0 text-muted-foreground">{new Date(a.created_at).toLocaleString()}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
