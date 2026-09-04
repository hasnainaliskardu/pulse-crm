import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { logActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";

function authorized(request: Request) {
  const key = process.env.API_KEY;
  if (!key) return false;
  const header = request.headers.get("authorization") ?? "";
  return header === `Bearer ${key}`;
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = getAdminClient();
  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const q = url.searchParams.get("q");
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);

  let query = admin.from("leads").select("*").range((page - 1) * 50, page * 50 - 1);
  if (status) query = query.eq("status", status as never);
  if (q) query = query.ilike("business_name", `%${q}%`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ leads: data, page });
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = getAdminClient();
  const body = await request.json();
  if (!body.business_name) return NextResponse.json({ error: "business_name required" }, { status: 400 });

  const { data, error } = await admin.from("leads").insert(body as never).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await logActivity({ memberId: null, action: "API_CREATE", entity: "LEAD", entityId: data.id, detail: { via: "api-key" } });
  return NextResponse.json({ lead: data });
}

export async function PATCH(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = getAdminClient();
  const body = await request.json();
  const id = body.id;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { data, error } = await admin.from("leads").update(body as never).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await logActivity({ memberId: null, action: "API_UPDATE", entity: "LEAD", entityId: id, detail: { changed: Object.keys(body) } });
  return NextResponse.json({ lead: data });
}

export async function DELETE(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = getAdminClient();
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { error } = await admin.from("leads").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await logActivity({ memberId: null, action: "API_DELETE", entity: "LEAD", entityId: id });
  return NextResponse.json({ ok: true });
}
