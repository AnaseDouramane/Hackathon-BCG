import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CropFieldsView } from "@/components/crops/CropFieldsView";
import { CROP_UI } from "@/components/ui/crop";
import { type CropCode, CropCodeSchema } from "@/lib/contract/schemas";
import { getNow } from "@/lib/now";
import { listFields } from "@/lib/services/fields";

const parseCrop = (param: string): CropCode | null => {
  const parsed = CropCodeSchema.safeParse(param.toUpperCase());
  return parsed.success ? parsed.data : null;
};

export function generateStaticParams() {
  return CropCodeSchema.options.map((code) => ({ crop: code.toLowerCase() }));
}

export async function generateMetadata({ params }: PageProps<"/crops/[crop]">): Promise<Metadata> {
  const crop = parseCrop((await params).crop);
  return { title: crop ? `${CROP_UI[crop].label} fields` : "Not found" };
}

// params is read inside a Suspense boundary so the shell can render instantly.
export default function CropPage({ params }: PageProps<"/crops/[crop]">) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-line" aria-busy="true" aria-label="Loading fields" />}>
      <CropContent params={params} />
    </Suspense>
  );
}

async function CropContent({ params }: { params: PageProps<"/crops/[crop]">["params"] }) {
  const crop = parseCrop((await params).crop);
  if (!crop) notFound();

  const fields = await listFields({ crop });
  const { label, Icon } = CROP_UI[crop];
  const nowIso = getNow().toISOString();

  return (
    <main>
      <div className="mb-4 flex flex-wrap items-center gap-4">
        <Link href="/" className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-muted hover:text-ink">
          <ArrowLeft size={16} aria-hidden /> Dashboard
        </Link>
        <h1 className="flex items-center gap-2 rounded-full border border-line bg-white px-4 py-1.5 text-lg font-semibold text-ink">
          <Icon size={20} aria-hidden />
          <span className="tracking-wider uppercase">{label}</span>
          <span>
            · {fields.length} {fields.length === 1 ? "field" : "fields"}
          </span>
        </h1>
        <p className="text-sm text-muted">ordered by priority</p>
      </div>
      <CropFieldsView fields={fields} nowIso={nowIso} />
    </main>
  );
}
