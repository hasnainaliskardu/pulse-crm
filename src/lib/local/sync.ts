"use client";

/**
 * HANA CRM sync engine.
 * - Pulls server changes into the local mirror (when online).
 * - Replays outbox queue to Supabase in order with retries + exponential backoff.
 * - Merge conflicts field-by-field (newest non-null wins) — never drops data.
 * - Emits connection state events for the header UI.
 */
import { createClient } from "@supabase/supabase-js";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { db, enqueue } from "./db";

export type ConnState = "online" | "offline" | "syncing" | "synced" | "error";

interface StateListeners {
  onStateChange?: (state: ConnState, pending: number) => void;
  onMirrorUpdate?: (tables: string[]) => void;
}

const SYNC_ENDPOINT = "/api/sync";
const HEARTBEAT_MS = 30_000;

let state: ConnState = "online";
let pending = 0;
let listeners: StateListeners = {};
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let syncing = false;

const anon = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );

export function initSync(listeners_: StateListeners) {
  listeners = listeners_;
  void refreshPending();

  if (typeof window !== "undefined") {
    window.addEventListener("online", () => void trySync("network-online"));
    window.addEventListener("offline", () => setConn("offline"));
    heartbeatTimer = setInterval(() => void heartbeat(), HEARTBEAT_MS);
    void heartbeat();
    void trySync("startup");
  }

  return () => {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
  };
}

function setConn(next: ConnState) {
  state = next;
  listeners.onStateChange?.(next, pending);
}

async function refreshPending() {
  pending = await db.outbox.where("status").anyOf(["pending", "error", "syncing"]).count();
  listeners.onStateChange?.(state, pending);
}

async function heartbeat() {
  if (!navigator.onLine) {
    setConn("offline");
    return;
  }
  try {
    const res = await fetch("/api/health", { cache: "no-store" });
    if (res.ok) {
      setConn(pending > 0 ? "syncing" : state === "offline" ? "online" : state);
      if (pending > 0) void trySync("heartbeat");
    } else {
      setConn("offline");
    }
  } catch {
    setConn("offline");
  }
}

/** Main entry: flush outbox then pull server deltas. Safe to call often. */
export async function trySync(_reason = "manual") {
  if (!navigator.onLine) {
    setConn("offline");
    return;
  }
  if (syncing) return;
  syncing = true;
  setConn("syncing");
  try {
    await flushOutbox();
    await pullChanges();
    setConn(pending > 0 ? "error" : "synced");
    setTimeout(() => {
      if (state === "synced") setConn("online");
    }, 2000);
  } catch {
    setConn(pending > 0 ? "error" : "online");
  } finally {
    syncing = false;
    await refreshPending();
  }
}

/** Replay queued mutations in order. 3 attempts per item with exponential backoff, then park with error badge. */
async function flushOutbox() {
  const queue = await db.outbox.orderBy("id").filter((i) => i.status === "pending" || (i.status === "error" && i.attempts < 3)).toArray();

  for (const item of queue) {
    await db.outbox.update(item.id!, { status: "syncing" });
    try {
      const res = await fetch(SYNC_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          table: item.table,
          op: item.op,
          recordId: item.recordId,
          payload: item.payload,
          baseVersion: item.baseVersion,
        }),
      });
      if (res.status === 409) {
        // conflict: server merged field-by-field; server version returned — accept merge
        const { serverRecord } = await res.json();
        await applyServerRecord(item.table, serverRecord);
        await db.outbox.delete(item.id!);
      } else if (res.ok) {
        const { record } = await res.json().catch(() => ({ record: null }));
        if (record) await applyServerRecord(item.table, record);
        await db.outbox.delete(item.id!);
      } else {
        throw new Error(`Sync failed (${res.status})`);
      }
    } catch (err) {
      const attempts = item.attempts + 1;
      if (attempts >= 3) {
        await db.outbox.update(item.id!, {
          status: "error",
          attempts,
          lastError: err instanceof Error ? err.message : "Unknown",
        });
      } else {
        await db.outbox.update(item.id!, { status: "pending", attempts, lastError: err instanceof Error ? err.message : "Unknown" });
        await backoff(attempts);
      }
    }
  }
  await refreshPending();
}

function backoff(attempt: number) {
  return new Promise((r) => setTimeout(r, Math.min(30_000, 2 ** attempt * 1000)));
}

/** Pull all rows changed since last cursor (simplified full-refresh pull for small dataset slices). */
async function pullChanges() {
  const cursor = (await db.meta.get("last_pull"))?.value ?? "0";
  const res = await fetch(`${SYNC_ENDPOINT}?since=${cursor}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Pull failed");
  const { leads, touches, tasks, notes, clients, members, stats, cursor: newCursor } = await res.json();

  const bulk = async (table: string, rows: Array<Record<string, unknown>>) => {
    if (!rows?.length) return;
    const store = (db as unknown as Record<string, { put: (r: unknown) => Promise<unknown> }>)[table];
    await Promise.all(rows.map((r) => store.put(r)));
  };
  await bulk("leads", leads);
  await bulk("touches", touches);
  await bulk("tasks", tasks);
  await bulk("notes", notes);
  await bulk("clients", clients);
  await bulk("members", members);
  if (stats?.length) await db.stats.bulkPut(stats);

  await db.meta.put({ key: "last_pull", value: newCursor ?? String(Date.now()) });
  listeners.onMirrorUpdate?.(["leads", "touches", "tasks", "notes", "clients", "members", "stats"]);
}

async function applyServerRecord(table: string, record: Record<string, unknown> | null) {
  if (!record) return;
  const store = (db as unknown as Record<string, { put: (r: unknown) => Promise<unknown> }>)[table];
  if (store) {
    await store.put(record as never);
    if (table === "leads" && typeof record.id === "string") {
      const lead = await db.leads.get(record.id);
      if (lead) await db.leads.update(record.id, { dirty: false });
    }
  }
  listeners.onMirrorUpdate?.([table]);
}

/** Subscribe to realtime updates (called once when online). */
export function subscribeRealtime(userId: string) {
  const supabase = anon();
  const channel: RealtimeChannel = supabase
    .channel(`hana-${userId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, (payload) => {
      void applyServerRecord("leads", payload.new as Record<string, unknown>);
    })
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "touches" }, (payload) => {
      void applyServerRecord("touches", payload.new as Record<string, unknown>);
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, (payload) => {
      void applyServerRecord("tasks", payload.new as Record<string, unknown>);
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "clients" }, (payload) => {
      void applyServerRecord("clients", payload.new as Record<string, unknown>);
    })
    .subscribe();
  return () => supabase.removeChannel(channel);
}

