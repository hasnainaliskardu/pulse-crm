"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BadgeDollarSign,
  BarChart3,
  Building2,
  CalendarDays,
  CheckSquare,
  DollarSign,
  Flag,
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  PhoneCall,
  Plus,
  ScrollText,
  Trophy,
  Users,
  Zap,
} from "lucide-react";
import { MarkAttendanceButton } from "@/components/attendance-button";
import { cn, initials, levelOf } from "@/lib/utils";
import type { Database } from "@/types/supabase";
import { SyncProvider } from "@/components/sync-provider";
import { ConnBadge, OfflineBanner } from "@/components/conn-badge";

type Member = Database["public"]["Tables"]["members"]["Row"];

interface NavItem {
  href: string;
  label: string;
  icon: typeof Home;
  founderOnly?: boolean;
  mobile?: boolean;
}

const navItems: NavItem[] = [
  { href: "/founder", label: "Dashboard", icon: LayoutDashboard, founderOnly: true, mobile: true },
  { href: "/app", label: "My Day", icon: Home, mobile: false },
  { href: "/leads", label: "Leads (Intl)", icon: Building2, mobile: true },
  { href: "/calls", label: "Cold Calling", icon: PhoneCall, mobile: true },
  { href: "/meetings", label: "Meetings", icon: CalendarDays, mobile: false },
  { href: "/attendance", label: "Attendance", icon: CheckSquare, mobile: false },
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy, mobile: false },
  { href: "/tasks", label: "Tasks", icon: CheckSquare, mobile: true },
  { href: "/calendar", label: "Calendar", icon: CalendarDays, mobile: false },
  { href: "/leads/new", label: "Add Lead", icon: Plus, mobile: false },
  { href: "/team", label: "Team", icon: Users, founderOnly: true, mobile: false },
  { href: "/targets", label: "Targets", icon: Flag, founderOnly: true, mobile: false },
  { href: "/revenue", label: "Revenue", icon: DollarSign, founderOnly: true, mobile: false },
  { href: "/money", label: "Money & Salaries", icon: BadgeDollarSign, founderOnly: true, mobile: false },
  { href: "/reports", label: "Reports", icon: BarChart3, founderOnly: true, mobile: false },
  { href: "/activity", label: "Activity Log", icon: ScrollText, founderOnly: true, mobile: false },
  { href: "/settings", label: "Settings", icon: Menu, founderOnly: true, mobile: false },
];

function SidebarLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      <Icon className="h-4 w-4" />
      {item.label}
    </Link>
  );
}

export function AppShell({ member, children }: { member: Member; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const isFounder = member.role === "FOUNDER";

  // mobile nav: Home, Leads, Add(FAB), Tasks, More(profile)
  const mobileCandidates = isFounder
    ? [
        { href: "/founder", label: "Home", icon: LayoutDashboard },
        { href: "/leads", label: "Leads", icon: Building2 },
        { href: "/leads/new", label: "Add", icon: Plus, center: true },
        { href: "/tasks", label: "Tasks", icon: CheckSquare },
        { href: "/settings", label: "More", icon: Menu },
      ]
    : [
        { href: "/app", label: "Home", icon: Home },
        { href: "/leads", label: "Leads", icon: Building2 },
        { href: "/leads/new", label: "Add", icon: Plus, center: true },
        { href: "/tasks", label: "Tasks", icon: CheckSquare },
        { href: "/leaderboard", label: "Ranks", icon: Trophy },
      ];

  const desktopItems = navItems.filter((n) => {
    if (isFounder) return true;
    // cold-calling workspace members don't need the intl-leads add form in nav
    if (n.href === "/leads/new") return (member.workspaces ?? ["INTL"]).includes("INTL");
    return !n.founderOnly;
  });

  async function signOut() {
    setSigningOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  const isActive = (href: string) =>
    href === "/founder" || href === "/app" ? pathname === href : pathname.startsWith(href);

  const lvl = levelOf(member.points);

  return (
    <SyncProvider userId={member.id}>
      {/* PWA service worker registration */}
      <ServiceWorkerRegistrar />

      <OfflineBanner />
      <div className="min-h-screen bg-background">
        {/* Desktop sidebar */}
        <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r bg-card lg:flex">
          <div className="flex h-16 items-center gap-2.5 border-b px-5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Zap className="h-4 w-4" fill="currentColor" />
            </div>
            <span className="text-lg font-bold tracking-tight">HANA CRM</span>
          </div>
          <nav className="flex-1 space-y-1 overflow-y-auto p-3">
            {desktopItems.map((item) => (
              <SidebarLink key={item.href} item={item} active={isActive(item.href)} />
            ))}
          </nav>
          <div className="border-t p-3">
            <div className="mb-2 flex items-center gap-3 rounded-lg p-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-sm font-bold text-accent-foreground">
                {initials(member.full_name)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{member.full_name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {isFounder ? "Founder" : member.position}
                </p>
              </div>
              <span className="rounded-md bg-accent px-1.5 py-0.5 text-[10px] font-bold text-accent-foreground">
                L{lvl.level}
              </span>
            </div>
            <button
              onClick={signOut}
              disabled={signingOut}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-destructive"
            >
              <LogOut className="h-4 w-4" /> Sign Out
            </button>
          </div>
        </aside>

        {/* Main */}
        <div className="lg:pl-60">
          {/* Mobile header */}
          <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-card/90 px-4 backdrop-blur lg:hidden">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <Zap className="h-3.5 w-3.5" fill="currentColor" />
              </div>
              <span className="font-bold">HANA CRM</span>
            </div>
            <div className="flex items-center gap-2">
              <MarkAttendanceButton memberId={member.id} compact />
              <ConnBadge />
              <span className="rounded-md bg-accent px-1.5 py-0.5 text-[10px] font-bold text-accent-foreground">
                L{lvl.level} {lvl.name}
              </span>
            </div>
          </header>

          {/* Desktop topbar */}
          <header className="sticky top-0 z-30 hidden h-14 items-center justify-end gap-3 border-b bg-card/90 px-8 backdrop-blur lg:flex">
            <MarkAttendanceButton memberId={member.id} />
            <ConnBadge />
          </header>

          <div className="mx-auto max-w-7xl px-4 pb-24 pt-6 lg:px-8 lg:pt-8">
            {children}
          </div>
        </div>

        {/* Mobile bottom nav with center FAB */}
        <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 backdrop-blur lg:hidden">
          <div className="relative grid h-16 grid-cols-5">
            {mobileCandidates.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              if ((item as { center?: boolean }).center) {
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-end justify-center"
                    aria-label="Add"
                  >
                    <span className="-mt-5 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg">
                      <Icon className="h-6 w-6" />
                    </span>
                  </Link>
                );
              }
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1 text-[11px] font-medium",
                    active ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </SyncProvider>
  );
}

function ServiceWorkerRegistrar() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
