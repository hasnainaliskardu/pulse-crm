import { notFound, redirect } from "next/navigation";
import { getFounderSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import MemberDetailClient from "./detail-client";

export const metadata = { title: "Member · HANA CRM" };
export const dynamic = "force-dynamic";

export default async function MemberDetailPage({ params }: { params: { id: string } }) {
  const founder = await getFounderSession();
  if (founder.role !== "FOUNDER") redirect("/app");
  const supabase = createClient();

  const { data: member } = await supabase.from("members").select("*").eq("id", params.id).maybeSingle();
  if (!member) notFound();

  const from14 = new Date(Date.now() - 13 * 864e5).toISOString().slice(0, 10);
  const [stats, workload, activity] = await Promise.all([
    supabase.from("daily_stats").select("*").eq("member_id", params.id).gte("date", from14).order("date"),
    supabase.from("leads").select("id, status", { count: "exact" }).eq("assigned_to", params.id),
    supabase.from("activity_log").select("id, action, entity, entity_id, member_id, detail, created_at").eq("member_id", params.id).order("created_at", { ascending: false }).limit(15),
  ]);

  return (
    <MemberDetailClient
      member={member}
      stats={stats.data ?? []}
      workloadCount={workload.count ?? 0}
      activity={activity.data ?? []}
    />
  );
}
