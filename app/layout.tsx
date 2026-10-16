import { CloudRain, Sprout, Thermometer } from "lucide-react";
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { formatLongDate, formatTime } from "@/lib/domain/format";
import { getHeaderInfo } from "@/lib/services/fields";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Felix Field", template: "%s · Felix Field" },
  description: "Field monitoring for agricultural extension officers in Kasungu, Malawi (demo data).",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

async function Header() {
  const info = await getHeaderInfo();
  const now = new Date(info.now);
  return (
    <header className="sticky top-0 z-[1100] border-b border-line bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between gap-4 px-4">
        <Link href="/" className="flex min-h-11 items-center gap-2">
          <Sprout className="text-ok" size={22} aria-hidden />
          <span className="font-bold tracking-wide text-ink">FELIX FIELD</span>
          <span className="hidden text-muted sm:inline">· Kasungu District</span>
        </Link>
        <div className="flex items-center gap-4 text-sm text-muted">
          <span>
            {formatLongDate(now)} · {formatTime(now)}
          </span>
          {info.tempMaxC !== null && (
            <span className="flex items-center gap-1">
              <Thermometer size={16} aria-hidden /> {info.tempMaxC}°C
            </span>
          )}
          {info.rainMm !== null && (
            <span className="flex items-center gap-1">
              <CloudRain size={16} aria-hidden /> {info.rainMm} mm
            </span>
          )}
        </div>
      </div>
    </header>
  );
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <Header />
        <div className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-4">{children}</div>
        <footer className="px-4 pb-4 text-center text-xs text-muted">
          Demo with fictional data · Advice is simplified and must be validated by an agronomist
        </footer>
      </body>
    </html>
  );
}
