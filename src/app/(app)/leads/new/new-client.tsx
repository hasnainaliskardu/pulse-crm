"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, ClipboardPaste, FileUp, Plus, ShieldAlert, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SimpleSelect } from "@/components/ui/simple-select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { db, putDraft, peekDraft, takeDraft } from "@/lib/local/db";
import { mutateLead, trySync } from "@/lib/local/sync";
import { LEAD_SOURCES, LEAD_STATUSES, WEBSITE_STATUSES, domainOf } from "@/lib/utils";

const FIELD_KEYS = [
  "business_name", "city", "state", "niche", "source", "website_url",
  "website_status", "seo_score", "owner_name", "owner_email", "owner_phone",
  "instagram", "facebook", "linkedin", "notes",
] as const;

const SINGLE_FIELDS = [
  { key: "business_name", label: "Business Name *", required: true },
  { key: "city", label: "City" },
  { key: "state", label: "State" },
  { key: "niche", label: "Niche" },
  { key: "owner_name", label: "Owner Name" },
  { key: "owner_email", label: "Owner Email", type: "email" },
  { key: "owner_phone", label: "Owner Phone", type: "tel" },
  { key: "instagram", label: "Instagram" },
  { key: "facebook", label: "Facebook" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "website_url", label: "Website URL" },
  { key: "seo_score", label: "SEO Score (0-100)", type: "number" },
] as const;

function parseDelimited(text: string): string[][] {
  const lines = text.trim().split(/\r?\n/).filter((l) => l.trim());
  return lines.map((line) => {
    if (line.includes("\t")) return line.split("\t").map((c) => c.trim());
    const cells: string[] = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = !inQ;
      } else if (ch === "," && !inQ) {
        cells.push(cur.trim()); cur = "";
      } else cur += ch;
    }
    cells.push(cur.trim());
    return cells;
  });
}

function guessColumn(header: string): string | null {
  const h = header.toLowerCase().replace(/[^a-z]/g, "");
  const map: Array<[string, string[]]> = [
    ["business_name", ["businessname", "business", "company", "name", "companyname"]],
    ["city", ["city", "town"]],
    ["state", ["state", "region"]],
    ["niche", ["niche", "category", "specialty", "service"]],
    ["source", ["source", "leadsource", "where"]],
    ["website_url", ["website", "websiteurl", "url", "site", "domain"]],
    ["website_status", ["websitestatus", "sitestatus"]],
    ["seo_score", ["seoscore", "score"]],
    ["owner_name", ["ownername", "owner", "contact", "contactname", "firstname", "fullname"]],
    ["owner_email", ["owneremail", "email", "owneremailaddress"]],
    ["owner_phone", ["ownerphone", "phone", "phonenumber", "mobile"]],
    ["instagram", ["instagram", "insta", "ig"]],
    ["facebook", ["facebook", "fb"]],
    ["linkedin", ["linkedin", "li"]],
    ["notes", ["notes", "note", "comment", "comments"]],
  ];
  for (const [key, aliases] of map) {
    if (aliases.includes(h)) return key;
  }
  return null;
}

const SOURCE_SET = new Set(LEAD_SOURCES as readonly string[]);
const WSTATUS_SET = new Set(WEBSITE_STATUSES as readonly string[]);

function coerceRow(cells: string[], mapping: Record<number, string>): Record<string, string> {
  const row: Record<string, string> = {};
  cells.forEach((cell, i) => {
    const key = mapping[i];
    if (!key) return;
    let v = cell.trim();
    if (key === "source") v = SOURCE_SET.has(v.toUpperCase().replace(/[\s-]/g, "_")) ? v.toUpperCase().replace(/[\s-]/g, "_") : "OTHER";
    if (key === "website_status") v = WSTATUS_SET.has(v.toUpperCase().replace(/[\s-]/g, "_")) ? v.toUpperCase().replace(/[\s-]/g, "_") : "NONE";
    row[key] = v;
  });
  return row;
}

