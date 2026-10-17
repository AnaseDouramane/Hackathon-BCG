// Port TS di tools/python/isda.py (iSDA Virtual Agronomist): login con JWT e piano nutrienti.
// Il piano è un'evidenza in più per Claude: se iSDA non risponde, l'analisi continua senza.
const BASE_URL = "https://api.isda-africa.com/virtual-agronomist/v1";

export const isIsdaEnabled = () => Boolean(process.env.ISDA_USERNAME && process.env.ISDA_PASSWORD);

let token: { value: string; expiresAt: number } | null = null;

async function login(): Promise<string> {
  const res = await fetch(`${BASE_URL}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({ username: process.env.ISDA_USERNAME ?? "", password: process.env.ISDA_PASSWORD ?? "" }),
    cache: "no-store",
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) throw new Error(`iSDA login failed (${res.status}): ${await res.text()}`);
  const data = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) throw new Error("iSDA login: no access_token in the response");
  // rinnovato 60 s prima della scadenza, come nel client Python
  token = { value: data.access_token, expiresAt: Date.now() + ((data.expires_in ?? 3600) - 60) * 1000 };
  return token.value;
}

async function request(method: "GET" | "POST", path: string, body?: unknown, retry = true): Promise<unknown> {
  const bearer = token && token.expiresAt > Date.now() ? token.value : await login();
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${bearer}`,
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(45_000),
  });
  if (res.status === 401 && retry) {
    token = null;
    return request(method, path, body, false);
  }
  if (!res.ok) throw new Error(`iSDA ${method} ${path} failed (${res.status}): ${await res.text()}`);
  return res.json();
}

let cropSlugs: Promise<string[]> | null = null;

/** Gli slug delle colture supportate (GET /crops), letti una volta sola. */
function listCropSlugs(): Promise<string[]> {
  cropSlugs ??= request("GET", "/crops").then((data) => {
    const items = Array.isArray(data) ? data : ((data as { crops?: unknown[] })?.crops ?? []);
    return items
      .map((c) => (typeof c === "string" ? c : ((c as { slug?: string })?.slug ?? "")))
      .filter(Boolean);
  });
  cropSlugs.catch(() => (cropSlugs = null));
  return cropSlugs;
}

const CROP_KEYWORDS: Record<string, string[]> = {
  MAIZE: ["maize", "corn"],
  SOYBEAN: ["soy"],
  BEANS: ["bean"],
  CHILI: ["chil", "pepper"],
};

/** Piano nutrienti per una coltura in un punto; null se iSDA non supporta quella coltura. */
export async function getNutrientPlan(cropCode: string, latitude: number, longitude: number): Promise<unknown | null> {
  const slugs = await listCropSlugs();
  const keywords = CROP_KEYWORDS[cropCode] ?? [cropCode.toLowerCase()];
  const slug = slugs.find((s) => keywords.some((k) => s.toLowerCase().includes(k)) && !(cropCode === "BEANS" && s.includes("soy")));
  if (!slug) return null;
  return request("POST", `/crops/${encodeURIComponent(slug)}/nutrient-plan`, {
    input: { Yield_Now_User: 3 },
    coordinates: { latitude, longitude },
  });
}
