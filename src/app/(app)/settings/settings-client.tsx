"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Link2, Plus, Settings as SettingsIcon, Sliders, Trash2, Workflow, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SimpleSelect } from "@/components/ui/simple-select";
import { Badge } from "@/components/ui/badge";
import { LEAD_STATUSES } from "@/lib/utils";
import type { CustomFieldRow, WorkflowRuleRow } from "@/types/supabase";

async function call(body: Record<string, unknown>) {
  const res = await fetch("/api/admin/settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed");
  return data;
}

export default function SettingsClient({
  webhookUrl,
  customFields,
  rules,
}: {
  webhookUrl: string;
  customFields: CustomFieldRow[];
  rules: WorkflowRuleRow[];
}) {
  const [webhook, setWebhook] = useState(webhookUrl);
  const [busy, setBusy] = useState(false);

  // custom field form
  const [cfLabel, setCfLabel] = useState("");
  const [cfEntity, setCfEntity] = useState("LEAD");
  const [cfType, setCfType] = useState("TEXT");
  const [cfOptions, setCfOptions] = useState("");

  // rule form
  const [rName, setRName] = useState("");
  const [rTrigger, setRTrigger] = useState("INTERESTED");
  const [rAction, setRAction] = useState("CREATE_TASK");
  const [rTaskTitle, setRTaskTitle] = useState("");
  const [rDue, setRDue] = useState("1");

  async function saveWebhook() {
    setBusy(true);
    try {
      await fetch("/api/admin/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "setWebhook", url: webhook }),
      });
      toast.success("Webhook URL saved");
    } catch {
      toast.error("Failed to save");
    } finally {
      setBusy(false);
    }
  }

  async function addField() {
    if (!cfLabel.trim()) return;
    setBusy(true);
    try {
      await call({ action: "addCustomField", label: cfLabel, entity: cfEntity, type: cfType, options: cfOptions });
      toast.success("Custom field added");
      setCfLabel(""); setCfOptions("");
      window.location.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function removeField(id: string) {
    await call({ action: "deleteCustomField", id });
    toast.success("Field removed");
    window.location.reload();
  }

  async function addRule() {
    if (!rName.trim()) return;
    setBusy(true);
    try {
      await call({
        action: "saveRule",
        name: rName,
        triggerEvent: "STATUS_CHANGE",
        triggerValue: rTrigger,
        actionType: rAction,
        taskTitle: rTaskTitle,
        dueInDays: Number(rDue) || 1,
      });
      toast.success("Rule saved");
      setRName(""); setRTaskTitle("");
      window.location.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <SettingsIcon className="h-6 w-6 text-primary" /> Settings
        </h1>
        <p className="text-sm text-muted-foreground">Google Sheet sync, custom fields, workflow automation.</p>
      </div>

      {/* Google Sheets webhook */}
      <section className="rounded-xl border bg-card p-4">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold"><Link2 className="h-4 w-4" /> Google Sheet backup webhook</h2>
        <div className="flex flex-wrap gap-2">
          <Input value={webhook} onChange={(e) => setWebhook(e.target.value)} placeholder="https://script.google.com/macros/s/…/exec" className="flex-1" />
          <Button onClick={saveWebhook} disabled={busy}>Save</Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Every new lead and every status change is POSTed here (2 retries, silent if empty). See README for the Apps Script code.
        </p>
      </section>

      {/* Custom fields */}
      <section className="rounded-xl border bg-card p-4">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold"><Sliders className="h-4 w-4" /> Custom fields</h2>
        <div className="mb-3 space-y-2">
          {customFields.map((f) => (
            <div key={f.id} className="flex items-center justify-between rounded-lg border p-2.5 text-sm">
              <div className="flex items-center gap-2">
                <span className="font-medium">{f.label}</span>
                <Badge variant="secondary">{f.entity}</Badge>
                <Badge variant="outline">{f.type}</Badge>
                {f.options && f.options.length > 0 && <span className="text-xs text-muted-foreground">{f.options.join(" / ")}</span>}
              </div>
              <Button variant="ghost" size="icon-sm" onClick={() => removeField(f.id)} aria-label="Delete field">
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
          {customFields.length === 0 && <p className="text-xs text-muted-foreground">No custom fields yet.</p>}
        </div>
        <div className="grid gap-2 sm:grid-cols-5">
          <Input value={cfLabel} onChange={(e) => setCfLabel(e.target.value)} placeholder="Label (e.g. Crew size)" />
          <SimpleSelect ariaLabel="Entity" value={cfEntity} onChange={setCfEntity} options={[{ label: "Lead", value: "LEAD" }, { label: "Client", value: "CLIENT" }]} />
          <SimpleSelect ariaLabel="Type" value={cfType} onChange={setCfType} options={["TEXT", "NUMBER", "SELECT", "DATE"].map((t) => ({ label: t, value: t }))} />
          <Input value={cfOptions} onChange={(e) => setCfOptions(e.target.value)} placeholder="Select options (comma-sep)" disabled={cfType !== "SELECT"} />
          <Button onClick={addField} disabled={busy}><Plus className="h-4 w-4" /> Add field</Button>
        </div>
      </section>

      {/* Workflow rules */}
      <section className="rounded-xl border bg-card p-4">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold"><Workflow className="h-4 w-4" /> Workflow automation</h2>
        <div className="mb-3 space-y-2">
          {rules.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-2.5 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Zap className="h-4 w-4 text-warning" />
                <span className="font-medium">{r.name}</span>
                <span className="text-xs text-muted-foreground">
                  When status = {r.trigger_value} → {r.action_type.replace(/_/g, " ").toLowerCase()}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={r.enabled ? "success" : "muted"}>{r.enabled ? "ON" : "OFF"}</Badge>
                <Button variant="ghost" size="sm" onClick={async () => { await call({ action: "toggleRule", id: r.id, enabled: !r.enabled }); window.location.reload(); }}>
                  {r.enabled ? "Disable" : "Enable"}
                </Button>
                <Button variant="ghost" size="icon-sm" onClick={async () => { await call({ action: "deleteRule", id: r.id }); window.location.reload(); }} aria-label="Delete rule">
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
          {rules.length === 0 && <p className="text-xs text-muted-foreground">No rules yet. Example: when status = INTERESTED → create task &quot;Send proposal&quot; due +1 day.</p>}
        </div>
        <div className="grid gap-2 sm:grid-cols-5">
          <Input value={rName} onChange={(e) => setRName(e.target.value)} placeholder="Rule name" />
          <SimpleSelect ariaLabel="When status" value={rTrigger} onChange={setRTrigger} options={LEAD_STATUSES.map((s) => ({ label: `When ${s.replace(/_/g, " ")}`, value: s }))} />
          <SimpleSelect ariaLabel="Then" value={rAction} onChange={setRAction} options={[{ label: "Create task", value: "CREATE_TASK" }]} />
          <div className="flex gap-2">
            <Input value={rTaskTitle} onChange={(e) => setRTaskTitle(e.target.value)} placeholder="Task title" />
            <Input type="number" value={rDue} onChange={(e) => setRDue(e.target.value)} placeholder="+days" className="w-16" aria-label="Due in days" />
          </div>
          <Button onClick={addRule} disabled={busy}><Plus className="h-4 w-4" /> Add rule</Button>
        </div>
      </section>

      <p className="text-xs text-muted-foreground">
        Need the Apps Script for Google Sheets? Check README.md — paste it, deploy as web app, then paste the URL above.
      </p>
    </div>
  );
}
