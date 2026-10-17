"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

// Small dropdown: opens on click/tap, closes on outside click or Escape.
export function Menu({ label, trigger, children }: { label: string; trigger: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-muted hover:bg-line/50 hover:text-ink"
      >
        {trigger}
      </button>
      {open && (
        <div
          id={panelId}
          role="menu"
          className="absolute right-0 top-full z-[1200] mt-1 w-56 rounded-xl border border-line bg-white p-1 shadow-lg"
        >
          {children}
        </div>
      )}
    </div>
  );
}
