// Genera data/seed.json e public/drone/*.svg per la demo (spec §9).
// Uso: npm run seed:generate   (poi npm test per verificare i numeri attesi)
//
// I campi vengono dal nostro db: data/kasungu/kasungu_fields.csv (anagrafica, coltura, zona)
// e kasungu_monitoring_area.geojson (confini). Il CSV non contiene problemi, quindi sopra
// ai campi mettiamo gli scenari della demo:
// - SHOWCASE: 20 casi scritti a mano (ALERTS qui sotto), sui campi più vicini alla base
// - altri campi: i problemi vengono dal catalogo TEMPLATES e da PLAN (~10% dei campi)
// Il risultato è deterministico: stessi CSV + stesso script → stesso seed.json.
import fs from "node:fs";
import path from "node:path";

const root = process.argv[2] ?? process.cwd();

// ─── deterministic PRNG ──────────────────────────────────────────────────
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20270301);
const between = (a, b) => a + (b - a) * rand();
const round = (v, d = 0) => Math.round(v * 10 ** d) / 10 ** d;

const DEMO_NOW = "2027-03-01T05:00:00.000Z";
const iso = (s) => new Date(s).toISOString();

// ─── reference data ──────────────────────────────────────────────────────
const crops = [
  { id: "crp_maize", code: "MAIZE", name: "Maize", cycleDays: 130 },
  { id: "crp_soybean", code: "SOYBEAN", name: "Soybean", cycleDays: 110 },
  { id: "crp_beans", code: "BEANS", name: "Beans", cycleDays: 80 },
  { id: "crp_chili", code: "CHILI", name: "Chili", cycleDays: 150 },
];
const cropByCode = Object.fromEntries(crops.map((c) => [c.code, c]));
/** Nome della coltura nel CSV → codice del contratto. */
const CSV_CROPS = { Maize: "MAIZE", Soybean: "SOYBEAN", Beans: "BEANS", Chili: "CHILI" };

// ─── db: CSV + GeoJSON (data/kasungu) ────────────────────────────────────
const dbDir = path.join(root, "data", "kasungu");
function readCsv(file) {
  const [header, ...rows] = fs.readFileSync(path.join(dbDir, file), "utf8").replace(/^﻿/, "").trim().split(/\r?\n/);
  const keys = header.split(",");
  return rows.map((line) => Object.fromEntries(line.split(",").map((v, i) => [keys[i], v])));
}
const csvFields = readCsv("kasungu_fields.csv");
const csvZones = readCsv("kasungu_zones.csv");
const boundaries = new Map(
  JSON.parse(fs.readFileSync(path.join(dbDir, "kasungu_monitoring_area.geojson"), "utf8"))
    .features.filter((f) => f.properties.kind === "field")
    .map((f) => [f.properties.field_id, f.geometry]),
);
for (const row of csvFields) {
  if (!CSV_CROPS[row.crop]) throw new Error(`kasungu_fields.csv: unknown crop "${row.crop}" (${row.field_id})`);
  if (!boundaries.has(row.field_id)) throw new Error(`kasungu_monitoring_area.geojson: no boundary for ${row.field_id}`);
}

// Scenari della demo: n, coltura, data di semina, stadio, finestra di raccolta (facoltativa).
// Ogni scenario va sul campo del CSV con quella coltura più vicino alla base (travel_min).
const SHOWCASE = [
  [1, "MAIZE", "2026-12-28", "VEGETATIVE"],
  [2, "MAIZE", "2027-01-18", "VEGETATIVE"],
  [3, "CHILI", "2026-10-25", "MATURITY", ["2027-02-20", "2027-03-20"]],
  [4, "MAIZE", "2026-12-05", "FRUITING"],
  [5, "CHILI", "2026-11-20", "FLOWERING"],
  [6, "SOYBEAN", "2026-12-15", "FLOWERING"],
  [7, "BEANS", "2026-12-20", "MATURITY", ["2027-03-05", "2027-03-12"]],
  [8, "MAIZE", "2026-12-01", "FRUITING"],
  [9, "SOYBEAN", "2026-12-10", "FRUITING"],
  [10, "CHILI", "2026-11-05", "MATURITY", ["2027-02-25", "2027-04-15"]],
  [11, "CHILI", "2026-12-20", "FLOWERING"],
  [12, "SOYBEAN", "2026-11-30", "MATURITY", ["2027-03-10", "2027-03-20"]],
  [13, "MAIZE", "2027-01-22", "VEGETATIVE"],
  [14, "BEANS", "2027-01-05", "FLOWERING"],
  [15, "MAIZE", "2026-11-25", "FRUITING"],
  [16, "SOYBEAN", "2026-12-08", "FRUITING"],
  [17, "CHILI", "2026-12-05", "FRUITING"],
  [18, "MAIZE", "2026-11-28", "FLOWERING"],
  [19, "MAIZE", "2026-12-03", "FRUITING"],
  [20, "BEANS", "2026-12-28", "FRUITING"],
];

