import { redirect } from "next/navigation";
import { getFounderSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import ReportsClient from "./reports-client";

export const metadata = { title: "Reports · Pulse CRM" };
export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const founder = await getFounderSession();
  if (founder.role !== "FOUNDER") redirect("/app");
  const supabase = createClient();

  const from = new Date(Date.now() - 365 * 864e5).toISOString().slice(0, 10);
  const [{ data: leads }, { data: touches }, { data: stats }, { data: members }, { data: meetings }, { data: attendance }, { data: clients }] = await Promise.all([
    supabase.from("leads").select("id, city, status, source, created_at").gte("created_at", `${from}T00:00:00.000Z`),
    supabase.from("touches").select("id, channel, direction, member_id, outcome, occurred_at").gte("occurred_at", `${from}T00:00:00.000Z`),
    supabase.from("daily_stats").select("*").gte("date", from),
    supabase.from("members").select("id, full_name").eq("is_active", true),
    supabase.from("meetings").select("id, scheduled_at, status").gte("scheduled_at", `${from}T00:00:00.000Z`),
    supabase.from("attendance").select("member_id, date, status").gte("date", from),
    supabase.from("clients").select("id, business_name, monthly_revenue, started_at, status"),
  ]);

  return (
    <ReportsClient
      leads={leads ?? []}
      touches={touches ?? []}
      stats={stats ?? []}
      members={members ?? []}
      meetings={meetings ?? []}
      attendance={attendance ?? []}
      clients={clients ?? []}
    />
  );
}
