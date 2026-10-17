import { ArrowLeft, Maximize2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Presentation" };

// Le slide sono un HTML statico in public/presentation/ (protetto dal login come il resto dell'app).
const SLIDES = "/presentation/felix-field-slides.html";

export default function PresentationPage() {
  return (
    <main className="flex h-[calc(100dvh-5.5rem)] flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-line text-muted hover:text-ink"
            aria-label="Back to dashboard"
          >
            <ArrowLeft size={18} />
          </Link>
          <h1 className="text-2xl font-bold text-ink">Presentation</h1>
        </div>
        <a
          href={SLIDES}
          target="_blank"
          rel="noopener"
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line px-4 text-sm font-semibold text-ink hover:bg-line/50"
        >
          <Maximize2 size={16} aria-hidden /> Open full screen
        </a>
      </div>
      <iframe src={SLIDES} title="Felix Field – Problem, Solution and Business case" className="min-h-0 w-full flex-1 rounded-2xl border border-line bg-white" />
    </main>
  );
}
