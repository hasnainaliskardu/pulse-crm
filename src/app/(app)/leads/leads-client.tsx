"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { toast } from "sonner";
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Filter,
  Plus,
  Search,
  Table2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SimpleSelect } from "@/components/ui/simple-select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge, WebsiteBadge } from "@/components/badges";
import { db, type CachedLead } from "@/lib/local/db";
import { mutateLead } from "@/lib/local/sync";
import { cn, LEAD_STATUSES, LEAD_SOURCES, WEBSITE_STATUSES, initials } from "@/lib/utils";

const PAGE_SIZE = 50;

interface Filters {
  status: string;
  q: string;
  assigned: string;
  website: string;
  source: string;
  city: string;
  from: string;
  to: string;
  sort: string;
}

function timeAgo(iso?: string | null) {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diff)) return "—";
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const d = Math.floor(hrs / 24);
  return d < 30 ? `${d}d ago` : new Date(iso).toLocaleDateString();
}

export default function LeadsWorkspace({
  isFounder,
  members,
  myId,
}: {
  isFounder: boolean;
  members: Array<{ id: string; full_name: string }>;
  myId: string;
}) {
  const [filters, setFilters] = useState<Filters>({ status: "", q: "", assigned: "", website: "", source: "", city: "", from: "", to: "", sort: "newest" });
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [view, setView] = useState<"table" | "kanban">("table");
  const [hydrated, setHydrated] = useState(false);

  // hydrate mirror from server on first load
  useEffect(() => {
    void (async () => {
      const { trySync } = await import("@/lib/local/sync");
      await trySync("leads-mount");
      setHydrated(true);
    })();
  }, []);

  const allLeads = useLiveQuery(() => db.leads.filter((l) => !l.deleted).toArray(), [], [] as CachedLead[]);
  const memberMap = useMemo(() => new Map(members.map((m) => [m.id, m.full_name])), [members]);

  const filtered = useMemo(() => {
    let rows = allLeads;
    if (!isFounder) rows = rows.filter((l) => l.assigned_to === myId || l.created_by === myId);
    if (filters.status) rows = rows.filter((l) => (l.status ?? "NEW") === filters.status);
    if (filters.website) rows = rows.filter((l) => (l.website_status ?? "NONE") === filters.website);
    if (filters.source) rows = rows.filter((l) => (l.source ?? "OTHER") === filters.source);
    if (filters.city) rows = rows.filter((l) => (l.city ?? "").toLowerCase().includes(filters.city.toLowerCase()));
    if (filters.assigned === "unassigned") rows = rows.filter((l) => !l.assigned_to);
    else if (filters.assigned) rows = rows.filter((l) => l.assigned_to === filters.assigned);
    if (filters.q) {
      const q = filters.q.toLowerCase();
      rows = rows.filter((l) =>
        [l.business_name, l.website_url, l.owner_phone, l.owner_name, l.owner_email].some((f) => (f ?? "").toLowerCase().includes(q))
      );
    }
    if (filters.from) rows = rows.filter((l) => (l.created_at ?? "") >= `${filters.from}T00:00:00`);
    if (filters.to) rows = rows.filter((l) => (l.created_at ?? "") <= `${filters.to}T23:59:59`);
    rows = [...rows].sort((a, b) =>
      filters.sort === "activity"
        ? new Date(b.last_activity_at ?? 0).getTime() - new Date(a.last_activity_at ?? 0).getTime()
        : new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
    );
    return rows;
  }, [allLeads, filters, isFounder, myId]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const hasFilters = Object.entries(filters).some(([k, v]) => v && k !== "sort");

  function applyFilters(next: Partial<Filters>) {
    setFilters((f) => ({ ...f, ...next }));
    setPage(1);
  }

  // kanban drag (offline-first: optimistic + queued)
  function onDropLead(leadId: string, newStatus: string) {
    const lead = allLeads.find((l) => l.id === leadId);
    if (!lead || lead.status === newStatus) return;
    void mutateLead("update", { status: newStatus }, { recordId: leadId, baseVersion: new Date(lead.updated_at).getTime() }).then(() => {
      toast.success(`${lead.business_name} → ${newStatus.replace(/_/g, " ")}`);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Leads</h1>
          <p className="text-sm text-muted-foreground">
            {filtered.length} shown{!isFounder && " · your assigned leads"}
          </p>
        </div>
        <div className="flex gap-2">
          <div className="flex overflow-hidden rounded-lg border">
            <button
              onClick={() => setView("table")}
              className={cn("flex h-9 w-9 items-center justify-center", view === "table" ? "bg-primary text-primary-foreground" : "text-muted-foreground")}
              aria-label="Table view"
            >
              <Table2 className="h-4 w-4" />
            </button>
            <button
              onClick={() => setView("kanban")}
              className={cn("flex h-9 w-9 items-center justify-center", view === "kanban" ? "bg-primary text-primary-foreground" : "text-muted-foreground")}
              aria-label="Kanban view"
            >
              <Columns3 className="h-4 w-4" />
            </button>
          </div>
          <Button asChild size="sm">
            <Link href="/leads/new"><Plus className="h-4 w-4" /> Add Lead</Link>
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filters.q}
            onChange={(e) => applyFilters({ q: e.target.value })}
            placeholder="Search name, domain, phone, owner…"
            className="pl-9"
          />
        </div>
        <Button variant={showFilters || hasFilters ? "default" : "outline"} size="icon" onClick={() => setShowFilters((s) => !s)} aria-label="Filters">
          <Filter className="h-4 w-4" />
        </Button>
      </div>

      {showFilters && (
        <div className="grid grid-cols-2 gap-2 rounded-xl border bg-card p-3 md:grid-cols-3 lg:grid-cols-7">
          <SimpleSelect ariaLabel="Status" value={filters.status} placeholder="Status" onChange={(v) => applyFilters({ status: v })} options={LEAD_STATUSES.map((s) => ({ label: s.replace(/_/g, " "), value: s }))} />
          <SimpleSelect ariaLabel="Website" value={filters.website} placeholder="Website" onChange={(v) => applyFilters({ website: v })} options={WEBSITE_STATUSES.map((s) => ({ label: s.replace(/_/g, " "), value: s }))} />
          <SimpleSelect ariaLabel="Source" value={filters.source} placeholder="Source" onChange={(v) => applyFilters({ source: v })} options={LEAD_SOURCES.map((s) => ({ label: s.replace(/_/g, " "), value: s }))} />
          {isFounder && (
            <SimpleSelect
              ariaLabel="Assigned"
              value={filters.assigned}
              placeholder="Assigned to"
              onChange={(v) => applyFilters({ assigned: v })}
              options={[{ label: "Unassigned", value: "unassigned" }, ...members.map((m) => ({ label: m.full_name, value: m.id }))]}
            />
          )}
          <Input value={filters.city} onChange={(e) => applyFilters({ city: e.target.value })} placeholder="City" aria-label="City" />
          <Input type="date" value={filters.from} onChange={(e) => applyFilters({ from: e.target.value })} aria-label="From" />
          <div className="flex gap-2">
            <Input type="date" value={filters.to} onChange={(e) => applyFilters({ to: e.target.value })} aria-label="To" />
            <Button
              variant="ghost"
              size="icon"
              aria-label="Clear"
              onClick={() => setFilters({ status: "", q: "", assigned: "", website: "", source: "", city: "", from: "", to: "", sort: "newest" })}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {!hydrated ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Building2}
          title={hasFilters ? "No leads match your filters" : "No leads yet"}
          description={hasFilters ? "Try clearing the filters or a different search." : "Import your scraped leads to start the pipeline."}
          actionLabel="Add Lead"
          actionHref="/leads/new"
        />
      ) : view === "table" ? (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-xl border bg-card md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-2.5 font-semibold">Business</th>
                    <th className="px-3 py-2.5 font-semibold">Website</th>
                    <th className="px-3 py-2.5 font-semibold">Status</th>
                    <th className="px-3 py-2.5 font-semibold">Assigned</th>
                    <th className="px-3 py-2.5 font-semibold">Activity</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((lead) => (
                    <tr key={lead.id} className={cn("border-b last:border-0 hover:bg-muted/30", lead.dirty && "bg-accent/30")}>
                      <td className="max-w-64 px-3 py-2.5">
                        <Link href={`/leads/${lead.id}`} className="block truncate font-medium hover:text-primary">
                          {lead.business_name}
                          {lead.dirty && <span className="ml-1.5 rounded bg-warning/20 px-1 text-[9px] font-bold text-warning">PENDING</span>}
                        </Link>
                        <p className="truncate text-xs text-muted-foreground">{lead.city ?? "—"}{lead.state ? `, ${lead.state}` : ""}</p>
                      </td>
                      <td className="px-3 py-2.5"><WebsiteBadge status={lead.website_status as never} /></td>
                      <td className="px-3 py-2.5"><StatusBadge status={lead.status as never} /></td>
                      <td className="px-3 py-2.5">
                        {lead.assigned_to ? (
                          <span className="inline-flex items-center gap-1.5">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-accent-foreground">
                              {initials(memberMap.get(lead.assigned_to) ?? "?")}
                            </span>
                            <span className="text-xs">{memberMap.get(lead.assigned_to)}</span>
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-xs text-muted-foreground">{timeAgo(lead.last_activity_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile cards */}
          <div className="grid gap-2 md:hidden">
            {pageRows.map((lead) => (
              <Link key={lead.id} href={`/leads/${lead.id}`} className="rounded-xl border bg-card p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{lead.business_name}</p>
                    <p className="text-xs text-muted-foreground">{lead.city ?? "—"}</p>
                  </div>
                  <StatusBadge status={lead.status as never} />
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <WebsiteBadge status={lead.website_status as never} />
                  <span className="text-[11px] text-muted-foreground">{timeAgo(lead.last_activity_at)}</span>
                </div>
              </Link>
            ))}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Page {page} of {totalPages}</p>
            <div className="flex gap-1">
              <Button variant="outline" size="icon-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label="Previous"><ChevronLeft className="h-4 w-4" /></Button>
              <Button variant="outline" size="icon-sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} aria-label="Next"><ChevronRight className="h-4 w-4" /></Button>
            </div>
          </div>
        </>
      ) : (
        /* Kanban */
        <div className="flex gap-3 overflow-x-auto pb-4">
          {LEAD_STATUSES.map((status) => {
            const col = filtered.filter((l) => (l.status ?? "NEW") === status);
            return (
              <div
                key={status}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  const id = e.dataTransfer.getData("text/lead-id");
                  if (id) onDropLead(id, status);
                }}
                className="w-60 shrink-0 rounded-xl border bg-muted/40"
              >
                <div className="flex items-center justify-between px-3 py-2">
                  <StatusBadge status={status} />
                  <span className="text-xs font-semibold text-muted-foreground">{col.length}</span>
                </div>
                <div className="max-h-[60vh] space-y-2 overflow-y-auto p-2">
                  {col.map((lead) => (
                    <div
                      key={lead.id}
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData("text/lead-id", lead.id)}
                      className="cursor-grab rounded-lg border bg-card p-2.5 text-sm shadow-sm active:cursor-grabbing"
                    >
                      <Link href={`/leads/${lead.id}`} className="block truncate font-medium">{lead.business_name}</Link>
                      <p className="truncate text-xs text-muted-foreground">{lead.city ?? "—"}</p>
                      <div className="mt-1.5"><WebsiteBadge status={lead.website_status as never} /></div>
                    </div>
                  ))}
                  {col.length === 0 && <p className="py-4 text-center text-xs text-muted-foreground">Empty</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
