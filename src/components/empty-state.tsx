import Link from "next/link";
import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  actionHref,
  onClick,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  onClick?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-14 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-accent-foreground">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      {actionLabel && actionHref && (
        <Link
          href={actionHref}
          className="mt-5 inline-flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow hover:bg-primary/90"
        >
          {actionLabel}
        </Link>
      )}
      {actionLabel && onClick && (
        <button
          onClick={onClick}
          className="mt-5 inline-flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow hover:bg-primary/90"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
