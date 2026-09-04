import { redirect } from "next/navigation";
import { getFounderSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import MoneyClient from "./money-client";

export const metadata = { title: "Money · Pulse CRM" };
export const dynamic = "force-dynamic";

export default async function MoneyPage() {
  const founder = await getFounderSession();
  if (founder.role !== "FOUNDER") redirect("/app");
  const supabase = createClient();

  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
  const [settingsRows, members, clients, salaries] = await Promise.all([
    supabase.from("settings").select("key, value"),
    supabase.from("members").select("id, full_name, position, workspaces, salary_monthly, joining_date").eq("is_active", true).order("full_name"),
    supabase.from("clients").select("*"),
    supabase.from("salaries").select("*").gte("month", monthStart),
  ]);

  const settings: Record<string, string> = {};
  for (const s of settingsRows.data ?? []) settings[s.key] = s.value;

  return (
    <MoneyClient
      members={members.data ?? []}
      clients={clients.data ?? []}
      salaries={salaries.data ?? []}
      settings={settings}
    />
  );
}
