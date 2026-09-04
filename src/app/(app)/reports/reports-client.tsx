"use client";

import { useMemo, useState } from "react";
import { BarChart3, Download, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SimpleSelect } from "@/components/ui/simple-select";
import { Input } from "@/components/ui/input";
import { CALL_OUTCOMES } from "@/lib/utils";
import type { DailyStatRow, LeadRow, MemberRow } from "@/types/supabase";

type ClientLite = { id: string; business_name: string; monthly_revenue: number; started_at: string; status: string };

type TouchLite = { id: string; channel: string; direction: string; member_id: string; outcome?: string | null; occurred_at: string };
type LeadLite = { id: string; city: string | null; status: string; source: string; created_at: string };
type MeetingLite = { id: string; scheduled_at: string; status: string };
type AttLite = { member_id: string; date: string; status: string };

const METRICS = [
  { label: "Leads added", value: "leads_added" },
  { label: "Touches sent", value: "touches" },
  { label: "Replies received", value: "replies" },
  { label: "Positive replies", value: "positives" },
  { label: "Calls booked", value: "calls" },
  { label: "Clients closed", value: "clients" },
] as const;

const GROUPS = [
  { label: "By member", value: "member" },
  { label: "By city", value: "city" },
  { label: "By status", value: "status" },
  { label: "By source", value: "source" },
] as const;

const todayStr = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n: number) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);

