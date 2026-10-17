// Port TS di tools/python/crophealth.py (Kindwise crop.health): malattie sospette da una foto.
// Ogni identificazione consuma crediti: si chiama solo per le foto nuove caricate dai campi.
import { z } from "zod";

const BASE_URL = "https://crop.kindwise.com/api/v1";

export const isCropHealthEnabled = () => Boolean(process.env.CROP_HEALTH_API_KEY);

const SuggestionSchema = z.object({ name: z.string(), probability: z.number() });
const IdentificationSchema = z.object({
  result: z.object({
    is_plant: z.object({ probability: z.number() }).partial().optional(),
    crop: z.object({ suggestions: z.array(SuggestionSchema) }).optional(),
    disease: z.object({ suggestions: z.array(SuggestionSchema) }).optional(),
  }),
});

export type CropHealthResult = {
  isPlantProbability: number | null;
  crops: { name: string; probability: number }[];
  diseases: { name: string; probability: number }[];
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export function parseIdentification(raw: unknown): CropHealthResult {
  const { result } = IdentificationSchema.parse(raw);
  const top = (list: { name: string; probability: number }[] = [], n: number) =>
    list.slice(0, n).map((s) => ({ name: s.name, probability: round2(s.probability) }));
  return {
    isPlantProbability: result.is_plant?.probability ?? null,
    crops: top(result.crop?.suggestions, 2),
    diseases: top(result.disease?.suggestions, 3),
  };
}

/** POST /identification con l'immagine in base64 e la posizione del campo. */
export async function identify(imageBase64: string, latitude: number, longitude: number): Promise<CropHealthResult> {
  const res = await fetch(`${BASE_URL}/identification?language=en`, {
    method: "POST",
    headers: { "Api-Key": process.env.CROP_HEALTH_API_KEY ?? "", "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ images: [imageBase64], latitude, longitude }),
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`crop.health identification failed (${res.status}): ${await res.text()}`);
  return parseIdentification(await res.json());
}
