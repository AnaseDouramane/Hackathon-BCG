import type { Alert, Crop, Field, WeatherDay } from "./types";

/** All demo data is illustrative. Polygons are NOT verified farm boundaries. */
export const DEMO_NOW = new Date("2026-10-16T08:00:00Z");
export const KASUNGU_CENTER: [number, number] = [-13.033, 33.483];

const DAYS = ["Fri", "Sat", "Sun", "Mon", "Tue"];
const dry: WeatherDay[] = DAYS.map((day, i) => ({
  day,
  condition: i === 2 ? "cloudy" : "sunny",
  high: 30 + (i % 2),
  low: 17,
  rainMm: 0,
}));
const heavyRain: WeatherDay[] = [
  { day: "Fri", condition: "cloudy", high: 29, low: 18, rainMm: 2 },
  { day: "Sat", condition: "rain", high: 26, low: 18, rainMm: 18 },
  { day: "Sun", condition: "storm", high: 24, low: 17, rainMm: 42 },
  { day: "Mon", condition: "rain", high: 25, low: 17, rainMm: 25 },
  { day: "Tue", condition: "cloudy", high: 27, low: 17, rainMm: 4 },
];
const showers: WeatherDay[] = [
  { day: "Fri", condition: "sunny", high: 31, low: 18, rainMm: 0 },
  { day: "Sat", condition: "cloudy", high: 30, low: 18, rainMm: 1 },
  { day: "Sun", condition: "rain", high: 27, low: 18, rainMm: 9 },
  { day: "Mon", condition: "cloudy", high: 28, low: 17, rainMm: 3 },
  { day: "Tue", condition: "sunny", high: 30, low: 17, rainMm: 0 },
];

// Reusable alert templates
const armyworm = (id: string, sev: Alert["severity"], due: number): Alert => ({
  id, category: "disease", title: "Possible fall armyworm infestation", severity: sev, status: "open", dueInHours: due,
  recommendations: [
    { action: "Scout 20 plants in a W pattern and count damaged whorls", why: "Confirms infestation level before any spraying; avoids wasting inputs.", window: "Within 24 hours" },
    { action: "If >20% of plants show fresh damage, apply approved pesticide into the whorl", why: "Larvae feed inside the whorl; early treatment protects yield.", window: "Within 48 hours of confirmation" },
    { action: "Advise farmer to inspect neighbouring maize plots", why: "Fall armyworm moths spread quickly across nearby fields.", window: "This week" },
  ],
});
const nitrogen = (id: string, sev: Alert["severity"], due: number): Alert => ({
  id, category: "fertilizer", title: "Potential nitrogen deficiency – top dressing due", severity: sev, status: "open", dueInHours: due,
  recommendations: [
    { action: "Apply Urea top dressing at 100 kg/ha (approx. 2 bags/ha)", why: "Soil nitrogen is low and the crop is at the knee-high stage when demand peaks.", window: "Within 3 days" },
    { action: "Apply fertilizer when soil is moist, 5–10 cm from plant base, and cover", why: "Reduces nitrogen loss to the air and runoff.", window: "Before the next rain" },
  ],
});
const lowPh = (id: string, sev: Alert["severity"], due: number): Alert => ({
  id, category: "fertilizer", title: "Acidic soil limiting nutrient uptake", severity: sev, status: "open", dueInHours: due,
  recommendations: [
    { action: "Plan agricultural lime application (approx. 1 t/ha) before next season", why: "pH below 5.5 locks up phosphorus and reduces yields.", window: "Before next planting" },
    { action: "Take a lab soil sample to confirm", why: "Sensor readings are preliminary; lab test confirms the dosage.", window: "Within 2 weeks" },
  ],
});
const harvestRain = (id: string, due: number): Alert => ({
  id, category: "maturity", title: "Crop mature – heavy rain forecast", severity: "critical", status: "open", dueInHours: due,
  recommendations: [
    { action: "Harvest groundnuts before Sunday's heavy rain", why: "Wet pods left in the ground can rot and develop aflatoxin.", window: "Within 48 hours" },
    { action: "Dry pods on raised racks or tarpaulin, not bare soil", why: "Keeps moisture below 10% and prevents mould.", window: "Immediately after lifting" },
  ],
});
const harvestSoon = (id: string, due: number): Alert => ({
  id, category: "maturity", title: "Approaching harvest window", severity: "medium", status: "open", dueInHours: due,
  recommendations: [
    { action: "Check grain/pod maturity on 10 sample plants", why: "Confirms the best harvest date to limit field losses.", window: "This week" },
    { action: "Arrange labour, bags and drying space", why: "Delays after maturity increase pest and weather losses.", window: "Before harvest window" },
  ],
});
const leafSpot = (id: string, crop: string, sev: Alert["severity"], due: number): Alert => ({
  id, category: "disease", title: crop === "tobacco" ? "Suspected frogeye leaf spot" : "Suspected leaf rust / leaf spot", severity: sev, status: "open", dueInHours: due,
  recommendations: [
    { action: "Inspect lower leaves and photograph symptoms with Diagnose Crop", why: "Leaf spots look similar; a closer check avoids the wrong treatment.", window: "Next visit" },
    { action: "Remove heavily infected leaves and avoid overhead watering", why: "Reduces spread of fungal spores.", window: "Within 1 week" },
  ],
});

