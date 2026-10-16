import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Camera, LayoutDashboard, Leaf, ListFilter } from "lucide-react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-6xl font-bold">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Page not found</h2>
        <p className="mt-2 text-muted-foreground">This page or field doesn't exist.</p>
        <Link to="/" className="mt-6 inline-flex min-h-12 items-center rounded-lg bg-primary px-5 font-semibold text-primary-foreground">
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">This page didn't load</h1>
        <p className="mt-2 text-muted-foreground">Something went wrong. Try again or go back to the dashboard.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button onClick={() => { router.invalidate(); reset(); }} className="min-h-12 rounded-lg bg-primary px-5 font-semibold text-primary-foreground">Try again</button>
          <a href="/" className="inline-flex min-h-12 items-center rounded-lg border bg-card px-5 font-semibold">Dashboard</a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Felix Field – Extension officer decision support" },
      { name: "description", content: "Field priorities, crop diagnosis and agronomic advice for extension officers in Kasungu, Malawi." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Archivo:wght@600;700;800&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head><HeadContent /></head>
      <body>{children}<Scripts /></body>
    </html>
  );
}

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/issues/$category", params: { category: "urgent" }, label: "Field lists", icon: ListFilter },
  { to: "/diagnose", label: "Diagnose Crop", icon: Camera },
] as const;

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <header className="sticky top-0 z-[1000] border-b bg-card">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2">
          <Link to="/" className="flex shrink-0 items-center gap-2">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-primary text-primary-foreground"><Leaf className="h-6 w-6" /></span>
            <span className="hidden font-display text-xl font-extrabold sm:inline">Felix Field</span>
          </Link>
          <nav className="ml-auto flex gap-1">
            {nav.map((n) => (
              <Link
                key={n.label}
                to={n.to}
                params={"params" in n ? n.params : undefined}
                activeOptions={{ exact: n.to === "/" }}
                className="flex min-h-12 items-center gap-2 rounded-lg px-3 font-semibold text-muted-foreground hover:bg-accent data-[status=active]:bg-secondary data-[status=active]:text-secondary-foreground"
              >
                <n.icon className="h-5 w-5" aria-hidden />
                <span className="hidden md:inline">{n.label}</span>
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-5">
        <Outlet />
      </main>
    </QueryClientProvider>
  );
}
