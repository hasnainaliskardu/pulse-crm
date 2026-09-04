import { getFounderSession, getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import CallsDashboard from "./calls-dashboard";

export const metadata = { title: "Call Center · Pulse CRM" };
export const dynamic = "force-dynamic";

export default async function CallsPage() {
  const me = await getSession();
  const supabase = createClient();

  const { data: members } = await supabase
    .from("members")
    .select("id, full_name, position, is_active, points, workspaces")
    .eq("is_active", true)
    .order("full_name");

  const callsTeam = (members ?? []).filter((m) => (m.workspaces ?? ["INTL"]).includes("CALLS"));
  const canSeeAll = me.role === "FOUNDER";

  return (
    <CallsDashboard
      me={{ id: me.id, name: me.full_name, isFounder: canSeeAll }}
      members={callsTeam.map((m) => ({ id: m.id, name: m.full_name, position: m.position }))}
    />
  );
}