type Spec = Omit<Field, "polygon" | "center" | "soil" | "weather" | "drone" | "plantingDate" | "harvestWindow" | "stage"> & {
  offset: [number, number];
  size?: number;
  stage?: string; plantingDate?: string; harvestWindow?: string;
  soil?: Partial<Field["soil"]>;
  weather?: WeatherDay[];
  drone?: Field["drone"];
};

const cropDefaults: Record<Crop, { stage: string; planted: string; harvest: string }> = {
  maize: { stage: "Vegetative (knee-high, V8)", planted: "2026-08-28", harvest: "Feb 10 – Mar 5, 2027" },
  soybean: { stage: "Flowering (R2)", planted: "2026-08-20", harvest: "Dec 20 – Jan 10, 2027" },
  beans: { stage: "Pod fill (R5)", planted: "2026-08-10", harvest: "Nov 1 – Nov 15, 2026" },
  tobacco: { stage: "Topping stage", planted: "2026-07-25", harvest: "Nov 15 – Dec 30, 2026" },
  groundnut: { stage: "Physiological maturity", planted: "2026-07-05", harvest: "Oct 17 – Oct 24, 2026" },
};

const specs: Spec[] = [
  { id: "KS-001", name: "Chikho North", crop: "maize", areaHa: 2.4, village: "Chikho", farmer: { name: "Grace Banda", phone: "+265 991 234 501" }, offset: [0.02, -0.03], alerts: [armyworm("A-001", "critical", 24)], soil: { nitrogen: 34 }, drone: { date: "Oct 14, 2026", note: "Ragged leaf damage visible in ~30% of canopy, north-east corner." } },
  { id: "KS-002", name: "Mtunthama Plot", crop: "maize", areaHa: 1.8, village: "Mtunthama", farmer: { name: "Peter Phiri", phone: "+265 888 410 222" }, offset: [-0.025, 0.02], alerts: [nitrogen("A-002", "high", 60)], soil: { nitrogen: 12, moisture: 26 }, drone: { date: "Oct 12, 2026", note: "Yellowing (V-shape) on lower leaves across most of the plot." } },
  { id: "KS-003", name: "Santhe Groundnuts", crop: "groundnut", areaHa: 1.2, village: "Santhe", farmer: { name: "Esther Mwale", phone: "+265 995 117 830" }, offset: [0.035, 0.03], alerts: [harvestRain("A-003", 40)], weather: heavyRain },
  { id: "KS-004", name: "Kaluluma East", crop: "maize", areaHa: 3.1, village: "Kaluluma", farmer: { name: "John Tembo", phone: "+265 999 552 014" }, offset: [-0.04, -0.035], alerts: [armyworm("A-004", "high", 50), nitrogen("A-005", "high", 70)], soil: { nitrogen: 15 }, drone: { date: "Oct 13, 2026", note: "Patchy damage and pale leaves; two issues likely." } },
  { id: "KS-005", name: "Chulu Soy Block", crop: "soybean", areaHa: 2.0, village: "Chulu", farmer: { name: "Mary Chirwa", phone: "+265 884 300 661" }, offset: [0.055, -0.01], alerts: [leafSpot("A-006", "soybean", "medium", 160)] },
  { id: "KS-006", name: "Linyangwa Beans", crop: "beans", areaHa: 0.8, village: "Linyangwa", farmer: { name: "Daniel Kumwenda", phone: "+265 991 778 403" }, offset: [-0.06, 0.005], alerts: [harvestSoon("A-007", 400)] },
  { id: "KS-007", name: "Kasungu Estate Rd", crop: "tobacco", areaHa: 2.7, village: "Chitala", farmer: { name: "Joseph Nyirenda", phone: "+265 888 902 117" }, offset: [0.01, 0.055], alerts: [leafSpot("A-008", "tobacco", "high", 120)] },
  { id: "KS-008", name: "Dwangwa Hill", crop: "maize", areaHa: 1.5, village: "Dwangwa", farmer: { name: "Lucy Zulu", phone: "+265 995 640 288" }, offset: [-0.015, -0.06], alerts: [] },
  { id: "KS-009", name: "Chamama Groundnuts", crop: "groundnut", areaHa: 1.0, village: "Chamama", farmer: { name: "Agnes Mbewe", phone: "+265 884 211 950" }, offset: [0.07, 0.035], alerts: [harvestSoon("A-009", 140)], weather: showers },
  { id: "KS-010", name: "Nkhamenya Soy", crop: "soybean", areaHa: 1.6, village: "Nkhamenya", farmer: { name: "Moses Gondwe", phone: "+265 999 012 674" }, offset: [-0.07, 0.045], alerts: [] },
  { id: "KS-011", name: "Mpherembe Maize", crop: "maize", areaHa: 2.2, village: "Mpherembe", farmer: { name: "Ruth Kachingwe", phone: "+265 991 450 309" }, offset: [0.045, -0.055], alerts: [lowPh("A-010", "medium", 300)], soil: { ph: 5.1 } },
  { id: "KS-012", name: "Wimbe Beans", crop: "beans", areaHa: 0.9, village: "Wimbe", farmer: { name: "Charles Kalua", phone: "+265 888 334 760" }, offset: [-0.035, 0.07], alerts: [] },
  { id: "KS-013", name: "Chisemphere Tobacco", crop: "tobacco", areaHa: 3.4, village: "Chisemphere", farmer: { name: "Elizabeth Nkhoma", phone: "+265 995 801 432" }, offset: [0.085, -0.04], alerts: [harvestSoon("A-011", 200)] },
  { id: "KS-014", name: "Lisasadzi Maize", crop: "maize", areaHa: 1.9, village: "Lisasadzi", farmer: { name: "Francis Mvula", phone: "+265 884 667 105" }, offset: [-0.085, -0.02], alerts: [armyworm("A-012", "medium", 110)], drone: { date: "Oct 10, 2026", note: "Isolated windowpane feeding on young leaves." } },
  { id: "KS-015", name: "Kapelula Groundnuts", crop: "groundnut", areaHa: 1.1, village: "Kapelula", farmer: { name: "Hannah Lungu", phone: "+265 991 920 548" }, offset: [0.025, 0.085], alerts: [] },
  { id: "KS-016", name: "Chipala Soy", crop: "soybean", areaHa: 1.4, village: "Chipala", farmer: { name: "Isaac Msiska", phone: "+265 888 145 390" }, offset: [-0.055, -0.07], alerts: [nitrogen("A-013", "medium", 180)], soil: { nitrogen: 18, phosphorus: 9 } },
  { id: "KS-017", name: "Kawamba Maize", crop: "maize", areaHa: 2.6, village: "Kawamba", farmer: { name: "Tiyamike Soko", phone: "+265 995 377 821" }, offset: [0.06, 0.07], alerts: [] },
  { id: "KS-018", name: "Mkanda Beans", crop: "beans", areaHa: 0.7, village: "Mkanda", farmer: { name: "Rose Chimwemwe", phone: "+265 884 590 033" }, offset: [-0.01, 0.03], alerts: [leafSpot("A-014", "beans", "low", 260)] },
  { id: "KS-019", name: "Chinkhwiri Tobacco", crop: "tobacco", areaHa: 2.1, village: "Chinkhwiri", farmer: { name: "Kondwani Banda", phone: "+265 999 703 216" }, offset: [-0.09, 0.075], alerts: [] },
  { id: "KS-020", name: "Bua Valley Maize", crop: "maize", areaHa: 2.9, village: "Bua", farmer: { name: "Chikondi Phiri", phone: "+265 991 068 457" }, offset: [0.09, 0.005], alerts: [] },
];

