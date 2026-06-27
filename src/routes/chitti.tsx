import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { GlassCard } from "@/components/common/GlassCard";
import { PiggyBank } from "lucide-react";

export const Route = createFileRoute("/chitti")({
  head: () => ({ meta: [{ title: "Chitti — Ledge" }] }),
  component: () => (
    <AppShell>
      <div className="space-y-4">
        <header className="pt-2">
          <h1 className="text-2xl font-bold">Chitti</h1>
          <p className="text-sm text-muted-foreground">Group savings & rotating funds.</p>
        </header>
        <GlassCard className="flex flex-col items-center gap-3 p-10 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-3xl bg-accent/20 text-accent">
            <PiggyBank className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-semibold">Coming soon</h2>
          <p className="max-w-xs text-sm text-muted-foreground">
            Track chit fund cycles, contributions, and payouts here — kept fully separate from your
            personal debts.
          </p>
        </GlassCard>
      </div>
    </AppShell>
  ),
});
