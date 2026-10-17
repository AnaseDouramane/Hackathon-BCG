import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <main className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto bg-white px-4">
      <LoginForm />
    </main>
  );
}
