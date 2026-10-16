import { withErrors } from "@/lib/api";
import { getStats } from "@/lib/services/fields";

export async function GET() {
  return withErrors(async () => Response.json(await getStats()));
}
