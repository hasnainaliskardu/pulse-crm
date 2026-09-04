import { getSession } from "@/lib/auth";
import QueueClient from "./queue-client";

export const metadata = { title: "My Queue · HANA CRM" };
export const dynamic = "force-dynamic";

export default async function QueuePage() {
  const member = await getSession();
  return <QueueClient meId={member.id} />;
}
