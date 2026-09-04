import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { email, password } = await request.json();

  // If Supabase env is not configured, respond with a clear setup message.
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_URL.includes("placeholder")
  ) {
    return NextResponse.json(
      { error: "Setup incomplete — Supabase is not connected yet. The founder must finish the Supabase setup first." },
      { status: 503 }
    );
  }

  try {
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
  } catch {
    return NextResponse.json(
      { error: "Login failed — check that the Supabase project is running and migrations have been run." },
      { status: 500 }
    );
  }
}
