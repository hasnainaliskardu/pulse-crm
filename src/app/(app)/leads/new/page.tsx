import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import NewLeadClient from "./new-client";

export const metadata = { title: "Add Lead · HANA CRM" };
export const dynamic = "force-dynamic";

export default async function NewLeadPage() {
  const member = await getSession();
  const supabase = createClient();
  const { data: members } = await supabase
    .from("members")
    .select("id, full_name")
    .eq("is_active", true)
    .order("full_name");

  return (
    <NewLeadClient
      meId={member.id}
      isFounder={member.role === "FOUNDER"}
      members={(members ?? []).map((m) => ({ id: m.id, full_name: m.full_name }))}
    />
  );
}
