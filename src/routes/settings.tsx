import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { GlassCard } from "@/components/common/GlassCard";
import { ClientOnly } from "@/components/common/ClientOnly";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Download,
  Upload,
  Trash2,
  Info,
  FileSpreadsheet,
  CheckCircle,
  Smartphone,
  Palette,
  Sun,
  Moon,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSettings, type AccentTheme } from "@/stores/settings";
import {
  exportToJSON,
  exportToCSV,
  exportToExcel,
  importBackupPayload,
} from "@/features/backup/backupService";
import { getDb } from "@/lib/db";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { CloudAccountCard } from "@/components/common/CloudAccountCard";
import { queueCloudDelete } from "@/features/sync/cloudSync";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings — Ledge" }] }),
  component: () => (
    <AppShell>
      <ClientOnly>
        <Settings />
      </ClientOnly>
    </AppShell>
  ),
});

async function clearAllData() {
  const db = getDb();
  const [people, categories, transactions, chittis, payments, repaymentPlans] = await Promise.all([
    db.people.toArray(),
    db.categories.toArray(),
    db.transactions.toArray(),
    db.chittis.toArray(),
    db.chittiPayments.toArray(),
    db.repaymentPlans.toArray(),
  ]);
  await db.transaction(
    "rw",
    [db.people, db.categories, db.transactions, db.chittis, db.chittiPayments, db.repaymentPlans],
    async () => {
      await db.transactions.clear();
      await db.categories.clear();
      await db.people.clear();
      await db.chittiPayments.clear();
      await db.chittis.clear();
      await db.repaymentPlans.clear();
    },
  );
  await Promise.all([
    ...people.map((row) => queueCloudDelete("people", row.id)),
    ...categories.map((row) => queueCloudDelete("categories", row.id)),
    ...transactions.map((row) => queueCloudDelete("transactions", row.id)),
    ...chittis.map((row) => queueCloudDelete("chittis", row.id)),
    ...payments.map((row) => queueCloudDelete("chittiPayments", row.id)),
    ...repaymentPlans.map((row) => queueCloudDelete("repaymentPlans", row.id)),
  ]);
}

