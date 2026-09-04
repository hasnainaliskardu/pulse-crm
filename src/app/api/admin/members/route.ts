import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase/admin";
import { createMember, updateMember, resetMemberPassword } from "@/lib/actions/members";
import type { Workspace } from "@/types/supabase";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const member = await getSession();
  if (member.role !== "FOUNDER") {
    return NextResponse.json({ error: "Founder only" }, { status: 403 });
  }

  const body = await request.json();

  switch (body.action) {
    case "createMember": {
      const res = await createMember(member.id, {
        fullName: body.fullName,
        email: body.email,
        position: body.position,
        password: body.password,
        dailyResearchTarget: Number(body.dailyResearchTarget) || 40,
        dailyTouchTarget: Number(body.dailyTouchTarget) || 45,
        workspaces: Array.isArray(body.workspaces) && body.workspaces.length ? body.workspaces : ["INTL"],
        joiningDate: body.joiningDate || null,
        salaryMonthly: Number(body.salaryMonthly) || 0,
      });
      if ("error" in res && res.error) return NextResponse.json(res, { status: 400 });
      return NextResponse.json({ ok: true });
    }
    case "updateMember": {
      const res = await updateMember(member.id, body.memberId, {
        full_name: body.fullName,
        position: body.position,
        is_active: body.isActive,
        daily_research_target: body.dailyResearchTarget !== undefined ? Number(body.dailyResearchTarget) : undefined,
        daily_touch_target: body.dailyTouchTarget !== undefined ? Number(body.dailyTouchTarget) : undefined,
        workspaces: Array.isArray(body.workspaces) ? (body.workspaces as Workspace[]) : undefined,
        joining_date: body.joiningDate !== undefined ? (body.joiningDate || null) : undefined,
        salary_monthly: body.salaryMonthly !== undefined ? Number(body.salaryMonthly) : undefined,
      });
      if ("error" in res && res.error) return NextResponse.json(res, { status: 400 });
      return NextResponse.json({ ok: true });
    }
    case "resetPassword": {
      const res = await resetMemberPassword(member.id, body.memberId, body.newPassword);
      if ("error" in res && res.error) return NextResponse.json(res, { status: 400 });
      return NextResponse.json({ ok: true });
    }
    case "hardDeleteAuth": {
      // full removal incl. auth user (typed confirmation done client-side)
      const admin = getAdminClient();
      const { error } = await admin.auth.admin.deleteUser(body.memberId);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ ok: true });
    }
    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
}
