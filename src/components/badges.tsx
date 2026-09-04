import { cn } from "@/lib/utils";
import type { LeadStatus, WebsiteStatus, TouchChannel } from "@/types/supabase";

const statusStyles: Record<string, string> = {
  NEW: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  RESEARCHING: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  READY: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-400",
  CONTACTED: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  REPLIED: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  INTERESTED: "bg-primary/10 text-primary",
  NOT_INTERESTED: "bg-neutral-500/10 text-neutral-500",
  CALL_BOOKED: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
  PROPOSAL: "bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400",
  WON: "bg-success/10 text-success",
  LOST: "bg-destructive/10 text-destructive",
  DORMANT: "bg-zinc-500/10 text-zinc-500",
};

export function StatusBadge({ status }: { status: LeadStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-md px-2 py-0.5 text-[11px] font-semibold",
        statusStyles[status] ?? statusStyles.NEW
      )}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}

const websiteStyles: Record<WebsiteStatus, string> = {
  NONE: "bg-destructive/10 text-destructive",
  BROKEN: "bg-orange-500/10 text-orange-600",
  POOR_SEO: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-500",
  GOOD: "bg-success/10 text-success",
};

export function WebsiteBadge({ status }: { status: WebsiteStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-md px-2 py-0.5 text-[11px] font-semibold",
        websiteStyles[status]
      )}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}

const replyStyles: Record<string, string> = {
  NONE: "bg-muted text-muted-foreground",
  NEUTRAL: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  POSITIVE: "bg-success/10 text-success",
  NEGATIVE: "bg-destructive/10 text-destructive",
};

export function ReplyBadge({ type }: { type: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold", replyStyles[type])}>
      {type.replace(/_/g, " ")}
    </span>
  );
}

const channelIcon: Record<TouchChannel, string> = {
  EMAIL: "✉️",
  IG_DM: "💬",
  WHATSAPP: "📱",
  CALL: "📞",
  LINKEDIN: "💼",
  FACEBOOK: "📘",
};

export function ChannelTag({ channel, direction }: { channel: TouchChannel; direction: "OUT" | "IN" }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
      <span>{channelIcon[channel]}</span>
      {channel.replace(/_/g, " ")}
      <span className={direction === "IN" ? "text-success" : "text-muted-foreground/70"}>
        {direction === "IN" ? "↓ in" : "↑ out"}
      </span>
    </span>
  );
}

export function SourceTag({ source }: { source: string }) {
  return (
    <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
      {source.replace(/_/g, " ")}
    </span>
  );
}
