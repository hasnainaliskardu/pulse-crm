import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import type { Database } from "@/types/supabase";

export const dynamic = "force-dynamic";

type Builder = ReturnType<Database["public"]["Tables"]["leads"] extends never ? never : never>;

export async function GET(request: Request) {
  const member = await getSession();
  const supabase = createClient();
  const url = new URL(request.url);

  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = 50;
  const from = (page - 1) * pageSize;

  const status = url.searchParams.get("status");
  const website = url.searchParams.get("website");
  const source = url.searchParams.get("source");
  const assigned = url.searchParams.get("assigned");
  const city = url.searchParams.get("city");
  const q = url.searchParams.get("q")?.trim();
  const from_ = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const sort = url.searchParams.get("sort") ?? "newest";
  const mine = url.searchParams.get("mine");

  // filters applied to both queries via a plain function on `any` builder
  const apply = (q: any) => {
    if (status) q = q.eq("status", status);
    if (website) q = q.eq("website_status", website);
    if (source) q = q.eq("source", source);
    if (assigned === "unassigned") q = q.is("assigned_to", null);
    else if (assigned) q = q.eq("assigned_to", assigned);
    if (city) q = q.ilike("city", `%${city}%`);
    if (q) {
      const like = `%${q}%`;
      q = q.or(`business_name.ilike.${like},owner_name.ilike.${like},owner_email.ilike.${like},owner_phone.ilike.${like},website_url.ilike.${like}`);
    }
    if (from_) q = q.gte("created_at", `${from_}T00:00:00.000Z`);
    if (to) q = q.lte("created_at", `${to}T23:59:59.999Z`);
    if (mine === "1") q = q.eq("assigned_to", member.id);
    return q;
  };

  const [dataRes, countRes] = await Promise.all([
    apply(supabase.from("leads").select("*").range(from, from + pageSize - 1))
      .order(sort === "activity" ? "last_activity_at" : "created_at", { ascending: false }),
    apply(supabase.from("leads").select("id", { count: "exact", head: true })),
  ]);

  if (dataRes.error) {
    return NextResponse.json({ error: dataRes.error.message }, { status: 500 });
  }

  return NextResponse.json({ leads: dataRes.data ?? [], count: countRes.count ?? 0, page });
}
