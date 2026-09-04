import "server-only";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { logActivity } from "@/lib/activity";
import { syncToSheets } from "@/lib/sheethook";
import { domainOf } from "@/lib/utils";
import type { Database } from "@/types/supabase";

export const leadInputSchema = z.object({
  business_name: z.string().min(1, "Business name is required"),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  niche: z.string().optional().nullable(),
  source: z.enum(["GOOGLE_MAPS", "HOUZZ", "YELP", "BBB", "SUNBIZ", "PERMIT", "FACEBOOK", "INSTAGRAM", "LINKEDIN", "OTHER"]).default("OTHER"),
  website_url: z.string().optional().nullable(),
  website_status: z.enum(["NONE", "BROKEN", "POOR_SEO", "GOOD"]).default("NONE"),
  seo_score: z.number().int().min(0).max(100).optional().nullable(),
  owner_name: z.string().optional().nullable(),
  owner_email: z.string().email().optional().nullable().or(z.literal("")),
  owner_phone: z.string().optional().nullable(),
  instagram: z.string().optional().nullable(),
  facebook: z.string().optional().nullable(),
  linkedin: z.string().optional().nullable(),
  assigned_to: z.string().uuid().optional().nullable(),
  status: z.enum(["NEW", "RESEARCHING", "READY", "CONTACTED", "REPLIED", "INTERESTED", "NOT_INTERESTED", "CALL_BOOKED", "PROPOSAL", "WON", "LOST", "DORMANT"]).default("NEW"),
  notes: z.string().optional().nullable(),
  monthly_value: z.number().int().min(0).optional().nullable(),
  __allowDuplicate: z.boolean().optional(),
});

export type LeadInput = z.infer<typeof leadInputSchema>;

function normalizeLead(input: LeadInput) {
  const out: Record<string, unknown> = { ...input };
  for (const k of ["city", "state", "niche", "website_url", "owner_name", "owner_email", "owner_phone", "instagram", "facebook", "linkedin", "notes"]) {
    if (typeof out[k] === "string" && (out[k] as string).trim() === "") out[k] = null;
    if (out[k] === "") out[k] = null;
  }
  if (typeof out.website_url === "string" && out.website_url && !out.website_url.startsWith("http")) {
    out.website_url = `https://${out.website_url}`;
  }
  return out as Database["public"]["Tables"]["leads"]["Insert"];
}

/** Find duplicates by name+city, website domain, or phone (last 4 digits fallback to full match). */
export async function findLeadDuplicates(rows: Array<{ business_name: string; city?: string | null; website_url?: string | null; owner_phone?: string | null }>) {
  const supabase = createClient();
  const nameCityKeys = new Set(rows.map((r) => `${r.business_name.trim().toLowerCase()}|${(r.city ?? "").trim().toLowerCase()}`));
  const domains = new Set(rows.map((r) => domainOf(r.website_url)).filter(Boolean));
  const phones = new Set(rows.map((r) => (r.owner_phone ?? "").replace(/\D/g, "")).filter((p) => p.length >= 7));

  const names = [...nameCityKeys].map((k) => k.split("|")[0]);
  const { data } = await supabase
    .from("leads")
    .select("id, business_name, city, website_url, owner_phone")
    .or(names.map((n) => `business_name.ilike.${encodeURIComponent(n)}`).join(","))
    .limit(500);

  const existing = data ?? [];
  return existing.filter((e) => {
    const nameCityMatch = nameCityKeys.has(`${e.business_name.trim().toLowerCase()}|${(e.city ?? "").trim().toLowerCase()}`);
    const domainMatch = domains.has(domainOf(e.website_url));
    const phoneMatch = phones.has((e.owner_phone ?? "").replace(/\D/g, ""));
    return nameCityMatch || domainMatch || phoneMatch;
  });
}

export async function createLead(memberId: string, input: LeadInput) {
  const parsed = leadInputSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid lead data" };
  }

  const dupes = await findLeadDuplicates([{ ...parsed.data }]);
  if (dupes.length > 0 && !input.__allowDuplicate) {
    return { duplicates: dupes.map((d) => ({ id: d.id, business_name: d.business_name, city: d.city })) };
  }

  const supabase = createClient();
  const lead = normalizeLead(parsed.data);
  const { __allowDuplicate: _allow, ...insertRow } = lead as Record<string, unknown>;
  void _allow;
  const { data, error } = await supabase
    .from("leads")
    .insert(insertRow as never)
    .select("id")
    .single();

  if (error) return { error: error.message };

  await logActivity({
    memberId,
    action: "CREATE",
    entity: "LEAD",
    entityId: data.id,
    detail: { business_name: lead.business_name, city: lead.city, source: lead.source },
  });

  syncToSheets({ type: "lead_created", lead: lead });

  return { id: data.id };
}

