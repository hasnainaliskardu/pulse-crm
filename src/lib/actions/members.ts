import "server-only";
import { z } from "zod";
import { getAdminClient } from "@/lib/supabase/admin";

const createMemberSchema = z.object({
  fullName: z.string().min(2, "Name too short"),
  email: z.string().email("Invalid email"),
  position: z.enum(["Researcher", "Sender", "Closer", "Manager"]),
  password: z.string().min(8, "Password must be at least 8 characters"),
  dailyResearchTarget: z.number().int().min(0).max(500).default(40),
  dailyTouchTarget: z.number().int().min(0).max(500).default(45),
});

export type CreateMemberInput = z.infer<typeof createMemberSchema>;

export async function createMember(founderId: string, input: CreateMemberInput) {
  const parsed = createMemberSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { email, fullName, position, password, dailyResearchTarget, dailyTouchTarget } =
    parsed.data;

  const admin = getAdminClient();

  // duplicate email check (auth + members)
  const { data: existing } = await admin
    .from("members")
    .select("id, email")
    .ilike("email", email)
    .maybeSingle();
  if (existing) return { error: "A member with this email already exists" };

  const { data: authData, error: authError } =
    await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
  if (authError || !authData.user) {
    return { error: authError?.message ?? "Could not create auth user" };
  }

  const { error: memberError } = await admin.from("members").insert({
    id: authData.user.id,
    full_name: fullName,
    email,
    position,
    role: "MEMBER",
    daily_research_target: dailyResearchTarget,
    daily_touch_target: dailyTouchTarget,
  });
  if (memberError) {
    await admin.auth.admin.deleteUser(authData.user.id);
    return { error: "Could not create member record: " + memberError.message };
  }

  await logActivityServer({
    memberId: founderId,
    action: "CREATE",
    entity: "MEMBER",
    entityId: authData.user.id,
    detail: { full_name: fullName, email, position },
  });

  return { userId: authData.user.id };
}

export async function resetMemberPassword(founderId: string, memberId: string, newPassword: string) {
  if (newPassword.length < 8) return { error: "Password must be at least 8 characters" };
  const admin = getAdminClient();
  const { error } = await admin.auth.admin.updateUserById(memberId, {
    password: newPassword,
  });
  if (error) return { error: error.message };
  await logActivityServer({
    memberId: founderId,
    action: "RESET_PASSWORD",
    entity: "MEMBER",
    entityId: memberId,
  });
  return { ok: true };
}

export async function updateMember(
  founderId: string,
  memberId: string,
  patch: {
    full_name?: string;
    position?: string;
    is_active?: boolean;
    daily_research_target?: number;
    daily_touch_target?: number;
  }
) {
  const admin = getAdminClient();
  const { error } = await admin.from("members").update(patch).eq("id", memberId);
  if (error) return { error: error.message };
  await logActivityServer({
    memberId: founderId,
    action: "UPDATE",
    entity: "MEMBER",
    entityId: memberId,
    detail: patch as Record<string, unknown>,
  });
  return { ok: true };
}

export async function deleteMemberAuth(founderId: string, memberId: string) {
  const admin = getAdminClient();
  const { error } = await admin.auth.admin.deleteUser(memberId);
  if (error) return { error: error.message };
  await logActivityServer({
    memberId: founderId,
    action: "DELETE",
    entity: "MEMBER",
    entityId: memberId,
  });
  return { ok: true };
}

/** Service-role logging (bypasses RLS, used for founder admin ops + sheets sync). */
async function logActivityServer(opts: {
  memberId: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  detail?: Record<string, unknown>;
}) {
  try {
    const admin = getAdminClient();
    await admin.from("activity_log").insert({
      member_id: opts.memberId,
      action: opts.action,
      entity: opts.entity,
      entity_id: opts.entityId ?? null,
      detail: (opts.detail ?? {}) as Record<string, unknown> as never,
    });
  } catch {
    // never block
  }
}
