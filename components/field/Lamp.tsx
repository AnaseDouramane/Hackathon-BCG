"use client";

import { useEffect, useState } from "react";
import type { LampColor } from "@/lib/contract/schemas";
import { LAMP_COLOR_LABEL, LAMP_HEX } from "@/lib/domain/colors";

const CYCLE_MS = 1500;

const CAPTION: Record<LampColor, string> = {
  RED: "urgent action needed",
  PURPLE: "disease risk",
  BLUE: "fertilizer needed",
  AMBER: "harvest / maturity",
  GREEN: "no action needed",
};

/** Simula il lampione fisico nel campo (spec §6.3, §8.3). */
export function Lamp({ colors }: { colors: LampColor[] }) {
  const [index, setIndex] = useState(0);
  const alternating = colors.length > 1;

  useEffect(() => {
    if (!alternating) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % colors.length), CYCLE_MS);
    return () => clearInterval(timer);
  }, [alternating, colors.length]);

  const current = colors[alternating ? index % colors.length : 0];
  const hex = LAMP_HEX[current];
  const caption = alternating
    ? `Alternating ${colors.map((c) => LAMP_COLOR_LABEL[c].toLowerCase()).join(" / ")} — several issues`
    : `${LAMP_COLOR_LABEL[current]} — ${CAPTION[current]}`;

  return (
    <figure className="flex items-center gap-4" aria-label={`Field lamp: ${caption}`}>
      <div className="relative h-20 w-9 shrink-0" aria-hidden>
        <span className="absolute top-6 left-1/2 h-12 w-1 -translate-x-1/2 rounded bg-muted" />
        <span className="absolute bottom-0 left-1/2 h-1.5 w-5 -translate-x-1/2 rounded bg-muted" />
        <span
          className={`lamp-glow absolute top-0 left-1/2 h-8 w-8 -translate-x-1/2 rounded-full ring-2 ring-white ${
            current === "RED" ? "lamp-pulse" : ""
          }`}
          style={{ backgroundColor: hex, boxShadow: `0 0 18px 4px ${hex}99`, ["--glow" as string]: `${hex}aa` }}
        />
      </div>
      <figcaption className="max-w-44 text-sm leading-tight text-ink">
        <span className="block text-[11px] font-semibold tracking-wider text-muted uppercase">Field lamp</span>
        {caption}
      </figcaption>
    </figure>
  );
}
