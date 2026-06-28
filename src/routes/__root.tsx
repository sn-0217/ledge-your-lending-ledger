import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { useSettings } from "@/stores/settings";
import { DataProvider } from "@/features/dataProvider";
import { WifiOff } from "lucide-react";

function NotFoundComponent() {
  return (
    <div className="surface-gradient flex min-h-dvh items-center justify-center px-4">
      <div className="glass max-w-md rounded-3xl p-8 text-center">
        <h1 className="text-6xl font-bold">404</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          That page doesn't exist.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
        >
          Back home
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);
  return (
    <div className="surface-gradient flex min-h-dvh items-center justify-center px-4">
      <div className="glass max-w-md rounded-3xl p-8 text-center">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <div className="mt-6 flex justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
          >
            Try again
          </button>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content:
          "width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1",
      },
      { title: "Ledge — Personal Money & Debt Manager" },
      {
        name: "description",
        content:
          "Track money you lent, borrowed, and repaid. Offline-first, private, beautifully simple.",
      },
      { name: "theme-color", content: "#000000" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { property: "og:title", content: "Ledge" },
      { property: "og:description", content: "Personal money & debt manager." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", href: "/icon.svg", type: "image/svg+xml" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap",
      },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function ThemeApplier() {
  const theme = useSettings((s) => s.theme);
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    root.classList.toggle("light", theme === "light");
  }, [theme]);
  return null;
}

function OfflineIndicator() {
  const [isOffline, setIsOffline] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const checkActualOnline = async () => {
      if (typeof navigator === "undefined") return;

      if (!navigator.onLine) {
        // If navigator says offline, verify with a lightweight connection test
        try {
          const controller = new AbortController();
          const id = setTimeout(() => controller.abort(), 3000);
          
          await fetch("https://clients3.google.com/generate_204", {
            method: "HEAD",
            mode: "no-cors",
            signal: controller.signal,
            cache: "no-store",
          });
          
          clearTimeout(id);
          setIsOffline(false); // Ping succeeded, we are actually online
        } catch {
          setIsOffline(true); // Ping failed, we are truly offline
        }
      } else {
        setIsOffline(false);
      }
    };

    checkActualOnline();

    // Recheck on network change events
    const online = () => {
      setIsOffline(false);
      setDismissed(false);
    };
    const offline = () => {
      checkActualOnline();
      setDismissed(false);
    };

    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    
    // Check periodically every 15 seconds to ensure status is accurate
    const interval = setInterval(checkActualOnline, 15000);

    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
      clearInterval(interval);
    };
  }, []);

  if (!isOffline || dismissed) return null;

  return (
    <div className="fixed bottom-24 left-1/2 z-[100] -translate-x-1/2 flex items-center gap-2 rounded-full bg-destructive/90 px-3.5 py-1.5 text-xs font-medium text-destructive-foreground shadow-lg backdrop-blur-sm animate-in fade-in slide-in-from-bottom duration-200">
      <WifiOff className="h-3.5 w-3.5" />
      <span>Offline Mode</span>
      <button
        onClick={() => setDismissed(true)}
        className="ml-1 flex h-4 w-4 items-center justify-center rounded-full hover:bg-white/10 text-xs font-bold transition-colors cursor-pointer"
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("/sw.js")
          .then((reg) => {
            console.log("SW registered:", reg.scope);
            
            // Check for service worker updates
            reg.addEventListener("updatefound", () => {
              const newWorker = reg.installing;
              if (newWorker) {
                newWorker.addEventListener("statechange", () => {
                  if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                    toast.info("Update available! Reload to update Ledge.", {
                      duration: Infinity,
                      action: {
                        label: "Reload",
                        onClick: () => {
                          newWorker.postMessage({ type: "SKIP_WAITING" });
                          window.location.reload();
                        },
                      },
                    });
                  }
                });
              }
            });
          })
          .catch((err) => console.error("SW registration failed:", err));
      });
    }
  }, []);

  useEffect(() => {
    const handleInstallPrompt = (e: Event) => {
      e.preventDefault();
      (window as any).deferredInstallPrompt = e;
      window.dispatchEvent(new CustomEvent("ledge:install_available"));
    };
    window.addEventListener("beforeinstallprompt", handleInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeApplier />
      <DataProvider>
        <OfflineIndicator />
        <Outlet />
      </DataProvider>
      <Toaster position="top-center" richColors />
    </QueryClientProvider>
  );
}

