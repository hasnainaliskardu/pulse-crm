import { AppShell } from "@/components/app-shell";
import { getSession } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const member = await getSession();
  return <AppShell member={member}>{children}</AppShell>;
}
