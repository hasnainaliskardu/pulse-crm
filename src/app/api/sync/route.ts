import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { syncToSheets } from "@/lib/sheethook";
import { logActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";

const SOURCE_SET = new Set(["GOOGLE_MAPS", "HOUZZ", "YELP", "BBB", "SUNBIZ", "PERMIT", "FACEBOOK", "INSTAGRAM", "LINKEDIN", "OTHER"]);
const WSTATUS_SET = new Set(["NONE", "BROKEN", "POOR_SEO", "GOOD"]);
const STATUS_SET = new Set(["NEW", "RESEARCHING", "READY", "CONTACTED", "REPLIED", "INTERESTED", "NOT_INTERESTED", "CALL_BOOKED", "PROPOSAL", "WON", "LOST", "DORMANT"]);
const REPLY_SET = new Set(["NONE", "NEUTRAL", "POSITIVE", "NEGATIVE"]);

/** Apply one outbox mutation from a client (offline replay). */
export async function POST(request: Request) {
  const member = await getSession();
  const { table, op, recordId, payload, baseVersion } = await request.json();

  const supabase = createClient();

  /** Run founder-defined workflow rules on lead status changes. */
  const runWorkflows = async (leadId: string, newStatus: string) => {
    const { data: rules } = await supabase
      .from("workflow_rules")
      .select("*")
      .eq("enabled", true)
      .eq("trigger_event", "STATUS_CHANGE")
      .eq("trigger_value", newStatus);
    for (const rule of rules ?? []) {
      const cfg = (rule.action_config ?? {}) as Record<string, unknown>;
      if (rule.action_type === "CREATE_TASK" && cfg.taskTitle) {
        await supabase.from("tasks").insert({
          title: String(cfg.taskTitle),
          lead_id: leadId,
          assigned_to: member.id,
          due_date: new Date(Date.now() + (Number(cfg.dueInDays) || 1) * 864e5).toISOString().slice(0, 10),
          priority: "HIGH",
          done: false,
          created_by: member.id,
        } as never);
        await logActivity({ memberId: member.id, action: "WORKFLOW", entity: "TASK", detail: { rule: rule.name, lead_id: leadId } });
      }
    }
  };

  try {
    if (table === "leads" && op === "insert") {
      const { id: _ignored, ...row } = payload as Record<string, any>;
      // hard defaults so imported rows can never carry null enums
      const safe = {
        source: "OTHER",
        website_status: "NONE",
        status: "NEW",
        reply_type: "NONE",
        ...row,
      };
      if (!SOURCE_SET.has(String(safe.source))) safe.source = "OTHER";
      if (!WSTATUS_SET.has(String(safe.website_status))) safe.website_status = "NONE";
      if (!STATUS_SET.has(String(safe.status))) safe.status = "NEW";
      if (!REPLY_SET.has(String(safe.reply_type))) safe.reply_type = "NONE";
      const { data, error } = await supabase
        .from("leads")
        .insert({ ...safe, business_name: row.business_name ?? "Unnamed", created_by: member.id } as never)
        .select()
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      await logActivity({ memberId: member.id, action: "CREATE", entity: "LEAD", entityId: data.id, detail: { business_name: data.business_name, offline: true } });
      syncToSheets({ type: "lead_created", lead: data });
      return NextResponse.json({ record: data });
    }

    if (table === "leads" && op === "update" && recordId) {
      // conflict detection: server changed since baseVersion?
      const { data: server } = await supabase
        .from("leads")
        .select()
        .eq("id", recordId)
        .maybeSingle();
      if (!server) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

      const serverVersion = new Date(server.updated_at).getTime();
      if (baseVersion && serverVersion > baseVersion + 1000) {
        // field-by-field merge: client fields win when set; server fills the rest
        const merged: Record<string, any> = { ...server };
        for (const [k, v] of Object.entries(payload)) {
          if (v !== undefined && v !== null) merged[k] = v;
        }
      const { data: updated, error } = await supabase
        .from("leads")
        .update(merged as never)
        .eq("id", recordId)
        .select()
        .single();
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        await logActivity({ memberId: member.id, action: "MERGE_CONFLICT", entity: "LEAD", entityId: recordId, detail: { client: payload, server: { id: server.id, updated_at: server.updated_at }, merged_fields: Object.keys(payload) } });
        return NextResponse.json({ record: updated, merged: true }, { status: 200 });
      }

      const { data: updated, error } = await supabase
        .from("leads")
        .update(payload as never)
        .eq("id", recordId)
        .select()
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      if (payload.status && payload.status !== server.status) {
        await logActivity({ memberId: member.id, action: "STATUS_CHANGE", entity: "LEAD", entityId: recordId, detail: { from: server.status, to: payload.status, business_name: server.business_name, offline: true } });
        syncToSheets({ type: "lead_status_changed", lead_id: recordId, from: server.status, to: payload.status, business_name: server.business_name });
        await runWorkflows(recordId, String(payload.status));
      } else {
        await logActivity({ memberId: member.id, action: "UPDATE", entity: "LEAD", entityId: recordId, detail: { changed: Object.keys(payload) } });
      }
      return NextResponse.json({ record: updated });
    }

    if (table === "leads" && op === "delete" && recordId) {
      if (member.role !== "FOUNDER") return NextResponse.json({ error: "Only founder can delete" }, { status: 403 });
      const { error } = await supabase.from("leads").delete().eq("id", recordId);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      await logActivity({ memberId: member.id, action: "DELETE", entity: "LEAD", entityId: recordId });
      return NextResponse.json({ record: null });
    }

    if (table === "touches" && op === "insert") {
      const { id: _lid, ...row } = payload as Record<string, any>;
      const { data, error } = await supabase
        .from("touches")
        .insert({ ...row, member_id: member.id } as never)
        .select()
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      await logActivity({ memberId: member.id, action: "LOG_TOUCH", entity: "TOUCH", entityId: data.id, detail: { lead_id: row.lead_id, channel: row.channel, offline: true } });
      return NextResponse.json({ record: data });
    }

    if (table === "tasks" && (op === "insert" || op === "update")) {
      if (op === "insert") {
        const { id, ...row } = payload as Record<string, any>;
        const { data, error } = await supabase
          .from("tasks")
          .insert({ ...row, title: row.title ?? "Untitled task", created_by: member.id } as never)
          .select()
          .single();
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        return NextResponse.json({ record: data });
      }
      const { data, error } = await supabase
        .from("tasks")
        .update(payload as never)
        .eq("id", recordId!)
        .select()
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ record: data });
    }

    if (table === "notes" && op === "insert") {
      const { id, ...row } = payload as Record<string, any>;
      const { data, error } = await supabase
        .from("notes")
        .insert({ ...row, body: row.body ?? "", lead_id: row.lead_id, author_id: member.id } as never)
        .select()
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ record: data });
    }

    if (table === "clients" && (op === "insert" || op === "update")) {
      if (member.role !== "FOUNDER") return NextResponse.json({ error: "Founder only" }, { status: 403 });
      if (op === "insert") {
        const { id, ...row } = payload as Record<string, any>;
        const { data, error } = await supabase.from("clients").insert(row as never).select().single();
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        return NextResponse.json({ record: data });
      }
      const { data, error } = await supabase
        .from("clients")
        .update(payload as never)
        .eq("id", recordId!)
        .select()
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ record: data });
    }

    return NextResponse.json({ error: `Unsupported ${table}.${op}` }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sync error" },
      { status: 500 }
    );
  }
}

