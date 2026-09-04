"use client";

import { useState } from "react";
import { Medal, Trophy } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { cn, initials, levelOf } from "@/lib/utils";

interface Row {
  id: string;
  name: string;
  position: string;
  lifetimePoints: number;
  touches: number;
  researches: number;
  replies: number;
  positives: number;
  calls: number;
  rangePoints: number;
}

const rankMedal = ["🥇", "🥈", "🥉"];

export default function LeaderboardClient({ meId, today, week, month }: { meId: string; today: Row[]; week: Row[]; month: Row[] }) {
  const [range, setRange] = useState("today");
  const rows = range === "today" ? today : range === "week" ? week : month;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Trophy className="h-6 w-6 text-warning" /> Leaderboard
          </h1>
          <p className="text-sm text-muted-foreground">Points: touch +1 · research +2 · reply +5 · positive +10 · call +20 · WON +100</p>
        </div>
      </div>

      <Tabs value={range} onValueChange={setRange}>
        <TabsList className="w-full max-w-xs">
          <TabsTrigger value="today" className="flex-1">Today</TabsTrigger>
          <TabsTrigger value="week" className="flex-1">This Week</TabsTrigger>
          <TabsTrigger value="month" className="flex-1">This Month</TabsTrigger>
        </TabsList>

        {(["today", "week", "month"] as const).map((r) => (
          <TabsContent key={r} value={r}>
            <div className="overflow-hidden rounded-xl border bg-card">
              <div className="grid grid-cols-[40px_1fr_repeat(5,minmax(44px,64px))_80px] items-center gap-2 border-b bg-muted/40 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground md:grid-cols-[48px_1fr_repeat(5,80px)_96px]">
                <span>#</span>
                <span>Member</span>
                <span className="text-right">Touches</span>
                <span className="text-right">Research</span>
                <span className="text-right">Replies</span>
                <span className="text-right">Positives</span>
                <span className="text-right">Calls</span>
                <span className="text-right">Points</span>
              </div>
              {(r === "today" ? today : r === "week" ? week : month).map((row, i) => {
                const lvl = levelOf(row.lifetimePoints);
                const me = row.id === meId;
                return (
                  <div
                    key={row.id}
                    className={cn(
                      "grid grid-cols-[40px_1fr_repeat(5,minmax(44px,64px))_80px] items-center gap-2 border-b px-3 py-2.5 last:border-0 md:grid-cols-[48px_1fr_repeat(5,80px)_96px]",
                      me && "bg-accent/40"
                    )}
                  >
                    <span className="text-sm font-bold">
                      {i < 3 ? <span className="text-base">{rankMedal[i]}</span> : i + 1}
                    </span>
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-foreground">
                        {initials(row.name)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{row.name}{me && " (you)"}</p>
                        <p className="truncate text-[11px] text-muted-foreground">{row.position} · L{lvl.level} {lvl.name}</p>
                      </div>
                    </div>
                    <span className="text-right text-sm tabular-nums">{row.touches}</span>
                    <span className="text-right text-sm tabular-nums">{row.researches}</span>
                    <span className="text-right text-sm tabular-nums">{row.replies}</span>
                    <span className="text-right text-sm tabular-nums">{row.positives}</span>
                    <span className="text-right text-sm tabular-nums">{row.calls}</span>
                    <span className="text-right">
                      <Badge variant={me ? "default" : "secondary"} className="tabular-nums">{row.rangePoints} pts</Badge>
                    </span>
                  </div>
                );
              })}
              {rows.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">No activity yet.</p>}
            </div>
          </TabsContent>
        ))}
      </Tabs>

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Medal className="h-3.5 w-3.5" /> Levels: L1 Rookie &lt;500 · L2 Scout 500–2k · L3 Hunter 2k–5k · L4 Closer 5k–15k · L5 Legend 15k+
      </p>
    </div>
  );
}
