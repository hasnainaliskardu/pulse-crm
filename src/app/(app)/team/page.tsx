import { redirect } from "next/navigation";
import { getFounderSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import TeamClient from "./team-client";

export const metadata = { title: "Team · HANA CRM" };
export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const founder = await getFounderSession();
  if (founder.role !== "FOUNDER") redirect("/app");
  const supabase = createClient();
  const { data: members } = await supabase
    .from("members")
    .select("*")
    .order("created_at", { ascending: true });
  return <TeamClient members={members ?? []} />;
}
