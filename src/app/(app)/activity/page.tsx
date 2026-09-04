import { redirect } from "next/navigation";
import { getFounderSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import ActivityClient from "./activity-client";

export const metadata = { title: "Activity Log · HANA CRM" };
export const dynamic = "force-dynamic";

export default async function ActivityPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const founder = await getFounderSession();
  if (founder.role !== "FOUNDER") redirect("/app");
  const supabase = createClient();

  const page = Math.max(1, parseInt(String(searchParams.page ?? "1"), 10) || 1);
  const pageSize = 50;
  const member = String(searchParams.member ?? "");
  const action = String(searchParams.action ?? "");

  let q = supabase
    .from("activity_log")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);
  if (member) q = q.eq("member_id", member);
  if (action) q = q.eq("action", action);

  const [{ data: logs, count }, { data: members }] = await Promise.all([
    q,
    supabase.from("members").select("id, full_name"),
  ]);

  return (
    <ActivityClient
      logs={logs ?? []}
      members={members ?? []}
      total={count ?? 0}
      page={page}
      pageSize={pageSize}
      member={member}
      action={action}
    />
  );
}
