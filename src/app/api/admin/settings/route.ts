import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const member = await getSession();
  if (member.role !== "FOUNDER") return NextResponse.json({ error: "Founder only" }, { status: 403 });
  const supabase = createClient();
  const body = await request.json();

  switch (body.action) {
    case "addCustomField": {
      const key = String(body.key || body.label || "").toLowerCase().replace(/[^a-z0-9_]/g, "_");
      const { error } = await supabase.from("custom_fields").insert({
        entity: body.entity ?? "LEAD",
        key,
        label: body.label,
        type: body.type ?? "TEXT",
        options: body.type === "SELECT" && body.options ? String(body.options).split(",").map((s: string) => s.trim()) : [],
      } as never);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      await logActivity({ memberId: member.id, action: "CREATE", entity: "CUSTOM_FIELD", detail: { key, label: body.label } });
      return NextResponse.json({ ok: true });
    }
    case "deleteCustomField": {
      const { error } = await supabase.from("custom_fields").delete().eq("id", body.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      await logActivity({ memberId: member.id, action: "DELETE", entity: "CUSTOM_FIELD", entityId: body.id });
      return NextResponse.json({ ok: true });
    }
    case "saveRule": {
      const row = {
        name: body.name,
        enabled: body.enabled ?? true,
        trigger_entity: "LEAD",
        trigger_event: body.triggerEvent ?? "STATUS_CHANGE",
        trigger_value: body.triggerValue ?? null,
        action_type: body.actionType,
        action_config: {
          taskTitle: body.taskTitle ?? null,
          dueInDays: Number(body.dueInDays) || 1,
          field: body.field ?? null,
          value: body.value ?? null,
        },
      };
      if (body.id) {
        const { error } = await supabase.from("workflow_rules").update(row as never).eq("id", body.id);
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      } else {
        const { error } = await supabase.from("workflow_rules").insert(row as never);
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      }
      await logActivity({ memberId: member.id, action: body.id ? "UPDATE" : "CREATE", entity: "WORKFLOW_RULE", detail: { name: body.name } });
      return NextResponse.json({ ok: true });
    }
    case "toggleRule": {
      const { error } = await supabase.from("workflow_rules").update({ enabled: body.enabled } as never).eq("id", body.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ ok: true });
    }
    case "deleteRule": {
      const { error } = await supabase.from("workflow_rules").delete().eq("id", body.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      await logActivity({ memberId: member.id, action: "DELETE", entity: "WORKFLOW_RULE", entityId: body.id });
      return NextResponse.json({ ok: true });
    }
    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
}
