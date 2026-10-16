export type Category = "urgent" | "disease" | "fertilizer" | "maturity" | "healthy";
export type IssueCategory = Exclude<Category, "urgent" | "healthy">;
export type Severity = "critical" | "high" | "medium" | "low";
export type Crop = "maize" | "soybean" | "beans" | "tobacco" | "groundnut";

export interface Recommendation {
  action: string;
  why: string;
  window: string;
}

export interface Alert {
  id: string;
  category: IssueCategory;
  title: string;
  severity: Severity;
  status: "open" | "resolved";
  /** Hours from DEMO_NOW until the action deadline */
  dueInHours: number;
  recommendations: Recommendation[];
}

export interface SoilReading {
  moisture: number; // %
  temperature: number; // °C
  ph: number;
  nitrogen: number; // mg/kg
  phosphorus: number; // mg/kg
  potassium: number; // mg/kg
}

export interface WeatherDay {
  day: string;
  condition: "sunny" | "cloudy" | "rain" | "storm";
  high: number;
  low: number;
  rainMm: number;
}

export interface Field {
  id: string;
  name: string;
  crop: Crop;
  areaHa: number;
  village: string;
  farmer: { name: string; phone: string };
  polygon: [number, number][];
  center: [number, number];
  stage: string;
  plantingDate: string;
  harvestWindow: string;
  soil: SoilReading;
  weather: WeatherDay[];
  drone: { date: string; note: string } | null;
  alerts: Alert[];
}
