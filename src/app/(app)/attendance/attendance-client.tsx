"use client";

import { useMemo, useState } from "react";
import { CalendarCheck } from "lucide-react";
import { SimpleSelect } from "@/components/ui/simple-select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type MemberLite = { id: string; full_name: string; position: string; workspaces?: string[]; joining_date?: string | null };
type AttRecord = { id?: string; member_id: string; date: string; status: string; note?: string | null };

const todayStr = () => new Date().toISOString().slice(0, 10);

const statusStyle: Record<string, string> = {
  PRESENT: "bg-success/15 text-success",
  ABSENT: "bg-destructive/15 text-destructive",
  LEAVE: "bg-warning/15 text-warning",
  HALF_DAY: "bg-info/15 text-info",
};

export default function AttendanceClient({
  meId,
  isFounder,
  members,
  records,
}: {
  meId: string;
  isFounder: boolean;
  members: MemberLite[];
  records: AttRecord[];
}) {
  const [overrides, setOverrides] = useState<Record<string, string>>({});

  const statusOf = (memberId: string, date: string) =>
    overrides[`${memberId}|${date}`] ??
    records.find((r) => r.member_id === memberId && r.date === date)?.status ??
    "";

  async function setStatus(memberId: string, date: string, status: string) {
    setOverrides((o) => ({ ...o, [`${memberId}|${date}`]: status }));
    const { mutateAttendance } = await import("@/lib/local/sync");
    await mutateAttendance(memberId, date, status);
  }

  // last 14 days grid
  const days = useMemo(() => {
    const out: string[] = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10);
      out.push(d);
    }
    return out;
  }, []);

  const visibleMembers = isFounder ? members : members.filter((m) => m.id === meId);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <CalendarCheck className="h-6 w-6 text-primary" /> Attendance
        </h1>
        <p className="text-sm text-muted-foreground">Last 14 days â€” click a cell to mark (founder) or mark today (member).</p>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2.5 font-semibold">Member</th>
              <th className="px-3 py-2.5 font-semibold">Joined</th>
              {days.map((d) => (
                <th key={d} className="px-1.5 py-2.5 text-center font-semibold">{d.slice(8)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleMembers.map((m) => (
              <tr key={m.id} className="border-b last:border-0">
                <td className="px-3 py-2">
                  <p className="font-medium">{m.full_name}</p>
                  <p className="text-xs text-muted-foreground">{m.position}</p>
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{m.joining_date ?? "â€”"}</td>
                {days.map((d) => {
                  const s = statusOf(m.id, d);
                  const isToday = d === todayStr();
                  return (
                    <td key={d} className="px-1 py-2 text-center">
                      {isFounder || isToday ? (
                        <select
                          aria-label={`${m.full_name} ${d}`}
                          value={s}
                          onChange={(e) => setStatus(m.id, d, e.target.value)}
                          className={cn(
                            "h-7 w-16 rounded-md border-0 text-center text-[10px] font-bold outline-none",
                            s ? statusStyle[s] : "bg-muted text-muted-foreground"
                          )}
                        >
                          <option value="">â€”</option>
                          <option value="PRESENT">P</option>
                          <option value="ABSENT">A</option>
                          <option value="LEAVE">L</option>
                          <option value="HALF_DAY">H</option>
                        </select>
                      ) : (
                        <span className={cn("inline-flex rounded px-1.5 py-0.5 text-[10px] font-bold", s ? statusStyle[s] : "text-muted-foreground")}>
                          {s ? s[0] : "Â·"}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        P = Present Â· A = Absent Â· L = Leave Â· H = Half day. Attendance feeds the daily reports and dashboards automatically.
      </p>
    </div>
  );
}
