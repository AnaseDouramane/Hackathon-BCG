import type { LampColor } from "@/lib/contract/schemas";
import { LAMP_COLOR_LABEL, LAMP_HEX } from "@/lib/domain/colors";

/** Lampione in miniatura (statico): un colore pieno o spicchi per più problemi. */
export function LampDot({ colors, size = 16 }: { colors: LampColor[]; size?: number }) {
  const background =
    colors.length === 1
      ? LAMP_HEX[colors[0]]
      : `conic-gradient(${colors
          .map((c, i) => `${LAMP_HEX[c]} ${(i / colors.length) * 360}deg ${((i + 1) / colors.length) * 360}deg`)
          .join(", ")})`;
  return (
    <span
      className="inline-block shrink-0 rounded-full ring-2 ring-white shadow"
      style={{ width: size, height: size, background }}
      role="img"
      aria-label={`Lamp: ${colors.map((c) => LAMP_COLOR_LABEL[c]).join(" / ")}`}
    />
  );
}
