import { getFounderDashboard } from "@/lib/queries";
import { getFounderSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import FounderDashboardClient from "./dashboard-client";

export const metadata = { title: "Dashboard · Pulse CRM" };

export default async function FounderDashboardPage() {
  const member = await getFounderSession();
  if (member.role !== "FOUNDER") redirect("/app");
  const data = await getFounderDashboard();
  return <FounderDashboardClient data={data} />;
}
