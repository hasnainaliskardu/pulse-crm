"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { ListChecks } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge, WebsiteBadge } from "@/components/badges";
import { db, type CachedLead } from "@/lib/local/db";
import { trySync } from "@/lib/local/sync";

export default function QueueClient({ meId }: { meId: string }) {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    void trySync("queue-mount").then(() => setHydrated(true));
  }, []);

  const mine = useLiveQuery(
    () => db.leads.filter((l) => !l.deleted && (l.assigned_to === meId || l.created_by === meId)).toArray(),
    [meId],
    [] as CachedLead[]
  );

  const groups = new Map<string, CachedLead[]>();
  for (const l of mine ?? []) {
    const arr = groups.get(l.status) ?? [];
    arr.push(l);
    groups.set(l.status, arr);
  }
  const order = ["NEW", "RESEARCHING", "READY", "CONTACTED", "REPLIED", "INTERESTED", "CALL_BOOKED", "PROPOSAL", "WON", "NOT_INTERESTED", "LOST", "DORMANT"];
  const sorted = Array.from(groups.entries()).sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <ListChecks className="h-6 w-6 text-primary" /> My Queue
        </h1>
        <p className="text-sm text-muted-foreground">{(mine ?? []).length} leads assigned to you.</p>
      </div>

      {!hydrated ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" />)}
        </div>
      ) : (mine ?? []).length === 0 ? (
        <EmptyState icon={ListChecks} title="Nothing assigned" description="Your queue is empty — ask the founder to assign leads." actionLabel="Browse leads" actionHref="/leads" />
      ) : (
        sorted.map(([status, leads]) => (
          <section key={status} className="rounded-xl border bg-card">
            <div className="flex items-center gap-2 border-b bg-muted/40 px-4 py-2">
              <StatusBadge status={status as never} />
              <span className="text-xs font-semibold text-muted-foreground">{leads.length}</span>
            </div>
            <div className="divide-y">
              {leads.map((l) => (
                <Link key={l.id} href={`/leads/${l.id}`} className="flex items-center justify-between gap-3 p-3 transition hover:bg-muted/30">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{l.business_name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {l.city ?? "—"} · {l.owner_name ?? "no owner found"}
                    </p>
                  </div>
                  <WebsiteBadge status={l.website_status as never} />
                </Link>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
