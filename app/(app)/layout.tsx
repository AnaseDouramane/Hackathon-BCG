import { Sprout } from "lucide-react";
import Link from "next/link";
import { ProfileMenu, SettingsMenu } from "@/components/shell/HeaderMenus";
import { LocalConditions } from "@/components/shell/LocalConditions";
import { Sidebar } from "@/components/shell/Sidebar";

function TopBar() {
  return (
    <header className="z-[1100] shrink-0 border-b border-line bg-white">
      <div className="flex h-14 items-center justify-between gap-4 px-4">
        <Link href="/" className="flex min-h-11 items-center gap-2">
          <Sprout className="text-ok" size={24} aria-hidden />
          <span className="font-bold tracking-wide text-ink">Felix Field</span>
        </Link>
        <div className="flex items-center gap-4">
          <LocalConditions />
          <div className="flex items-center gap-1">
            <SettingsMenu />
            <ProfileMenu />
          </div>
        </div>
      </div>
    </header>
  );
}

// Shell: fixed top bar, and a content area that is the only thing that scrolls.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-dvh flex-col">
      <TopBar />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        {/* `relative` keeps absolutely positioned children (sr-only text) inside this scroller instead of
            letting them stretch the document and add a second scrollbar. */}
        <div className="relative min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto min-h-full w-full max-w-[1400px] px-4 py-4">{children}</div>
        </div>
      </div>
    </div>
  );
}
