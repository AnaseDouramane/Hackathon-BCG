import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { CATEGORIES, getFieldsByCategory, isCategory } from "@/data/fields";
import { FieldMap } from "@/components/FieldMap";
import { FieldRow } from "@/components/FieldRow";
import { STATUS } from "@/components/status";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/issues/$category")({
  loader: ({ params }) => {
    if (!isCategory(params.category)) throw notFound();
    return { category: params.category };
  },
  head: ({ loaderData }) => {
    const label = loaderData ? STATUS[loaderData.category].label : "Field list";
    return {
      meta: [
        { title: `${label} fields – Felix Field` },
        { name: "description", content: `Kasungu fields filtered by ${label.toLowerCase()}, sorted by priority.` },
        { property: "og:title", content: `${label} fields – Felix Field` },
        { property: "og:description", content: `Prioritized list of ${label.toLowerCase()} fields.` },
      ],
    };
  },
  component: IssuesPage,
});

function IssuesPage() {
  const { category } = Route.useLoaderData();
  const fields = getFieldsByCategory(category);
  const S = STATUS[category];
  return (
    <div className="space-y-4">
      <Link to="/" className="inline-flex min-h-11 items-center gap-2 font-semibold text-primary"><ArrowLeft className="h-5 w-5" />Dashboard</Link>
      <h1 className={cn("flex items-center gap-3 text-3xl font-extrabold", S.text)}><S.icon className="h-8 w-8" />{S.label}<span className="text-foreground">({fields.length})</span></h1>
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((c) => (
          <Link key={c} to="/issues/$category" params={{ category: c }} className={cn("min-h-11 rounded-full border-2 px-4 py-2 font-semibold", STATUS[c].border, c === category ? cn(STATUS[c].bg, "text-primary-foreground") : cn("bg-card", STATUS[c].text))}>
            {STATUS[c].short}
          </Link>
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-2">
          {fields.length ? fields.map((f) => <FieldRow key={f.id} field={f} showAction />) : (
            <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">No fields in this category right now.</div>
          )}
        </div>
        <div className="lg:sticky lg:top-20 lg:self-start"><FieldMap fields={fields} height={420} /></div>
      </div>
    </div>
  );
}
