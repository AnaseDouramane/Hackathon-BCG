"use client";

import { LogOut, Mail, Presentation, Settings } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Menu } from "@/components/shell/Menu";

const PHOTO = "/felix.png";

function Avatar() {
  const [broken, setBroken] = useState(false);
  // The server-rendered <img> can fail before React attaches onError, so also check after mount.
  const check = (img: HTMLImageElement | null) => {
    if (img?.complete && img.naturalWidth === 0) setBroken(true);
  };
  if (broken)
    return (
      <span className="grid h-9 w-9 place-items-center rounded-full bg-ok text-sm font-bold text-white" aria-hidden>
        FF
      </span>
    );
  // Plain <img>: the photo is optional and falls back to initials when the file is missing.
  // eslint-disable-next-line @next/next/no-img-element
  return <img ref={check} src={PHOTO} alt="" onError={() => setBroken(true)} className="h-9 w-9 rounded-full object-cover" />;
}

export function SettingsMenu() {
  return (
    <Menu label="Settings" trigger={<Settings size={20} aria-hidden />}>
      <Link
        href="/settings/recipients"
        role="menuitem"
        className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left text-sm font-semibold text-ink hover:bg-line/50"
      >
        <Mail size={16} aria-hidden /> Alert recipients
      </Link>
      <Link
        href="/settings/presentation"
        role="menuitem"
        className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left text-sm font-semibold text-ink hover:bg-line/50"
      >
        <Presentation size={16} aria-hidden /> Presentation
      </Link>
    </Menu>
  );
}

export function ProfileMenu() {
  return (
    <Menu label="Profile menu" trigger={<Avatar />}>
      <p className="px-3 py-2 text-sm font-semibold text-ink">Felix Field</p>
      <form action="/api/auth/logout" method="post">
        <button
          type="submit"
          role="menuitem"
          className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left text-sm font-semibold text-ink hover:bg-line/50"
        >
          <LogOut size={16} aria-hidden /> Sign out
        </button>
      </form>
    </Menu>
  );
}
