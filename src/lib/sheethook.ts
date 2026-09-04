import "server-only";
import { getAdminClient } from "@/lib/supabase/admin";

/** Fire-and-forget Google Sheet sync. Never throws. Retries once. */
export async function syncToSheets(payload: Record<string, unknown>) {
  const url =
    process.env.SHEETS_WEBHOOK_URL || (await getSheetsWebhookFromDb());
  if (!url) return;

  const body = JSON.stringify(payload);
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (res.ok) return;
    } catch {
      // retry once
    }
  }
  // silent fail by design
}

async function getSheetsWebhookFromDb(): Promise<string> {
  try {
    const admin = getAdminClient();
    const { data } = await admin
      .from("settings")
      .select("value")
      .eq("key", "sheets_webhook_url")
      .maybeSingle();
    return data?.value ?? "";
  } catch {
    return "";
  }
}
