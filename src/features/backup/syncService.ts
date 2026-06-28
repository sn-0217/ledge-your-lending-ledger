import { useEffect, useState } from "react";
import { GoogleDriveSyncProvider, type SyncProvider } from "./syncProvider";

export type SyncStatus = "idle" | "syncing" | "synced" | "error" | "unauthorized";

let activeProvider: SyncProvider = new GoogleDriveSyncProvider();
let currentStatus: SyncStatus = "idle";
let errorMessage: string = "";
const listeners = new Set<(status: SyncStatus, error?: string) => void>();

const AUTO_SYNC_KEY = "ledge:auto-sync";
const LAST_SYNC_KEY = "ledge:last-sync";

export function getActiveProvider(): SyncProvider {
  return activeProvider;
}

export function setActiveProvider(provider: SyncProvider) {
  activeProvider = provider;
}

export function getSyncStatus(): SyncStatus {
  return currentStatus;
}

export function getSyncError(): string {
  return errorMessage;
}

export function getAutoSyncEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(AUTO_SYNC_KEY) === "true";
}

export function setAutoSyncEnabled(enabled: boolean) {
  if (typeof window === "undefined") return;
  localStorage.setItem(AUTO_SYNC_KEY, String(enabled));
  window.dispatchEvent(new CustomEvent("ledge:autosync_change"));
}

export function getLastSyncTime(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(LAST_SYNC_KEY) || "";
}

export function setLastSyncTime(timeISO: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(LAST_SYNC_KEY, timeISO);
  window.dispatchEvent(new CustomEvent("ledge:lastsync_change"));
}

export function setSyncStatus(status: SyncStatus, error: string = "") {
  currentStatus = status;
  errorMessage = error;
  listeners.forEach((l) => l(status, error));
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("ledge:sync_status", { detail: { status, error } }));
  }
}

export function subscribeToSyncStatus(listener: (status: SyncStatus, error?: string) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useSyncStatus() {
  const [status, setStatus] = useState<SyncStatus>(getSyncStatus);
  const [error, setError] = useState<string>(getSyncError);
  const [lastSync, setLastSync] = useState<string>(getLastSyncTime);
  const [autoSync, setAutoSync] = useState<boolean>(getAutoSyncEnabled);

  useEffect(() => {
    const unsub = subscribeToSyncStatus((newStatus, newError) => {
      setStatus(newStatus);
      setError(newError || "");
    });

    const handleSyncChange = () => {
      setLastSync(getLastSyncTime());
      setAutoSync(getAutoSyncEnabled());
    };

    window.addEventListener("ledge:lastsync_change", handleSyncChange);
    window.addEventListener("ledge:autosync_change", handleSyncChange);

    return () => {
      unsub();
      window.removeEventListener("ledge:lastsync_change", handleSyncChange);
      window.removeEventListener("ledge:autosync_change", handleSyncChange);
    };
  }, []);

  return { status, error, lastSync, autoSync };
}

// Debounce timer for auto-sync on change
let changeSyncTimeout: number | null = null;

export async function triggerBackup(dbData: any, isAuto: boolean = false) {
  if (!activeProvider.isConfigured()) return;
  
  if (isAuto && !getAutoSyncEnabled()) return;

  setSyncStatus("syncing");
  try {
    const info = await activeProvider.backup(dbData);
    const timeISO = info.modifiedTime ?? new Date().toISOString();
    setLastSyncTime(timeISO);
    setSyncStatus("synced");
    // Clear back to idle after a few seconds
    setTimeout(() => {
      if (getSyncStatus() === "synced") setSyncStatus("idle");
    }, 2500);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Sync failed";
    console.error("Backup failed:", err);
    if (msg.includes("401") || msg.includes("unauthorized") || msg.includes("authorization")) {
      setSyncStatus("unauthorized", msg);
    } else {
      setSyncStatus("error", msg);
    }
    throw err;
  }
}

export async function triggerRestore(): Promise<any> {
  setSyncStatus("syncing");
  try {
    const data = await activeProvider.restore();
    setLastSyncTime(new Date().toISOString());
    setSyncStatus("synced");
    setTimeout(() => {
      if (getSyncStatus() === "synced") setSyncStatus("idle");
    }, 2500);
    return data;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Restore failed";
    console.error("Restore failed:", err);
    if (msg.includes("401") || msg.includes("unauthorized")) {
      setSyncStatus("unauthorized", msg);
    } else {
      setSyncStatus("error", msg);
    }
    throw err;
  }
}

export function handleDataChanged(dbDataFn: () => Promise<any>) {
  if (!getAutoSyncEnabled() || !activeProvider.isConfigured()) return;

  if (changeSyncTimeout) {
    window.clearTimeout(changeSyncTimeout);
  }

  // Debounce background auto-sync by 3 seconds
  changeSyncTimeout = window.setTimeout(async () => {
    try {
      const data = await dbDataFn();
      await triggerBackup(data, true);
    } catch (e) {
      console.warn("Auto sync on change failed:", e);
    }
  }, 3000);
}

// Global listener for OAuth token invalidation
if (typeof window !== "undefined") {
  window.addEventListener("ledge:sync_unauthorized", () => {
    setSyncStatus("unauthorized", "Session expired. Please sign in again.");
  });
}
