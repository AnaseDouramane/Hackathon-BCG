import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { CATEGORY_UI, type CategoryKey } from "@/components/ui/category";

export function KpiCard({
  category,
  value,
  caption,
  href,
}: {
  category: CategoryKey;
  value: number;
  caption: string;
  href: string;
}) {
  const { label, Icon, text, bg, bgSoft } = CATEGORY_UI[category];
  const urgent = category === "URGENT";
  return (
    <Link
      href={href}
      className={`group relative flex min-h-24 items-center justify-between gap-3 overflow-hidden rounded-2xl border border-line p-4 shadow-sm transition hover:shadow-md focus-visible:ring-2 focus-visible:ring-ink ${
        urgent ? bgSoft : "bg-white"
      }`}
    >
      <span className={`absolute inset-y-0 left-0 w-1.5 ${bg}`} aria-hidden />
      <div className="pl-2">
        <p className={`flex items-center gap-1.5 text-sm font-semibold tracking-wider uppercase ${text}`}>
          <Icon size={18} aria-hidden />
          {label}
        </p>
        <p className="mt-0.5 text-sm text-muted">{caption}</p>
      </div>
      <div className="flex items-center gap-1">
        <span className={`text-4xl font-bold tabular-nums ${urgent ? text : "text-ink"}`}>{value}</span>
        <ChevronRight size={20} className="text-muted transition group-hover:translate-x-0.5" aria-hidden />
      </div>
    </Link>
  );
}
