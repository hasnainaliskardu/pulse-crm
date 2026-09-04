import { getSession } from "@/lib/auth";
import { getMemberDashboard } from "@/lib/queries";
import { redirect } from "next/navigation";
import MemberDayClient from "./day-client";

export const metadata = { title: "My Day · Pulse CRM" };

export default async function MemberDayPage() {
  const member = await getSession();
  if (member.role === "FOUNDER") redirect("/founder");
  const data = await getMemberDashboard(member);
  return <MemberDayClient member={member} data={data} />;
}
