"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { KeyRound, Plus, UserCog, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SimpleSelect } from "@/components/ui/simple-select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { initials, levelOf, POSITIONS } from "@/lib/utils";
import type { MemberRow } from "@/types/supabase";

export default function TeamClient({ members }: { members: MemberRow[] }) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  // create form
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [position, setPosition] = useState("Researcher");
  const [password, setPassword] = useState("");
  const [researchTarget, setResearchTarget] = useState("40");
  const [touchTarget, setTouchTarget] = useState("45");

  // reset password dialog
  const [resetFor, setResetFor] = useState<MemberRow | null>(null);
  const [newPassword, setNewPassword] = useState("");

  async function call(body: Record<string, unknown>) {
    const res = await fetch("/api/admin/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Failed");
    return data;
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await call({
        action: "createMember",
        fullName,
        email,
        position,
        password,
        dailyResearchTarget: Number(researchTarget),
        dailyTouchTarget: Number(touchTarget),
      });
      toast.success(`Member created: ${fullName}`);
      setCreateOpen(false);
      setFullName(""); setEmail(""); setPassword(""); setPosition("Researcher");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(m: MemberRow) {
    setBusy(true);
    try {
      await call({ action: "updateMember", memberId: m.id, isActive: !m.is_active });
      toast.success(m.is_active ? "Deactivated" : "Reactivated");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!resetFor) return;
    setBusy(true);
    try {
      await call({ action: "resetPassword", memberId: resetFor.id, newPassword });
      toast.success("Password reset");
      setResetFor(null);
      setNewPassword("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Users className="h-6 w-6 text-primary" /> Team
          </h1>
          <p className="text-sm text-muted-foreground">{members.length} accounts — create, edit, deactivate, reset passwords.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> Create Member</Button>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        {(members ?? []).map((m) => {
          const lvl = levelOf(m.points);
          return (
            <div key={m.id} className="flex flex-wrap items-center gap-3 border-b p-3 last:border-0">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-sm font-bold text-accent-foreground">
                {initials(m.full_name)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/team/${m.id}`} className="truncate text-sm font-semibold hover:text-primary">{m.full_name}</Link>
                  {m.role === "FOUNDER" && <Badge variant="default">Founder</Badge>}
                  <Badge variant="secondary">L{lvl.level} {lvl.name}</Badge>
                  {!m.is_active && <Badge variant="destructive">Deactivated</Badge>}
                </div>
                <p className="truncate text-xs text-muted-foreground">{m.email} · {m.position} · {m.points} pts · targets {m.daily_research_target}/{m.daily_touch_target}</p>
              </div>
              {m.role !== "FOUNDER" && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setResetFor(m)}>
                    <KeyRound className="h-3.5 w-3.5" /> Reset
                  </Button>
                  <Button variant={m.is_active ? "destructive" : "secondary"} size="sm" disabled={busy} onClick={() => toggleActive(m)}>
                    {m.is_active ? "Deactivate" : "Reactivate"}
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create team member</DialogTitle>
            <DialogDescription>The member can sign in immediately with this password.</DialogDescription>
          </DialogHeader>
          <form onSubmit={create} className="space-y-3">
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Full name" required minLength={2} />
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required />
            <SimpleSelect ariaLabel="Position" value={position} onChange={setPosition} options={POSITIONS.map((p) => ({ label: p, value: p }))} />
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password (min 8 chars)" required minLength={8} />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Daily research target</label>
                <Input type="number" value={researchTarget} onChange={(e) => setResearchTarget(e.target.value)} min={0} max={500} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Daily touch target</label>
                <Input type="number" value={touchTarget} onChange={(e) => setTouchTarget(e.target.value)} min={0} max={500} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={busy}><UserCog className="h-4 w-4" /> Create</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Reset password dialog */}
      <Dialog open={!!resetFor} onOpenChange={(o) => !o && setResetFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset password — {resetFor?.full_name}</DialogTitle>
            <DialogDescription>Sets a new password immediately.</DialogDescription>
          </DialogHeader>
          <form onSubmit={resetPassword} className="space-y-3">
            <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="New password (min 8 chars)" required minLength={8} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setResetFor(null)}>Cancel</Button>
              <Button type="submit" disabled={busy}>Reset password</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
