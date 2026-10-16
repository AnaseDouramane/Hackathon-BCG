import type { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-line bg-white p-4 shadow-sm ${className}`}>{children}</section>;
}

export function CardTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-2">
      <h2 className="text-xs font-semibold tracking-wider text-muted uppercase">{children}</h2>
      {aside && <span className="text-xs text-muted">{aside}</span>}
    </div>
  );
}
