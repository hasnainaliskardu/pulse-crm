"use client";

import Link from "next/link";
import {
  CalendarCheck,
  Flame,
  ListChecks,
  MessageSquareReply,
  Plus,
  Send,
  Target,
  Trophy,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusBadge, WebsiteBadge } from "@/components/badges";
import { EmptyState } from "@/components/empty-state";
import { cn, initials, levelOf } from "@/lib/utils";
import type { Database } from "@/types/supabase";

type Member = Database["public"]["Tables"]["members"]["Row"];
type MemberData = Awaited<ReturnType<typeof import("@/lib/queries").getMemberDashboard>>;

function ProgressBar({ label, value, target, icon: Icon, tone }: { label: string; value: number; target: number; icon: typeof Target; tone: string }) {
  const pct = target ? Math.min(100, Math.round((value / target) * 100)) : 0;
  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Icon className="h-4 w-4 text-muted-foreground" /> {label}
          </div>
          <span className="text-sm font-bold tabular-nums">
            {value}
            <span className="text-xs font-normal text-muted-foreground"> / {target}</span>
          </span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-muted">
          <div className={cn("h-full rounded-full transition-all", tone)} style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-1.5 text-right text-[11px] text-muted-foreground">{pct}% of target</p>
      </CardContent>
    </Card>
  );
}

export default function MemberDayClient({ member, data }: { member: Member; data: MemberData }) {
  const lvl = levelOf(member.points);
  const toNext = Math.max(0, lvl.next - member.points);
  const lvlPct = Math.min(100, Math.round(((member.points - lvl.floor) / (lvl.next - lvl.floor)) * 100));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Day</h1>
          <p className="text-sm text-muted-foreground">Keep the pipeline moving, {member.full_name.split(" ")[0]}.</p>
        </div>
        <Button asChild size="sm">
          <Link href="/leads/new"><Plus className="h-4 w-4" /> Add Lead</Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <ProgressBar label="Leads Researched" value={data.stat.leads_researched} target={member.daily_research_target} icon={ListChecks} tone="bg-info" />
        <ProgressBar label="Touches Sent" value={data.stat.touches_sent} target={member.daily_touch_target} icon={Send} tone="bg-primary" />
        <ProgressBar label="Replies Today" value={data.stat.replies_received} target={Math.max(1, Math.round(member.daily_touch_target / 5))} icon={MessageSquareReply} tone="bg-success" />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-base font-bold text-accent-foreground">
                {initials(member.full_name)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Badge variant="default">L{lvl.level} {lvl.name}</Badge>
                  <span className="text-sm font-bold tabular-nums">{member.points} pts</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${lvlPct}%` }} />
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {toNext > 0 ? `${toNext} pts to next level` : "Max level reached"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-warning/15 text-warning">
                <Trophy className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold tabular-nums">#{data.rank}</p>
                <p className="text-xs text-muted-foreground">Today&apos;s leaderboard rank</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium">
              <CalendarCheck className="h-4 w-4 text-muted-foreground" /> 14-Day Streak
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {data.streak.map((d) => (
                <div
                  key={d.date}
                  title={`${d.date}: ${d.touches} touches`}
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-md text-[10px] font-bold",
                    d.hit ? "bg-success/20 text-success" : "bg-destructive/15 text-destructive"
                  )}
                >
                  {d.date.slice(8)}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-base">My Lead Queue</CardTitle>
          <Badge variant="secondary">{data.queueCount} leads</Badge>
        </CardHeader>
        <CardContent>
          {data.queueCount === 0 ? (
            <EmptyState
              icon={Flame}
              title="No leads assigned yet"
              description="Ask the founder to assign leads to you, or browse the unassigned pool."
              actionLabel="Browse Leads"
              actionHref="/leads"
            />
          ) : (
            <div className="space-y-4">
              {Array.from(data.queue.entries()).map(([status, leads]) => (
                <div key={status}>
                  <div className="mb-2 flex items-center gap-2">
                    <StatusBadge status={status as never} />
                    <span className="text-xs text-muted-foreground">{leads.length}</span>
                  </div>
                  <div className="space-y-2">
                    {leads.slice(0, 5).map((l) => (
                      <Link
                        key={l.id}
                        href={`/leads/${l.id}`}
                        className="flex items-center justify-between rounded-lg border p-3 transition hover:border-primary/40 hover:bg-muted/40"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{l.business_name}</p>
                          <p className="text-xs text-muted-foreground">{l.city ?? "—"}</p>
                        </div>
                        <WebsiteBadge status={l.website_status} />
                      </Link>
                    ))}
                    {leads.length > 5 && (
                      <Link href={`/leads?status=${status}`} className="block rounded-lg border border-dashed p-2 text-center text-xs font-medium text-muted-foreground hover:text-primary">
                        View all {leads.length} →
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
