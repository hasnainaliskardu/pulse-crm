import { getSession } from "@/lib/auth";
import MeetingsClient from "./meetings-client";

export const metadata = { title: "Meetings · Pulse CRM" };
export const dynamic = "force-dynamic";

export default async function MeetingsPage() {
  await getSession();
  return <MeetingsClient />;
}
