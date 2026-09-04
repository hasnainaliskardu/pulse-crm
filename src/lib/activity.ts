import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/supabase";

/** Append to activity_log using the user's session (RLS-checked). */
export async function logActivity(opts: {
  memberId: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  detail?: Record<string, unknown>;
}) {
  try {
    const supabase = createClient();
    await supabase.from("activity_log").insert({
      member_id: opts.memberId,
      action: opts.action,
      entity: opts.entity,
      entity_id: opts.entityId ?? null,
      detail: (opts.detail ?? {}) as Json,
    });
  } catch {
    // never block app on logging failure
  }
}
