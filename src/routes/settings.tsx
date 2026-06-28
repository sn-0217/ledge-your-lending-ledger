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
  Cloud,
  RefreshCw,
  AlertCircle,
  FileSpreadsheet,
  CheckCircle,
  Smartphone,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  exportToJSON,
  exportToCSV,
  exportToExcel,
  importBackupPayload,
  getDatabaseBackupPayload,
} from "@/features/backup/backupService";
import {
  useSyncStatus,
  triggerBackup,
  triggerRestore,
  setAutoSyncEnabled,
  getActiveProvider,
} from "@/features/backup/syncService";
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
  await db.transaction("rw", db.people, db.categories, db.transactions, db.chittis, db.chittiPayments, async () => {
    await db.transactions.clear();
    await db.categories.clear();
    await db.people.clear();
    await db.chittiPayments.clear();
    await db.chittis.clear();
  });
}

function Settings() {
  const queryClient = useQueryClient();
  const { status, error, lastSync, autoSync } = useSyncStatus();
  const [busy, setBusy] = useState<"backup" | "restore" | "check" | null>(null);
  const [message, setMessage] = useState("");
  const [lastBackupTime, setLastBackupTime] = useState<string>("");
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);

  const provider = getActiveProvider();
  const isCloudConfigured = provider.isConfigured();

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

  const handleToggleAutoSync = async () => {
    if (autoSync) {
      setAutoSyncEnabled(false);
      setMessage("Auto-sync disabled.");
    } else {
      setBusy("backup");
      setMessage("Authorizing Google Drive...");
      try {
        await provider.requestToken({ forcePrompt: true });
        setAutoSyncEnabled(true);
        
        // Initial auto backup
        const dbData = await getDatabaseBackupPayload();
        await triggerBackup(dbData);
        
        // Fetch fresh backup info
        const info = await provider.getBackupInfo();
        if (info?.modifiedTime) {
          setLastBackupTime(info.modifiedTime);
        }
        setMessage("Auto-sync activated successfully.");
        toast.success("Auto-sync enabled");
      } catch (err) {
        console.error("Failed to enable auto-sync:", err);
        setAutoSyncEnabled(false);
        setMessage(err instanceof Error ? err.message : "Authorization failed.");
        toast.error("Auto-sync authorization failed");
      } finally {
        setBusy(null);
      }
    }
  };

  const runCloudAction = async (action: "backup" | "restore" | "check") => {
    setBusy(action);
    setMessage(
      action === "backup"
        ? "Opening Google sign-in..."
        : action === "restore"
          ? "Opening Google sign-in..."
          : "Checking Google Drive..."
    );

    try {
      if (action === "backup") {
        const dbData = await getDatabaseBackupPayload();
        await triggerBackup(dbData);
        // fetch info
        const info = await provider.getBackupInfo();
        if (info?.modifiedTime) setLastBackupTime(info.modifiedTime);
        setMessage(`Backup complete. Synced to Google Drive.`);
        toast.success("Cloud backup successful");
      } else if (action === "restore") {
        if (!confirm("Restore backup from Google Drive? This will overwrite your local database.")) {
          return;
        }
        const cloudData = await triggerRestore();
        await importBackupPayload(cloudData);
        // Invalidate queries to reload all routes
        queryClient.invalidateQueries();
        setMessage("Restore complete. Database updated successfully.");
        toast.success("Database restored successfully");
      } else {
        const info = await provider.getBackupInfo();
        if (info?.modifiedTime) {
          setLastBackupTime(info.modifiedTime);
          setMessage(`Backup verified · ${new Date(info.modifiedTime).toLocaleString()}`);
          toast.success("Backup verified");
        } else {
          setLastBackupTime("");
          setMessage("No Google Drive backup file found yet.");
          toast.warning("No backup found on Drive");
        }
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Sync action failed.");
      toast.error(err instanceof Error ? err.message : "Sync operation failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-5">
      <header className="pt-2">
        <h1 className="text-2xl font-bold">Settings</h1>
      </header>

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
                        <strong>Brave &amp; Chrome:</strong> Tap the browser's menu button (three vertical dots <span className="font-semibold">⋮</span>) and select <span className="font-semibold text-foreground">"Install app"</span> or <span className="font-semibold text-foreground">"Add to Home screen"</span>.
                      </li>
                      <li>
                        <strong>Safari (iOS):</strong> Tap the share icon (<span className="font-semibold">⎙</span>) and select <span className="font-semibold text-foreground">"Add to Home Screen"</span>.
                      </li>
                      <li>
                        <strong>Firefox &amp; Others:</strong> Tap the options menu and select <span className="font-semibold text-foreground">"Install"</span> or <span className="font-semibold text-foreground">"Add to Home screen"</span>.
                      </li>
                    </ul>
                  </div>
                )}
              </div>
            </div>
            {installPrompt ? (
              <Button size="sm" onClick={handleInstallApp} className="rounded-full px-3 text-xs shrink-0 ml-4 mt-0.5">
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

      {/* Cloud Sync Section */}
      <GlassCard className="space-y-3.5 p-4">
        <div className="flex items-center justify-between pb-0.5">
          <div className="flex items-center gap-2">
            <Cloud className="h-5 w-5 text-primary" />
            <span className="text-sm font-semibold">Google Drive Sync</span>
          </div>
          <span
            className={cn(
              "text-[10px] px-2 py-0.5 rounded-full font-semibold border",
              isCloudConfigured
                ? "bg-[oklch(0.85_0.18_155/0.1)] text-[oklch(0.85_0.18_155)] border-[oklch(0.85_0.18_155/0.15)]"
                : "bg-orange-500/10 text-orange-400 border-orange-500/15"
            )}
          >
            {isCloudConfigured ? "Configured" : "Unconfigured"}
          </span>
        </div>

        {!isCloudConfigured ? (
          <div className="rounded-2xl border border-dashed border-orange-500/30 bg-orange-500/5 p-3 text-xs text-orange-400 leading-relaxed">
            <div className="font-semibold flex items-center gap-1 mb-0.5">
              <AlertCircle className="h-3.5 w-3.5" /> Client ID Missing
            </div>
            To enable Google Drive Sync, add <span className="font-mono">VITE_GOOGLE_CLIENT_ID</span> to your `.env` configuration file first.
          </div>
        ) : (
          <div className="space-y-3">
            {/* Auto Sync Toggle */}
            <div className="flex items-center justify-between py-1.5 border-b border-white/5">
              <div className="space-y-0.5">
                <div className="text-xs font-semibold">Auto-sync changes</div>
                <p className="text-[10px] text-muted-foreground">Automatically backup after data updates</p>
              </div>
              <button
                disabled={busy !== null}
                onClick={handleToggleAutoSync}
                className={cn(
                  "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out outline-none",
                  autoSync ? "bg-primary" : "bg-white/10"
                )}
              >
                <span
                  className={cn(
                    "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                    autoSync ? "translate-x-5" : "translate-x-0"
                  )}
                />
              </button>
            </div>

            {/* Sync Actions Rows */}
            <div className="space-y-3 text-xs">
              {/* Manual Backup */}
              <div className="flex items-center justify-between py-1">
                <div>
                  <div className="font-semibold">Cloud Backup</div>
                  <p className="text-[10px] text-muted-foreground">
                    {lastBackupTime || lastSync
                      ? `Last synced: ${new Date(lastBackupTime || lastSync).toLocaleString()}`
                      : "No backups found"}
                  </p>
                </div>
                <Button
                  disabled={busy !== null}
                  size="sm"
                  variant="outline"
                  onClick={() => runCloudAction("backup")}
                  className="h-8 rounded-full gap-1.5 px-3"
                >
                  {busy === "backup" ? (
                    <RefreshCw className="h-3 w-3 animate-spin" />
                  ) : (
                    <Upload className="h-3 w-3" />
                  )}
                  {busy === "backup" ? "Syncing..." : "Backup now"}
                </Button>
              </div>

              {/* Manual Restore */}
              <div className="flex items-center justify-between py-1">
                <div>
                  <div className="font-semibold">Cloud Restore</div>
                  <p className="text-[10px] text-muted-foreground">Download latest cloud backup to local db</p>
                </div>
                <Button
                  disabled={busy !== null}
                  size="sm"
                  variant="outline"
                  onClick={() => runCloudAction("restore")}
                  className="h-8 rounded-full gap-1.5 px-3"
                >
                  {busy === "restore" ? (
                    <RefreshCw className="h-3 w-3 animate-spin" />
                  ) : (
                    <Download className="h-3 w-3" />
                  )}
                  {busy === "restore" ? "Restoring..." : "Restore"}
                </Button>
              </div>

              {/* Verify backup */}
              <div className="flex items-center justify-between py-1">
                <div>
                  <div className="font-semibold">Verify backup</div>
                  <p className="text-[10px] text-muted-foreground">Confirm current status in Google Drive</p>
                </div>
                <Button
                  disabled={busy !== null}
                  size="sm"
                  variant="outline"
                  onClick={() => runCloudAction("check")}
                  className="h-8 rounded-full gap-1.5 px-3 text-muted-foreground"
                >
                  {busy === "check" ? (
                    <RefreshCw className="h-3 w-3 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3 w-3" />
                  )}
                  Check
                </Button>
              </div>
            </div>

            {message && (
              <div className="text-[10px] bg-white/5 border border-white/5 px-2.5 py-2 rounded-xl text-muted-foreground flex items-start gap-1.5 leading-relaxed">
                <Info className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                <span>{message}</span>
              </div>
            )}
            
            {status !== "idle" && (
              <div className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground">
                <span className="relative flex h-2 w-2">
                  <span className={cn(
                    "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
                    status === "syncing" && "bg-primary",
                    status === "synced" && "bg-green-500",
                    (status === "error" || status === "unauthorized") && "bg-destructive"
                  )} />
                  <span className={cn(
                    "relative inline-flex rounded-full h-2 w-2",
                    status === "syncing" && "bg-primary",
                    status === "synced" && "bg-green-500",
                    (status === "error" || status === "unauthorized") && "bg-destructive"
                  )} />
                </span>
                <span className="capitalize">Status: {status === "unauthorized" ? "unauthorized session" : status}</span>
              </div>
            )}
          </div>
        )}
      </GlassCard>

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
            className="rounded-full text-xs py-1 px-2 h-9 text-[oklch(0.85_0.18_155)] border-[oklch(0.85_0.18_155/0.2)] hover:bg-[oklch(0.85_0.18_155/0.05)]"
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
          <AlertDialogContent className="glass-strong border-white/10 text-foreground">
            <AlertDialogHeader>
              <AlertDialogTitle>Clear all data?</AlertDialogTitle>
              <AlertDialogDescription className="text-muted-foreground">
                This will permanently delete every person, category, transaction, and chitti record.
                This cannot be undone. Export a backup first to save a local copy.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="rounded-full border-white/10 text-foreground hover:bg-white/5">Cancel</AlertDialogCancel>
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
          <div className="pt-1">Offline-first · Cloud backup integration · Private</div>
        </div>
      </GlassCard>
    </div>
  );
}
