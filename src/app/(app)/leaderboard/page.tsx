import { getLeaderboard } from "@/lib/leaderboard";
import { getSession } from "@/lib/auth";
import LeaderboardClient from "./leaderboard-client";

export const metadata = { title: "Leaderboard · HANA CRM" };
export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  const member = await getSession();
  const [today, week, month] = await Promise.all([
    getLeaderboard("today"),
    getLeaderboard("week"),
    getLeaderboard("month"),
  ]);
  return (
    <LeaderboardClient
      meId={member.id}
      today={today}
      week={week}
      month={month}
    />
  );
}
