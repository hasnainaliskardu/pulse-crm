import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const { email, password } = await request.json();
  const supabase = createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    return NextResponse.json(
      { error: "Invalid email or password" },
      { status: 401 }
    );
  }

  const { data: member } = await supabase
    .from("members")
    .select("id, is_active, role")
    .eq("id", data.user.id)
    .maybeSingle();

  if (!member || !member.is_active) {
    await supabase.auth.signOut();
    return NextResponse.json(
      { error: "Account deactivated. Contact the founder." },
      { status: 403 }
    );
  }

  return NextResponse.json({ ok: true });
}
