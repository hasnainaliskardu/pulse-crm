"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { db, type CachedTask, type CachedLead } from "@/lib/local/db";
import { trySync } from "@/lib/local/sync";
import { cn } from "@/lib/utils";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default function CalendarClient({ meId }: { meId: string }) {
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return { y: d.getFullYear(), m: d.getMonth() };
  });
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    void trySync("calendar-mount").then(() => setHydrated(true));
  }, []);

  const tasks = useLiveQuery(() => db.tasks.toArray(), [], [] as CachedTask[]);
  const leads = useLiveQuery(() => db.leads.toArray(), [], [] as CachedLead[]);
  const leadName = useMemo(() => new Map((leads ?? []).map((l) => [l.id, l.business_name])), [leads]);

  const byDate = useMemo(() => {
    const map = new Map<string, Array<{ kind: "TASK" | "FOLLOWUP"; label: string; href?: string; done?: boolean }>>();
    for (const t of tasks ?? []) {
      if (!t.due_date) continue;
      if (t.assigned_to !== meId && t.assigned_to) continue;
      const arr = map.get(t.due_date) ?? [];
      arr.push({ kind: "TASK", label: t.title, href: t.lead_id ? `/leads/${t.lead_id}` : undefined, done: t.done });
      map.set(t.due_date, arr);
    }
    // follow-ups: leads dormant/contacted with last activity > 7 days ago → gentle marker
    const cutoff = Date.now() - 7 * 864e5;
    for (const l of leads ?? []) {
      if (!["DORMANT", "CONTACTED", "REPLIED", "INTERESTED"].includes(l.status)) continue;
      if (l.assigned_to && l.assigned_to !== meId) continue;
      const d = new Date(l.last_activity_at);
      if (d.getTime() > cutoff) continue;
      const key = d.toISOString().slice(0, 10);
      const arr = map.get(key) ?? [];
      arr.push({ kind: "FOLLOWUP", label: `Follow up: ${l.business_name}`, href: `/leads/${l.id}` });
      map.set(key, arr);
    }
    return map;
  }, [tasks, leads, meId]);

  const first = new Date(cursor.y, cursor.m, 1);
  const startDay = (first.getDay() + 6) % 7; // Monday-start
  const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate();
  const todayKey = new Date().toISOString().slice(0, 10);

  const cells: Array<{ date?: string }> = [
    ...Array.from({ length: startDay }, () => ({})),
    ...Array.from({ length: daysInMonth }, (_, i) => {
      const dd = String(i + 1).padStart(2, "0");
      return { date: `${cursor.y}-${String(cursor.m + 1).padStart(2, "0")}-${dd}` };
    }),
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <CalendarDays className="h-6 w-6 text-primary" /> {MONTHS[cursor.m]} {cursor.y}
          </h1>
          <p className="text-sm text-muted-foreground">Tasks and follow-ups — cached offline.</p>
        </div>
        <div className="flex gap-1">
          <Button variant="outline" size="icon" onClick={() => setCursor((c) => (c.m === 0 ? { y: c.y - 1, m: 11 } : { y: c.y, m: c.m - 1 }))} aria-label="Previous month">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => { const d = new Date(); setCursor({ y: d.getFullYear(), m: d.getMonth() }); }}>Today</Button>
          <Button variant="outline" size="icon" onClick={() => setCursor((c) => (c.m === 11 ? { y: c.y + 1, m: 0 } : { y: c.y, m: c.m + 1 }))} aria-label="Next month">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-muted-foreground">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d} className="py-1">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((c, i) => {
          if (!c.date) return <div key={i} />;
          const items = byDate.get(c.date) ?? [];
          const isToday = c.date === todayKey;
          return (
            <div
              key={i}
              className={cn(
                "min-h-20 rounded-lg border p-1.5 md:min-h-24",
                isToday && "border-primary/60 bg-accent/40"
              )}
            >
              <p className={cn("mb-1 text-right text-[11px] font-bold", isToday ? "text-primary" : "text-muted-foreground")}>
                {Number(c.date.slice(8))}
              </p>
              <div className="space-y-1">
                {items.slice(0, 3).map((item, j) => {
                  const inner = (
                    <>
                      <span className="mr-1 text-[9px] font-bold">{item.kind === "TASK" ? "T" : "F"}</span>
                      <span className="truncate">{item.label}</span>
                    </>
                  );
                  return item.href ? (
                    <Link key={j} href={item.href} className={cn("block truncate rounded bg-muted px-1 py-0.5 text-[10px] hover:bg-accent", item.done && "line-through opacity-60")}>
                      {inner}
                    </Link>
                  ) : (
                    <p key={j} className={cn("truncate rounded bg-muted px-1 py-0.5 text-[10px]", item.done && "line-through opacity-60")}>{inner}</p>
                  );
                })}
                {items.length > 3 && <p className="text-[9px] text-muted-foreground">+{items.length - 3} more</p>}
              </div>
            </div>
          );
        })}
      </div>
      {!hydrated && <p className="text-center text-xs text-muted-foreground">Loading cached data…</p>}
    </div>
  );
}
