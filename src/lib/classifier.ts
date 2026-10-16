import type { Crop } from "@/data/types";

export interface Classification {
  simulated: boolean;
  category: "disease" | "pest" | "nutrient" | "healthy";
  label: string;
  confidence: number; // 0..1
  severity: "high" | "medium" | "low" | "none";
  explanation: string;
  nextSteps: string[];
}

/** Interface a real CV/ML service must implement. */
export interface CropClassifier {
  classify(image: File, crop: Crop): Promise<Classification>;
}

const RESULTS: Record<Crop, Omit<Classification, "simulated" | "confidence">[]> = {
  maize: [
    { category: "pest", label: "Fall armyworm (possible)", severity: "high", explanation: "Ragged holes and frass in the leaf whorl are typical of fall armyworm larvae.", nextSteps: ["Scout 20 plants and count damaged whorls", "If >20% damaged, apply an approved pesticide into the whorl", "Re-check in 7 days"] },
    { category: "nutrient", label: "Nitrogen deficiency (possible)", severity: "medium", explanation: "V-shaped yellowing starting from leaf tips on lower leaves suggests low nitrogen.", nextSteps: ["Top dress with Urea at ~100 kg/ha", "Apply when soil is moist and cover the fertilizer"] },
  ],
  soybean: [{ category: "disease", label: "Soybean rust (possible)", severity: "medium", explanation: "Small tan-brown lesions on the underside of leaves are consistent with rust.", nextSteps: ["Check underside of leaves with a hand lens", "Consult extension guidelines on fungicide use"] }],
  beans: [{ category: "disease", label: "Angular leaf spot (possible)", severity: "low", explanation: "Angular brown lesions bounded by veins suggest angular leaf spot.", nextSteps: ["Remove badly infected leaves", "Use clean seed next season"] }],
  tobacco: [{ category: "disease", label: "Frogeye leaf spot (possible)", severity: "medium", explanation: "Round spots with pale centres are typical of frogeye leaf spot.", nextSteps: ["Prime lower leaves early", "Improve air flow between plants"] }],
  groundnut: [{ category: "disease", label: "Early leaf spot (possible)", severity: "medium", explanation: "Brown circular spots with a yellow halo indicate early leaf spot.", nextSteps: ["Inspect lower canopy", "Plan harvest timing; avoid delays if mature"] }],
};

/** Demo implementation. Deterministic per image so retries are consistent unless the photo changes. */
export const mockClassifier: CropClassifier = {
  async classify(image, crop) {
    await new Promise((r) => setTimeout(r, 1400));
    const seed = (image.size + image.name.length) % 997;
    const options = RESULTS[crop];
    const healthy = seed % 5 === 0;
    const confidence = 0.48 + ((seed * 37) % 47) / 100;
    if (healthy)
      return { simulated: true, category: "healthy", label: "No visible problem", severity: "none", confidence, explanation: "No clear symptoms were detected in this photo.", nextSteps: ["Continue routine monitoring", "Take another photo if symptoms appear"] };
    return { simulated: true, confidence, ...options[seed % options.length] };
  },
};

export const classifier: CropClassifier = mockClassifier;
