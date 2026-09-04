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
