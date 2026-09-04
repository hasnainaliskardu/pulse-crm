import { getFounderDashboard } from "@/lib/queries";
import { getFounderSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import FounderDashboardClient from "./dashboard-client";

export const metadata = { title: "Dashboard · Pulse CRM" };
export const dynamic = "force-dynamic";

export default async function FounderDashboardPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const member = await getFounderSession();
  if (member.role !== "FOUNDER") redirect("/app");

  const from = String(searchParams.from ?? "");
  const to = String(searchParams.to ?? "");
  const range = from && to ? { from, to } : undefined;

  const data = await getFounderDashboard(range);
  return <FounderDashboardClient data={data} range={range} />;
}
