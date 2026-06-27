import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { GlassCard } from "@/components/common/GlassCard";
import { ClientOnly } from "@/components/common/ClientOnly";
import { useAllPersonRows } from "@/lib/queries";
import { useFormatMoney, initials, relativeDate } from "@/lib/formatters";
import { ArrowDownLeft, ArrowUpRight, Clock, Sparkles, TrendingUp } from "lucide-react";
import { useMemo } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

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
      <div className="h-40 animate-pulse rounded-3xl bg-muted/30" />
      <div className="grid grid-cols-2 gap-3">
        <div className="h-24 animate-pulse rounded-2xl bg-muted/30" />
        <div className="h-24 animate-pulse rounded-2xl bg-muted/30" />
      </div>
    </div>
  );
}

function Dashboard() {
  const rows = useAllPersonRows();
  const fmt = useFormatMoney();

  const totals = useMemo(() => {
    if (!rows) return null;
    let toReceive = 0;
    let toPay = 0;
    let lifetimeLent = 0;
    let lifetimeBorrowed = 0;
    let lifetimeReceived = 0;
    let lifetimePaid = 0;
    for (const r of rows) {
      for (const c of r.categories) {
        const b = c.balance;
        if (b.outstanding > 0) toReceive += b.outstanding;
        if (b.outstanding < 0) toPay += -b.outstanding;
        lifetimeLent += b.totalLent;
        lifetimeBorrowed += b.totalBorrowed;
        lifetimeReceived += b.totalReceived;
        lifetimePaid += b.totalPaid;
      }
    }
    return { toReceive, toPay, lifetimeLent, lifetimeBorrowed, lifetimeReceived, lifetimePaid };
  }, [rows]);

  const insights = useMemo(() => {
    if (!rows) return null;
    let owesMost: { name: string; amt: number } | null = null;
    let owedMost: { name: string; amt: number } | null = null;
    for (const r of rows) {
      if (r.balance.outstanding > 0 && (!owesMost || r.balance.outstanding > owesMost.amt))
        owesMost = { name: r.person.name, amt: r.balance.outstanding };
      if (r.balance.outstanding < 0 && (!owedMost || r.balance.outstanding < -owedMost.amt))
        owedMost = { name: r.person.name, amt: -r.balance.outstanding };
    }
    return { owesMost, owedMost };
  }, [rows]);

  if (!rows) return <DashboardSkeleton />;

  if (rows.length === 0) return <EmptyState />;

  const net = (totals?.toReceive ?? 0) - (totals?.toPay ?? 0);

  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between pt-2">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Ledge</p>
          <h1 className="text-2xl font-bold">Overview</h1>
        </div>
      </header>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 28 }}
      >
        <GlassCard strong className="relative overflow-hidden p-6">
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary/20 blur-3xl" />
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Net balance</p>
          <div className="mt-1 flex items-baseline gap-2">
            <span
              className={cn(
                "text-4xl font-bold tabular-nums",
                net >= 0 ? "text-[oklch(0.85_0.18_155)]" : "text-[oklch(0.78_0.22_22)]",
              )}
            >
              {fmt(net)}
            </span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <BalancePill
              label="You'll receive"
              amount={totals?.toReceive ?? 0}
              tone="receive"
              icon={ArrowDownLeft}
            />
            <BalancePill
              label="You'll pay"
              amount={totals?.toPay ?? 0}
              tone="pay"
              icon={ArrowUpRight}
            />
          </div>
        </GlassCard>
      </motion.div>

      {insights && (insights.owesMost || insights.owedMost) && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {insights.owesMost && (
            <InsightCard
              icon={Sparkles}
              title="Owes you most"
              value={insights.owesMost.name}
              sub={fmt(insights.owesMost.amt)}
            />
          )}
          {insights.owedMost && (
            <InsightCard
              icon={Clock}
              title="You owe most to"
              value={insights.owedMost.name}
              sub={fmt(insights.owedMost.amt)}
            />
          )}
        </div>
      )}

      <section>
        <div className="mb-2 flex items-center justify-between px-1">
          <h2 className="text-sm font-semibold text-muted-foreground">People</h2>
          <Link to="/people" className="text-xs text-primary">
            View all
          </Link>
        </div>
        <div className="space-y-2">
          {rows.slice(0, 5).map((r) => (
            <Link
              key={r.person.id}
              to="/people/$personId"
              params={{ personId: r.person.id }}
              className="block"
            >
              <GlassCard className="flex items-center gap-3 p-3 transition-transform active:scale-[0.98]">
                <Avatar name={r.person.name} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{r.person.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {r.balance.activeCount > 0
                      ? `${r.balance.activeCount} active`
                      : "Settled"}{" "}
                    · {relativeDate(r.balance.lastActivity)}
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
                    {r.balance.outstanding > 0
                      ? "owes you"
                      : r.balance.outstanding < 0
                        ? "you owe"
                        : ""}
                  </div>
                </div>
              </GlassCard>
            </Link>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <Stat label="Lent" amount={totals?.lifetimeLent ?? 0} />
        <Stat label="Borrowed" amount={totals?.lifetimeBorrowed ?? 0} />
        <Stat label="Received" amount={totals?.lifetimeReceived ?? 0} />
        <Stat label="Paid" amount={totals?.lifetimePaid ?? 0} />
      </section>
    </div>
  );
}

function BalancePill({
  label,
  amount,
  tone,
  icon: Icon,
}: {
  label: string;
  amount: number;
  tone: "receive" | "pay";
  icon: typeof ArrowDownLeft;
}) {
  const fmt = useFormatMoney();
  return (
    <div className="glass rounded-2xl p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon
          className={cn(
            "h-3.5 w-3.5",
            tone === "receive" ? "text-[oklch(0.85_0.18_155)]" : "text-[oklch(0.78_0.22_22)]",
          )}
        />
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold tabular-nums">{fmt(amount)}</div>
    </div>
  );
}

function InsightCard({
  icon: Icon,
  title,
  value,
  sub,
}: {
  icon: typeof Sparkles;
  title: string;
  value: string;
  sub: string;
}) {
  return (
    <GlassCard className="flex items-center gap-3 p-4">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-primary/15 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{title}</div>
        <div className="truncate font-semibold">{value}</div>
        <div className="text-xs text-muted-foreground tabular-nums">{sub}</div>
      </div>
    </GlassCard>
  );
}

function Stat({ label, amount }: { label: string; amount: number }) {
  const fmt = useFormatMoney();
  return (
    <GlassCard className="p-3">
      <div className="flex items-center gap-1 text-[11px] uppercase tracking-wider text-muted-foreground">
        <TrendingUp className="h-3 w-3" /> {label}
      </div>
      <div className="mt-0.5 text-base font-semibold tabular-nums">{fmt(amount)}</div>
    </GlassCard>
  );
}

function Avatar({ name }: { name: string }) {
  return (
    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-primary/30 to-accent/30 text-sm font-bold">
      {initials(name)}
    </div>
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
        <p className="mt-4 text-xs text-muted-foreground">Tap the <span className="font-semibold text-primary">+</span> to start.</p>
      </GlassCard>
    </div>
  );
}