/** Pull changed rows since cursor for the local mirror. */
export async function GET(request: Request) {
  const member = await getSession();
  const supabase = createClient();
  const url = new URL(request.url);
  const since = url.searchParams.get("since") ?? "0";
  const sinceDate = new Date(Number(since) || 0).toISOString();

  const isFounder = member.role === "FOUNDER";
  const scope = isFounder ? {} : { assigned_to: member.id };

  const [leads, touches, tasks, notes, clients, members, stats] = await Promise.all([
    supabase.from("leads").select("*").or(`updated_at.gte.${sinceDate},created_at.gte.${sinceDate}`).match(scope),
    supabase.from("touches").select("*").gte("created_at", sinceDate),
    supabase.from("tasks").select("*").or(`updated_at.gte.${sinceDate},created_at.gte.${sinceDate}`),
    supabase.from("notes").select("*").gte("created_at", sinceDate),
    supabase.from("clients").select("*").gte("created_at", sinceDate),
    supabase.from("members").select("*").eq("is_active", true),
    supabase.from("daily_stats").select("*").gte("date", new Date(Date.now() - 45 * 864e5).toISOString().slice(0, 10)),
  ]);

  return NextResponse.json({
    leads: leads.data ?? [],
    touches: touches.data ?? [],
    tasks: tasks.data ?? [],
    notes: notes.data ?? [],
    clients: clients.data ?? [],
    members: members.data ?? [],
    stats: stats.data ?? [],
    cursor: String(Date.now()),
  });
}