export async function updateLead(memberId: string, leadId: string, patch: Partial<LeadInput> & { reply_type?: string }) {
  const supabase = createClient();

  // verify access
  const { data: existing } = await supabase
    .from("leads")
    .select("id, business_name, status, assigned_to, created_by")
    .eq("id", leadId)
    .maybeSingle();
  if (!existing) return { error: "Lead not found or not accessible" };

  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined || k.startsWith("__")) continue;
    clean[k] = v === "" ? null : v;
  }
  if (clean.status) delete clean.__allowDuplicate;

  const { error } = await supabase.from("leads").update(clean as never).eq("id", leadId);
  if (error) return { error: error.message };

  await logActivity({
    memberId,
    action: "UPDATE",
    entity: "LEAD",
    entityId: leadId,
    detail: { business_name: existing.business_name, changed: Object.keys(clean) },
  });

  if (clean.status && clean.status !== existing.status) {
    syncToSheets({ type: "lead_status_changed", lead_id: leadId, from: existing.status, to: clean.status, business_name: existing.business_name });
  }

  return { ok: true };
}

export async function deleteLead(founderId: string, leadId: string) {
  const admin = getAdminClient();
  const { data: existing } = await admin
    .from("leads")
    .select("id, business_name, touches(id)")
    .eq("id", leadId)
    .maybeSingle();
  if (!existing) return { error: "Lead not found" };

  const { error } = await admin.from("leads").delete().eq("id", leadId);
  if (error) return { error: error.message };

  await logActivity({
    memberId: founderId,
    action: "DELETE",
    entity: "LEAD",
    entityId: leadId,
    detail: { business_name: existing.business_name, touches_deleted: existing.touches?.length ?? 0 },
  });
  return { ok: true };
}

/** Bulk import. Duplicates skipped by default; returns per-row results. */
export async function bulkImportLeads(memberId: string, rows: LeadInput[], mode: "skip" | "allow") {
  const supabase = createClient();
  const results = { inserted: 0, duplicates: [] as Array<{ business_name: string; city: string | null }>, errors: [] as string[] };

  const dupes = mode === "skip" ? await findLeadDuplicates(rows) : [];
  const dupeKeys = new Set(dupes.map((d) => `${d.business_name.trim().toLowerCase()}|${(d.city ?? "").trim().toLowerCase()}`));

  // dedupe within the batch itself
  const seen = new Set<string>();
  const toInsert: Database["public"]["Tables"]["leads"]["Insert"][] = [];

  for (const row of rows) {
    const parsed = leadInputSchema.safeParse(row);
    if (!parsed.success) {
      results.errors.push(`${row.business_name ?? "Row"}: ${parsed.error.issues[0]?.message}`);
      continue;
    }
    const lead = normalizeLead(parsed.data);
    const key = `${lead.business_name.trim().toLowerCase()}|${(lead.city ?? "").trim().toLowerCase()}`;
    if (dupeKeys.has(key) || seen.has(key)) {
      results.duplicates.push({ business_name: lead.business_name, city: lead.city ?? null });
      continue;
    }
    seen.add(key);
    toInsert.push({ ...lead, created_by: memberId });
  }

  // insert in chunks of 100
  for (let i = 0; i < toInsert.length; i += 100) {
    const chunk = toInsert.slice(i, i + 100);
    const { error } = await supabase.from("leads").insert(chunk as never);
    if (error) {
      results.errors.push(`Chunk ${i / 100 + 1}: ${error.message}`);
    } else {
      results.inserted += chunk.length;
    }
  }

  await logActivity({
    memberId,
    action: "BULK_IMPORT",
    entity: "LEAD",
    detail: { attempted: rows.length, inserted: results.inserted, duplicates: results.duplicates.length, errors: results.errors.length },
  });

  for (const lead of toInsert.slice(0, 5)) {
    syncToSheets({ type: "lead_created", lead });
  }

  return results;
}

export async function logTouch(memberId: string, input: {
  lead_id: string;
  channel: "EMAIL" | "IG_DM" | "WHATSAPP" | "CALL" | "LINKEDIN" | "FACEBOOK";
  direction: "OUT" | "IN";
  message_summary: string;
  message_full?: string | null;
  occurred_at?: string;
}) {
  const supabase = createClient();

  const { data: lead } = await supabase
    .from("leads")
    .select("id, assigned_to, created_by")
    .eq("id", input.lead_id)
    .maybeSingle();
  if (!lead) return { error: "Lead not found or not accessible" };

  if (!input.message_summary?.trim()) return { error: "Message summary is required" };

  const { data, error } = await supabase
    .from("touches")
    .insert({
      lead_id: input.lead_id,
      member_id: memberId,
      channel: input.channel,
      direction: input.direction,
      message_summary: input.message_summary.trim().slice(0, 300),
      message_full: input.message_full?.trim() || null,
      occurred_at: input.occurred_at || new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  await logActivity({
    memberId,
    action: "LOG_TOUCH",
    entity: "TOUCH",
    entityId: data.id,
    detail: { lead_id: input.lead_id, channel: input.channel, direction: input.direction, summary: input.message_summary.slice(0, 100) },
  });

  return { id: data.id };
}
