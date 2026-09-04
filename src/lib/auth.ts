import "server-only";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { Database } from "@/types/supabase";

type Member = Database["public"]["Tables"]["members"]["Row"];

export async function getSession() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: member } = await supabase
    .from("members")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!member || !member.is_active) {
    redirect("/login");
  }
  return member as Member;
}

export async function getFounderSession(): Promise<Member> {
  const member = await getSession();
  if (member.role !== "FOUNDER") redirect("/app");
  return member;
}
