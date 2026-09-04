import { redirect } from "next/navigation";
import { getFounderSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import TargetsClient from "./targets-client";

export const metadata = { title: "Targets · HANA CRM" };
export const dynamic = "force-dynamic";

export default async function TargetsPage() {
  const founder = await getFounderSession();
  if (founder.role !== "FOUNDER") redirect("/app");
  const supabase = createClient();

  const { data: members } = await supabase
    .from("members")
    .select("id, full_name, position, daily_research_target, daily_touch_target, points")
    .eq("is_active", true)
    .order("full_name");

  const today = new Date().toISOString().slice(0, 10);
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);

  const [todayStats, monthStats, teamTargets, clients] = await Promise.all([
    supabase.from("daily_stats").select("*").eq("date", today),
    supabase.from("daily_stats").select("*").gte("date", monthStart),
    supabase.from("targets").select("*"),
    supabase.from("clients").select("*").gte("started_at", monthStart),
  ]);

  return (
    <TargetsClient
      members={members ?? []}
      todayStats={todayStats.data ?? []}
      monthStats={monthStats.data ?? []}
      teamTargets={teamTargets.data ?? []}
      monthClientsClosed={(clients.data ?? []).length}
    />
  );
}
