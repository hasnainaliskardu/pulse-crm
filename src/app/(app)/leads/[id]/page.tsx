import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import LeadDetail from "./detail";
import type { MemberRow } from "@/types/supabase";

export const dynamic = "force-dynamic";

export default async function LeadPage({ params }: { params: { id: string } }) {
  const member = (await getSession()) as MemberRow;
  const supabase = createClient();
  const { data: members } = await supabase
    .from("members")
    .select("id, full_name")
    .eq("is_active", true)
    .order("full_name");

  return (
    <LeadDetail
      me={member}
      members={(members ?? []).map((m) => ({ id: m.id, full_name: m.full_name }))}
    />
  );
}