function poly(c: [number, number], s: number, seed: number): [number, number][] {
  const j = (k: number) => ((Math.sin(seed * 12.9898 + k * 78.233) * 43758.5453) % 1) * s * 0.25;
  return [
    [c[0] + s * 0.6 + j(1), c[1] - s + j(2)],
    [c[0] + s * 0.5 + j(3), c[1] + s * 0.9 + j(4)],
    [c[0] - s * 0.6 + j(5), c[1] + s + j(6)],
    [c[0] - s * 0.55 + j(7), c[1] - s * 0.8 + j(8)],
  ];
}

export const FIELDS: Field[] = specs.map((s, i) => {
  const d = cropDefaults[s.crop];
  const center: [number, number] = [KASUNGU_CENTER[0] + s.offset[0], KASUNGU_CENTER[1] + s.offset[1]];
  return {
    id: s.id, name: s.name, crop: s.crop, areaHa: s.areaHa, village: s.village, farmer: s.farmer, alerts: s.alerts,
    center,
    polygon: poly(center, (s.size ?? 0.006) * Math.sqrt(s.areaHa / 2), i + 1),
    stage: s.stage ?? d.stage,
    plantingDate: s.plantingDate ?? d.planted,
    harvestWindow: s.harvestWindow ?? d.harvest,
    soil: { moisture: 32, temperature: 24, ph: 6.1, nitrogen: 38, phosphorus: 22, potassium: 140, ...s.soil },
    weather: s.weather ?? dry,
    drone: s.drone ?? null,
  };
});
