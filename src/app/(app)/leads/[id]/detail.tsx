"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { toast } from "sonner";
import {
  ArrowLeft,
  CheckCircle2,
  FileText,
  Paperclip,
  Send,
  StickyNote,
  Trash2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SimpleSelect } from "@/components/ui/simple-select";
import { StatusBadge, WebsiteBadge, ChannelTag, ReplyBadge } from "@/components/badges";
import { db, peekDraft, putDraft, takeDraft } from "@/lib/local/db";
import { mutateLead, mutateTouch, mutateNote, mutateTask, trySync } from "@/lib/local/sync";
import { cn, LEAD_STATUSES, TOUCH_CHANNELS, REPLY_TYPES } from "@/lib/utils";
import type { Database } from "@/types/supabase";

type Member = Database["public"]["Tables"]["members"]["Row"];

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const d = Math.floor(hrs / 24);
  return d < 30 ? `${d}d ago` : new Date(iso).toLocaleDateString();
}

const EDIT_FIELDS = [
  { key: "owner_name", label: "Owner Name" },
  { key: "owner_email", label: "Owner Email", type: "email" },
  { key: "owner_phone", label: "Owner Phone", type: "tel" },
  { key: "instagram", label: "Instagram", prefix: "@" },
  { key: "facebook", label: "Facebook" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "city", label: "City" },
  { key: "state", label: "State" },
  { key: "niche", label: "Niche" },
  { key: "website_url", label: "Website URL" },
] as const;

