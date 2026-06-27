import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { GlassCard } from "@/components/common/GlassCard";
import { ClientOnly } from "@/components/common/ClientOnly";
import { useAllPersonRows } from "@/lib/queries";
import { useFormatMoney, initials, relativeDate } from "@/lib/formatters";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/people/")({
  head: () => ({ meta: [{ title: "People — Ledge" }] }),
  component: () => (
    <AppShell>
      <ClientOnly>
        <PeoplePage />
      </ClientOnly>
    </AppShell>
  ),
});

function PeoplePage() {
  const rows = useAllPersonRows();
  const fmt = useFormatMoney();
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    if (!rows) return [];
    const needle = q.trim().toLowerCase();
    return rows
      .filter((r) => {
        if (!needle) return true;
        return (
          r.person.name.toLowerCase().includes(needle) ||
          r.categories.some((c) => c.category.name.toLowerCase().includes(needle))
        );
      })
      .sort((a, b) => b.balance.lastActivity - a.balance.lastActivity);
  }, [rows, q]);

  if (!rows) return <div className="space-y-3 pt-4"><div className="h-12 animate-pulse rounded-full bg-muted/30" /><div className="h-20 animate-pulse rounded-2xl bg-muted/30" /></div>;

  return (
    <div className="space-y-4">
      <header className="flex items-end justify-between pt-2">
        <h1 className="text-2xl font-bold">People</h1>
        <span className="text-xs text-muted-foreground">{rows.length} total</span>
      </header>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search people or categories"
          className="glass rounded-full pl-9"
        />
      </div>

      {filtered.length === 0 ? (
        <GlassCard className="p-8 text-center text-sm text-muted-foreground">
          {rows.length === 0
            ? "No people yet. Tap + to add someone."
            : "No results. Try a different search."}
        </GlassCard>
      ) : (
        <ul className="space-y-2">
          {filtered.map((r) => (
            <li key={r.person.id}>
              <Link to="/people/$personId" params={{ personId: r.person.id }} className="block">
                <GlassCard className="flex items-center gap-3 p-3 transition-transform active:scale-[0.98]">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-primary/30 to-accent/30 text-sm font-bold">
                    {initials(r.person.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{r.person.name}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {r.categories.length} {r.categories.length === 1 ? "category" : "categories"} ·{" "}
                      {relativeDate(r.balance.lastActivity)}
                    </div>
                  </div>
                  <div
                    className={cn(
                      "text-right text-sm font-semibold tabular-nums",
                      r.balance.outstanding > 0 && "text-[oklch(0.85_0.18_155)]",
                      r.balance.outstanding < 0 && "text-[oklch(0.78_0.22_22)]",
                      r.balance.outstanding === 0 && "text-muted-foreground",
                    )}
                  >
                    {r.balance.outstanding === 0 ? "Settled" : fmt(Math.abs(r.balance.outstanding))}
                  </div>
                </GlassCard>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
