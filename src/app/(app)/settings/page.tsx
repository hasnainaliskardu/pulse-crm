import { redirect } from "next/navigation";
import { getFounderSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import SettingsClient from "./settings-client";

export const metadata = { title: "Settings · HANA CRM" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const founder = await getFounderSession();
  if (founder.role !== "FOUNDER") redirect("/app");
  const supabase = createClient();

  const { data: setting } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "sheets_webhook_url")
    .maybeSingle();

  const { data: fields } = await supabase.from("custom_fields").select("*").order("created_at");
  const { data: rules } = await supabase.from("workflow_rules").select("*").order("created_at");

  return (
    <SettingsClient
      webhookUrl={setting?.value ?? ""}
      customFields={fields ?? []}
      rules={rules ?? []}
    />
  );
}
