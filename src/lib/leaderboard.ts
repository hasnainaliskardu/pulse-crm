import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";

type DailyStat = Database["public"]["Tables"]["daily_stats"]["Row"];

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}
function daysAgoUTC(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}
function monthStartUTC(): string {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

export async function getLeaderboard(range: "today" | "week" | "month") {
  const supabase = createClient();
  const from =
    range === "today" ? todayUTC() : range === "week" ? daysAgoUTC(6) : monthStartUTC();

  const [members, stats] = await Promise.all([
    supabase.from("members").select("id, full_name, position, points, is_active").eq("is_active", true).order("points", { ascending: false }),
    supabase.from("daily_stats").select("*").gte("date", from),
  ]);

  const rows = (members.data ?? []).map((m) => {
    const mine = (stats.data ?? []).filter((s) => s.member_id === m.id) as DailyStat[];
    const sum = (k: "touches_sent" | "leads_researched" | "replies_received" | "positive_replies" | "calls_booked" | "clients_closed") =>
      mine.reduce((a, r) => a + (r[k] || 0), 0);
    return {
      id: m.id,
      name: m.full_name,
      position: m.position,
      lifetimePoints: m.points,
      touches: sum("touches_sent"),
      researches: sum("leads_researched"),
      replies: sum("replies_received"),
      positives: sum("positive_replies"),
      calls: sum("calls_booked"),
      rangePoints:
        sum("touches_sent") * 1 +
        sum("leads_researched") * 2 +
        sum("replies_received") * 5 +
        sum("positive_replies") * 10 +
        sum("calls_booked") * 20 +
        sum("clients_closed") * 100,
    };
  });

  rows.sort((a, b) => b.rangePoints - a.rangePoints || b.touches - a.touches);
  return rows;
}
