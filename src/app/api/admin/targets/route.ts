import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const member = await getSession();
  if (member.role !== "FOUNDER") return NextResponse.json({ error: "Founder only" }, { status: 403 });
  const supabase = createClient();
  const body = await request.json();

  switch (body.action) {
    case "setMemberTargets": {
      const { error } = await supabase
        .from("members")
        .update({
          daily_research_target: Number(body.dailyResearchTarget) || 0,
          daily_touch_target: Number(body.dailyTouchTarget) || 0,
        } as never)
        .eq("id", body.memberId);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ ok: true });
    }
    case "setTeamTarget": {
      const { error } = await supabase
        .from("targets")
        .upsert(
          { member_id: null, period: body.period, metric: body.metric, value: Number(body.value) || 0 } as never,
          { onConflict: "member_id, period, metric" }
        );
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ ok: true });
    }
    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
}
