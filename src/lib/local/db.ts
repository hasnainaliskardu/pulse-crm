/**
 * HANA CRM — client-side local mirror + outbox queue (Dexie / IndexedDB).
 * UI reads from here; sync engine replays outbox to Supabase when online.
 */
import Dexie, { type Table } from "dexie";

export interface OutboxItem {
  id?: number;
  queueId: string; // uuid, survives reloads
  table: "leads" | "touches" | "tasks" | "notes" | "clients" | "custom_field_values" | "workflow_rules" | "members";
  op: "insert" | "update" | "delete";
  recordId: string | null; // server-side id (null for inserts created offline)
  payload: Record<string, unknown>;
  baseVersion: number; // updated_at ms of the cached copy the edit was made against
  attempts: number;
  lastError?: string;
  status: "pending" | "syncing" | "error";
  createdAt: number;
}

export interface CachedLead {
  id: string;
  business_name: string;
  city: string | null;
  state: string | null;
  niche: string | null;
  source: string;
  website_url: string | null;
  website_status: string;
  seo_score: number | null;
  owner_name: string | null;
  owner_email: string | null;
  owner_phone: string | null;
  instagram: string | null;
  facebook: string | null;
  linkedin: string | null;
  assigned_to: string | null;
  status: string;
  reply_type: string;
  monthly_value: number | null;
  notes: string | null;
  last_activity_at: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  dirty?: boolean; // has local changes not yet confirmed by server
  deleted?: boolean;
}

export interface CachedTouch {
  id: string;
  lead_id: string;
  member_id: string;
  channel: string;
  direction: string;
  message_summary: string;
  message_full: string | null;
  occurred_at: string;
  created_at: string;
  dirty?: boolean;
}

export interface CachedTask {
  id: string;
  title: string;
  due_date: string | null;
  assigned_to: string | null;
  lead_id: string | null;
  priority: "LOW" | "MEDIUM" | "HIGH";
  done: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  dirty?: boolean;
}

export interface CachedNote {
  id: string;
  lead_id: string;
  author_id: string | null;
  body: string;
  created_at: string;
  dirty?: boolean;
}

export interface CachedClient {
  id: string;
  business_name: string;
  closed_by: string | null;
  monthly_revenue: number;
  started_at: string;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  dirty?: boolean;
}

export interface CachedMember {
  id: string;
  full_name: string;
  email: string;
  position: string;
  role: string;
  is_active: boolean;
  daily_research_target: number;
  daily_touch_target: number;
  points: number;
  created_at: string;
}

export interface CachedStat {
  member_id: string;
  date: string;
  leads_researched: number;
  touches_sent: number;
  replies_received: number;
  positive_replies: number;
  calls_booked: number;
  clients_closed: number;
}

export interface Draft {
  key: string; // form key, e.g. "lead:<id>" or "touch:<leadId>"
  data: Record<string, unknown>;
  savedAt: number;
}

export class HanaDB extends Dexie {
  leads!: Table<CachedLead, string>;
  touches!: Table<CachedTouch, string>;
  tasks!: Table<CachedTask, string>;
  notes!: Table<CachedNote, string>;
  clients!: Table<CachedClient, string>;
  members!: Table<CachedMember, string>;
  stats!: Table<CachedStat, string>;
  outbox!: Table<OutboxItem, number>;
  drafts!: Table<Draft, string>;
  meta!: Table<{ key: string; value: string }, string>;

  constructor() {
    super("hana-crm");
    this.version(1).stores({
      leads: "id, status, assigned_to, business_name, city, last_activity_at, updated_at, dirty",
      touches: "id, lead_id, member_id, occurred_at",
      tasks: "id, lead_id, assigned_to, due_date, done, updated_at",
      notes: "id, lead_id, created_at",
      clients: "id, status, updated_at",
      members: "id, email",
      stats: "member_id, date",
      outbox: "++id, queueId, table, status, createdAt",
      drafts: "key",
      meta: "key",
    });
  }
}

export const db = new HanaDB();

export async function putDraft(key: string, data: Record<string, unknown>) {
  await db.drafts.put({ key, data, savedAt: Date.now() });
}

export async function takeDraft(key: string): Promise<Draft | undefined> {
  const d = await db.drafts.get(key);
  if (d) await db.drafts.delete(key);
  return d;
}

export async function peekDraft(key: string): Promise<Draft | undefined> {
  return db.drafts.get(key);
}

export function newLocalId(): string {
  return crypto.randomUUID();
}

/** Queue a mutation locally BEFORE the UI shows success. Returns queue id. */
export async function enqueue(
  table: OutboxItem["table"],
  op: OutboxItem["op"],
  payload: Record<string, unknown>,
  opts: { recordId?: string | null; baseVersion?: number } = {}
): Promise<string> {
  const queueId = crypto.randomUUID();
  await db.outbox.add({
    queueId,
    table,
    op,
    recordId: opts.recordId ?? (payload.id as string) ?? null,
    payload,
    baseVersion: opts.baseVersion ?? 0,
    attempts: 0,
    status: "pending",
    createdAt: Date.now(),
  });
  return queueId;
}

export async function pendingCount(): Promise<number> {
  return db.outbox.where("status").anyOf(["pending", "error"]).count();
}