export default function NewLeadClient({
  meId,
  isFounder,
  members,
}: {
  meId: string;
  isFounder: boolean;
  members: Array<{ id: string; full_name: string }>;
}) {
  const router = useRouter();

  // -------- single form --------
  const [form, setForm] = useState<Record<string, string>>({ source: "OTHER", website_status: "NONE" });
  const [assignTo, setAssignTo] = useState("");
  const draftKey = "lead:new";
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    if (restored) return;
    void peekDraft(draftKey).then((d) => {
      if (d && Object.keys(d.data).length) {
        setForm((f) => ({ ...f, ...(d.data as Record<string, string>) }));
        toast.info("Draft restored");
      }
      setRestored(true);
    });
  }, [draftKey, restored]);

  useEffect(() => {
    if (!restored) return;
    const t = setInterval(() => {
      if (form.business_name?.trim()) void putDraft(draftKey, form);
    }, 3000);
    return () => clearInterval(t);
  }, [form, restored, draftKey]);

  async function submitSingle(e: React.FormEvent) {
    e.preventDefault();
    if (!form.business_name?.trim()) {
      toast.error("Business name is required");
      return;
    }
    const payload: Record<string, unknown> = {
      source: form.source || "OTHER",
      website_status: form.website_status || "NONE",
      status: "NEW",
      ...form,
    };
    if (assignTo) payload.assigned_to = assignTo;
    if (payload.seo_score === "" || payload.seo_score === undefined) delete payload.seo_score;
    const id = await mutateLead("insert", payload);
    await takeDraft(draftKey);
    toast.success("Lead added");
    router.push(`/leads/${id}`);
    void trySync("lead-created");
  }

  // -------- bulk import --------
  const [raw, setRaw] = useState("");
  const [matrix, setMatrix] = useState<string[][]>([]);
  const [hasHeader, setHasHeader] = useState(true);
  const [mapping, setMapping] = useState<Record<number, string>>({});
  const [step, setStep] = useState<"paste" | "preview" | "done">("paste");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ inserted: number; duplicates: number; errors: string[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // duplicate confirmation flow: step 1 warning, step 2 final confirm
  const [dupConfirm, setDupConfirm] = useState<{ open: boolean; count: number; mode: "skip" | "allow"; secondConfirm: boolean }>({ open: false, count: 0, mode: "skip", secondConfirm: false });

  const existingLeads = useLiveQuery(() => db.leads.toArray(), []);

  const parsedRows = useMemo(() => (matrix.length ? matrix.slice(hasHeader ? 1 : 0) : []), [matrix, hasHeader]);

  const duplicateKeys = useMemo(() => {
    const ex = new Set(
      (existingLeads ?? []).map((l) => `${(l.business_name ?? "").trim().toLowerCase()}|${(l.city ?? "").trim().toLowerCase()}`)
    );
    const exDomains = new Set((existingLeads ?? []).map((l) => domainOf(l.website_url)).filter(Boolean));
    const exPhones = new Set((existingLeads ?? []).map((l) => (l.owner_phone ?? "").replace(/\D/g, "")).filter((p) => p.length >= 7));
    const flags: boolean[] = [];
    const inBatch = new Set<string>();
    for (const cells of parsedRows) {
      const row = coerceRow(cells, mapping);
      const key = `${(row.business_name ?? "").trim().toLowerCase()}|${(row.city ?? "").trim().toLowerCase()}`;
      const dom = domainOf(row.website_url);
      const phone = (row.owner_phone ?? "").replace(/\D/g, "");
      const isDup = ex.has(key) || exDomains.has(dom) || exPhones.has(phone) || inBatch.has(key);
      flags.push(isDup);
      if (key && row.business_name) inBatch.add(key);
    }
    return flags;
  }, [parsedRows, mapping, existingLeads]);

  function analyze(text: string) {
    const rows = parseDelimited(text);
    if (rows.length === 0) {
      toast.error("No rows detected");
      return;
    }
    setMatrix(rows);
    const m: Record<number, string> = {};
    const header = rows[0] ?? [];
    let mapped = 0;
    header.forEach((h, i) => {
      const g = guessColumn(h);
      if (g && !Object.values(m).includes(g)) {
        m[i] = g;
        mapped++;
      }
    });
    if (mapped === 0) setHasHeader(false);
    setMapping(m);
    setStep("preview");
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const text = await f.text();
    setRaw(text.slice(0, 500_000));
    analyze(text.slice(0, 500_000));
    e.target.value = "";
  }

  // Custom variables: any unmapped column can get a name; values go into notes as "key: value"
  const [customNames, setCustomNames] = useState<Record<number, string>>({});
  const unmappedCols = useMemo(() => {
    const header = matrix[0] ?? [];
    return header
      .map((h, i) => ({ i, header: hasHeader ? h : `Column ${i + 1}` }))
      .filter(({ i }) => !mapping[i] && !customNames[i]);
  }, [matrix, mapping, customNames, hasHeader]);

  async function runImport(mode: "skip" | "allow") {
    setImporting(true);
    try {
      let inserted = 0;
      let duplicates = 0;
      const errors: string[] = [];
      const toInsert = parsedRows
        .map((cells, i) => ({ cells, dup: duplicateKeys[i] }))
        .filter((r) => mode === "allow" || !r.dup);

      if (mode === "skip") duplicates = parsedRows.length - toInsert.length;

      for (const r of toInsert) {
        const row = coerceRow(r.cells, mapping);
        if (!row.business_name) {
          errors.push("A row is missing business name (mapped).");
          continue;
        }
        const payload: Record<string, unknown> = {
          source: "OTHER",
          website_status: "NONE",
          status: "NEW",
          ...row,
        };
        // custom variables → notes
        const extras: string[] = [];
        for (const [idxStr, name] of Object.entries(customNames)) {
          const i = Number(idxStr);
          const val = r.cells[i];
          if (val && val.trim()) extras.push(`${name.trim()}: ${val.trim()}`);
        }
        if (extras.length) payload.notes = row.notes ? `${row.notes} | ${extras.join(" | ")}` : extras.join(" | ");

        if (isFounder && assignTo) payload.assigned_to = assignTo;
        await mutateLead("insert", payload);
        inserted++;
      }

      setResult({ inserted, duplicates, errors });
      setStep("done");
      toast.success(`Imported ${inserted} leads${duplicates ? `, skipped ${duplicates} duplicates` : ""}`);
      void trySync("bulk-import");
    } finally {
      setImporting(false);
    }
  }

  // import button: if duplicates detected → two-step confirm
  function requestImport(mode: "skip" | "allow") {
    const dupCount = duplicateKeys.filter(Boolean).length;
    if (dupCount > 0) {
      setDupConfirm({ open: true, count: dupCount, mode, secondConfirm: false });
    } else {
      void runImport(mode);
    }
  }

  function confirmDuplicates(second: boolean) {
    if (!second) {
      setDupConfirm((d) => ({ ...d, open: false, secondConfirm: false }));
      // reopen for the FINAL confirmation
      setTimeout(() => setDupConfirm((d) => ({ ...d, open: true, secondConfirm: true })), 150);
      return;
    }
    const mode = dupConfirm.mode;
    setDupConfirm({ open: false, count: 0, mode: "skip", secondConfirm: false });
    void runImport(mode);
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Add Lead</h1>
        <p className="text-sm text-muted-foreground">Single lead or bulk import — works offline too.</p>
      </div>

      <Tabs defaultValue="single">
        <TabsList className="w-full max-w-sm">
          <TabsTrigger value="single" className="flex-1">Single</TabsTrigger>
          <TabsTrigger value="bulk" className="flex-1">Bulk Import</TabsTrigger>
        </TabsList>

        {/* SINGLE */}
        <TabsContent value="single">
          <form onSubmit={submitSingle} className="space-y-4 rounded-xl border bg-card p-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {SINGLE_FIELDS.map((f) => (
                <div key={f.key}>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">{f.label}</label>
                  <Input
                    value={form[f.key] ?? ""}
                    onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
                    type={"type" in f ? (f.type as string) : "text"}
                    required={"required" in f}
                  />
                </div>
              ))}
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Source</label>
                <SimpleSelect
                  ariaLabel="Source"
                  value={form.source ?? "OTHER"}
                  onChange={(v) => setForm((s) => ({ ...s, source: v }))}
                  options={LEAD_SOURCES.map((s) => ({ label: s.replace(/_/g, " "), value: s }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Website Status</label>
                <SimpleSelect
                  ariaLabel="Website status"
                  value={form.website_status ?? "NONE"}
                  onChange={(v) => setForm((s) => ({ ...s, website_status: v }))}
                  options={WEBSITE_STATUSES.map((s) => ({ label: s.replace(/_/g, " "), value: s }))}
                />
              </div>
              {isFounder && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Assign to</label>
                  <SimpleSelect
                    ariaLabel="Assign to"
                    value={assignTo}
                    placeholder="Unassigned"
                    onChange={setAssignTo}
                    options={members.map((m) => ({ label: m.full_name, value: m.id }))}
                  />
                </div>
              )}
            </div>
            <Button type="submit"><Plus className="h-4 w-4" /> Add Lead</Button>
          </form>
        </TabsContent>

        {/* BULK */}
        <TabsContent value="bulk">
          {step === "paste" && (
            <div className="space-y-3 rounded-xl border bg-card p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                  <FileUp className="h-4 w-4" /> Upload .csv
                </Button>
                <input ref={fileRef} type="file" accept=".csv,.tsv,.txt" className="hidden" onChange={onFile} />
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <input type="checkbox" checked={hasHeader} onChange={(e) => setHasHeader(e.target.checked)} className="h-4 w-4 accent-[hsl(var(--primary))]" />
                  First row is a header
                </label>
              </div>
              <Textarea
                value={raw}
                onChange={(e) => setRaw(e.target.value)}
                placeholder={"Paste CSV/TSV here…\nbusiness_name,city,website_url,owner_phone\nAcme Remodeling,Austin,https://acme.com,512-555-0100"}
                rows={10}
                className="font-mono text-xs"
              />
              <div className="flex items-center gap-2">
                <Button onClick={() => analyze(raw)} disabled={!raw.trim()}>
                  <ClipboardPaste className="h-4 w-4" /> Analyze &amp; Preview
                </Button>
                <p className="text-xs text-muted-foreground">Auto-detects columns and duplicates.</p>
              </div>
            </div>
          )}

          {step === "preview" && (
            <div className="space-y-3 rounded-xl border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold">Preview — {parsedRows.length} rows</h2>
                  <p className="text-xs text-muted-foreground">
                    {duplicateKeys.filter(Boolean).length} duplicates detected (marked below)
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setStep("paste")}>Back</Button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b text-left">
                      {(matrix[0] ?? []).map((_, i) => (
                        <th key={i} className="py-2 pr-3">
                          <SimpleSelect
                            ariaLabel={`Column ${i + 1} mapping`}
                            value={mapping[i] ?? ""}
                            placeholder="— skip —"
                            onChange={(v) => setMapping((m) => ({ ...m, [i]: v }))}
                            className="h-7 w-36 text-[11px]"
                            options={FIELD_KEYS.map((k) => ({ label: k.replace(/_/g, " "), value: k }))}
                          />
                        </th>
                      ))}
                    </tr>
                    <tr className="border-b text-left">
                      {(matrix[0] ?? []).map((_, i) => (
                        <th key={`c${i}`} className="pb-2 pr-3">
                          {!mapping[i] && (
                            <Input
                              aria-label={`Custom name for column ${i + 1}`}
                              placeholder="Custom name (optional)"
                              className="h-7 w-36 border-warning/50 text-[11px]"
                              value={customNames[i] ?? ""}
                              onChange={(e) => setCustomNames((c) => ({ ...c, [i]: e.target.value }))}
                            />
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {parsedRows.slice(0, 12).map((cells, r) => (
                      <tr key={r} className={duplicateKeys[r] ? "bg-destructive/5" : ""}>
                        {cells.map((c, i) => (
                          <td key={i} className="max-w-40 truncate py-1.5 pr-3">{c}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {parsedRows.length > 12 && (
                  <p className="pt-2 text-center text-xs text-muted-foreground">+{parsedRows.length - 12} more rows…</p>
                )}
              </div>

              {unmappedCols.length > 0 && (
                <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-2.5 text-xs">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                  <span>
                    {unmappedCols.length} unmapped column{unmappedCols.length > 1 ? "s" : ""} ({unmappedCols.map((c) => c.header).join(", ")}).
                    Skip them (their data is dropped), or give each a custom name above — the values will be saved in the lead notes.
                  </span>
                </div>
              )}

              {isFounder && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground">Assign all to:</span>
                  <SimpleSelect
                    ariaLabel="Assign imported"
                    value={assignTo}
                    placeholder="Unassigned"
                    onChange={setAssignTo}
                    className="h-8 w-44 text-xs"
                    options={members.map((m) => ({ label: m.full_name, value: m.id }))}
                  />
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <Button onClick={() => requestImport("skip")} disabled={importing}>
                  <Upload className="h-4 w-4" /> Import {parsedRows.length - duplicateKeys.filter(Boolean).length} (skip duplicates)
                </Button>
                <Button variant="outline" onClick={() => requestImport("allow")} disabled={importing}>
                  Import all {parsedRows.length}
                </Button>
              </div>
            </div>
          )}

          {step === "done" && result && (
            <div className="space-y-3 rounded-xl border bg-card p-6 text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-success" />
              <h2 className="text-lg font-bold">Import complete</h2>
              <p className="text-sm text-muted-foreground">
                {result.inserted} imported · {result.duplicates} duplicates skipped
              </p>
              {(result.errors ?? []).length > 0 && (
                <div className="rounded-lg bg-destructive/10 p-3 text-left text-xs text-destructive">
                  {result.errors.map((e, i) => <p key={i}>{e}</p>)}
                </div>
              )}
              <div className="flex justify-center gap-2">
                <Button variant="outline" onClick={() => { setStep("paste"); setRaw(""); setMatrix([]); setResult(null); setCustomNames({}); }}>
                  Import more
                </Button>
                <Button onClick={() => router.push("/leads")}>View leads</Button>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {duplicateKeys.some(Boolean) && step === "preview" && (
        <div className="flex items-start gap-2 rounded-xl border border-warning/40 bg-warning/10 p-3 text-xs text-foreground">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          Rows highlighted red match existing leads by name+city, domain, or phone. They will be skipped unless you choose &quot;Import all&quot;.
        </div>
      )}

      {/* Duplicate two-step confirmation */}
      <Dialog open={dupConfirm.open} onOpenChange={(o) => !o && setDupConfirm((d) => ({ ...d, open: false, secondConfirm: false }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-warning" />
              {dupConfirm.secondConfirm ? "Final confirmation" : "Duplicates detected"}
            </DialogTitle>
            <DialogDescription>
              {dupConfirm.secondConfirm ? (
                <>
                  Are you <strong>sure</strong>? {dupConfirm.mode === "allow"
                    ? `This will import ${dupConfirm.count} duplicate lead${dupConfirm.count > 1 ? "s" : ""} into your CRM.`
                    : `This will skip ${dupConfirm.count} duplicate lead${dupConfirm.count > 1 ? "s" : ""} and import the rest.`}
                </>
              ) : (
                <>
                  {dupConfirm.count} row{dupConfirm.count > 1 ? "s" : ""} in this CSV already exist in your CRM (matched by name+city, domain, or phone).
                  {dupConfirm.mode === "allow" ? " Import them anyway as duplicates?" : " Skip them and import only new leads?"}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDupConfirm((d) => ({ ...d, open: false, secondConfirm: false }))}>Cancel</Button>
            <Button
              variant={dupConfirm.secondConfirm ? "destructive" : "default"}
              onClick={() => (dupConfirm.secondConfirm ? confirmDuplicates(true) : confirmDuplicates(false))}
            >
              {dupConfirm.secondConfirm ? "Yes, import" : "Continue"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
