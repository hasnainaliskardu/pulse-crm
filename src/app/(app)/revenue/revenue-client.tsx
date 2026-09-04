"use client";

import { useState } from "react";
import { toast } from "sonner";
import { DollarSign, Handshake, Plus, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SimpleSelect } from "@/components/ui/simple-select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { ClientRow, DailyStatRow, MemberRow } from "@/types/supabase";

const usd = (n: number) => `$${new Intl.NumberFormat("en-US").format(n)}`;

export default function RevenueClient({
  clients,
  members,
  monthStats,
  monthClientsTarget,
}: {
  clients: ClientRow[];
  members: Array<Pick<MemberRow, "id" | "full_name" | "is_active" | "daily_touch_target" | "points">>;
  monthStats: DailyStatRow[];
  monthClientsTarget: number;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const [businessName, setBusinessName] = useState("");
  const [closedBy, setClosedBy] = useState("");
  const [monthlyRevenue, setMonthlyRevenue] = useState("");
  const [startedAt, setStartedAt] = useState(new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState("ACTIVE");
  const [notes, setNotes] = useState("");

  const active = clients.filter((c) => c.status === "ACTIVE");
  const mrr = active.reduce((a, c) => a + c.monthly_revenue, 0);
  const totalCollected = clients.reduce((a, c) => a + c.monthly_revenue, 0);

  // commission pool: 30% of first-month revenue of each closed client
  const pool = clients.reduce((a, c) => a + Math.round(c.monthly_revenue * 0.3), 0);
  const equalShare = pool * 0.25;
  const bonusShare = pool * 0.05;

  // eligible: active members with ≥80% monthly target (touches)
  const daysElapsed = new Date().getDate();
  const eligible = members.filter((m) => {
    const monthTouches = monthStats.filter((s) => s.member_id === m.id).reduce((a, s) => a + s.touches_sent, 0);
    const monthTarget = m.daily_touch_target * daysElapsed;
    return monthTarget > 0 && monthTouches / monthTarget >= 0.8;
  });
  const perMember = eligible.length ? equalShare / eligible.length : 0;
  const topPerformer = [...members].sort((a, b) => {
    const pts = (id: string) => monthStats.filter((s) => s.member_id === id).reduce((a, s) => a + s.touches_sent + s.replies_received * 5 + s.positive_replies * 10 + s.calls_booked * 20, 0);
    return pts(b.id) - pts(a.id);
  })[0];

  const nameOf = (id: string | null) => members.find((m) => m.id === id)?.full_name ?? "—";

  function openCreate() {
    setEditId(null);
    setBusinessName(""); setClosedBy(""); setMonthlyRevenue(""); setStartedAt(new Date().toISOString().slice(0, 10)); setStatus("ACTIVE"); setNotes("");
    setOpen(true);
  }

  function openEdit(c: ClientRow) {
    setEditId(c.id);
    setBusinessName(c.business_name); setClosedBy(c.closed_by ?? ""); setMonthlyRevenue(String(c.monthly_revenue)); setStartedAt(c.started_at); setStatus(c.status); setNotes(c.notes ?? "");
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch("/api/admin/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "upsertClient",
          id: editId,
          businessName,
          closedBy,
          monthlyRevenue: Number(monthlyRevenue) || 0,
          startedAt,
          status,
          notes,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success(editId ? "Client updated" : "Client added");
      setOpen(false);
      window.location.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Revenue &amp; Commissions</h1>
          <p className="text-sm text-muted-foreground">Clients, MRR, and the monthly commission pool split.</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4" /> Add Client</Button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Active Clients</p>
          <p className="text-2xl font-bold tabular-nums">{active.length}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">MRR</p>
          <p className="text-2xl font-bold tabular-nums text-success">{usd(mrr)}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Total Collected (all-time)</p>
          <p className="text-2xl font-bold tabular-nums">{usd(totalCollected)}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Commission Pool (30%)</p>
          <p className="text-2xl font-bold tabular-nums text-primary">{usd(pool)}</p>
        </div>
      </div>

      {/* Commission split */}
      <section className="rounded-xl border bg-card">
        <div className="border-b bg-muted/40 px-4 py-2 text-sm font-semibold">This month&apos;s split — 25% equal share (≥80% target) + 5% top performer</div>
        <div className="divide-y">
          <div className="flex items-center justify-between p-3 text-sm">
            <span className="flex items-center gap-2"><Handshake className="h-4 w-4 text-muted-foreground" /> Equal share — {eligible.length} eligible member{eligible.length === 1 ? "" : "s"}</span>
            <span className="font-semibold">{usd(equalShare)} total</span>
          </div>
          {eligible.map((m) => (
            <div key={m.id} className="flex items-center justify-between p-3 pl-8 text-sm">
              <span>{m.full_name}</span>
              <span className="font-semibold tabular-nums">{usd(perMember)}</span>
            </div>
          ))}
          {eligible.length === 0 && <p className="p-3 pl-8 text-xs text-muted-foreground">No members at ≥80% of monthly target yet.</p>}
          <div className="flex items-center justify-between p-3 text-sm">
            <span className="flex items-center gap-2"><TrendingUp className="h-4 w-4 text-warning" /> #1 performer bonus — {topPerformer?.full_name ?? "—"}</span>
            <span className="font-semibold tabular-nums">{usd(bonusShare)}</span>
          </div>
        </div>
      </section>

      {/* Clients table */}
      <section className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2.5">Business</th>
              <th className="px-3 py-2.5">Closed by</th>
              <th className="px-3 py-2.5">Monthly</th>
              <th className="px-3 py-2.5">Started</th>
              <th className="px-3 py-2.5">Status</th>
              <th className="px-3 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {clients.map((c) => (
              <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30">
                <td className="px-3 py-2.5 font-medium">{c.business_name}</td>
                <td className="px-3 py-2.5">{nameOf(c.closed_by)}</td>
                <td className="px-3 py-2.5 tabular-nums">{usd(c.monthly_revenue)}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{c.started_at}</td>
                <td className="px-3 py-2.5">
                  <Badge variant={c.status === "ACTIVE" ? "success" : "destructive"}>{c.status}</Badge>
                </td>
                <td className="px-3 py-2.5">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(c)}>Edit</Button>
                </td>
              </tr>
            ))}
            {clients.length === 0 && (
              <tr><td colSpan={6} className="py-10 text-center text-sm text-muted-foreground">No clients yet — close your first WON lead.</td></tr>
            )}
          </tbody>
        </table>
      </section>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editId ? "Edit client" : "Add client"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={save} className="space-y-3">
            <Input value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Business name" required />
            <SimpleSelect ariaLabel="Closed by" value={closedBy} placeholder="Closed by" onChange={setClosedBy} options={members.map((m) => ({ label: m.full_name, value: m.id }))} />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Monthly revenue ($)</label>
                <Input type="number" value={monthlyRevenue} onChange={(e) => setMonthlyRevenue(e.target.value)} min={0} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Started</label>
                <Input type="date" value={startedAt} onChange={(e) => setStartedAt(e.target.value)} />
              </div>
            </div>
            <SimpleSelect ariaLabel="Status" value={status} onChange={setStatus} options={[{ label: "Active", value: "ACTIVE" }, { label: "Churned", value: "CHURNED" }]} />
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional)" rows={2} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={busy}><DollarSign className="h-4 w-4" /> Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
