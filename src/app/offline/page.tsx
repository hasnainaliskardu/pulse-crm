import Link from "next/link";
import { CloudOff } from "lucide-react";

export const metadata = { title: "Offline · HANA CRM" };

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-warning/15 text-warning">
        <CloudOff className="h-7 w-7" />
      </div>
      <h1 className="text-xl font-bold">You&apos;re offline</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        HANA CRM keeps working offline. Cached pages remain available — use the back
        button or reopen the app. Your changes are saved on this device and sync
        automatically when the connection returns.
      </p>
      <Link href="/" className="mt-2 text-sm font-semibold text-primary hover:underline">
        Try again
      </Link>
    </div>
  );
}
