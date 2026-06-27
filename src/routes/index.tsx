import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { GlassCard } from "@/components/common/GlassCard";
import { ClientOnly } from "@/components/common/ClientOnly";
import { useAllPersonRows, useAllTransactions } from "@/lib/queries";
import { useFormatMoney, initials, relativeDate } from "@/lib/formatters";
import {
  ArrowDownLeft,
  ArrowUpRight,
  AlertCircle,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { useMemo } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { PersonRow } from "@/lib/queries";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Ledge — Dashboard" },
      { name: "description", content: "Your money at a glance." },
    ],
  }),
  component: () => (
    <AppShell>
      <ClientOnly fallback={<DashboardSkeleton />}>
        <Dashboard />
      </ClientOnly>
    </AppShell>
  ),
});

function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-32 animate-pulse rounded-full bg-muted/50" />
      <div className="h-44 animate-pulse rounded-3xl bg-muted/30" />
      <div className="grid grid-cols-2 gap-3">
        <div className="h-24 animate-pulse rounded-2xl bg-muted/30" />
        <div className="h-24 animate-pulse rounded-2xl bg-muted/30" />
      </div>
    </div>
  );
}

function Dashboard() {
  const rows = useAllPersonRows();
  const txs = useAllTransactions();
  const fmt = useFormatMoney();

  const totals = useMemo(() => {
    if (!rows) return null;
    let toReceive = 0, toPay = 0, lifetimeLent = 0, lifetimeBorrowed = 0;
    for (const r of rows) {
      for (const c of r.categories) {
        const b = c.balance;
        if (b.outstanding > 0) toReceive += b.outstanding;
        if (b.outstanding < 0) toPay += -b.outstanding;
        lifetimeLent += b.totalLent;
        lifetimeBorrowed += b.totalBorrowed;
      }
    }
    return { toReceive, toPay, lifetimeLent, lifetimeBorrowed };
  }, [rows]);

  // Overdue entries (have dueDate in the past and balance not settled)
  const overdue = useMemo(() => {
    if (!rows || !txs) return [];
    const now = Date.now();
    const settled = new Set(
      rows.flatMap((r) => r.categories.filter((c) => c.balance.settled).map((c) => c.category.id))
    );
    return txs.filter(
      (t) => t.dueDate && t.dueDate < now && !settled.has(t.categoryId)
        && (t.type === "lent" || t.type === "borrowed")
    );
  }, [rows, txs]);

  // Recent activity: last 4 transactions with person name
  const recent = useMemo(() => {
    if (!txs || !rows) return [];
    const personMap = new Map(rows.map((r) => [r.person.id, r.person.name]));
    return [...txs]
      .sort((a, b) => b.date - a.date)
      .slice(0, 4)
      .map((t) => ({ ...t, personName: personMap.get(t.personId) ?? "?" }));
  }, [txs, rows]);

  // Top unsettled people sorted by outstanding
  const topPeople = useMemo(() => {
    if (!rows) return [];
    return [...rows]
      .sort((a, b) => Math.abs(b.balance.outstanding) - Math.abs(a.balance.outstanding))
      .slice(0, 5);
  }, [rows]);

  if (!rows || !txs) return <DashboardSkeleton />;
  if (rows.length === 0) return <EmptyState />;

  const net = (totals?.toReceive ?? 0) - (totals?.toPay ?? 0);

  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between pt-2">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Ledge</p>
          <h1 className="text-2xl font-bold">Overview</h1>
        </div>
        <span className="text-xs text-muted-foreground">{rows.length} people</span>
      </header>

      {/* Net balance hero card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 28 }}
      >
        <GlassCard strong className="relative overflow-hidden p-6">
          <div className="absolute -right-12 -top-12 h-52 w-52 rounded-full bg-primary/15 blur-3xl" />
          <div className="absolute -left-8 -bottom-8 h-32 w-32 rounded-full bg-accent/10 blur-2xl" />
          <p className="relative text-xs uppercase tracking-widest text-muted-foreground">Net balance</p>
          <div className="relative mt-1 flex items-baseline gap-2">
            <span
              className={cn(
                "text-4xl font-bold tabular-nums",
                net >= 0 ? "text-[oklch(0.85_0.18_155)]" : "text-[oklch(0.78_0.22_22)]",
              )}
            >
              {net >= 0 ? "+" : "−"}{fmt(Math.abs(net))}
            </span>
          </div>
          <p className="relative mt-0.5 text-xs text-muted-foreground">
            {net > 0 ? "overall people owe you" : net < 0 ? "overall you owe more" : "all settled up"}
          </p>

          <div className="relative mt-5 grid grid-cols-2 gap-3">
            <div className="glass rounded-2xl p-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <ArrowDownLeft className="h-3.5 w-3.5 text-[oklch(0.85_0.18_155)]" />
                To receive
              </div>
              <div className="mt-1 text-lg font-semibold tabular-nums text-[oklch(0.85_0.18_155)]">
                {fmt(totals?.toReceive ?? 0)}
              </div>
            </div>
            <div className="glass rounded-2xl p-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <ArrowUpRight className="h-3.5 w-3.5 text-[oklch(0.78_0.22_22)]" />
                To pay
              </div>
              <div className="mt-1 text-lg font-semibold tabular-nums text-[oklch(0.78_0.22_22)]">
                {fmt(totals?.toPay ?? 0)}
              </div>
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {/* Lifetime stats */}
      <div className="grid grid-cols-2 gap-3">
        <GlassCard className="p-3">
          <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
            <TrendingUp className="h-3 w-3" /> Total lent
          </div>
          <div className="mt-0.5 text-base font-semibold tabular-nums">{fmt(totals?.lifetimeLent ?? 0)}</div>
        </GlassCard>
        <GlassCard className="p-3">
          <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
            <TrendingDown className="h-3 w-3" /> Total borrowed
          </div>
          <div className="mt-0.5 text-base font-semibold tabular-nums">{fmt(totals?.lifetimeBorrowed ?? 0)}</div>
        </GlassCard>
      </div>

      {/* Overdue alert */}
      {overdue.length > 0 && (
        <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}>
          <GlassCard className="flex items-start gap-3 border border-orange-500/30 p-4">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-orange-400" />
            <div>
              <div className="text-sm font-semibold text-orange-400">
                {overdue.length} overdue {overdue.length === 1 ? "entry" : "entries"}
              </div>
              <div className="text-xs text-muted-foreground">
                Some transactions have passed their due date. Check People for details.
              </div>
            </div>
          </GlassCard>
        </motion.div>
      )}

      {/* People list */}
      <section>
        <div className="mb-2 flex items-center justify-between px-1">
          <h2 className="text-sm font-semibold text-muted-foreground">People</h2>
          <Link to="/people" className="text-xs text-primary">
            View all
          </Link>
        </div>
        <div className="space-y-2">
          {topPeople.map((r) => (
            <PersonRow key={r.person.id} r={r} fmt={fmt} />
          ))}
        </div>
      </section>

      {/* Recent activity */}
      {recent.length > 0 && (
        <section>
          <h2 className="mb-2 px-1 text-sm font-semibold text-muted-foreground">Recent activity</h2>
          <GlassCard className="divide-y divide-border/50 p-0 overflow-hidden">
            {recent.map((t) => {
              const positive = t.type === "lent" || t.type === "repayment_out";
              const label: Record<string, string> = {
                lent: "Lent", borrowed: "Borrowed",
                repayment_in: "Received", repayment_out: "Paid",
              };
              return (
                <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                  <div
                    className={cn(
                      "grid h-9 w-9 shrink-0 place-items-center rounded-2xl text-xs font-bold",
                      positive
                        ? "bg-[oklch(0.78_0.17_155/0.18)] text-[oklch(0.85_0.18_155)]"
                        : "bg-[oklch(0.78_0.22_22/0.18)] text-[oklch(0.85_0.22_22)]",
                    )}
                  >
                    {label[t.type][0]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium capitalize">{t.personName}</div>
                    <div className="text-xs text-muted-foreground">
                      {label[t.type]} · {relativeDate(t.date)}
                    </div>
                  </div>
                  <div
                    className={cn(
                      "text-sm font-semibold tabular-nums",
                      positive ? "text-[oklch(0.85_0.18_155)]" : "text-[oklch(0.78_0.22_22)]",
                    )}
                  >
                    {positive ? "+" : "−"}{fmt(t.amount)}
                  </div>
                </div>
              );
            })}
          </GlassCard>
        </section>
      )}
    </div>
  );
}

