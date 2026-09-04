"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { toast } from "sonner";
import { CalendarDays, CheckSquare, Clock, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SimpleSelect } from "@/components/ui/simple-select";
import { EmptyState } from "@/components/empty-state";
import { db } from "@/lib/local/db";
import { mutateTask, trySync } from "@/lib/local/sync";
import { cn } from "@/lib/utils";
import type { CachedTask, CachedLead } from "@/lib/local/db";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function TasksClient({ meId, meRole }: { meId: string; meRole: string }) {
  const [view, setView] = useState<"today" | "all" | "done">("today");
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [leadId, setLeadId] = useState("");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    void trySync("tasks-mount").then(() => setHydrated(true));
  }, []);

  const tasks = useLiveQuery(() => db.tasks.toArray(), [], [] as CachedTask[]);
  const leads = useLiveQuery(() => db.leads.toArray(), [], [] as CachedLead[]);
  const leadName = useMemo(() => new Map((leads ?? []).map((l) => [l.id, l.business_name])), [leads]);

  const today = todayStr();
  const visible = (tasks ?? []).filter((t) => {
    if (view === "done") return t.done;
    if (view === "today") return !t.done && (t.assigned_to === meId || meRole === "FOUNDER") && (!t.due_date || t.due_date <= today);
    return !t.done;
  }).sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"));

  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    await mutateTask({
      title: title.trim(),
      due_date: due || null,
      lead_id: leadId || null,
      assigned_to: meId,
      priority: priority as "LOW" | "MEDIUM" | "HIGH",
      done: false,
    });
    setTitle("");
    setDue("");
    setLeadId("");
    toast.success("Task created");
  }

  const prio = { HIGH: "text-destructive", MEDIUM: "text-warning", LOW: "text-muted-foreground" } as Record<string, string>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tasks</h1>
          <p className="text-sm text-muted-foreground">Today&apos;s follow-ups and to-dos — works offline.</p>
        </div>
        <div className="flex overflow-hidden rounded-lg border">
          {(["today", "all", "done"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn("h-9 px-4 text-sm font-medium capitalize", view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground")}
            >
              {v === "today" ? "Today" : v === "all" ? "Open" : "Done"}
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={addTask} className="grid gap-2 rounded-xl border bg-card p-3 sm:grid-cols-[1fr_150px_130px_150px_auto]">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="New task…" />
        <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} aria-label="Due date" />
        <SimpleSelect ariaLabel="Priority" value={priority} onChange={setPriority} options={[{ label: "High", value: "HIGH" }, { label: "Medium", value: "MEDIUM" }, { label: "Low", value: "LOW" }]} />
        <SimpleSelect
          ariaLabel="Link lead"
          value={leadId}
          placeholder="Link lead…"
          onChange={setLeadId}
          options={(leads ?? []).slice(0, 100).map((l) => ({ label: l.business_name.slice(0, 30), value: l.id }))}
        />
        <Button type="submit" size="sm"><Plus className="h-4 w-4" /> Add</Button>
      </form>

      {!hydrated ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" />)}
        </div>
      ) : visible.length === 0 ? (
        <EmptyState icon={CheckSquare} title="No tasks here" description="Create a task above or check the other tabs." />
      ) : (
        <div className="space-y-2">
          {visible.map((t) => (
            <div key={t.id} className="flex items-center gap-3 rounded-xl border bg-card p-3">
              <input
                type="checkbox"
                checked={t.done}
                onChange={() => {
                  void mutateTask({ done: !t.done }, "update", t.id).then(() => toast.success(t.done ? "Reopened" : "Task completed"));
                }}
                className="h-5 w-5 accent-[hsl(var(--primary))]"
                aria-label={`Done: ${t.title}`}
              />
              <div className="min-w-0 flex-1">
                <p className={cn("truncate text-sm font-medium", t.done && "text-muted-foreground line-through")}>{t.title}</p>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className={cn("font-semibold uppercase", prio[t.priority])}>{t.priority}</span>
                  {t.due_date && (
                    <span className={cn("inline-flex items-center gap-1", !t.done && t.due_date < today && "text-destructive font-semibold")}>
                      <CalendarDays className="h-3 w-3" /> {t.due_date}
                    </span>
                  )}
                  {t.lead_id && leadName.get(t.lead_id) && (
                    <Link href={`/leads/${t.lead_id}`} className="text-primary hover:underline">
                      {leadName.get(t.lead_id)}
                    </Link>
                  )}
                  {t.dirty && <span className="rounded bg-warning/20 px-1 text-[9px] font-bold text-warning">PENDING</span>}
                </div>
              </div>
              <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
