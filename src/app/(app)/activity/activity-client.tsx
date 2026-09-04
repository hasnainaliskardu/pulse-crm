"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, ScrollText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SimpleSelect } from "@/components/ui/simple-select";
import { EmptyState } from "@/components/empty-state";
import { initials } from "@/lib/utils";
import type { ActivityLogRow, Json, MemberRow } from "@/types/supabase";

export default function ActivityClient({
  logs,
  members,
  total,
  page,
  pageSize,
  member,
  action,
}: {
  logs: ActivityLogRow[];
  members: Array<Pick<MemberRow, "id" | "full_name">>;
  total: number;
  page: number;
  pageSize: number;
  member: string;
  action: string;
}) {
  const [memberFilter, setMemberFilter] = useState(member);
  const [actionFilter, setActionFilter] = useState(action);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const nameOf = (id: string | null) => members.find((m) => m.id === id)?.full_name ?? "System";

  const qs = (p: number) => {
    const params = new URLSearchParams();
    if (p > 1) params.set("page", String(p));
    if (memberFilter) params.set("member", memberFilter);
    if (actionFilter) params.set("action", actionFilter);
    const s = params.toString();
    return s ? `/activity?${s}` : "/activity";
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <ScrollText className="h-6 w-6 text-primary" /> Activity Log
        </h1>
        <p className="text-sm text-muted-foreground">{total} events — append-only, nothing is ever deleted.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <SimpleSelect
          ariaLabel="Filter member"
          value={memberFilter}
          placeholder="All members"
          onChange={(v) => setMemberFilter(v)}
          className="w-48"
          options={members.map((m) => ({ label: m.full_name, value: m.id }))}
        />
        <SimpleSelect
          ariaLabel="Filter action"
          value={actionFilter}
          placeholder="All actions"
          onChange={(v) => setActionFilter(v)}
          className="w-48"
          options={["CREATE", "UPDATE", "STATUS_CHANGE", "DELETE", "LOG_TOUCH", "BULK_IMPORT", "MERGE_CONFLICT", "RESET_PASSWORD", "UPLOAD_FILE"]
            .map((a) => ({ label: a.replace(/_/g, " "), value: a }))}
        />
        <Button asChild size="sm" variant="outline"><Link href={qs(1)}>Apply filters</Link></Button>
      </div>

      {logs.length === 0 ? (
        <EmptyState icon={ScrollText} title="No events match" description="Try different filters — every mutation in the app is logged here." />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          {logs.map((l) => (
            <div key={l.id} className="flex flex-wrap items-center gap-3 border-b p-3 text-sm last:border-0">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-foreground">
                {initials(nameOf(l.member_id))}
              </span>
              <div className="min-w-40 flex-1">
                <p className="font-medium">{nameOf(l.member_id)}</p>
                <p className="text-xs text-muted-foreground">{new Date(l.created_at).toLocaleString()}</p>
              </div>
              <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-semibold">{l.action.replace(/_/g, " ")}</span>
              <span className="rounded-md bg-accent/60 px-2 py-0.5 text-xs font-medium text-accent-foreground">{l.entity}</span>
              <span className="min-w-40 flex-1 truncate text-xs text-muted-foreground">
                {l.detail ? JSON.stringify(l.detail as Json).slice(0, 120) : ""}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Page {page} of {totalPages}</p>
        <div className="flex gap-1">
          <Button variant="outline" size="icon-sm" disabled={page <= 1} asChild={page > 1}>
            {page > 1 ? <Link href={qs(page - 1)}><ChevronLeft className="h-4 w-4" /></Link> : <ChevronLeft className="h-4 w-4" />}
          </Button>
          <Button variant="outline" size="icon-sm" disabled={page >= totalPages} asChild={page < totalPages}>
            {page < totalPages ? <Link href={qs(page + 1)}><ChevronRight className="h-4 w-4" /></Link> : <ChevronRight className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