// ─── alerts + actions (hand-written content, to be validated by #5) ──────
// key: scenario n → array of { suffix, category, severity, source, confidence, title, description, detectedAt, dueAt, actions: [[priority, title, why, dueAt]] }
const ALERTS = {
  1: [{
    s: "a", category: "DISEASE", severity: "CRITICAL", source: "DRONE", confidence: 0.81,
    title: "Fall armyworm outbreak (~30% of plants)",
    description: "Drone imagery from 28 Feb shows ragged holes and frass in the leaf whorls of about 30% of plants, spreading from the eastern edge of the field.",
    detectedAt: "2027-02-28T09:30:00Z", dueAt: "2027-03-01T16:00:00Z",
    actions: [
      [1, "Scout 20 plants in a W pattern today", "Confirm the drone finding on the ground: look for larvae and fresh frass inside the whorls. The share of infested plants decides whether spraying is needed.", "2027-03-01T14:00:00Z"],
      [2, "Treat the whorls early morning or late afternoon", "If more than 20% of plants are infested, apply a recommended insecticide or biopesticide into the whorls. Larvae are most exposed at these times of day.", "2027-03-02T07:00:00Z"],
      [3, "Re-check the field in 7 days", "Fall armyworm has several generations per season; a new wave is likely after the coming rains.", "2027-03-08T07:00:00Z"],
    ],
  }],
  2: [{
    s: "a", category: "FERTILIZER", severity: "HIGH", source: "SENSOR", confidence: 0.74,
    title: "Nitrogen deficiency — top-dressing window closing",
    description: "Soil nitrogen is 9 ppm (target above 20) and the crop is at knee height, the last useful window for urea. 38 mm of rain is forecast for 2 March.",
    detectedAt: "2027-02-28T04:00:00Z", dueAt: "2027-03-02T06:00:00Z",
    actions: [
      [1, "Apply urea top-dressing today and cover it with soil", "Place the fertilizer 5–10 cm from each plant and cover it. Applied and buried before the 2 March rain, it is not washed away.", "2027-03-01T16:00:00Z"],
      [2, "Do not apply during the heavy rain on 2 March", "Uncovered fertilizer on wet soil is lost with the run-off.", "2027-03-02T06:00:00Z"],
      [3, "Check leaf colour again in 10 days", "Yellowing that starts at the tip of the lower leaves should stop moving up the plant.", "2027-03-11T07:00:00Z"],
    ],
  }],
  3: [{
    s: "a", category: "MATURITY", severity: "CRITICAL", source: "WEATHER", confidence: 0.85,
    title: "Pick ripe chillies now: heavy rain in 48h",
    description: "About 70% of the fruits on sample plants are fully red. 45 mm of rain is forecast on 3 March; ripe chillies left on the plant in heavy rain split and rot, and wet pods dry badly and can develop aflatoxin.",
    detectedAt: "2027-03-01T04:00:00Z", dueAt: "2027-03-03T00:00:00Z",
    actions: [
      [1, "Pick all red chillies within 48 hours", "The fruit is ripe and 45 mm of rain is forecast on 3 March. Fruit left on the plant in heavy rain splits and rots.", "2027-03-03T00:00:00Z"],
      [2, "Dry chillies on raised racks or tarpaulins, not on bare soil", "Contact with damp soil is the main route of mould and aflatoxin contamination during drying.", "2027-03-03T00:00:00Z"],
      [3, "Store only when pods are brittle and the seeds rattle", "Storing chillies before they are fully dry lets mould grow in the bags.", "2027-03-10T07:00:00Z"],
    ],
  }],
  4: [{
    s: "a", category: "DISEASE", severity: "HIGH", source: "DRONE", confidence: 0.72,
    title: "Grey leaf spot on lower leaves",
    description: "Drone close-ups show long, rectangular grey-brown lesions between the leaf veins on lower leaves, mostly in the wetter, low-lying half of the field.",
    detectedAt: "2027-02-27T10:00:00Z", dueAt: "2027-03-06T07:00:00Z",
    actions: [
      [1, "Confirm in the field on 10 plants", "Grey leaf spot lesions are rectangular and bounded by the veins, which distinguishes them from other leaf spots.", "2027-03-03T07:00:00Z"],
      [2, "If lesions reach the ear leaf, consider a fungicide spray", "Protecting the ear leaf and the leaves above it protects grain filling.", "2027-03-06T07:00:00Z"],
      [3, "Plan a rotation with soybean or beans next season", "The fungus survives on maize residue; rotating crops breaks the cycle.", null],
    ],
  }],
  5: [
    {
      s: "a", category: "DISEASE", severity: "MEDIUM", source: "SENSOR", confidence: 0.64,
      title: "Conditions favourable to Phytophthora blight",
      description: "Soil moisture has stayed above 85% with soil temperature above 25 °C for 6 days. These conditions favour Phytophthora blight, a soil-borne disease of chilli. No visual symptoms have been confirmed yet.",
      detectedAt: "2027-02-28T04:00:00Z", dueAt: "2027-03-09T07:00:00Z",
      actions: [
        [1, "Inspect stems at soil level for dark, water-soaked lesions", "Phytophthora causes dark lesions at the stem base and sudden wilting. Removing infected plants early limits spread.", "2027-03-04T07:00:00Z"],
        [2, "Open drainage furrows in waterlogged rows", "The pathogen moves in standing water; draining the field lowers the risk.", "2027-03-06T07:00:00Z"],
      ],
    },
    {
      s: "b", category: "FERTILIZER", severity: "MEDIUM", source: "SENSOR", confidence: 0.78,
      title: "Low potassium for fruit quality",
      description: "Soil potassium is 62 ppm, below the 100 ppm target for chilli. Low potassium reduces fruit size and colour.",
      detectedAt: "2027-02-27T04:00:00Z", dueAt: "2027-03-10T07:00:00Z",
      actions: [
        [3, "Apply a potassium fertilizer such as potassium sulphate", "Chilli needs potassium to fill and colour its fruit; apply it to moist soil and cover it.", "2027-03-10T07:00:00Z"],
      ],
    },
  ],
  6: [{
    s: "a", category: "DISEASE", severity: "MEDIUM", source: "DRONE", confidence: 0.68,
    title: "Early soybean rust symptoms",
    description: "Drone images show small tan-brown spots on lower leaves in the centre of the field. Humid weather is forecast for the coming days.",
    detectedAt: "2027-02-27T11:00:00Z", dueAt: "2027-03-07T07:00:00Z",
    actions: [
      [1, "Check the underside of lower leaves for raised pustules", "Small raised pustules on the leaf underside confirm rust.", "2027-03-03T07:00:00Z"],
      [2, "If confirmed, spray a recommended fungicide before flowering ends", "Rust spreads quickly in humid weather and causes early leaf drop, reducing pod fill.", "2027-03-07T07:00:00Z"],
    ],
  }],
  7: [
    {
      s: "a", category: "DISEASE", severity: "MEDIUM", source: "DRONE", confidence: 0.7,
      title: "Angular leaf spot",
      description: "Angular brown lesions limited by the leaf veins are visible on about 15% of leaves.",
      detectedAt: "2027-02-26T10:00:00Z", dueAt: "2027-03-08T07:00:00Z",
      actions: [
        [2, "Avoid working among the plants when leaves are wet", "The fungus spreads with rain splash and on wet hands and tools.", null],
        [3, "Keep seed only from healthy plants", "Angular leaf spot is carried in the seed to the next season.", "2027-03-12T07:00:00Z"],
      ],
    },
    {
      s: "b", category: "MATURITY", severity: "MEDIUM", source: "WEATHER", confidence: 0.8,
      title: "Harvest window opens on 5 March",
      description: "Pods are turning yellow; the harvest window is expected between 5 and 12 March. Rain on 3–4 March may slow drying.",
      detectedAt: "2027-02-28T04:00:00Z", dueAt: "2027-03-06T07:00:00Z",
      actions: [
        [1, "Prepare tarpaulins and threshing space for 5 March", "Beans harvested at maturity and dried quickly keep their seed quality.", "2027-03-05T07:00:00Z"],
      ],
    },
  ],
  8: [{
    s: "a", category: "FERTILIZER", severity: "LOW", source: "SENSOR", confidence: 0.88,
    title: "Acidic soil (pH 5.0)",
    description: "Soil pH has averaged 5.0 this season. Below 5.5, maize takes up phosphorus poorly.",
    detectedAt: "2027-02-20T04:00:00Z", dueAt: "2027-04-15T07:00:00Z",
    actions: [
      [1, "Get a soil test from the district lab", "The right amount of lime depends on the soil type.", "2027-03-31T07:00:00Z"],
      [2, "Plan agricultural lime before next season's planting", "Lime needs a few weeks in the soil before planting to raise the pH.", "2027-04-15T07:00:00Z"],
    ],
  }],
  9: [{
    s: "a", category: "FERTILIZER", severity: "MEDIUM", source: "SENSOR", confidence: 0.71,
    title: "Low phosphorus at pod set",
    description: "Soil phosphorus is 7 ppm (target above 15). Phosphorus supports pod formation.",
    detectedAt: "2027-02-26T04:00:00Z", dueAt: "2027-03-09T07:00:00Z",
    actions: [
      [1, "Check for dark-green, stunted plants with few pods", "These symptoms confirm that phosphorus is limiting the crop.", "2027-03-05T07:00:00Z"],
      [2, "Next season: phosphorus fertilizer and inoculant at planting", "Soybean needs phosphorus early; rhizobium inoculant lets the plant fix its own nitrogen.", null],
    ],
  }],
  10: [{
    s: "a", category: "MATURITY", severity: "MEDIUM", source: "DRONE", confidence: 0.77,
    title: "First fruits turning red — start picking",
    description: "The drone colour index shows the first flush of fruit turning red across the field.",
    detectedAt: "2027-02-28T10:00:00Z", dueAt: "2027-03-05T07:00:00Z",
    actions: [
      [1, "Pick fully red fruits this week, then every 7–10 days", "Regular picking of ripe fruit keeps the plants producing and avoids over-ripe, rotting fruit.", "2027-03-05T07:00:00Z"],
      [2, "Prepare drying racks before the first picking", "Picked chillies must start drying on the same day.", "2027-03-03T07:00:00Z"],
    ],
  }],
  11: [{
    s: "a", category: "DISEASE", severity: "HIGH", source: "DRONE", confidence: 0.79,
    title: "Chilli leaf curl virus",
    description: "Drone images show patches of stunted plants with curled, yellow-mottled leaves. Whiteflies spread the virus between plants.",
    detectedAt: "2027-02-27T09:00:00Z", dueAt: "2027-03-04T12:00:00Z",
    actions: [
      [1, "Uproot and bury plants with leaf curl symptoms", "Infected plants are a source of virus; removing them slows the spread.", "2027-03-04T12:00:00Z"],
      [2, "Check the underside of young leaves for whiteflies", "Whiteflies carry the virus from plant to plant.", "2027-03-04T12:00:00Z"],
      [3, "Next season: raise seedlings under net and use a tolerant variety", "Protecting young plants from whiteflies avoids early infection.", null],
    ],
  }],
  12: [{
    s: "a", category: "MATURITY", severity: "LOW", source: "DRONE", confidence: 0.75,
    title: "Approaching maturity (R7)",
    description: "Most pods have turned brown; the expected harvest window is 10–20 March.",
    detectedAt: "2027-02-28T11:00:00Z", dueAt: "2027-03-10T07:00:00Z",
    actions: [
      [1, "Plan harvest labour for 10 March", "Harvesting promptly at full maturity (R8) avoids losses from pod shattering.", "2027-03-08T07:00:00Z"],
      [2, "Harvest in the morning", "Pods are less brittle with morning dew, so fewer split open.", null],
    ],
  }],
  13: [{
    s: "a", category: "FERTILIZER", severity: "MEDIUM", source: "SENSOR", confidence: 0.73,
    title: "Urea top-dressing due in 5 days",
    description: "The late-planted crop is approaching knee height and soil nitrogen is 14 ppm.",
    detectedAt: "2027-02-28T04:00:00Z", dueAt: "2027-03-06T07:00:00Z",
    actions: [
      [1, "Buy urea this week", "Having the fertilizer on the farm avoids missing the short top-dressing window.", "2027-03-04T07:00:00Z"],
      [2, "Apply at knee height, after the 3–4 March rains", "Applying to moist soil just after rain, and covering it, reduces losses.", "2027-03-06T07:00:00Z"],
    ],
  }],
};

