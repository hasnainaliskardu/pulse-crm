import { getSession } from "@/lib/auth";
import CalendarClient from "./calendar-client";

export const metadata = { title: "Calendar · HANA CRM" };
export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const member = await getSession();
  return <CalendarClient meId={member.id} />;
}
