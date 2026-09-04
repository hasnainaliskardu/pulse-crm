import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import AttendanceClient from "./attendance-client";

export const metadata = { title: "Attendance · Pulse CRM" };
export const dynamic = "force-dynamic";

export default async function AttendancePage() {
  const me = await getSession();
  const supabase = createClient();

  const from = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
  const [members, records] = await Promise.all([
    supabase.from("members").select("id, full_name, position, workspaces, joining_date").eq("is_active", true).order("full_name"),
    supabase.from("attendance").select("*").gte("date", from).order("date", { ascending: false }),
  ]);

  return (
    <AttendanceClient
      meId={me.id}
      isFounder={me.role === "FOUNDER"}
      members={members.data ?? []}
      records={records.data ?? []}
    />
  );
}
