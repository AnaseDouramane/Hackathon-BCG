"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: form.get("username"), password: form.get("password") }),
      });
      if (res.ok) {
        router.replace("/");
        router.refresh();
        return;
      }
      const data = (await res.json().catch(() => null)) as { message?: string } | null;
      setError(data?.message ?? "Wrong username or password.");
    } catch {
      setError("Something went wrong. Try again.");
    }
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="w-full max-w-sm space-y-4">
      <h1 className="text-2xl font-bold text-ink">Felix Field</h1>
      <label className="block text-sm font-semibold text-ink">
        Username
        <input name="username" autoComplete="username" required className="mt-1 min-h-11 w-full rounded-lg border border-line px-3 font-normal" />
      </label>
      <label className="block text-sm font-semibold text-ink">
        Password
        <input name="password" type="password" autoComplete="current-password" required className="mt-1 min-h-11 w-full rounded-lg border border-line px-3 font-normal" />
      </label>
      {error && (
        <p role="alert" className="text-sm font-semibold text-red-600">
          {error}
        </p>
      )}
      <button disabled={busy} className="min-h-11 w-full rounded-lg bg-ink font-semibold text-white disabled:opacity-60">
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
