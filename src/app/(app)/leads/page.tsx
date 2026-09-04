import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import LeadsWorkspace from "./leads-client";

export const metadata = { title: "Leads · HANA CRM" };
export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  const member = await getSession();
  const supabase = createClient();
  const { data: members } = await supabase
    .from("members")
    .select("id, full_name")
    .eq("is_active", true)
    .order("full_name");

  return (
    <LeadsWorkspace
      isFounder={member.role === "FOUNDER"}
      myId={member.id}
      members={(members ?? []).map((m) => ({ id: m.id, full_name: m.full_name }))}
    />
  );
}
