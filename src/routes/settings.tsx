import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { GlassCard } from "@/components/common/GlassCard";
import { ClientOnly } from "@/components/common/ClientOnly";
import { Button } from "@/components/ui/button";
import { getDb } from "@/lib/db";
import { toast } from "sonner";
import { Download, Upload, Trash2, Info } from "lucide-react";
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

async function exportJSON() {
  const db = getDb();
  const [people, categories, transactions, chittis, chittiPayments] = await Promise.all([
    db.people.toArray(),
    db.categories.toArray(),
    db.transactions.toArray(),
    db.chittis.toArray(),
    db.chittiPayments.toArray(),
  ]);
  const payload = {
    app: "ledge",
    version: 2,
    exportedAt: new Date().toISOString(),
    people,
    categories,
    transactions,
    chittis,
    chittiPayments,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ledge-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

async function exportCSV() {
  const db = getDb();
  const [people, categories, transactions] = await Promise.all([
    db.people.toArray(),
    db.categories.toArray(),
    db.transactions.toArray(),
  ]);
  const peopleById = new Map(people.map((p) => [p.id, p]));
  const catsById = new Map(categories.map((c) => [c.id, c]));
  const rows = [
    ["date", "person", "category", "type", "amount", "due", "notes"],
    ...transactions.map((t) => [
      new Date(t.date).toISOString().slice(0, 10),
      peopleById.get(t.personId)?.name ?? "",
      catsById.get(t.categoryId)?.name ?? "",
      t.type,
      String(t.amount),
      t.dueDate ? new Date(t.dueDate).toISOString().slice(0, 10) : "",
      (t.notes ?? "").replace(/\n/g, " "),
    ]),
  ];
  const csv = rows
    .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ledge-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

async function importJSON(file: File) {
  const text = await file.text();
  const data = JSON.parse(text);
  if (data.app !== "ledge") throw new Error("Not a Ledge backup file");
  const db = getDb();
  await db.transaction("rw", db.people, db.categories, db.transactions, db.chittis, db.chittiPayments, async () => {
    if (data.people) await db.people.bulkPut(data.people);
    if (data.categories) await db.categories.bulkPut(data.categories);
    if (data.transactions) await db.transactions.bulkPut(data.transactions);
    if (data.chittis) await db.chittis.bulkPut(data.chittis);
    if (data.chittiPayments) await db.chittiPayments.bulkPut(data.chittiPayments);
  });
}

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
  return (
    <div className="space-y-5">
      <header className="pt-2">
        <h1 className="text-2xl font-bold">Settings</h1>
      </header>

      {/* Backup & Restore */}
      <GlassCard className="space-y-3 p-4">
        <h2 className="text-sm font-semibold text-muted-foreground">Backup &amp; Restore</h2>
        <p className="text-xs text-muted-foreground">
          Export your data to keep a local copy, or import a previous backup.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            onClick={async () => {
              try {
                await exportJSON();
                toast.success("JSON exported");
              } catch (e) {
                toast.error((e as Error).message);
              }
            }}
          >
            <Download className="h-4 w-4" /> JSON
          </Button>
          <Button
            variant="outline"
            onClick={async () => {
              try {
                await exportCSV();
                toast.success("CSV exported");
              } catch (e) {
                toast.error((e as Error).message);
              }
            }}
          >
            <Download className="h-4 w-4" /> CSV
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
                await importJSON(file);
                toast.success("Imported successfully");
              } catch (err) {
                toast.error((err as Error).message);
              } finally {
                e.target.value = "";
              }
            }}
          />
        </label>
        <p className="text-[11px] text-muted-foreground">
          All data is stored locally on your device. Export regularly to avoid data loss.
        </p>
      </GlassCard>

      {/* Danger Zone */}
      <GlassCard className="space-y-3 border border-destructive/30 p-4">
        <h2 className="text-sm font-semibold text-destructive">Danger Zone</h2>
        <p className="text-xs text-muted-foreground">
          Permanently deletes all people, categories, and transactions. This cannot be undone.
        </p>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" className="w-full gap-2">
              <Trash2 className="h-4 w-4" /> Clear all data
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="glass-strong">
            <AlertDialogHeader>
              <AlertDialogTitle>Clear all data?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete every person, category, and transaction. There is no undo.
                Export a backup first if you want to keep your data.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={async () => {
                  try {
                    await clearAllData();
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
          <div className="pt-1">All data stays on your device. No accounts. No cloud.</div>
        </div>
      </GlassCard>
    </div>
  );
}
