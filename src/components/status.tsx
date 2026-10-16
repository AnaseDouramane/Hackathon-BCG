import { AlertTriangle, Bug, CheckCircle2, Sprout, Wheat, type LucideIcon } from "lucide-react";
import type { Category } from "@/data/types";
import { cn } from "@/lib/utils";

export const STATUS: Record<Category, { label: string; short: string; icon: LucideIcon; text: string; bg: string; soft: string; border: string; desc: string }> = {
  urgent: { label: "Urgent action", short: "Urgent", icon: AlertTriangle, text: "text-urgent", bg: "bg-urgent", soft: "bg-urgent-soft", border: "border-urgent", desc: "Critical, or due within 72 h" },
  disease: { label: "Disease / pest", short: "Disease", icon: Bug, text: "text-disease", bg: "bg-disease", soft: "bg-disease-soft", border: "border-disease", desc: "Crop health problem" },
  fertilizer: { label: "Fertilizer / soil", short: "Fertilizer", icon: Sprout, text: "text-fertilizer", bg: "bg-fertilizer", soft: "bg-fertilizer-soft", border: "border-fertilizer", desc: "Nutrient or soil issue" },
  maturity: { label: "Maturity / harvest", short: "Harvest", icon: Wheat, text: "text-maturity", bg: "bg-maturity", soft: "bg-maturity-soft", border: "border-maturity", desc: "Harvest timing" },
  healthy: { label: "Healthy", short: "Healthy", icon: CheckCircle2, text: "text-healthy", bg: "bg-healthy", soft: "bg-healthy-soft", border: "border-healthy", desc: "No active issues" },
};

export function StatusBadge({ category, className }: { category: Category; className?: string }) {
  const s = STATUS[category];
  const Icon = s.icon;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm font-semibold", s.soft, s.text, s.border, className)}>
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      {s.short}
    </span>
  );
}

export function SimulatedTag({ children = "Demo data" }: { children?: React.ReactNode }) {
  return <span className="inline-flex items-center rounded-md border border-sim/40 bg-sim-soft px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-sim">{children}</span>;
}
