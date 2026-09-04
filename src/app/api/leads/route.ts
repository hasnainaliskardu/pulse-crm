import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  createLead,
  updateLead,
  deleteLead,
  bulkImportLeads,
  logTouch,
  LeadInput,
} from "@/lib/actions/leads";

export const dynamic = "force-dynamic";

type Action =
  | { action: "create"; lead: LeadInput }
  | { action: "update"; leadId: string; patch: Record<string, unknown> }
  | { action: "delete"; leadId: string }
  | { action: "bulkImport"; rows: LeadInput[]; mode: "skip" | "allow" }
  | { action: "logTouch"; touch: Parameters<typeof logTouch>[1] }
  | { action: "bulkStatus"; leadIds: string[]; status: string }
  | { action: "bulkAssign"; leadIds: string[]; memberId: string | null };

export async function POST(request: Request) {
  const member = await getSession();
  const body = (await request.json()) as Action;

  switch (body.action) {
    case "create": {
      const res = await createLead(member.id, body.lead);
      if ("error" in res && res.error) return NextResponse.json(res, { status: 400 });
      return NextResponse.json(res);
    }
    case "update": {
      const res = await updateLead(member.id, body.leadId, body.patch);
      if ("error" in res && res.error) return NextResponse.json(res, { status: 400 });
      return NextResponse.json(res);
    }
    case "delete": {
      if (member.role !== "FOUNDER") {
        return NextResponse.json({ error: "Only the founder can delete leads" }, { status: 403 });
      }
      const res = await deleteLead(member.id, body.leadId);
      if ("error" in res && res.error) return NextResponse.json(res, { status: 400 });
      return NextResponse.json(res);
    }
    case "bulkImport": {
      const res = await bulkImportLeads(member.id, body.rows, body.mode);
      return NextResponse.json(res);
    }
    case "logTouch": {
      const res = await logTouch(member.id, body.touch);
      if ("error" in res && res.error) return NextResponse.json(res, { status: 400 });
      return NextResponse.json(res);
    }
    case "bulkStatus": {
      const { createClient } = await import("@/lib/supabase/server");
      const supabase = createClient();
      const { error } = await supabase
        .from("leads")
        .update({ status: body.status } as never)
        .in("id", body.leadIds);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ ok: true });
    }
    case "bulkAssign": {
      const { createClient } = await import("@/lib/supabase/server");
      const supabase = createClient();
      const { error } = await supabase
        .from("leads")
        .update({ assigned_to: body.memberId } as never)
        .in("id", body.leadIds);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ ok: true });
    }
    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
}