function PersonRow({ r, fmt }: { r: PersonRow; fmt: (n: number) => string }) {
  return (
    <Link to="/people/$personId" params={{ personId: r.person.id }} className="block">
      <GlassCard className="flex items-center gap-3 p-3 transition-transform active:scale-[0.98]">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-primary/30 to-accent/30 text-sm font-bold">
          {initials(r.person.name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium capitalize">{r.person.name}</div>
          <div className="text-xs text-muted-foreground">
            {r.balance.activeCount > 0 ? `${r.balance.activeCount} active` : "Settled"} ·{" "}
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
          {r.balance.outstanding === 0 ? "—" : fmt(Math.abs(r.balance.outstanding))}
          <div className="text-[10px] font-normal uppercase tracking-wider opacity-70">
            {r.balance.outstanding > 0 ? "owes you" : r.balance.outstanding < 0 ? "you owe" : ""}
          </div>
        </div>
      </GlassCard>
    </Link>
  );
}

function EmptyState() {
  return (
    <div className="space-y-6 pt-10 text-center">
      <header>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Welcome to</p>
        <h1 className="bg-gradient-to-br from-foreground to-foreground/60 bg-clip-text text-5xl font-bold text-transparent">
          Ledge
        </h1>
      </header>
      <GlassCard className="mx-auto max-w-sm p-6 text-left">
        <h2 className="text-lg font-semibold">Track money between you and people.</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Add someone, record what you lent or borrowed, and Ledge keeps the balances tidy. Fully
          offline. Always private.
        </p>
        <p className="mt-4 text-xs text-muted-foreground">
          Tap the <span className="font-semibold text-primary">+</span> to start.
        </p>
      </GlassCard>
    </div>
  );
}
