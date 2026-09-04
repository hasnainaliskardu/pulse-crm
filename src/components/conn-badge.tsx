"use client";

import { CloudOff, Cloud, RefreshCw, CloudUpload, AlertTriangle } from "lucide-react";
import { useSync } from "@/components/sync-provider";
import { cn } from "@/lib/utils";

export function ConnBadge() {
  const { state, pending, sync } = useSync();

  const map = {
    online: { icon: Cloud, label: "Online", cls: "text-success", dot: "bg-success" },
    offline: { icon: CloudOff, label: "Offline", cls: "text-warning", dot: "bg-warning" },
    syncing: { icon: RefreshCw, label: pending ? `Syncing ${pending}…` : "Syncing…", cls: "text-info", dot: "bg-info animate-pulse" },
    synced: { icon: CloudUpload, label: "All synced", cls: "text-success", dot: "bg-success" },
    error: { icon: AlertTriangle, label: `${pending} pending`, cls: "text-destructive", dot: "bg-destructive" },
  } as const;

  const s = map[state];
  const Icon = s.icon;

  return (
    <button
      onClick={sync}
      title={state === "offline" ? "Offline — changes saved on device, will sync automatically" : "Click to sync now"}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-1 text-xs font-medium",
        s.cls
      )}
    >
      <Icon className={cn("h-3.5 w-3.5", state === "syncing" && "animate-spin")} />
      <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} />
      {pending > 0 && state !== "syncing" ? `${pending} pending` : s.label}
    </button>
  );
}

export function OfflineBanner() {
  const { state } = useSync();
  if (state !== "offline") return null;
  return (
    <div className="sticky top-0 z-50 flex items-center justify-center gap-2 bg-warning px-4 py-1.5 text-center text-xs font-semibold text-white">
      <CloudOff className="h-3.5 w-3.5" />
      Offline mode — changes saved on device, will sync automatically
    </div>
  );
}
