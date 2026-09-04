import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { logActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const member = await getSession();
  const supabase = createClient();

  const fd = await request.formData();
  const file = fd.get("file") as File | null;
  const leadId = String(fd.get("leadId") ?? "");
  if (!file || !leadId) return NextResponse.json({ error: "Missing file or lead" }, { status: 400 });

  const ext = file.name.split(".").pop() ?? "bin";
  const path = `${leadId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from("lead-files")
    .upload(path, await file.arrayBuffer(), { contentType: file.type || "application/octet-stream" });
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 });

  const { data, error } = await supabase
    .from("files")
    .insert({
      lead_id: leadId,
      uploaded_by: member.id,
      storage_path: path,
      file_name: file.name,
      mime_type: file.type,
      size_bytes: file.size,
    })
    .select("id, file_name")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await logActivity({ memberId: member.id, action: "UPLOAD_FILE", entity: "FILE", entityId: data.id, detail: { file_name: file.name, lead_id: leadId } });
  return NextResponse.json({ ok: true, file: data });
}

export async function GET(request: Request) {
  await getSession();
  const supabase = createClient();
  const url = new URL(request.url);
  const leadId = url.searchParams.get("leadId");
  if (!leadId) return NextResponse.json({ files: [] });
  const { data } = await supabase
    .from("files")
    .select("id, file_name")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false });
  return NextResponse.json({ files: data ?? [] });
}