/* ---------------- Public mutation API (offline-first) ---------------- */

/**
 * Write-through: update local mirror immediately (optimistic) and enqueue outbox item.
 * Returns immediately; sync engine replays later.
 */
export async function mutateLead(
  op: "insert" | "update" | "delete",
  data: Record<string, unknown>,
  opts: { recordId?: string; baseVersion?: number } = {}
) {
  if (op === "insert") {
    const id = (data.id as string) ?? crypto.randomUUID();
    const now = new Date().toISOString();
    const lead = { ...data, id, created_at: now, updated_at: now, last_activity_at: now, dirty: true } as never;
    await db.leads.put(lead);
    await enqueue("leads", "insert", { ...data, id }, { recordId: id, baseVersion: opts.baseVersion });
    listeners.onMirrorUpdate?.(["leads"]);
    return id;
  }
  if (op === "update" && opts.recordId) {
    const existing = await db.leads.get(opts.recordId);
    const merged = { ...(existing ?? {}), ...data, updated_at: new Date().toISOString(), dirty: true } as never;
    await db.leads.put(merged);
    await enqueue("leads", "update", data, opts);
    listeners.onMirrorUpdate?.(["leads"]);
    return opts.recordId;
  }
  if (op === "delete" && opts.recordId) {
    await db.leads.update(opts.recordId, { deleted: true, dirty: true });
    await enqueue("leads", "delete", {}, opts);
    listeners.onMirrorUpdate?.(["leads"]);
    return opts.recordId;
  }
  throw new Error("Invalid lead mutation");
}

export async function mutateTouch(data: {
  lead_id: string;
  channel: string;
  direction: string;
  message_summary: string;
  message_full?: string | null;
  occurred_at?: string;
}) {
  const id = crypto.randomUUID();
  const memberId = (await db.meta.get("user_id"))?.value ?? "";
  const now = new Date().toISOString();
  const touch = {
    ...data,
    id,
    member_id: memberId,
    occurred_at: data.occurred_at ?? now,
    created_at: now,
    dirty: true,
  } as never;
  await db.touches.put(touch);
  // optimistic local lead status nudge
  const lead = await db.leads.get(data.lead_id);
  if (lead) {
    const patch: Record<string, unknown> = { last_activity_at: now, dirty: true };
    if (data.direction === "IN" && ["NEW", "RESEARCHING", "CONTACTED"].includes(lead.status)) patch.status = "REPLIED";
    if (data.direction === "OUT" && ["NEW", "RESEARCHING"].includes(lead.status)) patch.status = "CONTACTED";
    await db.leads.update(data.lead_id, patch as never);
    await enqueue("leads", "update", patch, { recordId: data.lead_id });
  }
  await enqueue("touches", "insert", { ...data, id }, { recordId: id });
  await trySync("touch-logged");
  listeners.onMirrorUpdate?.(["touches", "leads"]);
  return id;
}

export async function mutateTask(data: Record<string, unknown>, op: "insert" | "update" = "insert", recordId?: string) {
  const id = (recordId ?? crypto.randomUUID()) as string;
  const now = new Date().toISOString();
  const task = { ...data, id, updated_at: now, dirty: true } as never;
  await db.tasks.put(task);
  await enqueue("tasks", op, op === "insert" ? { ...data, id } : data, { recordId: id });
  await trySync("task-saved");
  listeners.onMirrorUpdate?.(["tasks"]);
  return id;
}

export async function mutateNote(data: { lead_id: string; body: string }) {
  const id = crypto.randomUUID();
  const authorId = (await db.meta.get("user_id"))?.value ?? null;
  const now = new Date().toISOString();
  await db.notes.put({ ...data, id, author_id: authorId, created_at: now, dirty: true } as never);
  await enqueue("notes", "insert", { ...data, id }, { recordId: id });
  await trySync("note-added");
  listeners.onMirrorUpdate?.(["notes"]);
  return id;
}

export async function mutateClient(data: Record<string, unknown>, op: "insert" | "update" = "insert", recordId?: string) {
  const id = (recordId ?? crypto.randomUUID()) as string;
  const now = new Date().toISOString();
  await db.clients.put({ ...data, id, updated_at: now, dirty: true } as never);
  await enqueue("clients", op, op === "insert" ? { ...data, id } : data, { recordId: id });
  await trySync("client-saved");
  listeners.onMirrorUpdate?.(["clients"]);
  return id;
}

/** Store logged-in user id for attribution of offline mutations. */
export async function setLocalUser(userId: string) {
  await db.meta.put({ key: "user_id", value: userId });
}
