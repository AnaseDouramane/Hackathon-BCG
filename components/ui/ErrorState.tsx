import { TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";

export function ErrorState({ title, message, action }: { title: string; message: string; action?: ReactNode }) {
  return (
    <div className="mx-auto mt-16 max-w-md rounded-2xl border border-line bg-white p-6 text-center shadow-sm">
      <TriangleAlert className="mx-auto text-muted" size={32} aria-hidden />
      <h1 className="mt-3 text-lg font-semibold text-ink">{title}</h1>
      <p className="mt-1 text-sm text-muted">{message}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
