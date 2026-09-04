"use client";

import { useMemo, useState } from "react";
import { BarChart3, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SimpleSelect } from "@/components/ui/simple-select";
import { Input } from "@/components/ui/input";
import type { DailyStatRow, LeadRow, MemberRow } from "@/types/supabase";

type TouchLite = { id: string; channel: string; direction: string; member_id: string; occurred_at: string };
type LeadLite = { id: string; city: string | null; status: string; source: string; created_at: string };

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

export default function ReportsClient({
  leads,
  touches,
  stats,
  members,
}: {
  leads: LeadLite[];
  touches: TouchLite[];
  stats: DailyStatRow[];
  members: Array<Pick<MemberRow, "id" | "full_name">>;
}) {
  const [metric, setMetric] = useState<string>("touches");
  const [group, setGroup] = useState<string>("member");
  const [from, setFrom] = useState(new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));

  const nameOf = (id: string) => members.find((m) => m.id === id)?.full_name ?? "—";

  const rows = useMemo(() => {
    const inRange = (iso: string) => iso >= `${from}T00:00:00` && iso <= `${to}T23:59:59`;
    const by = new Map<string, number>();

    if (metric === "leads_added") {
      for (const l of leads.filter((l) => inRange(l.created_at))) {
        const key = group === "member" ? "All" : group === "city" ? l.city ?? "Unknown" : group === "status" ? l.status : l.source;
        by.set(key, (by.get(key) ?? 0) + 1);
      }
    } else if (metric === "touches") {
      for (const t of touches.filter((t) => inRange(t.occurred_at) && t.direction === "OUT")) {
        const key = group === "member" ? nameOf(t.member_id) : group === "city" ? "All" : group === "status" ? "All" : "All";
        by.set(key, (by.get(key) ?? 0) + 1);
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

  function exportCsv() {
    const csv = ["label,value", ...rows.map((r) => `"${r.label}",${r.value}`)].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `hana-report-${metric}-${group}-${from}-to-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <BarChart3 className="h-6 w-6 text-primary" /> Reports
        </h1>
        <p className="text-sm text-muted-foreground">Pick a metric, group it, export CSV.</p>
      </div>

      <div className="grid gap-2 rounded-xl border bg-card p-3 sm:grid-cols-4">
        <SimpleSelect ariaLabel="Metric" value={metric} onChange={setMetric} options={METRICS.map((m) => ({ label: m.label, value: m.value }))} />
        <SimpleSelect ariaLabel="Group by" value={group} onChange={setGroup} options={GROUPS.map((g) => ({ label: g.label, value: g.value }))} />
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From" />
        <div className="flex gap-2">
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To" />
          <Button size="sm" variant="outline" onClick={exportCsv}><Download className="h-4 w-4" /> CSV</Button>
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