export default function ReportsClient({
  leads,
  touches,
  stats,
  members,
  meetings,
  attendance,
  clients,
}: {
  leads: LeadLite[];
  touches: TouchLite[];
  stats: DailyStatRow[];
  members: Array<Pick<MemberRow, "id" | "full_name">>;
  meetings: MeetingLite[];
  attendance: AttLite[];
  clients: ClientLite[];
}) {
  const [metric, setMetric] = useState<string>("touches");
  const [group, setGroup] = useState<string>("member");
  const [from, setFrom] = useState(daysAgo(30));
  const [to, setTo] = useState(todayStr());

  const nameOf = (id: string) => members.find((m) => m.id === id)?.full_name ?? "—";

  const inRange = (iso: string) => iso >= `${from}T00:00:00` && iso <= `${to}T23:59:59`;
  const rangeTouches = touches.filter((t) => inRange(t.occurred_at));
  const rangeMeetings = meetings.filter((m) => inRange(m.scheduled_at));
  const rangeAttendance = attendance.filter((a) => a.date >= from && a.date <= to);
  const rangeClients = clients.filter((c) => c.started_at >= from && c.started_at <= to);

  // ---- outcome metrics (calls + emails) ----
  const calls = rangeTouches.filter((t) => t.channel === "CALL");
  const emails = rangeTouches.filter((t) => t.channel === "EMAIL");
  const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 1000) / 10}%` : "—");

  const callOutcome = (o: string) => calls.filter((t) => t.outcome === o).length;
  const emailReplies = emails.filter((t) => t.direction === "IN").length;

  // ---- grouped rows ----
  const rows = useMemo(() => {
    const by = new Map<string, number>();
    if (metric === "leads_added") {
      for (const l of leads.filter((l) => inRange(l.created_at))) {
        const key = group === "member" ? "All" : group === "city" ? l.city ?? "Unknown" : group === "status" ? l.status : l.source;
        by.set(key, (by.get(key) ?? 0) + 1);
      }
    } else if (metric === "touches") {
      for (const t of rangeTouches.filter((t) => t.direction === "OUT")) {
        by.set(group === "member" ? nameOf(t.member_id) : "All", (by.get(group === "member" ? nameOf(t.member_id) : "All") ?? 0) + 1);
      }
    } else {
      const keyOf: Record<string, keyof DailyStatRow> = { replies: "replies_received", positives: "positive_replies", calls: "calls_booked", clients: "clients_closed" };
      const field = keyOf[metric];
      for (const s of stats.filter((s) => s.date >= from && s.date <= to)) {
        const key = group === "member" ? nameOf(s.member_id) : "All";
        by.set(key, (by.get(key) ?? 0) + (s[field] as number));
      }
    }
    return Array.from(by.entries()).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  }, [metric, group, from, to, leads, touches, stats, members]);

  const max = Math.max(1, ...rows.map((r) => r.value));

  // ---- downloadable monthly report (CSV) ----
  function downloadReport() {
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const L: string[] = [];
    L.push(`Pulse CRM Report,${from},to,${to}`);
    L.push("");
    L.push("SECTION,VALUE");
    L.push(`Leads added,${leads.filter((l) => inRange(l.created_at)).length}`);
    L.push(`Touches sent,${rangeTouches.filter((t) => t.direction === "OUT").length}`);
    L.push(`Calls made,${calls.length}`);
    L.push(`Emails sent,${emails.length}`);
    L.push(`Email replies,${emailReplies}`);
    L.push(`Meetings booked,${rangeMeetings.length}`);
    L.push(`Clients closed,${rangeClients.length}`);
    L.push(`Revenue (monthly value of clients started),${rangeClients.reduce((a, c) => a + c.monthly_revenue, 0)}`);
    L.push("");
    L.push("CALL OUTCOMES,COUNT,RATE");
    for (const o of CALL_OUTCOMES) {
      const n = callOutcome(o.value);
      L.push(`${o.label},${n},${pct(n, calls.length)}`);
    }
    L.push("");
    L.push("EMAIL METRICS,VALUE");
    L.push(`Emails sent,${emails.length}`);
    L.push(`Reply rate,${pct(emailReplies, emails.length)}`);
    L.push("");
    L.push("ATTENDANCE,PRESENT,ABSENT,LEAVE,HALF_DAY");
    L.push(
      `Team,${rangeAttendance.filter((a) => a.status === "PRESENT").length},${rangeAttendance.filter((a) => a.status === "ABSENT").length},${rangeAttendance.filter((a) => a.status === "LEAVE").length},${rangeAttendance.filter((a) => a.status === "HALF_DAY").length}`
    );
    L.push("");
    L.push("MEMBER,TOUCHES,CALLS,EMAILS");
    for (const m of members) {
      const mt = rangeTouches.filter((t) => t.member_id === m.id);
      L.push(`${esc(m.full_name)},${mt.length},${mt.filter((t) => t.channel === "CALL").length},${mt.filter((t) => t.channel === "EMAIL").length}`);
    }

    const csv = L.join("\n");
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `pulse-report-${from}-to-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const rangePresets: Array<{ label: string; f: () => void }> = [
    { label: "Today", f: () => { setFrom(todayStr()); setTo(todayStr()); } },
    { label: "7 days", f: () => { setFrom(daysAgo(6)); setTo(todayStr()); } },
    { label: "30 days", f: () => { setFrom(daysAgo(29)); setTo(todayStr()); } },
    { label: "Year", f: () => { setFrom(daysAgo(364)); setTo(todayStr()); } },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <BarChart3 className="h-6 w-6 text-primary" /> Reports
          </h1>
          <p className="text-sm text-muted-foreground">Auto-calculated from real CRM activity — no manual entry.</p>
        </div>
        <Button onClick={downloadReport}>
          <Download className="h-4 w-4" /> Download report (CSV)
        </Button>
      </div>

      {/* Date range */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3">
        {rangePresets.map((p) => (
          <Button key={p.label} size="sm" variant="outline" onClick={p.f}>{p.label}</Button>
        ))}
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" aria-label="From" />
        <span className="text-xs text-muted-foreground">to</span>
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" aria-label="To" />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
        {[
          { label: "Calls", value: calls.length },
          { label: "Interested", value: callOutcome("INTERESTED") },
          { label: "Rejected", value: callOutcome("REJECTED") },
          { label: "No answer", value: callOutcome("NO_ANSWER") },
          { label: "WhatsApp req.", value: callOutcome("WHATSAPP_REQUEST") },
          { label: "Meetings", value: rangeMeetings.length },
          { label: "Emails sent", value: emails.length },
          { label: "Email replies", value: emailReplies },
          { label: "Reply rate", value: pct(emailReplies, emails.length) },
          { label: "Clients closed", value: rangeClients.length },
          { label: "Revenue", value: `$${rangeClients.reduce((a, c) => a + c.monthly_revenue, 0).toLocaleString()}` },
          { label: "Present days", value: rangeAttendance.filter((a) => a.status === "PRESENT").length },
        ].map((k) => (
          <div key={k.label} className="rounded-xl border bg-card p-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{k.label}</p>
            <p className="mt-1 text-xl font-bold tabular-nums">{k.value}</p>
          </div>
        ))}
      </div>

      {/* Custom grouped chart */}
      <div className="grid gap-2 rounded-xl border bg-card p-3 sm:grid-cols-4">
        <SimpleSelect ariaLabel="Metric" value={metric} onChange={setMetric} options={METRICS.map((m) => ({ label: m.label, value: m.value }))} />
        <SimpleSelect ariaLabel="Group by" value={group} onChange={setGroup} options={GROUPS.map((g) => ({ label: g.label, value: g.value }))} />
        <div className="sm:col-span-2 flex items-end justify-between">
          <p className="text-xs text-muted-foreground">{rows.length} groups</p>
          <p className="flex items-center gap-1 text-xs text-muted-foreground"><FileSpreadsheet className="h-3.5 w-3.5" /> CSV includes all sections</p>
        </div>
      </div>

      <div className="space-y-2 rounded-xl border bg-card p-4">
        {rows.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No data for this range.</p>}
        {rows.map((r) => (
          <div key={r.label} className="flex items-center gap-3">
            <span className="w-40 truncate text-sm font-medium">{r.label}</span>
            <div className="h-7 flex-1 overflow-hidden rounded-lg bg-muted">
              <div className="h-full rounded-lg bg-primary/80" style={{ width: `${Math.max(2, (r.value / max) * 100)}%` }} />
            </div>
            <span className="w-14 text-right text-sm font-bold tabular-nums">{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