// ─── weather ─────────────────────────────────────────────────────────────
const BASE_WEATHER = [
  ["2027-03-01", 17, 27, 2, 30, 70],
  ["2027-03-02", 18, 25, 12, 65, 80],
  ["2027-03-03", 18, 24, 30, 85, 90],
  ["2027-03-04", 17, 25, 15, 70, 85],
  ["2027-03-05", 17, 27, 3, 35, 72],
  ["2027-03-06", 16, 28, 0, 20, 65],
  ["2027-03-07", 17, 28, 4, 40, 70],
];
const WEATHER_OVERRIDES = {
  2: { "2027-03-02": [18, 24, 38, 85, 88] },
  3: {
    "2027-03-01": [17, 27, 2, 30, 70],
    "2027-03-02": [18, 26, 8, 60, 78],
    "2027-03-03": [18, 24, 45, 90, 92],
    "2027-03-04": [17, 25, 20, 75, 88],
    "2027-03-05": [17, 27, 3, 35, 72],
  },
};

// ─── sensors ─────────────────────────────────────────────────────────────
const SENSOR_OVERRIDES = {
  2: { nPpm: 9 },
  5: { soilMoisturePct: 88, soilTempC: 26.5, kPpm: 62 },
  8: { ph: 5.0 },
  9: { pPpm: 7 },
  13: { nPpm: 14 },
  3: { soilMoisturePct: 24 },
};

