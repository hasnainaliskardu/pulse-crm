import { redirect } from "next/navigation";
import { getFounderSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import RevenueClient from "./revenue-client";

export const metadata = { title: "Revenue · HANA CRM" };
export const dynamic = "force-dynamic";

export default async function RevenuePage() {
  const founder = await getFounderSession();
  if (founder.role !== "FOUNDER") redirect("/app");
  const supabase = createClient();

  const [clients, members, monthStats, teamTargets] = await Promise.all([
    supabase.from("clients").select("*").order("started_at", { ascending: false }),
    supabase.from("members").select("id, full_name, is_active, daily_touch_target, points").eq("is_active", true),
    supabase.from("daily_stats").select("*").gte("date", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)),
    supabase.from("targets").select("*").eq("period", "MONTHLY"),
  ]);

  return (
    <RevenueClient
      clients={clients.data ?? []}
      members={members.data ?? []}
      monthStats={monthStats.data ?? []}
      monthClientsTarget={teamTargets.data?.find((t) => t.metric === "clients_closed")?.value ?? 5}
    />
  );
}
