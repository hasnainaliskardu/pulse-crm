import { NextResponse } from "next/server";
import { getFounderSession } from "@/lib/auth";
import { getFounderDashboard } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const member = await getFounderSession();
    if (member.role !== "FOUNDER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const data = await getFounderDashboard();
    return NextResponse.json({ kpis: data.kpis, recentTouches: data.recentTouches });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
