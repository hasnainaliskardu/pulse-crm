import { getSession } from "@/lib/auth";
import TasksClient from "./tasks-client";

export const metadata = { title: "Tasks · HANA CRM" };
export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const member = await getSession();
  return <TasksClient meId={member.id} meRole={member.role} />;
}
