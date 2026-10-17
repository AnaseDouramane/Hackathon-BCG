import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { IssuesView } from "@/components/issues/IssuesView";
import { CATEGORY_UI, FILTER_TO_KEY } from "@/components/ui/category";
import { CategoryFilterSchema } from "@/lib/contract/schemas";
import { getNow } from "@/lib/now";
import { listFields } from "@/lib/services/fields";

export function generateStaticParams() {
  return CategoryFilterSchema.options.map((category) => ({ category }));
}

export async function generateMetadata({ params }: PageProps<"/issues/[category]">): Promise<Metadata> {
  const parsed = CategoryFilterSchema.safeParse((await params).category);
  return { title: parsed.success ? CATEGORY_UI[FILTER_TO_KEY[parsed.data]].label : "Not found" };
}

// params is read inside a Suspense boundary so the shell can render instantly.
export default function IssuesPage({ params }: PageProps<"/issues/[category]">) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-line" aria-busy="true" aria-label="Loading list" />}>
      <IssuesContent params={params} />
    </Suspense>
  );
}

async function IssuesContent({ params }: { params: PageProps<"/issues/[category]">["params"] }) {
  const parsed = CategoryFilterSchema.safeParse((await params).category);
  if (!parsed.success) notFound();

  const category = parsed.data;
  const fields = await listFields({ category });
  const { label, Icon, text, bgSoft, border } = CATEGORY_UI[FILTER_TO_KEY[category]];
  const nowIso = getNow().toISOString();

  return (
    <main>
      <div className="mb-4 flex flex-wrap items-center gap-4">
        <Link href="/" className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-muted hover:text-ink">
          <ArrowLeft size={16} aria-hidden /> Dashboard
        </Link>
        <h1
          className={`flex items-center gap-2 rounded-full border px-4 py-1.5 text-lg font-semibold ${border} ${bgSoft} ${text}`}
        >
          <Icon size={20} aria-hidden />
          <span className="tracking-wider uppercase">{label}</span>
          <span className="text-ink">
            · {fields.length} {fields.length === 1 ? "field needs" : "fields need"} attention
          </span>
        </h1>
      </div>

      <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-line" aria-label="Loading list" />}>
        <IssuesView fields={fields} nowIso={nowIso} />
      </Suspense>
    </main>
  );
}
