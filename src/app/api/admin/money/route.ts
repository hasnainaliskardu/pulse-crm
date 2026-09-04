import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const me = await getSession();
  if (me.role !== "FOUNDER") return NextResponse.json({ error: "Founder only" }, { status: 403 });
  const admin = getAdminClient();
  const supabase = createClient();
  const body = await request.json();

  switch (body.action) {
    case "setSetting": {
      const { error } = await admin.from("settings").upsert({ key: body.key, value: String(body.value ?? "") } as never);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      await logActivity({ memberId: me.id, action: "UPDATE", entity: "SETTINGS", detail: { key: body.key } });
      return NextResponse.json({ ok: true });
    }
    case "setMemberMeta": {
      // workspaces, joining date, salary
      const patch: Record<string, unknown> = {};
      if (body.workspaces !== undefined) patch.workspaces = body.workspaces;
      if (body.joiningDate !== undefined) patch.joining_date = body.joiningDate || null;
      if (body.salaryMonthly !== undefined) patch.salary_monthly = Number(body.salaryMonthly) || 0;
      const { error } = await admin.from("members").update(patch as never).eq("id", body.memberId);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      await logActivity({ memberId: me.id, action: "UPDATE", entity: "MEMBER", entityId: body.memberId, detail: patch });
      return NextResponse.json({ ok: true });
    }
    case "upsertSalary": {
      const month = body.month ?? new Date().toISOString().slice(0, 7) + "-01";
      const { error } = await supabase.from("salaries").upsert(
        {
          member_id: body.memberId,
          month,
          base_amount: Number(body.baseAmount) || 0,
          commission_amount: Number(body.commissionAmount) || 0,
          paid: !!body.paid,
          paid_at: body.paid ? new Date().toISOString() : null,
          notes: body.notes ?? null,
        } as never,
        { onConflict: "member_id, month" }
      );
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ ok: true });
    }
    case "toggleSalaryPaid": {
      const { data: s } = await supabase.from("salaries").select("id, paid").eq("id", body.salaryId).maybeSingle();
      if (!s) return NextResponse.json({ error: "Salary row not found" }, { status: 404 });
      const { error } = await supabase
        .from("salaries")
        .update({ paid: !s.paid, paid_at: !s.paid ? new Date().toISOString() : null } as never)
        .eq("id", body.salaryId);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      await logActivity({ memberId: me.id, action: s.paid ? "UNMARK_PAID" : "MARK_PAID", entity: "SALARY", entityId: body.salaryId });
      return NextResponse.json({ ok: true });
    }
    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
}
