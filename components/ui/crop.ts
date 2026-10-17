// Icona ed etichetta di ogni coltura (usate dalla sidebar e dalla pagina per coltura).
import { Bean, Flame, Leaf, type LucideIcon, Wheat } from "lucide-react";
import type { StaticImageData } from "next/image";
import beansPhoto from "@/fields_photos/beans.png";
import chiliPhoto from "@/fields_photos/chili.png";
import maizePhoto from "@/fields_photos/maize.png";
import soybeanPhoto from "@/fields_photos/soybean.png";
import type { CropCode } from "@/lib/contract/schemas";

export const CROP_UI: Record<CropCode, { label: string; Icon: LucideIcon }> = {
  MAIZE: { label: "Maize", Icon: Wheat },
  BEANS: { label: "Beans", Icon: Bean },
  SOYBEAN: { label: "Soybean", Icon: Leaf },
  CHILI: { label: "Chili", Icon: Flame },
};

// Foto della coltura (cartella fields_photos/ nella root del progetto), importate staticamente:
// Next le serve con un URL con hash e il build fallisce se un file manca.
export const CROP_PHOTO: Record<CropCode, StaticImageData> = {
  MAIZE: maizePhoto,
  BEANS: beansPhoto,
  SOYBEAN: soybeanPhoto,
  CHILI: chiliPhoto,
};

export const CROP_ORDER: CropCode[] = ["MAIZE", "BEANS", "SOYBEAN", "CHILI"];

export const cropHref = (code: CropCode) => `/crops/${code.toLowerCase()}`;
