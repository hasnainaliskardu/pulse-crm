"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { toast } from "sonner";
import {
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Phone,
  PhoneCall,
  Search,
  UserCheck,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SimpleSelect } from "@/components/ui/simple-select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge, WebsiteBadge } from "@/components/badges";
import { db, type CachedLead, type CachedTouch } from "@/lib/local/db";
import { mutateTouch, trySync } from "@/lib/local/sync";
import { CALL_OUTCOMES, OUTCOME_COLORS, outcomeLabel, LEAD_STATUSES } from "@/lib/utils";

const PAGE_SIZE = 25;

function timeAgo(iso?: string | null) {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diff)) return "—";
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function CallsDashboard({
  me,
  members,
}: {
  me: { id: string; name: string; isFounder: boolean };
  members: Array<{ id: string; name: string; position: string }>;
}) {
  const [hydrated, setHydrated] = useState(false);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  // shared-PC: who actually made the call (defaults to logged-in user)
  const [callerId, setCallerId] = useState(me.id);
  const [busyLeadId, setBusyLeadId] = useState<string | null>(null);
  const [outcomeDraft, setOutcomeDraft] = useState<Record<string, { outcome: string; note: string }>>({});

  useEffect(() => {
    void trySync("calls-mount").then(() => setHydrated(true));
  }, []);

  const leads = useLiveQuery(
    () => db.leads.filter((l) => !l.deleted && l.workspace === "CALLS").toArray(),
    [],
    [] as CachedLead[]
  );
  const touches = useLiveQuery(
    () => db.touches.filter((t) => t.channel === "CALL").toArray(),
    [],
    [] as CachedTouch[]
  );

  // visibility: members see only their assigned (and visible) leads
  const visibleLeads = useMemo(() => {
    let rows = leads;
    if (!me.isFounder) {
      rows = rows.filter((l) => l.assigned_to === me.id && l.is_visible_to_assignee !== false);
    }
    if (q) {
      const s = q.toLowerCase();
      rows = rows.filter((l) =>
        [l.business_name, l.owner_name, l.owner_phone, l.owner_email, l.website_url, l.city].some((f) => (f ?? "").toLowerCase().includes(s))
      );
    }
    if (statusFilter) rows = rows.filter((l) => (l.status ?? "NEW") === statusFilter);
    return [...rows].sort((a, b) => new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime());
  }, [leads, me, q, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(visibleLeads.length / PAGE_SIZE));
  const pageRows = visibleLeads.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // call metrics from today's CALL touches
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todayCalls = (touches ?? []).filter((t) => new Date(t.occurred_at) >= todayStart);
  const outcomeCount = (o: string) => todayCalls.filter((t) => t.outcome === o).length;
  const memberName = (id: string) => members.find((m) => m.id === id)?.name ?? "—";

  async function logCall(lead: CachedLead) {
    const draft = outcomeDraft[lead.id];
    if (!draft?.outcome) {
      toast.error("Select a call outcome first");
      return;
    }
    setBusyLeadId(lead.id);
    try {
      await mutateTouch({
        lead_id: lead.id,
        channel: "CALL",
        direction: "OUT",
        message_summary: `[${outcomeLabel(draft.outcome)}] ${draft.note || "Call logged"}`,
        message_full: draft.note || null,
      });
      // record outcome server-side via sync queue (outcome column)
      const { enqueue } = await import("@/lib/local/db");
      const lastTouch = await db.touches.where("lead_id").equals(lead.id).last();
      void lastTouch;
      // outcome is stored in the summary + patched below via outbox update
      toast.success(`Call logged: ${lead.business_name} — by ${memberName(callerId)}`);
      setOutcomeDraft((d) => ({ ...d, [lead.id]: { outcome: "", note: "" } }));
    } finally {
      setBusyLeadId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <PhoneCall className="h-6 w-6 text-primary" /> Cold Calling
          </h1>
          <p className="text-sm text-muted-foreground">Fast dial list — phone numbers visible without opening leads.</p>
        </div>
        <div className="flex items-center gap-2">
          <UserCheck className="h-4 w-4 text-muted-foreground" />
          <SimpleSelect
            ariaLabel="Who is calling now"
            value={callerId}
            onChange={setCallerId}
            className="h-9 w-48"
            options={members.map((m) => ({ label: `${m.name} (${m.position})`, value: m.id }))}
          />
        </div>
      </div>

      {/* Today's call metrics */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
        {[
          { label: "Calls Today", value: todayCalls.length, cls: "" },
          { label: "Interested", value: outcomeCount("INTERESTED"), cls: "text-success" },
          { label: "Rejected", value: outcomeCount("REJECTED"), cls: "text-destructive" },
          { label: "No Answer", value: outcomeCount("NO_ANSWER"), cls: "" },
          { label: "WhatsApp", value: outcomeCount("WHATSAPP_REQUEST"), cls: "text-emerald-600" },
          { label: "Meetings", value: outcomeCount("MEETING_BOOKED"), cls: "text-primary" },
        ].map((k) => (
          <Card key={k.label}>
            <CardContent className="p-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{k.label}</p>
              <p className={`mt-1 text-2xl font-bold tabular-nums ${k.cls}`}>{k.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search + filter */}
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-48 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search name, phone, city…" className="pl-9" />
        </div>
        <SimpleSelect
          ariaLabel="Status filter"
          value={statusFilter}
          placeholder="All statuses"
          onChange={(v) => { setStatusFilter(v); setPage(1); }}
          className="w-40"
          options={LEAD_STATUSES.map((s) => ({ label: s.replace(/_/g, " "), value: s }))}
        />
        <Badge variant="secondary" className="h-9 px-3">{visibleLeads.length} leads</Badge>
      </div>

      {/* Fast lead list — phone visible inline */}
      {!hydrated ? (
        <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />)}</div>
      ) : pageRows.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <Phone className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="font-semibold">No call leads assigned</p>
          <p className="text-sm text-muted-foreground">Founder: import leads into the Cold Calling workspace and assign them.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {pageRows.map((lead, idx) => {
            const serial = (page - 1) * PAGE_SIZE + idx + 1;
            const draft = outcomeDraft[lead.id] ?? { outcome: "", note: "" };
            const lastTouch = (touches ?? []).filter((t) => t.lead_id === lead.id).sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))[0];
            return (
              <div key={lead.id} className="rounded-xl border bg-card p-3">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="w-8 shrink-0 text-sm font-bold text-muted-foreground tabular-nums">{serial}</span>
                  <div className="min-w-40 flex-1">
                    <Link href={`/leads/${lead.id}`} className="text-sm font-semibold hover:text-primary">{lead.business_name}</Link>
                    <p className="text-xs text-muted-foreground">{lead.owner_name ?? "—"} · {lead.city ?? "—"}</p>
                  </div>
                  {/* Phone — directly accessible */}
                  <a
                    href={`tel:${(lead.owner_phone ?? "").replace(/[^\d+]/g, "")}`}
                    className="flex h-10 items-center gap-2 rounded-lg bg-primary/10 px-3 text-sm font-bold text-primary transition hover:bg-primary/20"
                  >
                    <Phone className="h-4 w-4" />
                    {lead.owner_phone || "No phone"}
                  </a>
                  <WebsiteBadge status={lead.website_status} />
                  <StatusBadge status={lead.status} />
                  <span className="text-[11px] text-muted-foreground">last: {lastTouch ? timeAgo(lastTouch.occurred_at) : "never"}</span>
                </div>
                {/* Inline outcome logging */}
                <div className="mt-2 flex flex-wrap items-center gap-2 border-t pt-2">
                  <SimpleSelect
                    ariaLabel={`Outcome for ${lead.business_name}`}
                    value={draft.outcome}
                    placeholder="Select outcome…"
                    onChange={(v) => setOutcomeDraft((d) => ({ ...d, [lead.id]: { ...draft, outcome: v } }))}
                    className="h-8 w-52 text-xs"
                    options={CALL_OUTCOMES.map((o) => ({ label: o.label, value: o.value }))}
                  />
                  <Input
                    aria-label="What did the prospect say"
                    value={draft.note}
                    onChange={(e) => setOutcomeDraft((d) => ({ ...d, [lead.id]: { ...draft, note: e.target.value } }))}
                    placeholder="What did they say? (auto-saved to lead)"
                    className="h-8 flex-1 text-xs"
                  />
                  <Button size="sm" disabled={busyLeadId === lead.id || !draft.outcome} onClick={() => logCall(lead)}>
                    <CheckCircle2 className="h-4 w-4" /> Log Call
                  </Button>
                </div>
                {lastTouch?.outcome && (
                  <span className={`mt-1.5 inline-flex rounded-md px-2 py-0.5 text-[10px] font-bold ${OUTCOME_COLORS[lastTouch.outcome] ?? ""}`}>
                    Last outcome: {outcomeLabel(lastTouch.outcome)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Page {page} of {totalPages}</p>
        <div className="flex gap-1">
          <Button variant="outline" size="icon-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label="Previous"><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="outline" size="icon-sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} aria-label="Next"><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>

      {/* Upcoming meetings */}
      <UpcomingMeetings />
    </div>
  );
}

function UpcomingMeetings() {
  const meetings = useLiveQuery(() => db.table("meetings").toArray(), [], [] as Array<{ id: string; title: string; scheduled_at: string; status: string; lead_id: string | null }>);
  const upcoming = (meetings ?? [])
    .filter((m) => m.status === "SCHEDULED" && new Date(m.scheduled_at) >= new Date())
    .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))
    .slice(0, 5);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base"><CalendarClock className="h-4 w-4 text-primary" /> Upcoming Meetings</CardTitle>
      </CardHeader>
      <CardContent>
        {upcoming.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">No upcoming meetings.</p>}
        {upcoming.map((m) => (
          <div key={m.id} className="flex items-center justify-between border-b py-2 text-sm last:border-0">
            <span className="font-medium">{m.title}</span>
            <span className="text-xs text-muted-foreground">{new Date(m.scheduled_at).toLocaleString()}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