function Settings() {
  const queryClient = useQueryClient();
  const { theme, setTheme, accentTheme, setAccentTheme } = useSettings();
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);

  // Detect standalone mode
  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsStandalone(window.matchMedia("(display-mode: standalone)").matches);
    }
  }, []);

  // Listen to PWA install availability
  useEffect(() => {
    const handlePrompt = () => {
      setInstallPrompt((window as any).deferredInstallPrompt);
    };
    window.addEventListener("ledge:install_available", handlePrompt);
    // Initial check
    if ((window as any).deferredInstallPrompt) {
      setInstallPrompt((window as any).deferredInstallPrompt);
    }
    return () => window.removeEventListener("ledge:install_available", handlePrompt);
  }, []);

  const handleInstallApp = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") {
      console.log("PWA install accepted");
    }
    (window as any).deferredInstallPrompt = null;
    setInstallPrompt(null);
  };

  return (
    <div className="space-y-5">
      <header className="pt-2">
        <h1 className="text-2xl font-bold">Settings</h1>
      </header>

      <CloudAccountCard />

      {/* Appearance Customizer */}
      <GlassCard className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Palette className="h-5 w-5 text-primary" />
          <span className="text-sm font-semibold">Appearance</span>
        </div>

        {/* Theme Mode Selector (Dark / Light) */}
        <div className="flex items-center justify-between border-b border-border/50 pb-3">
          <div className="space-y-0.5">
            <div className="text-xs font-semibold">Theme Mode</div>
            <p className="text-[10px] text-muted-foreground">Select dark or light style</p>
          </div>
          <div className="flex bg-secondary/60 rounded-full p-1 border border-border">
            <button
              onClick={() => setTheme("dark")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-all",
                theme === "dark"
                  ? "bg-primary text-primary-foreground shadow"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Moon className="h-3.5 w-3.5" />
              <span>Dark</span>
            </button>
            <button
              onClick={() => setTheme("light")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-all",
                theme === "light"
                  ? "bg-primary text-primary-foreground shadow"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Sun className="h-3.5 w-3.5" />
              <span>Light</span>
            </button>
          </div>
        </div>

        {/* Accent Color Theme Selector */}
        <div className="space-y-2">
          <div className="space-y-0.5">
            <div className="text-xs font-semibold">Accent Color</div>
            <p className="text-[10px] text-muted-foreground">
              Customize primary colors across the app
            </p>
          </div>

          <div className="flex items-center gap-3 pt-1">
            {[
              {
                id: "mint",
                label: "Mint",
                color: "bg-[oklch(0.78_0.17_155)] border-[oklch(0.78_0.17_155/0.2)]",
              },
              {
                id: "purple",
                label: "Lavender",
                color: "bg-[oklch(0.72_0.18_280)] border-[oklch(0.72_0.18_280/0.2)]",
              },
              {
                id: "blue",
                label: "Ocean",
                color: "bg-[oklch(0.65_0.18_240)] border-[oklch(0.65_0.18_240/0.2)]",
              },
              {
                id: "rose",
                label: "Rose",
                color: "bg-[oklch(0.68_0.22_340)] border-[oklch(0.68_0.22_340/0.2)]",
              },
              {
                id: "amber",
                label: "Amber",
                color: "bg-[oklch(0.82_0.16_75)] border-[oklch(0.82_0.16_75/0.2)]",
              },
            ].map((acc) => {
              const isActive = accentTheme === acc.id;
              return (
                <button
                  key={acc.id}
                  onClick={() => setAccentTheme(acc.id as AccentTheme)}
                  className="flex flex-col items-center gap-1.5 group cursor-pointer focus:outline-none"
                  aria-label={`Select ${acc.label} theme`}
                >
                  <div
                    className={cn(
                      "relative h-8 w-8 rounded-full border flex items-center justify-center transition-all scale-95 group-hover:scale-100",
                      isActive
                        ? "scale-100 ring-2 ring-primary ring-offset-2 ring-offset-background"
                        : "",
                      acc.color,
                    )}
                  >
                    {isActive && (
                      <CheckCircle className="h-4 w-4 text-primary-foreground drop-shadow-sm font-bold" />
                    )}
                  </div>
                  <span
                    className={cn(
                      "text-[9px] font-semibold transition-colors",
                      isActive ? "text-primary" : "text-muted-foreground",
                    )}
                  >
                    {acc.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </GlassCard>

      {/* PWA Install Promo */}
      {!isStandalone && (
        <GlassCard className="p-4 border-primary/20 bg-primary/5 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-start justify-between">
            <div className="flex-1 flex gap-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary mt-0.5">
                <Smartphone className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <div className="text-sm font-semibold text-foreground">Install Ledge App</div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Add Ledge to your home screen for quick, offline access.
                </p>
                {showInstructions && (
                  <div className="mt-2.5 space-y-1.5 border-t border-primary/10 pt-2 text-[10px] text-muted-foreground leading-relaxed animate-in fade-in slide-in-from-top-1">
                    <p className="font-semibold text-primary/80">Follow these steps to install:</p>
                    <ul className="list-disc pl-3.5 space-y-1">
                      <li>
                        <strong>Brave &amp; Chrome:</strong> Tap the browser's menu button (three
                        vertical dots <span className="font-semibold">⋮</span>) and select{" "}
                        <span className="font-semibold text-foreground">"Install app"</span> or{" "}
                        <span className="font-semibold text-foreground">"Add to Home screen"</span>.
                      </li>
                      <li>
                        <strong>Safari (iOS):</strong> Tap the share icon (
                        <span className="font-semibold">⎙</span>) and select{" "}
                        <span className="font-semibold text-foreground">"Add to Home Screen"</span>.
                      </li>
                      <li>
                        <strong>Firefox &amp; Others:</strong> Tap the options menu and select{" "}
                        <span className="font-semibold text-foreground">"Install"</span> or{" "}
                        <span className="font-semibold text-foreground">"Add to Home screen"</span>.
                      </li>
                    </ul>
                  </div>
                )}
              </div>
            </div>
            {installPrompt ? (
              <Button
                size="sm"
                onClick={handleInstallApp}
                className="rounded-full px-3 text-xs shrink-0 ml-4 mt-0.5"
              >
                Install
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowInstructions(!showInstructions)}
                className="rounded-full px-3 text-xs shrink-0 ml-4 mt-0.5 border-primary/20 hover:bg-primary/10"
              >
                {showInstructions ? "Hide" : "How to Install"}
              </Button>
            )}
          </div>
        </GlassCard>
      )}

      {/* Local Backup & Restore */}
      <GlassCard className="space-y-3 p-4">
        <h2 className="text-sm font-semibold text-muted-foreground">Export &amp; Import</h2>
        <p className="text-xs text-muted-foreground">
          Download your data locally or restore a previously saved backup file.
        </p>
        <div className="grid grid-cols-3 gap-2">
          <Button
            variant="outline"
            onClick={async () => {
              try {
                await exportToJSON();
                toast.success("JSON exported");
              } catch (e) {
                toast.error((e as Error).message);
              }
            }}
            className="rounded-full text-xs py-1 px-2 h-9"
          >
            <Download className="h-3.5 w-3.5 mr-1 shrink-0" /> JSON
          </Button>
          <Button
            variant="outline"
            onClick={async () => {
              try {
                await exportToCSV();
                toast.success("CSV exported");
              } catch (e) {
                toast.error((e as Error).message);
              }
            }}
            className="rounded-full text-xs py-1 px-2 h-9"
          >
            <Download className="h-3.5 w-3.5 mr-1 shrink-0" /> CSV
          </Button>
          <Button
            variant="outline"
            onClick={async () => {
              try {
                await exportToExcel();
                toast.success("Excel exported");
              } catch (e) {
                toast.error((e as Error).message);
              }
            }}
            className="rounded-full text-xs py-1 px-2 h-9 text-primary border-primary/20 hover:bg-primary/5"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 mr-1 shrink-0" /> Excel
          </Button>
        </div>

        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-full border border-dashed border-border bg-secondary/30 px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground">
          <Upload className="h-4 w-4" /> Import JSON backup
          <input
            type="file"
            accept="application/json"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              try {
                const text = await file.text();
                const parsed = JSON.parse(text);
                await importBackupPayload(parsed);
                queryClient.invalidateQueries();
                toast.success("Database restored successfully");
              } catch (err) {
                toast.error((err as Error).message);
              } finally {
                e.target.value = "";
              }
            }}
          />
        </label>
      </GlassCard>

      {/* Danger Zone */}
      <GlassCard className="space-y-3 border border-destructive/30 p-4">
        <h2 className="text-sm font-semibold text-destructive">Danger Zone</h2>
        <p className="text-xs text-muted-foreground">
          Permanently deletes all people, categories, transactions, and chitti records.
        </p>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" className="w-full gap-2 rounded-full">
              <Trash2 className="h-4 w-4" /> Clear all data
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="glass-strong border-glass-border text-foreground">
            <AlertDialogHeader>
              <AlertDialogTitle>Clear all data?</AlertDialogTitle>
              <AlertDialogDescription className="text-muted-foreground">
                This will permanently delete every person, category, transaction, and chitti record.
                This cannot be undone. Export a backup first to save a local copy.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="rounded-full border-border text-foreground hover:bg-secondary">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-full"
                onClick={async () => {
                  try {
                    await clearAllData();
                    queryClient.invalidateQueries();
                    toast.success("All data cleared");
                  } catch (e) {
                    toast.error((e as Error).message);
                  }
                }}
              >
                Yes, delete everything
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </GlassCard>

      {/* About */}
      <GlassCard className="flex items-start gap-3 p-4">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
          <Info className="h-4 w-4" />
        </div>
        <div className="space-y-0.5 text-xs text-muted-foreground">
          <div className="font-semibold text-foreground">Ledge</div>
          <div>Personal money &amp; debt manager</div>
          <div className="pt-1">Offline-first · Private</div>
        </div>
      </GlassCard>
    </div>
  );
}