// ─── drone ───────────────────────────────────────────────────────────────
// pattern: how the "health" map is damaged
const DRONE = {
  1: { at: "2027-02-28T09:30:00Z", ndvi: 0.52, pattern: "east", findings: "Leaf damage consistent with fall armyworm on ~30% of plants, concentrated on the eastern edge." },
  3: { at: "2027-02-27T09:30:00Z", ndvi: 0.41, pattern: "senescence", findings: "Most of the canopy shows ripe red fruit, consistent with harvest maturity." },
  4: { at: "2027-02-27T10:00:00Z", ndvi: 0.58, pattern: "south", findings: "Lesions on lower leaves in the low-lying southern half of the field." },
  6: { at: "2027-02-27T11:00:00Z", ndvi: 0.63, pattern: "centre", findings: "Small tan-brown spots on lower leaves in the centre of the field." },
  7: { at: "2027-02-26T10:00:00Z", ndvi: 0.49, pattern: "spots", findings: "Angular leaf lesions on ~15% of leaves; pods turning yellow." },
  10: { at: "2027-02-28T10:00:00Z", ndvi: 0.55, pattern: "senescence-light", findings: "Fruit turning red across the field (first flush ripening)." },
  11: { at: "2027-02-27T09:00:00Z", ndvi: 0.5, pattern: "patches", findings: "Patches of stunted plants with curled, mottled yellow leaves." },
  12: { at: "2027-02-28T11:00:00Z", ndvi: 0.38, pattern: "senescence", findings: "Most of the canopy has turned brown (stage R7)." },
  15: { at: "2027-02-26T09:00:00Z", ndvi: 0.74, pattern: "healthy", findings: "Uniform, healthy canopy." },
  16: { at: "2027-02-26T11:00:00Z", ndvi: 0.71, pattern: "healthy", findings: "Uniform, healthy canopy." },
};

function ndviColor(v) {
  const stops = [[0.2, [178, 34, 34]], [0.4, [230, 145, 56]], [0.55, [241, 214, 74]], [0.7, [126, 186, 74]], [0.85, [38, 128, 56]]];
  if (v <= stops[0][0]) return `rgb(${stops[0][1].join(",")})`;
  for (let i = 1; i < stops.length; i++) {
    if (v <= stops[i][0]) {
      const [a, ca] = stops[i - 1], [b, cb] = stops[i];
      const t = (v - a) / (b - a);
      return `rgb(${ca.map((c, k) => Math.round(c + (cb[k] - c) * t)).join(",")})`;
    }
  }
  return `rgb(${stops[stops.length - 1][1].join(",")})`;
}

