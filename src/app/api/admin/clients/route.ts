import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { logActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const member = await getSession();
  if (member.role !== "FOUNDER") return NextResponse.json({ error: "Founder only" }, { status: 403 });
  const supabase = createClient();
  const body = await request.json();

  switch (body.action) {
    case "upsertClient": {
      const row = {
        business_name: body.businessName,
        closed_by: body.closedBy || null,
        monthly_revenue: Number(body.monthlyRevenue) || 0,
        started_at: body.startedAt || new Date().toISOString().slice(0, 10),
        status: body.status ?? "ACTIVE",
        notes: body.notes || null,
      };
      if (body.id) {
        const { error } = await supabase.from("clients").update(row as never).eq("id", body.id);
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        await logActivity({ memberId: member.id, action: "UPDATE", entity: "CLIENT", entityId: body.id, detail: row });
      } else {
        const { data, error } = await supabase.from("clients").insert(row as never).select("id").single();
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        await logActivity({ memberId: member.id, action: "CREATE", entity: "CLIENT", entityId: data.id, detail: row });
      }
      return NextResponse.json({ ok: true });
    }
    case "setWebhook": {
      const admin = getAdminClient();
      const { error } = await admin.from("settings").upsert({ key: "sheets_webhook_url", value: body.url ?? "" } as never);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      await logActivity({ memberId: member.id, action: "UPDATE", entity: "SETTINGS", detail: { key: "sheets_webhook_url" } });
      return NextResponse.json({ ok: true });
    }
    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
}
