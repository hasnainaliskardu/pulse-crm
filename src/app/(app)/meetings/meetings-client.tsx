"use client";

import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { toast } from "sonner";
import { CalendarPlus, CalendarClock, Users, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SimpleSelect } from "@/components/ui/simple-select";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { db, type CachedLead } from "@/lib/local/db";
import { mutateMeeting, trySync } from "@/lib/local/sync";

type Meeting = {
  id: string;
  lead_id: string | null;
  member_id: string | null;
  title: string;
  scheduled_at: string;
  status: string;
  notes: string | null;
};

const statusVariant = (s: string) =>
  s === "SCHEDULED" ? "info" : s === "COMPLETED" ? "success" : s === "CANCELLED" ? "destructive" : "warning";

export default function MeetingsClient() {
  const [hydrated, setHydrated] = useState(false);
  const [leadId, setLeadId] = useState("");
  const [title, setTitle] = useState("");
  const [when, setWhen] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    void trySync("meetings-mount").then(() => setHydrated(true));
  }, []);

  const meetings = useLiveQuery(() => db.table("meetings").toArray(), [], [] as Meeting[]);
  const leads = useLiveQuery(() => db.leads.filter((l) => !l.deleted).toArray(), [], [] as CachedLead[]);
  const leadName = (id: string | null) => leads.find((l) => l.id === id)?.business_name ?? "—";

  async function book(e: React.FormEvent) {
    e.preventDefault();
    if (!when) {
      toast.error("Pick a date & time");
      return;
    }
    await mutateMeeting({
      lead_id: leadId || null,
      title: title || "Meeting",
      scheduled_at: new Date(when).toISOString(),
      notes: notes || null,
    });
    setTitle(""); setWhen(""); setNotes(""); setLeadId("");
    toast.success("Meeting booked");
  }

  const sorted = [...(meetings ?? [])].sort((a, b) => b.scheduled_at.localeCompare(a.scheduled_at));
  const upcoming = sorted.filter((m) => m.status === "SCHEDULED");
  const past = sorted.filter((m) => m.status !== "SCHEDULED");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <CalendarClock className="h-6 w-6 text-primary" /> Meetings
        </h1>
        <p className="text-sm text-muted-foreground">{upcoming.length} upcoming · {past.length} past</p>
      </div>

      <form onSubmit={book} className="grid gap-2 rounded-xl border bg-card p-3 sm:grid-cols-[1fr_200px_1fr_auto]">
        <SimpleSelect
          ariaLabel="Link lead"
          value={leadId}
          placeholder="Link lead…"
          onChange={setLeadId}
          options={(leads ?? []).slice(0, 100).map((l) => ({ label: l.business_name.slice(0, 40), value: l.id }))}
        />
        <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} aria-label="When" />
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (e.g. Discovery call)" />
        <Button type="submit"><CalendarPlus className="h-4 w-4" /> Book</Button>
      </form>

      {!hydrated ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-muted" />)}</div>
      ) : sorted.length === 0 ? (
        <EmptyState icon={Users} title="No meetings yet" description="Book a meeting when a prospect agrees to talk." />
      ) : (
        <div className="space-y-2">
          {sorted.map((m) => (
            <div key={m.id} className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-3">
              <div className="min-w-40 flex-1">
                <p className="text-sm font-semibold">{m.title}</p>
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  {m.lead_id ? (
                    <a href={`/leads/${m.lead_id}`} className="inline-flex items-center gap-1 text-primary hover:underline">
                      <Link2 className="h-3 w-3" /> {leadName(m.lead_id)}
                    </a>
                  ) : "No lead linked"}
                </p>
              </div>
              <span className="text-sm">{new Date(m.scheduled_at).toLocaleString()}</span>
              <Badge variant={statusVariant(m.status) as never}>{m.status}</Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