function droneSvg(code, dateLabel, pattern) {
  const r = mulberry32(code.split("").reduce((s, c) => s * 31 + c.charCodeAt(0), 7));
  const W = 480, H = 300, CW = 16, CH = 15, cols = W / CW, rows = H / CH;
  const patchCentres = [[0.3, 0.35], [0.7, 0.6], [0.45, 0.8]];
  let cells = "";
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const u = x / cols, v = y / rows;
      let health = 0.78 + (r() - 0.5) * 0.12;
      if (pattern === "east") health -= Math.max(0, (u - 0.55) * 1.1) + (r() < 0.12 ? 0.2 : 0);
      if (pattern === "south") health -= Math.max(0, (v - 0.5) * 0.7) + (r() < 0.1 ? 0.15 : 0);
      if (pattern === "centre") health -= Math.max(0, 0.3 - Math.hypot(u - 0.5, v - 0.5)) * 0.9;
      if (pattern === "spots") health -= (r() < 0.18 ? 0.3 : 0) + 0.15;
      if (pattern === "patches") for (const [px, py] of patchCentres) health -= Math.max(0, 0.14 - Math.hypot(u - px, v - py)) * 3;
      if (pattern === "senescence") health -= 0.38 + (r() - 0.5) * 0.1;
      if (pattern === "senescence-light") health -= 0.22 + Math.max(0, (v - 0.4) * 0.2);
      // crop rows
      const rowShade = x % 2 === 0 ? 0 : -0.03;
      cells += `<rect x="${x * CW}" y="${y * CH}" width="${CW}" height="${CH}" fill="${ndviColor(health + rowShade)}"/>`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Sample NDVI drone imagery for ${code}">
<rect width="${W}" height="${H}" fill="#6b4f2a"/>
${cells}
<rect x="0" y="${H - 28}" width="${W}" height="28" fill="rgba(0,0,0,0.55)"/>
<text x="10" y="${H - 9}" font-family="Arial, sans-serif" font-size="13" fill="#fff">${code === "sample" ? "Sample imagery · NDVI" : `Sample imagery · NDVI · ${code} · ${dateLabel}`}</text>
</svg>
`;
}

// ─── generated issues: problem templates (simplified, to be validated by #5) ──
// {x} in text is replaced with a value drawn from vars.x = [min, max, decimals?].
const TEMPLATES = {
  DISEASE: {
    MAIZE: [
      { source: "DRONE", drone: "east", stage: "VEGETATIVE", vars: { pct: [8, 18] },
        title: "Fall armyworm damage on ~{pct}% of plants",
        description: "Drone images show ragged leaf holes and frass in the whorls of about {pct}% of plants.",
        actions: [["Scout 20 plants in a W pattern", "Confirm larvae in the whorls before deciding whether to treat."],
                  ["Treat the whorls if more than 20% of plants are infested", "Larvae are most exposed early in the morning or late in the afternoon."]] },
      { source: "SENSOR", stage: "FRUITING", vars: { days: [4, 7] },
        title: "Conditions favourable to grey leaf spot",
        description: "Humidity and leaf wetness have stayed high for {days} days with warm temperatures, conditions that favour grey leaf spot. No visual symptoms confirmed yet.",
        actions: [["Check lower leaves for rectangular grey lesions", "Confirming early allows a timely decision on fungicide."],
                  ["Plan a rotation for next season", "The fungus survives on maize residue."]] },
      { source: "DRONE", drone: "spots", stage: "VEGETATIVE", vars: {},
        title: "Maize streak virus symptoms",
        description: "Drone close-ups show yellow streaks along the leaves of scattered plants.",
        actions: [["Uproot plants with streak symptoms", "Removing infected plants reduces the source of the virus."],
                  ["Next season: plant early with a tolerant variety", "Early planting avoids the peak of leafhoppers that carry the virus."]] },
    ],
    SOYBEAN: [
      { source: "DRONE", drone: "centre", stage: "FLOWERING", vars: {},
        title: "Early soybean rust symptoms",
        description: "Drone images show small tan-brown spots on lower leaves.",
        actions: [["Check the underside of lower leaves for raised pustules", "Pustules on the leaf underside confirm rust."],
                  ["If confirmed, spray a recommended fungicide", "Rust spreads quickly in humid weather and causes early leaf drop."]] },
      { source: "SENSOR", stage: "FLOWERING", vars: { days: [4, 6] },
        title: "Conditions favourable to soybean rust",
        description: "Humid, mild nights for {days} days favour rust spores. No visual symptoms confirmed yet.",
        actions: [["Inspect lower leaves this week", "Rust is easiest to control when caught early."],
                  ["Prepare a fungicide plan with the agro-dealer", "Having the product ready avoids delays if rust is confirmed."]] },
    ],
    BEANS: [
      { source: "DRONE", drone: "spots", stage: "FLOWERING", vars: { pct: [10, 20] },
        title: "Angular leaf spot",
        description: "Angular brown lesions limited by the leaf veins are visible on about {pct}% of leaves.",
        actions: [["Avoid working among the plants when leaves are wet", "The fungus spreads with rain splash and on wet hands and tools."],
                  ["Keep seed only from healthy plants", "The disease is carried in the seed to the next season."]] },
      { source: "DRONE", drone: "spots", stage: "FRUITING", vars: {},
        title: "Anthracnose on pods",
        description: "Dark sunken lesions are visible on pods in parts of the field.",
        actions: [["Remove and burn badly affected plants", "Infected plant material spreads the fungus."],
                  ["Do not use these seeds for planting", "Anthracnose is seed-borne."]] },
    ],
    CHILI: [
      { source: "SENSOR", stage: "FLOWERING", vars: { moist: [84, 90] }, sensor: { soilMoisturePct: "moist" },
        title: "Conditions favourable to Phytophthora blight",
        description: "Soil moisture is around {moist}% with warm soil for several days, conditions that favour Phytophthora blight. No visual symptoms confirmed yet.",
        actions: [["Inspect stems at soil level for dark, water-soaked lesions", "Early removal of infected plants limits spread."],
                  ["Open drainage furrows in waterlogged rows", "The pathogen moves in standing water."]] },
      { source: "DRONE", drone: "patches", stage: "FLOWERING", vars: {},
        title: "Chilli leaf curl virus",
        description: "Patches of stunted plants with curled, yellow-mottled leaves; whiteflies spread the virus.",
        actions: [["Uproot and bury plants with leaf curl symptoms", "Infected plants are a source of virus."],
                  ["Check the underside of young leaves for whiteflies", "Whiteflies carry the virus from plant to plant."]] },
      { source: "DRONE", drone: "spots", stage: "FRUITING", vars: {},
        title: "Anthracnose on fruit",
        description: "Sunken dark spots are visible on ripening fruit in parts of the field.",
        actions: [["Remove and destroy infected fruit", "The fungus spreads from rotting fruit to healthy fruit with rain splash."],
                  ["Do not keep seed from infected fruit", "Anthracnose is carried in the seed."]] },
    ],
  },
  FERTILIZER: {
    MAIZE: [
      { source: "SENSOR", stage: "VEGETATIVE", vars: { n: [8, 13] }, sensor: { nPpm: "n" },
        title: "Nitrogen deficiency — top-dressing due",
        description: "Soil nitrogen is {n} ppm (target above 20) and the crop is near knee height.",
        actions: [["Apply urea top-dressing and cover it with soil", "Buried fertilizer is not lost with rain or sun."],
                  ["Check leaf colour again in 10 days", "Yellowing of the lower leaves should stop."]] },
      { source: "SENSOR", stage: "FRUITING", vars: { ph: [4.9, 5.3, 1] }, sensor: { ph: "ph" },
        title: "Acidic soil (pH {ph})",
        description: "Soil pH is {ph}. Below 5.5, maize takes up phosphorus poorly.",
        actions: [["Get a soil test from the district lab", "The right amount of lime depends on the soil."],
                  ["Plan agricultural lime before next season", "Lime needs a few weeks in the soil to work."]] },
    ],
    SOYBEAN: [
      { source: "SENSOR", stage: "FRUITING", vars: { p: [6, 9] }, sensor: { pPpm: "p" },
        title: "Low phosphorus at pod set",
        description: "Soil phosphorus is {p} ppm (target above 15). Phosphorus supports pod formation.",
        actions: [["Check for dark-green, stunted plants with few pods", "Confirms that phosphorus is limiting the crop."],
                  ["Next season: phosphorus fertilizer and inoculant at planting", "Soybean needs phosphorus early."]] },
    ],
    BEANS: [
      { source: "SENSOR", stage: "FLOWERING", vars: { p: [6, 9] }, sensor: { pPpm: "p" },
        title: "Low phosphorus",
        description: "Soil phosphorus is {p} ppm (target above 15), limiting flowering and pod set.",
        actions: [["Record the field for phosphorus at next planting", "Phosphorus is most useful when placed at planting."],
                  ["Add manure or compost before next season", "Organic matter improves phosphorus availability."]] },
    ],
    CHILI: [
      { source: "SENSOR", stage: "FLOWERING", vars: { k: [55, 70] }, sensor: { kPpm: "k" },
        title: "Low potassium for fruit quality",
        description: "Soil potassium is {k} ppm, below the 100 ppm target for chilli.",
        actions: [["Apply a potassium fertilizer such as potassium sulphate", "Potassium fills and colours the fruit."],
                  ["Re-test the soil in two weeks", "Checks that the application reached the roots."]] },
      { source: "SENSOR", stage: "FRUITING", vars: { ph: [5.0, 5.4, 1] }, sensor: { ph: "ph" },
        title: "Calcium likely low — risk of blossom-end rot",
        description: "Acidic soil (pH {ph}) suggests low calcium while fruits are forming; low calcium causes dark, sunken patches at the fruit tip.",
        actions: [["Apply gypsum or agricultural lime around the plants", "Supplies calcium to the developing fruit."],
                  ["Water evenly during fruit set", "Irregular soil moisture makes blossom-end rot worse."]] },
    ],
  },
  MATURITY: {
    MAIZE: [
      { source: "DRONE", drone: "senescence", stage: "MATURITY", vars: {},
        title: "Approaching maturity — plan harvest",
        description: "The canopy is drying down; black layer is expected within two weeks.",
        actions: [["Check kernels for the black layer", "Harvesting at maturity avoids losses in the field."],
                  ["Prepare drying and storage space", "Grain must dry to safe moisture before storage."]] },
    ],
    SOYBEAN: [
      { source: "DRONE", drone: "senescence", stage: "MATURITY", vars: {},
        title: "Approaching maturity (R7)",
        description: "Most pods have turned brown; harvest window expected within two weeks.",
        actions: [["Plan harvest labour", "Prompt harvest at R8 avoids pod shattering."],
                  ["Harvest in the morning", "Pods shatter less with morning dew."]] },
    ],
    BEANS: [
      { source: "WEATHER", stage: "MATURITY", vars: {},
        title: "Harvest window opens soon",
        description: "Pods are turning yellow; the forecast shows rain on 3 March, so harvest before or dry quickly after.",
        actions: [["Prepare tarpaulins and threshing space", "Quick drying keeps seed quality."],
                  ["Harvest on dry days", "Wet pods can rot."]] },
    ],
    CHILI: [
      { source: "WEATHER", stage: "MATURITY", vars: {},
        title: "Ripe fruit — pick before the rains",
        description: "Many fruits are fully red and heavy rain is forecast; ripe chillies left on the plant in the rain split and rot.",
        actions: [["Pick all fully red fruits before the rain", "Ripe fruit left on the plant in heavy rain splits and rots."],
                  ["Dry chillies on raised racks or tarpaulins", "Contact with damp soil spreads mould and aflatoxin."]] },
      { source: "DRONE", drone: "senescence-light", stage: "MATURITY", vars: {},
        title: "Fruits turning red — plan picking",
        description: "The drone colour index shows fruits turning red across the field.",
        actions: [["Pick fully red fruits every 7–10 days", "Regular picking keeps the plants producing."],
                  ["Prepare drying racks", "Chillies must start drying on the day they are picked."]] },
    ],
  },
};

// ─── generated issues: plan (~10% of all fields have issues) ─────────────
// urgent: HIGH severity with due date within 72h of "now"
const PLAN = [
  { crop: "MAIZE", cats: ["DISEASE"], urgent: true },
  { crop: "CHILI", cats: ["DISEASE"], urgent: true },
  { crop: "MAIZE", cats: ["FERTILIZER"], urgent: true },
  { crop: "CHILI", cats: ["MATURITY"], urgent: true, rain: true },
  { crop: "BEANS", cats: ["MATURITY"], urgent: true, rain: true },
  { crop: "CHILI", cats: ["DISEASE", "FERTILIZER"] },
  { crop: "MAIZE", cats: ["DISEASE", "FERTILIZER"] },
  { crop: "SOYBEAN", cats: ["DISEASE", "FERTILIZER"] },
];
const SINGLE_CROPS = {
  DISEASE: ["MAIZE", "SOYBEAN", "BEANS", "CHILI", "CHILI", "MAIZE", "MAIZE"],
  FERTILIZER: ["MAIZE", "MAIZE", "SOYBEAN", "BEANS", "CHILI", "CHILI"],
  MATURITY: ["MAIZE", "SOYBEAN", "BEANS", "CHILI", "CHILI"],
};
const SINGLE_COUNTS = { DISEASE: 14, FERTILIZER: 13, MATURITY: 12 };
for (const [cat, count] of Object.entries(SINGLE_COUNTS)) {
  for (let i = 0; i < count; i++) PLAN.push({ crop: SINGLE_CROPS[cat][i % SINGLE_CROPS[cat].length], cats: [cat] });
}

const STAGE_FRACTION = { EMERGENCE: 0.1, VEGETATIVE: 0.3, FLOWERING: 0.5, FRUITING: 0.7, MATURITY: 0.93 };
const HEALTHY_STAGES = ["VEGETATIVE", "FLOWERING", "FRUITING", "FRUITING", "MATURITY"];
const DRONE_NDVI = { healthy: 0.74, east: 0.55, spots: 0.52, centre: 0.6, patches: 0.5, senescence: 0.4, "senescence-light": 0.56 };

const pick = (arr) => arr[Math.floor(rand() * arr.length)];
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const fill = (text, values) => text.replace(/\{(\w+)\}/g, (_, k) => String(values[k]));
function drawVars(vars) {
  const values = {};
  for (const [k, [min, max, decimals = 0]] of Object.entries(vars)) values[k] = round(between(min, max), decimals);
  return values;
}
const daysFromNow = (days, hourUtc = 7) => {
  const d = new Date(DEMO_NOW);
  d.setUTCDate(d.getUTCDate() + days);
  d.setUTCHours(hourUtc, 0, 0, 0);
  return d.toISOString();
};
// il CSV non ha telefoni: li generiamo
const phone = () =>
  `+265 ${pick(["99", "88"])}${Math.floor(between(1, 9))} ${Math.floor(between(100, 999))} ${Math.floor(between(100, 999))}`;

// ─── build ───────────────────────────────────────────────────────────────
const addDays = (date, days) => new Date(Date.parse(date) + days * 86400000).toISOString().slice(0, 10);

const seed = {
  demoNow: DEMO_NOW,
  farmers: [], crops, fields: [], plantings: [], alerts: [], actions: [],
  sensorReadings: [], weatherForecasts: [], droneCaptures: [],
};

const droneDir = path.join(root, "public", "drone");
fs.rmSync(droneDir, { recursive: true, force: true });
fs.mkdirSync(droneDir, { recursive: true });
for (const pattern of Object.keys(DRONE_NDVI)) {
  fs.writeFileSync(path.join(droneDir, `sample-${pattern}.svg`), droneSvg("sample", "sample", pattern));
}

// each zone (one weather station) has its own, slightly different forecast
const zoneWeather = Object.fromEntries(
  csvZones.map(({ zone_id }) => [
    zone_id,
    BASE_WEATHER.map(([date, tmin, tmax, rain, prob, hum]) => [
      date, tmin + Math.round(between(-1, 1)), tmax + Math.round(between(-1, 1)),
      round(rain * between(0.7, 1.3)), Math.min(95, prob + Math.round(between(-5, 5))), hum,
    ]),
  ]),
);

function addWeather(id, zone, overrides) {
  for (const [date, tmin, tmax, rain, prob, hum] of zoneWeather[zone]) {
    const o = overrides?.[date];
    const [a, b, c, d, e] = o ?? [tmin, tmax, round(rain * between(0.9, 1.1)), prob, hum];
    seed.weatherForecasts.push({
      id: `wf_${id}_${date.replaceAll("-", "")}`, fieldId: id, date,
      tempMinC: a, tempMaxC: b, rainMm: c, rainProbPct: d, humidityPct: e,
    });
  }
}
const baseSensor = (row) => ({
  id: `sr_${row.field_id}`, fieldId: row.field_id, sensorId: row.soil_node_id, measuredAt: iso("2027-03-01T04:00:00Z"),
  soilMoisturePct: round(between(30, 46)), soilTempC: round(between(22, 25), 1), ph: round(between(5.7, 6.4), 1),
  nPpm: round(between(19, 30)), pPpm: round(between(15, 26)), kPpm: round(between(95, 140)),
});

// Scenario showcase → campo più vicino alla base con quella coltura; PLAN → campi a caso con quella coltura.
const used = new Set();
function takeField(rows, cropCode) {
  const row = rows.find((r) => !used.has(r.field_id) && CSV_CROPS[r.crop] === cropCode);
  if (!row) throw new Error(`kasungu_fields.csv: no free ${cropCode} field left`);
  used.add(row.field_id);
  return row;
}
const byDistance = [...csvFields].sort(
  (a, b) => Number(a.travel_min) - Number(b.travel_min) || Number(a.dist_base_km) - Number(b.dist_base_km),
);
const showcaseById = new Map(SHOWCASE.map((entry) => [takeField(byDistance, entry[1]).field_id, entry]));
const shuffledFields = shuffle(csvFields);
const planById = new Map(PLAN.map((plan) => [takeField(shuffledFields, plan.crop).field_id, plan]));
let urgentSeq = 0;
let issueSeq = 0;

for (const row of csvFields) {
  const id = row.field_id;
  const crop = cropByCode[CSV_CROPS[row.crop]];

  // campo e contadino così come sono nel db
  seed.farmers.push({ id: `frm_${id}`, name: row.farmer, phone: phone(), village: row.group_name });
  seed.fields.push({
    id, code: id, name: row.field_name, farmerId: `frm_${id}`, areaHa: Number(row.area_ha),
    boundary: boundaries.get(id), centroidLat: Number(row.lat), centroidLng: Number(row.lon),
  });

  // 1) showcase fields (hand-written scenarios)
  const showcase = showcaseById.get(id);
  if (showcase) {
    const [n, , planted, stage, harvest] = showcase;
    const [hStart, hEnd] = harvest ?? [addDays(planted, crop.cycleDays - 5), addDays(planted, crop.cycleDays + 10)];
    seed.plantings.push({
      id: `pln_${id}`, fieldId: id, cropId: crop.id,
      plantedAt: planted, expectedHarvestStart: hStart, expectedHarvestEnd: hEnd,
      growthStage: stage, status: "ACTIVE",
    });

    for (const a of ALERTS[n] ?? []) {
      const alertId = `alr_${id}${a.s}`;
      seed.alerts.push({
        id: alertId, fieldId: id, plantingId: `pln_${id}`,
        category: a.category, severity: a.severity, title: a.title, description: a.description,
        source: a.source, confidence: a.confidence,
        detectedAt: iso(a.detectedAt), dueAt: a.dueAt ? iso(a.dueAt) : null,
        status: "OPEN", resolvedAt: null,
      });
      for (const [priority, title, why, dueAt] of a.actions) {
        seed.actions.push({
          id: `act_${id}${a.s}${priority}`, alertId, fieldId: id,
          priority, title, why, dueAt: dueAt ? iso(dueAt) : null, done: false, doneAt: null,
        });
      }
    }

    seed.sensorReadings.push({ ...baseSensor(row), ...(SENSOR_OVERRIDES[n] ?? {}) });
    addWeather(id, row.zone_id, WEATHER_OVERRIDES[n]);

    const drone = DRONE[n];
    if (drone) {
      const file = `${id.toLowerCase()}.svg`;
      const dateLabel = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(drone.at));
      fs.writeFileSync(path.join(droneDir, file), droneSvg(id, dateLabel, drone.pattern));
      seed.droneCaptures.push({
        id: `dc_${id}`, fieldId: id, capturedAt: iso(drone.at),
        imageUrl: `/drone/${file}`, ndviMean: drone.ndvi, findings: drone.findings,
      });
    }
    continue;
  }

  // 2) other fields: issues from PLAN + TEMPLATES, or healthy
  const plan = planById.get(id);
  const seq = plan ? issueSeq++ : 0;
  const templates = plan
    ? plan.cats.map((cat, k) => {
        const options = TEMPLATES[cat][crop.code];
        return options[(seq + k) % options.length];
      })
    : [];
  const stage = templates[0]?.stage ?? pick(HEALTHY_STAGES);
  const plantedAt = addDays(DEMO_NOW, -Math.round(crop.cycleDays * STAGE_FRACTION[stage] + between(-4, 4)));
  seed.plantings.push({
    id: `pln_${id}`, fieldId: id, cropId: crop.id, plantedAt,
    expectedHarvestStart: addDays(plantedAt, crop.cycleDays - 5), expectedHarvestEnd: addDays(plantedAt, crop.cycleDays + 10),
    growthStage: stage, status: "ACTIVE",
  });

  const sensor = baseSensor(row);
  let droneTemplate = null;
  let priority = 1;
  templates.forEach((t, k) => {
    const values = drawVars(t.vars);
    for (const [field, varName] of Object.entries(t.sensor ?? {})) sensor[field] = values[varName];
    const suffix = "ab"[k];
    const alertId = `alr_${id}${suffix}`;
    const due = plan.urgent ? daysFromNow(1, 13 + 6 * urgentSeq++) : daysFromNow(Math.floor(between(4, 12)));
    seed.alerts.push({
      id: alertId, fieldId: id, plantingId: `pln_${id}`,
      category: plan.cats[k], severity: plan.urgent ? "HIGH" : pick(["LOW", "MEDIUM", "MEDIUM", "HIGH"]),
      title: fill(t.title, values), description: fill(t.description, values),
      source: t.source, confidence: round(between(0.6, 0.92), 2),
      detectedAt: daysFromNow(-Math.floor(between(0, 4)), 4), dueAt: due,
      status: "OPEN", resolvedAt: null,
    });
    t.actions.forEach(([title, why], j) => {
      const firstDue = Math.max(Date.parse(due) - 86400000, Date.parse(DEMO_NOW) + 6 * 3600000);
      seed.actions.push({
        id: `act_${id}${suffix}${priority}`, alertId, fieldId: id,
        priority: priority++, title, why, dueAt: j === 0 ? new Date(firstDue).toISOString() : due, done: false, doneAt: null,
      });
    });
    if (t.source === "DRONE") droneTemplate = { t, values };
  });
  seed.sensorReadings.push(sensor);

  addWeather(id, row.zone_id, plan?.rain ? { "2027-03-03": [18, 24, 40, 88, 92] } : undefined);

  if (droneTemplate || rand() < 0.08) {
    const pattern = droneTemplate?.t.drone ?? "healthy";
    seed.droneCaptures.push({
      id: `dc_${id}`, fieldId: id, capturedAt: daysFromNow(-Math.floor(between(1, 4)), 9),
      imageUrl: `/drone/sample-${pattern}.svg`, ndviMean: round(DRONE_NDVI[pattern] + between(-0.04, 0.04), 2),
      findings: droneTemplate ? fill(droneTemplate.t.description, droneTemplate.values) : "Uniform, healthy canopy.",
    });
  }
}

// compact writer: one row per line (diff-friendly and much smaller than pretty JSON)
const out = ["{", `  "demoNow": ${JSON.stringify(seed.demoNow)},`];
const tables = Object.keys(seed).filter((k) => k !== "demoNow");
tables.forEach((table, i) => {
  out.push(`  "${table}": [`);
  out.push(seed[table].map((row) => `    ${JSON.stringify(row)}`).join(",\n"));
  out.push(`  ]${i < tables.length - 1 ? "," : ""}`);
});
out.push("}");
fs.mkdirSync(path.join(root, "data"), { recursive: true });
fs.writeFileSync(path.join(root, "data", "seed.json"), out.join("\n") + "\n");

const byField = new Map();
for (const a of seed.alerts) byField.set(a.fieldId, [...(byField.get(a.fieldId) ?? []), a]);
const count = (pred) => [...byField.values()].filter(pred).length;
const isUrgent = (a) => a.severity === "CRITICAL" || Date.parse(a.dueAt) - Date.parse(DEMO_NOW) <= 72 * 3600000;
console.log(`showcase: ${[...showcaseById].map(([id, [n]]) => `${n}→${id}`).join(" ")}`);
console.log(`fields ${seed.fields.length} · alerts ${seed.alerts.length} · actions ${seed.actions.length} · drone ${seed.droneCaptures.length}`);
console.log(
  `urgent ${count((as) => as.some(isUrgent))} · disease ${count((as) => as.some((a) => a.category === "DISEASE"))} · ` +
    `fertilizer ${count((as) => as.some((a) => a.category === "FERTILIZER"))} · maturity ${count((as) => as.some((a) => a.category === "MATURITY"))} · ` +
    `ok ${seed.fields.length - byField.size}`,
);
