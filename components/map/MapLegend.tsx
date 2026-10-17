import { LAMP_HEX } from "@/lib/domain/colors";

const ITEMS = [
  { label: "Urgent", fill: LAMP_HEX.RED },
  { label: "Disease", fill: LAMP_HEX.PURPLE },
  { label: "Needs (fertilizers & water)", fill: LAMP_HEX.BLUE },
  { label: "Maturity", fill: LAMP_HEX.AMBER },
  { label: "OK", fill: LAMP_HEX.GREEN },
  {
    label: "Multiple issues",
    fill: `repeating-linear-gradient(45deg, ${LAMP_HEX.PURPLE} 0 5px, ${LAMP_HEX.BLUE} 5px 10px)`,
  },
];

export function MapLegend() {
  return (
    <div className="pointer-events-none absolute bottom-3 left-3 z-[1000] rounded-xl bg-white/95 px-3 py-2 shadow-md">
      <p className="mb-1 text-[11px] font-semibold tracking-wider text-muted uppercase">Legend</p>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-ink">
        {ITEMS.map((item) => (
          <li key={item.label} className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-sm ring-1 ring-ink/20" style={{ background: item.fill }} />
            {item.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
