"use client";

import { ChevronLeft, ChevronRight, LayoutDashboard, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { CATEGORY_UI, FILTER_TO_KEY } from "@/components/ui/category";
import { CROP_ORDER, CROP_UI, cropHref } from "@/components/ui/crop";
import type { CategoryFilter } from "@/lib/contract/schemas";

const STORAGE_KEY = "felix.sidebar.open";

type Item = { href: string; label: string; Icon: LucideIcon };
type Section = { title: string; items: Item[] };

const CATEGORIES: CategoryFilter[] = ["urgent", "disease", "fertilizer", "maturity"];

// Areas of the sidebar, each with its own heading (a thin divider when the bar is collapsed).
const SECTIONS: Section[] = [
  { title: "Overview", items: [{ href: "/", label: "Dashboard", Icon: LayoutDashboard }] },
  {
    title: "Issues",
    items: CATEGORIES.map((c) => {
      const { label, Icon } = CATEGORY_UI[FILTER_TO_KEY[c]];
      return { href: `/issues/${c}`, label, Icon };
    }),
  },
  {
    title: "Fields",
    items: CROP_ORDER.map((code) => ({ href: cropHref(code), ...CROP_UI[code] })),
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(true);

  // Saved choice wins; otherwise start closed on narrow screens.
  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(STORAGE_KEY);
    } catch {}
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is only readable in the browser
    setOpen(saved !== null ? saved === "1" : window.matchMedia("(min-width: 768px)").matches);
  }, []);

  const toggle = () => {
    setOpen((o) => {
      try {
        localStorage.setItem(STORAGE_KEY, o ? "0" : "1");
      } catch {}
      return !o;
    });
  };

  // On md+ the wrapper width follows the panel, so content shifts. Below md the wrapper stays a
  // 64px rail and the open panel overlays the content instead of pushing it.
  return (
    <div className={`relative w-16 shrink-0 transition-[width] duration-150 motion-reduce:transition-none ${open ? "md:w-56" : ""}`}>
      <nav
        aria-label="Main"
        className={`absolute inset-y-0 left-0 z-[1050] flex flex-col border-r border-line bg-white transition-[width] duration-150 motion-reduce:transition-none ${open ? "w-56" : "w-16"}`}
      >
        <div className="flex-1 overflow-y-auto p-2">
          {SECTIONS.map(({ title, items }, i) => (
            <section key={title} aria-label={title} className={i > 0 ? "mt-3 border-t border-line pt-3" : ""}>
              <h2 className={open ? "px-3 pb-1 text-xs font-semibold tracking-wider text-muted uppercase" : "sr-only"}>{title}</h2>
              <ul className="space-y-1">
                {items.map(({ href, label, Icon }) => {
                  const active = pathname === href;
                  return (
                    <li key={href}>
                      <Link
                        href={href}
                        title={open ? undefined : label}
                        aria-current={active ? "page" : undefined}
                        className={`flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold ${
                          active ? "bg-ink text-white" : "text-muted hover:bg-line/50 hover:text-ink"
                        }`}
                      >
                        <Icon size={20} className="shrink-0" aria-hidden />
                        <span className={open ? "truncate" : "sr-only"}>{label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
        <div className="border-t border-line p-2">
          <button
            type="button"
            onClick={toggle}
            aria-expanded={open}
            aria-label={open ? "Collapse sidebar" : "Expand sidebar"}
            title={open ? undefined : "Expand sidebar"}
            className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-semibold text-muted hover:bg-line/50 hover:text-ink"
          >
            {open ? <ChevronLeft size={20} className="shrink-0" aria-hidden /> : <ChevronRight size={20} className="shrink-0" aria-hidden />}
            <span className={open ? "truncate" : "sr-only"}>Collapse</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
