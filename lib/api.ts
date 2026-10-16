// Risposte di errore nel formato del contratto (spec §7.5).
import { unstable_rethrow } from "next/navigation";
import type { ApiError } from "@/lib/contract/schemas";

const STATUS: Record<ApiError["error"], number> = {
  INVALID_QUERY: 400,
  FIELD_NOT_FOUND: 404,
  INTERNAL_ERROR: 500,
};

export function apiError(error: ApiError["error"], message: string): Response {
  return Response.json({ error, message } satisfies ApiError, { status: STATUS[error] });
}

/** Esegue un handler e trasforma ogni eccezione in un INTERNAL_ERROR. */
export async function withErrors(handler: () => Promise<Response>): Promise<Response> {
  try {
    return await handler();
  } catch (err) {
    // Gli errori interni di Next (prerender interrotto, notFound, …) vanno lasciati passare.
    unstable_rethrow(err);
    console.error(err);
    return apiError("INTERNAL_ERROR", err instanceof Error ? err.message : "Unexpected error");
  }
}
