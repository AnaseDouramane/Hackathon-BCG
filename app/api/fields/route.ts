import type { NextRequest } from "next/server";
import { apiError, withErrors } from "@/lib/api";
import { CropCodeSchema, FieldListQuerySchema } from "@/lib/contract/schemas";
import { listFields } from "@/lib/services/fields";

export async function GET(request: NextRequest) {
  return withErrors(async () => {
    const params = request.nextUrl.searchParams;
    const query = FieldListQuerySchema.safeParse({
      category: params.get("category") ?? undefined,
      crop: params.get("crop") ?? undefined,
    });
    if (!query.success) {
      return apiError(
        "INVALID_QUERY",
        `category must be urgent|disease|fertilizer|maturity and crop must be ${CropCodeSchema.options.join("|")}`,
      );
    }
    return Response.json(await listFields(query.data));
  });
}
