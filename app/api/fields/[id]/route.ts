import type { NextRequest } from "next/server";
import { apiError, withErrors } from "@/lib/api";
import { getFieldDetail } from "@/lib/services/fields";

export async function GET(_request: NextRequest, ctx: RouteContext<"/api/fields/[id]">) {
  return withErrors(async () => {
    const { id } = await ctx.params;
    const field = await getFieldDetail(id);
    if (!field) return apiError("FIELD_NOT_FOUND", `Field ${id} not found`);
    return Response.json(field);
  });
}
