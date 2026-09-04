"use client";

import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { toast } from "sonner";
import { CalendarCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/local/db";
import { mutateAttendance } from "@/lib/local/sync";
import { cn } from "@/lib/utils";

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function MarkAttendanceButton({ memberId, compact }: { memberId: string; compact?: boolean }) {
  const todayStr = today();
  const record = useLiveQuery(
    () => db.table("attendance").get([memberId, todayStr]),
    [memberId, todayStr],
    undefined
  );
  const [busy, setBusy] = useState(false);

  async function mark() {
    if (record) {
      toast.info(`Already marked: ${record.status}`);
      return;
    }
    setBusy(true);
    try {
      await mutateAttendance(memberId, todayStr, "PRESENT");
      toast.success("Attendance marked: Present");
    } finally {
      setBusy(false);
    }
  }

  if (record) {
    return (
      <span className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
        record.status === "PRESENT"
          ? "border-success/40 bg-success/10 text-success"
          : record.status === "ABSENT"
            ? "border-destructive/40 bg-destructive/10 text-destructive"
            : "border-warning/40 bg-warning/10 text-warning"
      )}>
        <CalendarCheck className="h-3.5 w-3.5" />
        {record.status}
      </span>
    );
  }

  return (
    <Button size="sm" variant="outline" onClick={mark} disabled={busy}>
      <CalendarCheck className="h-4 w-4" /> {compact ? "Mark present" : "Mark attendance"}
    </Button>
  );
}
