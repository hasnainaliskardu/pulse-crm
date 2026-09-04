import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export function domainOf(url: string | null | undefined) {
  if (!url) return "";
  try {
    const u = url.startsWith("http") ? url : `https://${url}`;
    return new URL(u).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

export function last4(phone: string | null | undefined) {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  return digits.slice(-4);
}

export const LEAD_STATUSES = [
  "NEW",
  "RESEARCHING",
  "READY",
  "CONTACTED",
  "REPLIED",
  "INTERESTED",
  "NOT_INTERESTED",
  "CALL_BOOKED",
  "PROPOSAL",
  "WON",
  "LOST",
  "DORMANT",
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_SOURCES = [
  "GOOGLE_MAPS",
  "HOUZZ",
  "YELP",
  "BBB",
  "SUNBIZ",
  "PERMIT",
  "FACEBOOK",
  "INSTAGRAM",
  "LINKEDIN",
  "OTHER",
] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

export const WEBSITE_STATUSES = ["NONE", "BROKEN", "POOR_SEO", "GOOD"] as const;
export type WebsiteStatus = (typeof WEBSITE_STATUSES)[number];

export const TOUCH_CHANNELS = [
  "EMAIL",
  "IG_DM",
  "WHATSAPP",
  "CALL",
  "LINKEDIN",
  "FACEBOOK",
] as const;
export type TouchChannel = (typeof TOUCH_CHANNELS)[number];

export const REPLY_TYPES = ["NONE", "NEUTRAL", "POSITIVE", "NEGATIVE"] as const;
export type ReplyType2 = (typeof REPLY_TYPES)[number];

export const POSITIONS = ["Researcher", "Sender", "Closer", "Manager"] as const;

export const POINTS = {
  touch: 1,
  research: 2,
  reply: 5,
  positive: 10,
  call: 20,
  won: 100,
} as const;

export function levelOf(points: number) {
  if (points < 500)
    return { level: 1, name: "Rookie", next: 500, floor: 0 };
  if (points < 2000)
    return { level: 2, name: "Scout", next: 2000, floor: 500 };
  if (points < 5000)
    return { level: 3, name: "Hunter", next: 5000, floor: 2000 };
  if (points < 15000)
    return { level: 4, name: "Closer", next: 15000, floor: 5000 };
  return { level: 5, name: "Legend", next: 15000, floor: 15000 };
}

// ---- V2: workspaces, call outcomes, currency ----

export const WORKSPACES = [
  { value: "INTL", label: "International Outreach", short: "INTL" },
  { value: "CALLS", label: "Cold Calling", short: "Calls" },
] as const;

export const CALL_OUTCOMES = [
  { value: "INTERESTED", label: "Interested" },
  { value: "REJECTED", label: "Rejected" },
  { value: "NO_ANSWER", label: "No answer" },
  { value: "WRONG_NUMBER", label: "Wrong number" },
  { value: "SWITCHED_OFF", label: "Phone switched off" },
  { value: "WHATSAPP_REQUEST", label: "Asked to contact on WhatsApp" },
  { value: "MEETING_BOOKED", label: "Meeting booked" },
  { value: "CALLBACK_LATER", label: "Callback later" },
  { value: "OTHER", label: "Other response" },
] as const;

export const OUTCOME_COLORS: Record<string, string> = {
  INTERESTED: "bg-success/10 text-success",
  REJECTED: "bg-destructive/10 text-destructive",
  NO_ANSWER: "bg-muted text-muted-foreground",
  WRONG_NUMBER: "bg-destructive/10 text-destructive",
  SWITCHED_OFF: "bg-muted text-muted-foreground",
  WHATSAPP_REQUEST: "bg-emerald-500/10 text-emerald-600",
  MEETING_BOOKED: "bg-primary/10 text-primary",
  CALLBACK_LATER: "bg-amber-500/10 text-amber-600",
  OTHER: "bg-info/10 text-info",
};

export function outcomeLabel(v?: string | null) {
  return CALL_OUTCOMES.find((o) => o.value === v)?.label ?? v ?? "";
}

export const ATTENDANCE_STATUSES = [
  { value: "PRESENT", label: "Present" },
  { value: "ABSENT", label: "Absent" },
  { value: "LEAVE", label: "Leave" },
  { value: "HALF_DAY", label: "Half day" },
] as const;

export const TEAM_POSITIONS = [
  "Founder", "Partner", "CRO", "COO", "HR", "Project Manager", "Sales Team", "Delivery Team",
] as const;

export function fmtMoney(usd: number, currency: "USD" | "PKR" | "USDT", rate: number) {
  if (currency === "USD") return `$${new Intl.NumberFormat("en-US").format(usd)}`;
  if (currency === "PKR") return `Rs ${new Intl.NumberFormat("en-US").format(Math.round(usd * rate))}`;
  return `${(usd * rate).toFixed(2)} USDT`;
}
