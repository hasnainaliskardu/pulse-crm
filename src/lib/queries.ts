import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";

type Member = Database["public"]["Tables"]["members"]["Row"];
type Lead = Database["public"]["Tables"]["leads"]["Row"];
type DailyStat = Database["public"]["Tables"]["daily_stats"]["Row"];

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoUTC(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

export async function getFounderDashboard() {
  const supabase = createClient();
  const today = todayUTC();
  const from30 = daysAgoUTC(29);

  const [members, todayStats, stats30, activeClients, todaysLeads] = await Promise.all([
    supabase.from("members").select("*").eq("is_active", true).order("points", { ascending: false }),
    supabase.from("daily_stats").select("*").eq("date", today),
    supabase.from("daily_stats").select("*").gte("date", from30),
    supabase.from("clients").select("*").eq("status", "ACTIVE"),
    supabase.from("leads").select("id, status, reply_type, created_at").gte("created_at", `${today}T00:00:00.000Z`),
  ]);

  const sum = (rows: DailyStat[] | null, key: keyof DailyStat) =>
    (rows ?? []).reduce((acc, r) => acc + (Number(r[key]) || 0), 0);

  // funnel counts for today from stats + status-bearing leads
  const leadsToday = (todaysLeads.data ?? []).length;
  const touchesToday = sum(todayStats.data, "touches_sent");
  const repliesToday = sum(todayStats.data, "replies_received");
  const positivesToday = sum(todayStats.data, "positive_replies");
  const callsToday = sum(todayStats.data, "calls_booked");
  const winsToday = sum(todayStats.data, "clients_closed");

  // proposals + wins today from lead status transitions recorded in activity? Use lead status as approximation for live funnel
  const [leadAgg] = await Promise.all([
    supabase.from("leads").select("id, status, reply_type"),
  ]);

  const allLeads = (leadAgg.data ?? []) as Pick<Lead, "id" | "status" | "reply_type">[];
  const proposalsAll = allLeads.filter((l) => l.status === "PROPOSAL" || l.status === "WON").length;

  const mrr = (activeClients.data ?? []).reduce((a, c) => a + (c.monthly_revenue || 0), 0);

  // team target attainment today
  const targetTotals = (members.data ?? []).reduce(
    (acc, m) => {
      acc.research += m.daily_research_target;
      acc.touches += m.daily_touch_target;
      return acc;
    },
    { research: 0, touches: 0 }
  );
  const attainment = targetTotals.touches
    ? Math.min(999, Math.round((touchesToday / targetTotals.touches) * 100))
    : 0;

  // 7-day and 30-day trend series
  const seriesFor = (days: number) => {
    const rows = (stats30.data ?? []).filter((r) => r.date >= daysAgoUTC(days - 1));
    const byDate = new Map<string, DailyStat>();
    for (let i = 0; i < days; i++) {
      const d = daysAgoUTC(days - 1 - i);
      byDate.set(d, {
        id: "", member_id: "", date: d,
        leads_researched: 0, touches_sent: 0, replies_received: 0,
        positive_replies: 0, calls_booked: 0, clients_closed: 0,
      });
    }
    for (const r of rows) {
      const ex = byDate.get(r.date);
      if (ex) {
        byDate.set(r.date, {
          ...ex,
          touches_sent: ex.touches_sent + r.touches_sent,
          replies_received: ex.replies_received + r.replies_received,
          leads_researched: ex.leads_researched + r.leads_researched,
        });
      }
    }
    return Array.from(byDate.values()).map((r) => ({
      date: r.date.slice(5),
      touches: r.touches_sent,
      replies: r.replies_received,
      researches: r.leads_researched,
    }));
  };

  // recent activity for live feed
  const [recentTouches, recentPositive, recentWins] = await Promise.all([
    supabase.from("touches").select("id, member_id, lead_id, channel, direction, message_summary, occurred_at, leads(business_name), members(full_name)").order("occurred_at", { ascending: false }).limit(8),
    supabase.from("leads").select("id, business_name, owner_name, assigned_to, updated_at").eq("reply_type", "POSITIVE").order("updated_at", { ascending: false }).limit(5),
    supabase.from("leads").select("id, business_name, monthly_value, updated_at").eq("status", "WON").order("updated_at", { ascending: false }).limit(5),
  ]);

  // per-member today rows
  const memberRows = (members.data ?? []).map((m) => {
    const s = (todayStats.data ?? []).find((r) => r.member_id === m.id);
    return {
      member: m,
      researched: s?.leads_researched ?? 0,
      touches: s?.touches_sent ?? 0,
      replies: s?.replies_received ?? 0,
      positives: s?.positive_replies ?? 0,
      calls: s?.calls_booked ?? 0,
    };
  }).sort((a, b) => b.touches + b.researched * 2 - (a.touches + a.researched * 2));

  return {
    kpis: {
      leadsAdded: leadsToday,
      touches: touchesToday,
      replies: repliesToday,
      positives: positivesToday,
      calls: callsToday,
      activeClients: (activeClients.data ?? []).length,
      mrr,
      attainment,
      wins: winsToday,
      proposals: proposalsAll,
    },
    funnel: {
      touches: touchesToday,
      replies: repliesToday,
      positives: positivesToday,
      calls: callsToday,
      proposals: proposalsAll,
      wins: winsToday,
    },
    memberRows,
    trend7: seriesFor(7),
    trend30: seriesFor(30),
    recentTouches: (recentTouches.data ?? []) as unknown as Array<{
      id: string; member_id: string; lead_id: string; channel: string; direction: string;
      message_summary: string; occurred_at: string;
      leads: { business_name: string } | null;
      members: { full_name: string } | null;
    }>,
    recentPositive: (recentPositive.data ?? []) as unknown as Array<{
      id: string; business_name: string; owner_name: string | null; updated_at: string;
    }>,
    recentWins: (recentWins.data ?? []) as unknown as Array<{
      id: string; business_name: string; monthly_value: number | null; updated_at: string;
    }>,
  };
}

export async function getMemberDashboard(member: Member) {
  const supabase = createClient();
  const today = todayUTC();
  const from14 = daysAgoUTC(13);

  const [todayStat, stats14, myLeads, myRank] = await Promise.all([
    supabase.from("daily_stats").select("*").eq("member_id", member.id).eq("date", today).maybeSingle(),
    supabase.from("daily_stats").select("*").eq("member_id", member.id).gte("date", from14),
    supabase.from("leads").select("id, business_name, status, city, website_status, last_activity_at").eq("assigned_to", member.id).order("last_activity_at", { ascending: false }),
    supabase.from("daily_stats").select("member_id, touches_sent, leads_researched").eq("date", today),
  ]);

  const stat = todayStat.data ?? {
    leads_researched: 0, touches_sent: 0, replies_received: 0,
    positive_replies: 0, calls_booked: 0, clients_closed: 0,
  };

  const scores = ((myRank.data ?? []).map((r) => ({
    member_id: r.member_id,
    score: r.touches_sent + r.leads_researched * 2,
  }))).sort((a, b) => b.score - a.score);
  const rank = scores.findIndex((s) => s.member_id === member.id) + 1;

  const streak = [];
  for (let i = 13; i >= 0; i--) {
    const d = daysAgoUTC(i);
    const row = (stats14.data ?? []).find((r) => r.date === d);
    const hit = (row?.touches_sent ?? 0) >= member.daily_touch_target;
    streak.push({ date: d, hit, touches: row?.touches_sent ?? 0 });
  }

  const byStatus = new Map<string, Lead[]>();
  for (const l of (myLeads.data ?? []) as Lead[]) {
    const arr = byStatus.get(l.status) ?? [];
    arr.push(l);
    byStatus.set(l.status, arr);
  }

  return {
    stat,
    streak,
    rank: rank || scores.length + 1,
    totalMembers: scores.length,
    queue: byStatus,
    queueCount: (myLeads.data ?? []).length,
  };
}