export default function LeadDetail({ me, members }: { me: Member; members: Array<{ id: string; full_name: string }> }) {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const isFounder = me.role === "FOUNDER";

  const lead = useLiveQuery(() => db.leads.get(id), [id]);
  const touches = useLiveQuery(() => db.touches.where("lead_id").equals(id).reverse().sortBy("occurred_at"), [id]);
  const notes = useLiveQuery(() => db.notes.where("lead_id").equals(id).reverse().sortBy("created_at"), [id]);
  const tasks = useLiveQuery(() => db.tasks.where("lead_id").equals(id).toArray(), [id]);

  // ---- edit form state with 3s draft autosave ----
  const [form, setForm] = useState<Record<string, string>>({});
  const [formDirty, setFormDirty] = useState(false);
  const [restoredToastShown, setRestoredToastShown] = useState(false);
  const draftKey = `lead:${id}`;
  const lastSaved = useRef(0);

  useEffect(() => {
    if (!lead || formDirty) return;
    const init: Record<string, string> = {};
    for (const f of EDIT_FIELDS) init[f.key] = (lead as unknown as Record<string, string>)[f.key] ?? "";
    init.notes = lead.notes ?? "";
    setForm(init);
  }, [lead, formDirty]);

  // restore draft once
  useEffect(() => {
    if (restoredToastShown) return;
    void peekDraft(draftKey).then((d) => {
      if (d) {
        setForm((f) => ({ ...f, ...(d.data as Record<string, string>) }));
        setFormDirty(true);
        setRestoredToastShown(true);
        toast.info("Draft restored");
      } else {
        setRestoredToastShown(true);
      }
    });
  }, [draftKey, restoredToastShown]);

  // autosave every 3s while typing
  useEffect(() => {
    if (!formDirty) return;
    const t = setInterval(() => {
      if (Date.now() - lastSaved.current > 2500) {
        void putDraft(draftKey, form as Record<string, unknown>);
        lastSaved.current = Date.now();
      }
    }, 3000);
    return () => clearInterval(t);
  }, [formDirty, form, draftKey]);

  function setField(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    setFormDirty(true);
  }

  async function saveEdits() {
    const patch: Record<string, unknown> = {};
    for (const f of EDIT_FIELDS) {
      const v = form[f.key];
      if (v !== undefined) patch[f.key] = v === "" ? null : v;
    }
    if (form.notes !== undefined) patch.notes = form.notes === "" ? null : form.notes;
    await mutateLead("update", patch, { recordId: id, baseVersion: lead ? new Date(lead.updated_at).getTime() : 0 });
    await takeDraft(draftKey);
    setFormDirty(false);
    toast.success("Lead saved");
  }

  async function changeStatus(status: string) {
    await mutateLead("update", { status }, { recordId: id, baseVersion: lead ? new Date(lead.updated_at).getTime() : 0 });
    toast.success(`Status → ${status.replace(/_/g, " ")}`);
  }

  async function setReplyType(reply_type: string) {
    await mutateLead("update", { reply_type }, { recordId: id, baseVersion: lead ? new Date(lead.updated_at).getTime() : 0 });
  }

  async function markResearched() {
    await mutateLead("update", { status: "READY" }, { recordId: id, baseVersion: lead ? new Date(lead.updated_at).getTime() : 0 });
    toast.success("Marked as READY");
  }

  async function assignTo(memberId: string) {
    await mutateLead("update", { assigned_to: memberId || null }, { recordId: id, baseVersion: lead ? new Date(lead.updated_at).getTime() : 0 });
    toast.success(memberId ? "Assigned" : "Unassigned");
  }

  // ---- log touch form ----
  const [tChannel, setTChannel] = useState("EMAIL");
  const [tDirection, setTDirection] = useState("OUT");
  const [tSummary, setTSummary] = useState("");
  const [tFull, setTFull] = useState("");
  const touchDraftKey = `touch:${id}`;
  const [tRestored, setTRestored] = useState(false);

  useEffect(() => {
    if (tRestored) return;
    void peekDraft(touchDraftKey).then((d) => {
      if (d) {
        const dd = d.data as Record<string, string>;
        if (dd.tSummary) {
          setTSummary(dd.tSummary);
          setTFull(dd.tFull ?? "");
          setTChannel(dd.tChannel ?? "EMAIL");
          setTDirection(dd.tDirection ?? "OUT");
          toast.info("Draft restored");
        }
      }
      setTRestored(true);
    });
  }, [touchDraftKey, tRestored]);

  useEffect(() => {
    if (!tRestored) return;
    const t = setInterval(() => {
      if (tSummary.trim()) void putDraft(touchDraftKey, { tSummary, tFull, tChannel, tDirection });
    }, 3000);
    return () => clearInterval(t);
  }, [tSummary, tFull, tChannel, tDirection, tRestored, touchDraftKey]);

  async function logTouch(e: React.FormEvent) {
    e.preventDefault();
    if (!tSummary.trim()) {
      toast.error("Message summary is required");
      return;
    }
    await mutateTouch({
      lead_id: id,
      channel: tChannel,
      direction: tDirection,
      message_summary: tSummary,
      message_full: tFull || null,
    });
    await takeDraft(touchDraftKey);
    setTSummary("");
    setTFull("");
    toast.success("Touch logged");
  }

  // ---- notes ----
  const [noteBody, setNoteBody] = useState("");
  async function addNote(e: React.FormEvent) {
    e.preventDefault();
    if (!noteBody.trim()) return;
    await mutateNote({ lead_id: id, body: noteBody.trim() });
    setNoteBody("");
    toast.success("Note added");
  }

  // ---- tasks ----
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDue, setTaskDue] = useState("");
  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    if (!taskTitle.trim()) return;
    await mutateTask({
      title: taskTitle.trim(),
      due_date: taskDue || null,
      lead_id: id,
      assigned_to: me.id,
      priority: "MEDIUM",
      done: false,
    });
    setTaskTitle("");
    setTaskDue("");
    toast.success("Task created");
  }

  // ---- files ----
  const [uploading, setUploading] = useState(false);
  async function uploadFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("leadId", id);
      const res = await fetch("/api/files", { method: "POST", body: fd });
      if (!res.ok) throw new Error("Upload failed");
      toast.success("File attached");
    } catch {
      // offline: keep in drafts with warning
      toast.warning("Offline — file will upload when back online");
      await putDraft(`file:${id}:${Date.now()}`, { name: file.name, type: file.type });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  const [files, setFiles] = useState<Array<{ id: string; file_name: string }>>([]);
  useEffect(() => {
    const load = async () => {
      const res = await fetch(`/api/files?leadId=${id}`).catch(() => null);
      if (res?.ok) {
        const data = await res.json();
        setFiles(data.files ?? []);
      }
    };
    void load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [id]);

  if (!lead) {
    return (
      <div className="space-y-3">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-muted" />
        <div className="h-40 animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()} aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-bold tracking-tight">{lead.business_name}</h1>
          <p className="text-xs text-muted-foreground">
            {lead.city ?? "—"}{lead.state ? `, ${lead.state}` : ""} · added {timeAgo(lead.created_at)}
          </p>
        </div>
      </div>

      {/* status controls */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3">
        <SimpleSelect
          ariaLabel="Status"
          value={lead.status}
          onChange={changeStatus}
          className="h-8 w-40 text-xs"
          options={LEAD_STATUSES.map((s) => ({ label: s.replace(/_/g, " "), value: s }))}
        />
        <SimpleSelect
          ariaLabel="Reply type"
          value={lead.reply_type}
          onChange={setReplyType}
          className="h-8 w-36 text-xs"
          options={REPLY_TYPES.map((s) => ({ label: s.replace(/_/g, " "), value: s }))}
        />
        <SimpleSelect
          ariaLabel="Assign"
          value={lead.assigned_to ?? ""}
          onChange={assignTo}
          className="h-8 w-40 text-xs"
          options={[
            { label: "Unassigned", value: "" },
            ...members.map((m) => ({ label: m.full_name, value: m.id })),
          ]}
        />
        {["RESEARCHING"].includes(lead.status) && (
          <Button size="sm" variant="secondary" onClick={markResearched}>
            <CheckCircle2 className="h-4 w-4" /> Mark Researched → READY
          </Button>
        )}
        <div className="ml-auto flex items-center gap-2">
          <StatusBadge status={lead.status as never} />
          <WebsiteBadge status={lead.website_status as never} />
          {lead.dirty && <span className="rounded bg-warning/20 px-1.5 py-0.5 text-[10px] font-bold text-warning">PENDING SYNC</span>}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Editable fields */}
        <section className="rounded-xl border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Details</h2>
            <Button size="sm" variant={formDirty ? "default" : "outline"} onClick={saveEdits} disabled={!formDirty}>
              {formDirty ? "Save changes" : "Saved"}
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {EDIT_FIELDS.map((f) => (
              <div key={f.key}>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">{f.label}</label>
                <Input
                  value={form[f.key] ?? ""}
                  onChange={(e) => setField(f.key, e.target.value)}
                  type={"type" in f ? f.type : "text"}
                  placeholder={"prefix" in f && f.prefix ? f.prefix : ""}
                />
              </div>
            ))}
          </div>
          <div className="mt-3">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Notes</label>
            <Textarea value={form.notes ?? ""} onChange={(e) => setField("notes", e.target.value)} rows={3} />
          </div>
        </section>

        {/* Log touch */}
        <section className="rounded-xl border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold">Log Touch</h2>
          <form onSubmit={logTouch} className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <SimpleSelect
                ariaLabel="Channel"
                value={tChannel}
                onChange={setTChannel}
                options={TOUCH_CHANNELS.map((c) => ({ label: c.replace(/_/g, " "), value: c }))}
              />
              <SimpleSelect
                ariaLabel="Direction"
                value={tDirection}
                onChange={setTDirection}
                options={[
                  { label: "Out (sent)", value: "OUT" },
                  { label: "In (received)", value: "IN" },
                ]}
              />
            </div>
            <Input
              value={tSummary}
              onChange={(e) => setTSummary(e.target.value)}
              placeholder="Message summary (required)"
              required
            />
            <Textarea
              value={tFull}
              onChange={(e) => setTFull(e.target.value)}
              placeholder="Full message (optional)"
              rows={3}
            />
            <Button type="submit" className="w-full">
              <Send className="h-4 w-4" /> Log Touch
            </Button>
          </form>

          {/* Files */}
          <div className="mt-4 border-t pt-3">
            <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <Paperclip className="h-3.5 w-3.5" /> Files
            </h3>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed p-2.5 text-xs text-muted-foreground hover:border-primary/50 hover:text-primary">
              <Upload className="h-4 w-4" />
              {uploading ? "Uploading…" : "Attach file (image/PDF)"}
              <input type="file" className="hidden" onChange={uploadFile} accept="image/*,.pdf" />
            </label>
            {files.length > 0 && (
              <ul className="mt-2 space-y-1">
                {files.map((f) => (
                  <li key={f.id} className="flex items-center gap-2 text-xs">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground" /> {f.file_name}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

      {/* Timeline */}
      <section className="rounded-xl border bg-card p-4">
        <h2 className="mb-3 text-sm font-semibold">Touch Timeline ({touches?.length ?? 0})</h2>
        {(touches ?? []).length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No touches logged yet.</p>
        ) : (
          <div className="space-y-3">
            {(touches ?? []).map((t) => (
              <div key={t.id} className="flex gap-3 border-b pb-3 last:border-0">
                <div className="pt-0.5">
                  <ChannelTag channel={t.channel as never} direction={t.direction as "OUT" | "IN"} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm">{t.message_summary}</p>
                  {t.message_full && <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">{t.message_full}</p>}
                </div>
                <span className="shrink-0 text-[11px] text-muted-foreground">{timeAgo(t.occurred_at)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Notes + Tasks */}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border bg-card p-4">
          <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
            <StickyNote className="h-4 w-4 text-muted-foreground" /> Notes
          </h2>
          <form onSubmit={addNote} className="flex gap-2">
            <Input value={noteBody} onChange={(e) => setNoteBody(e.target.value)} placeholder="Add a note…" />
            <Button type="submit" size="sm" variant="secondary">Add</Button>
          </form>
          <div className="mt-3 space-y-2">
            {(notes ?? []).map((n) => (
              <div key={n.id} className="rounded-lg bg-muted/40 p-2.5 text-sm">
                {n.body}
                <p className="mt-1 text-[11px] text-muted-foreground">{timeAgo(n.created_at)}</p>
              </div>
            ))}
            {(notes ?? []).length === 0 && <p className="py-3 text-center text-xs text-muted-foreground">No notes yet.</p>}
          </div>
        </section>

        <section className="rounded-xl border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold">Tasks</h2>
          <form onSubmit={addTask} className="flex flex-wrap gap-2">
            <Input value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder="Task title" className="flex-1" />
            <Input type="date" value={taskDue} onChange={(e) => setTaskDue(e.target.value)} className="w-40" aria-label="Due date" />
            <Button type="submit" size="sm" variant="secondary">Add</Button>
          </form>
          <div className="mt-3 space-y-2">
            {(tasks ?? []).map((t) => (
              <label key={t.id} className="flex items-center gap-2 rounded-lg border p-2 text-sm">
                <input
                  type="checkbox"
                  checked={t.done}
                  onChange={() => void mutateTask({ done: !t.done }, "update", t.id)}
                  className="h-4 w-4 accent-[hsl(var(--primary))]"
                />
                <span className={cn("flex-1", t.done && "text-muted-foreground line-through")}>{t.title}</span>
                {t.due_date && <span className="text-[11px] text-muted-foreground">{t.due_date}</span>}
              </label>
            ))}
            {(tasks ?? []).length === 0 && <p className="py-3 text-center text-xs text-muted-foreground">No tasks yet.</p>}
          </div>
        </section>
      </div>
    </div>
  );
}
