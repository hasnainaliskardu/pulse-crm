"use client";

import { useState } from "react";
import { toast } from "sonner";
import { BadgeDollarSign, Calculator, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SimpleSelect } from "@/components/ui/simple-select";
import { Badge } from "@/components/ui/badge";
import type { MemberRow, ClientRow, SalaryRow } from "@/types/supabase";

async function call(body: Record<string, unknown>) {
  const res = await fetch("/api/admin/money", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed");
  return data;
}

export default function MoneyClient({
  members,
  clients,
  salaries,
  settings,
}: {
  members: Array<Pick<MemberRow, "id" | "full_name" | "position" | "workspaces" | "salary_monthly" | "joining_date">>;
  clients: ClientRow[];
  salaries: SalaryRow[];
  settings: Record<string, string>;
}) {
  const [currency, setCurrency] = useState(settings.currency ?? "USD");
  const [rate, setRate] = useState(settings.usd_to_pkr ?? "280");
  const [teamPct, setTeamPct] = useState(settings.team_pct ?? "30");
  const [reservePct, setReservePct] = useState(settings.reserve_pct ?? "20");
  const [deliveryPct, setDeliveryPct] = useState(settings.delivery_pct ?? "40");
  const [busy, setBusy] = useState(false);

  const revenueThisMonth = clients
    .filter((c) => c.started_at >= new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10))
    .reduce((a, c) => a + c.monthly_revenue, 0);

  const teamShare = (revenueThisMonth * Number(teamPct)) / 100;
  const reserve = (revenueThisMonth * Number(reservePct)) / 100;
  const founderProfit = revenueThisMonth - teamShare - reserve;

  const deliveryMembers = members.filter((m) => (m.position ?? "").toLowerCase().includes("delivery"));
  const salesMembers = members.filter((m) => (m.position ?? "").toLowerCase().includes("sales"));
  const deliveryPool = (teamShare * Number(deliveryPct)) / 100;
  const salesPool = teamShare - deliveryPool;

  const fmt = (usd: number) => {
    if (currency === "PKR") return `Rs ${Math.round(usd * Number(rate)).toLocaleString()}`;
    if (currency === "USDT") return `${(usd * Number(rate) / Number(rate)).toFixed(2)} USDT`;
    return `$${usd.toLocaleString()}`;
  };

  async function save(key: string, value: string) {
    setBusy(true);
    try {
      await call({ action: "setSetting", key, value });
      toast.success("Saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function togglePaid(s: SalaryRow) {
    try {
      await call({ action: "toggleSalaryPaid", salaryId: s.id });
      toast.success(s.paid ? "Marked unpaid" : "Marked paid");
      window.location.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <BadgeDollarSign className="h-6 w-6 text-primary" /> Money
        </h1>
        <p className="text-sm text-muted-foreground">Currency, commission split, and salary tracking — founder only.</p>
      </div>

      {/* Currency */}
      <section className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Display currency</label>
          <SimpleSelect ariaLabel="Currency" value={currency} onChange={(v) => { setCurrency(v); save("currency", v); }} options={[
            { label: "USD ($)", value: "USD" },
            { label: "PKR (Rs)", value: "PKR" },
            { label: "USDT", value: "USDT" },
          ]} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">1 USD = ? PKR</label>
          <div className="flex gap-2">
            <Input type="number" value={rate} onChange={(e) => setRate(e.target.value)} />
            <Button size="sm" variant="outline" disabled={busy} onClick={() => save("usd_to_pkr", rate)}>Save</Button>
          </div>
        </div>
        <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
          Changing the rate instantly converts every money figure on this page into {currency}.
        </div>
      </section>

      {/* Revenue & split calculator */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Revenue this month</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-success">{fmt(revenueThisMonth)}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Team commission ({teamPct}%)</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-primary">{fmt(teamShare)}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Company reserve ({reservePct}%)</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-info">{fmt(reserve)}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Founder profit</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-warning">{fmt(founderProfit)}</p>
        </div>
      </section>

      <section className="flex flex-wrap items-end gap-4 rounded-xl border bg-card p-4">
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Team %</label>
          <div className="flex gap-2">
            <Input className="w-20" type="number" value={teamPct} onChange={(e) => setTeamPct(e.target.value)} />
            <Button size="sm" variant="outline" disabled={busy} onClick={() => save("team_pct", teamPct)}>Save</Button>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Reserve %</label>
          <div className="flex gap-2">
            <Input className="w-20" type="number" value={reservePct} onChange={(e) => setReservePct(e.target.value)} />
            <Button size="sm" variant="outline" disabled={busy} onClick={() => save("reserve_pct", reservePct)}>Save</Button>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Delivery share of team pool %</label>
          <div className="flex gap-2">
            <Input className="w-20" type="number" value={deliveryPct} onChange={(e) => setDeliveryPct(e.target.value)} />
            <Button size="sm" variant="outline" disabled={busy} onClick={() => save("delivery_pct", deliveryPct)}>Save</Button>
          </div>
        </div>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Calculator className="h-3.5 w-3.5" />
          Delivery pool: {fmt(deliveryPool / Math.max(1, deliveryMembers.length))} each · Sales pool: {fmt(salesPool / Math.max(1, salesMembers.length))} each
        </p>
      </section>

      {/* Salaries */}
      <section className="overflow-x-auto rounded-xl border bg-card">
        <div className="border-b bg-muted/40 px-4 py-2.5 text-sm font-semibold flex items-center gap-2">
          <Wallet className="h-4 w-4" /> Salary tracking — this month
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2">Member</th>
              <th className="px-3 py-2">Base salary</th>
              <th className="px-3 py-2">Commission</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => {
              const row = salaries.find((s) => s.member_id === m.id);
              return (
                <tr key={m.id} className="border-b last:border-0">
                  <td className="px-3 py-2.5">
                    <p className="font-medium">{m.full_name}</p>
                    <p className="text-xs text-muted-foreground">{m.position}</p>
                  </td>
                  <td className="px-3 py-2.5 tabular-nums">{fmt(m.salary_monthly ?? 0)}</td>
                  <td className="px-3 py-2.5 tabular-nums">
                    {m.position.toLowerCase().includes("delivery")
                      ? fmt(deliveryPool / Math.max(1, deliveryMembers.length))
                      : m.position.toLowerCase().includes("sales")
                        ? fmt(salesPool / Math.max(1, salesMembers.length))
                        : "—"}
                  </td>
                  <td className="px-3 py-2.5">
                    {row ? (
                      <Badge variant={row.paid ? "success" : "warning"}>{row.paid ? "Paid" : "Unpaid"}</Badge>
                    ) : (
                      <Badge variant="muted">Not generated</Badge>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    {row && (
                      <Button size="sm" variant={row.paid ? "outline" : "default"} onClick={() => togglePaid(row)}>
                        {row.paid ? "Unmark" : "Mark paid"}
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}
