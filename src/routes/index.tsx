import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { GlassCard } from "@/components/common/GlassCard";
import { PersonAvatar } from "@/components/common/PersonAvatar";
import { ClientOnly } from "@/components/common/ClientOnly";
import { useLedge, type PersonRow } from "@/features/dataProvider";
import { useFormatMoney, relativeDate } from "@/lib/formatters";
import { getRepaymentPlanSchedule, dateOnly } from "@/lib/repaymentPlanUtils";
import { getDb } from "@/lib/db";
import { useLiveQuery } from "dexie-react-hooks";
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  ChevronRight,
  TrendingUp,
  Search,
  Users,
  Briefcase,
  Calendar,
  Layers,
  Coins,
  XCircle,
  Landmark,
} from "lucide-react";
import { useMemo, useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [{ title: "Ledge — Home" }, { name: "description", content: "Your money at a glance." }],
  }),
  component: () => (
    <AppShell>
      <ClientOnly fallback={<DashboardSkeleton />}>
        <Dashboard />
      </ClientOnly>
    </AppShell>
  ),
});

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function todayLabel() {
  return new Date().toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4 pt-2">
      <div className="h-5 w-40 animate-pulse rounded-full bg-muted/50" />
      <div className="h-52 animate-pulse rounded-3xl bg-muted/30" />
      <div className="h-24 animate-pulse rounded-2xl bg-muted/30" />
      <div className="h-32 animate-pulse rounded-2xl bg-muted/30" />
    </div>
  );
}

interface DashboardPayment {
  key: string;
  personId: string;
  personName: string;
  categoryName: string;
  dueDate: number;
  amount: number;
  direction: "pay" | "receive";
  month?: number;
}

function Dashboard() {
  const { personRows: rows, transactions: txs, chittis, loans, isLoading } = useLedge();
  const repaymentPlans = useLiveQuery(() => getDb().repaymentPlans.toArray(), []);
  const fmt = useFormatMoney();
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Keyboard Shortcuts registration
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement).isContentEditable
      ) {
        return;
      }

      if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("ledge:open_quick_add"));
      }
      if (e.key === "/") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const totals = useMemo(() => {
    if (!rows.length)
      return { toReceive: 0, toPay: 0, lifetimeLent: 0, lifetimeReceived: 0, recoveryRate: 0 };
    let toReceive = 0,
      toPay = 0,
      lifetimeLent = 0,
      lifetimeReceived = 0;
    for (const r of rows) {
      for (const c of r.categories) {
        const b = c.balance;
        if (b.outstanding > 0) toReceive += b.outstanding;
        if (b.outstanding < 0) toPay += -b.outstanding;
        lifetimeLent += b.totalLent;
        lifetimeReceived += b.totalReceived;
      }
    }
    const recoveryRate =
      lifetimeLent > 0 ? Math.min((lifetimeReceived / lifetimeLent) * 100, 100) : 0;
    return { toReceive, toPay, lifetimeLent, lifetimeReceived, recoveryRate };
  }, [rows]);

  // Secondary Quick Stats
  // Top person who owes you the most
  const topDebtor = useMemo(() => {
    if (!rows.length) return null;
    return (
      rows
        .filter((r) => r.balance.outstanding > 0)
        .sort((a, b) => b.balance.outstanding - a.balance.outstanding)[0] ?? null
    );
  }, [rows]);

  // Top person you owe the most to
  const topCreditor = useMemo(() => {
    if (!rows.length) return null;
    return (
      rows
        .filter((r) => r.balance.outstanding < 0)
        .sort((a, b) => a.balance.outstanding - b.balance.outstanding)[0] ?? null
    );
  }, [rows]);

  // Due items are based on the outstanding category balance and plan installments,
  // rather than the original transaction amount/date when a schedule exists.
  const { overduePayments, upcomingPayments } = useMemo(() => {
    const plans = repaymentPlans ?? [];
    const today = dateOnly(Date.now());
    const horizon = new Date(today);
    horizon.setDate(horizon.getDate() + 30);
    const horizonDate = dateOnly(horizon.getTime());
    const categoryRows = new Map(
      rows.flatMap((row) =>
        row.categories.map(
          (categoryRow) =>
            [categoryRow.category.id, { ...categoryRow, person: row.person }] as const,
        ),
      ),
    );
    const plansByCategory = new Map(plans.map((plan) => [plan.categoryId, plan]));
    const overdue: DashboardPayment[] = [];
    const upcoming: DashboardPayment[] = [];

    for (const plan of plans) {
      const categoryRow = categoryRows.get(plan.categoryId);
      if (!categoryRow || categoryRow.balance.outstanding >= -0.005) continue;
      const categoryTransactions = txs.filter(
        (transaction) => transaction.categoryId === plan.categoryId,
      );
      const schedule = getRepaymentPlanSchedule(
        plan,
        categoryRow.balance.outstanding,
        categoryTransactions,
      );
      const schedulePayments = schedule.installments
        .filter((installment) => installment.remainingAmount > 0.005)
        .map((installment) => ({
          key: plan.id + "-month-" + installment.month,
          personId: categoryRow.person.id,
          personName: categoryRow.person.name,
          categoryName: categoryRow.category.name,
          dueDate: installment.dueDate,
          amount: installment.remainingAmount,
          direction: "pay" as const,
          month: installment.month,
        }));

      overdue.push(...schedulePayments.filter((payment) => dateOnly(payment.dueDate) < today));
      const nextScheduled = schedulePayments
        .filter((payment) => dateOnly(payment.dueDate) >= today)
        .sort((a, b) => a.dueDate - b.dueDate)[0];
      if (nextScheduled) upcoming.push(nextScheduled);
    }

    // Preserve legacy transaction due dates for categories without a repayment plan.
    for (const row of rows) {
      for (const categoryRow of row.categories) {
        if (plansByCategory.has(categoryRow.category.id)) continue;
        const outstanding = categoryRow.balance.outstanding;
        if (Math.abs(outstanding) < 0.005) continue;
        const applicableType = outstanding > 0 ? "lent" : "borrowed";
        const dueEntries = txs
          .filter(
            (transaction) =>
              transaction.categoryId === categoryRow.category.id &&
              transaction.type === applicableType &&
              transaction.dueDate !== undefined,
          )
          .sort((a, b) => (a.dueDate ?? 0) - (b.dueDate ?? 0));
        const dueEntry = dueEntries[0];
        if (!dueEntry?.dueDate) continue;
        const payment: DashboardPayment = {
          key: "category-" + categoryRow.category.id,
          personId: row.person.id,
          personName: row.person.name,
          categoryName: categoryRow.category.name,
          dueDate: dueEntry.dueDate,
          amount: Math.abs(outstanding),
          direction: outstanding < 0 ? "pay" : "receive",
        };
        const dueDay = dateOnly(payment.dueDate);
        if (dueDay < today) overdue.push(payment);
        else if (dueDay <= horizonDate) upcoming.push(payment);
      }
    }

    return {
      overduePayments: overdue.sort((a, b) => a.dueDate - b.dueDate),
      upcomingPayments: upcoming.sort((a, b) => a.dueDate - b.dueDate).slice(0, 3),
    };
  }, [repaymentPlans, rows, txs]);

  // Recent activity: last 3 transactions
  const recent = useMemo(() => {
    if (!txs.length || !rows.length) return [];
    const personMap = new Map(rows.map((r) => [r.person.id, r.person]));
    return [...txs]
      .sort((a, b) => b.date - a.date)
      .slice(0, 3)
      .map((t) => ({ ...t, person: personMap.get(t.personId) }));
  }, [txs, rows]);

  // Global Search Filter
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const q = searchQuery.toLowerCase().trim();

    const peopleResult = rows
      .filter((r) => r.person.name.toLowerCase().includes(q))
      .map((r) => r.person);

    const txResult = txs
      .filter((t) => (t.notes && t.notes.toLowerCase().includes(q)) || String(t.amount).includes(q))
      .map((t) => {
        const p = rows.find((r) => r.person.id === t.personId)?.person;
        return { ...t, person: p };
      });

    const chittiResult = chittis
      .filter(
        (c) =>
          (c.name && c.name.toLowerCase().includes(q)) ||
          rows
            .find((r) => r.person.id === c.organizerId)
            ?.person.name.toLowerCase()
            .includes(q),
      )
      .map((c) => {
        const p = rows.find((r) => r.person.id === c.organizerId)?.person;
        return { ...c, organizer: p };
      });

    const loanResult = loans.filter(
      (loan) =>
        loan.name.toLowerCase().includes(q) ||
        loan.lender.toLowerCase().includes(q) ||
        loan.kind.toLowerCase().includes(q),
    );

    return {
      people: peopleResult,
      transactions: txResult,
      chittis: chittiResult,
      loans: loanResult,
    };
  }, [searchQuery, rows, txs, chittis, loans]);

  if (isLoading) return <DashboardSkeleton />;
  if (rows.length === 0) return <EmptyState />;

  const net = (totals?.toReceive ?? 0) - (totals?.toPay ?? 0);
  const recovery = totals?.recoveryRate ?? 0;

  return (
    <div className="space-y-4 pt-2 sm:space-y-5 lg:space-y-6">
      {/* Search Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">
              {todayLabel()}
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight lg:text-3xl">{greeting()} 👋</h1>
          </div>
        </div>

        <div className="relative w-full sm:min-w-[220px] sm:flex-1 sm:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Global search (people, notes, amounts...)"
            className="glass rounded-full pl-9 pr-9"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <XCircle className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div>
        {searchResults ? (
          /* SEARCH RESULTS STATE */
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-150 ease-out">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Search Results
              </h2>
              <button onClick={() => setSearchQuery("")} className="text-xs text-primary">
                Clear search
              </button>
            </div>

            {/* People Results */}
            {searchResults.people.length > 0 && (
              <GlassCard className="p-3 space-y-2">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground pb-1 border-b border-border/50">
                  <Users className="h-3.5 w-3.5" /> People
                </div>
                <div className="divide-y divide-border/50">
                  {searchResults.people.map((p) => (
                    <Link
                      key={p.id}
                      to="/people/$personId"
                      params={{ personId: p.id }}
                      className="flex items-center justify-between py-2.5 first:pt-1 last:pb-1"
                    >
                      <span className="font-medium capitalize text-sm">{p.name}</span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </Link>
                  ))}
                </div>
              </GlassCard>
            )}

            {/* Transaction Results */}
            {searchResults.transactions.length > 0 && (
              <GlassCard className="p-3 space-y-2">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground pb-1 border-b border-border/50">
                  <Layers className="h-3.5 w-3.5" /> Transactions
                </div>
                <div className="divide-y divide-border/50">
                  {searchResults.transactions.map((t) => (
                    <Link
                      key={t.id}
                      to="/people/$personId"
                      params={{ personId: t.personId }}
                      className="flex items-center justify-between py-2.5 first:pt-1 last:pb-1 text-sm"
                    >
                      <div>
                        <div className="font-medium capitalize">{t.person?.name}</div>
                        <div className="text-[11px] text-muted-foreground truncate max-w-[200px]">
                          {t.notes || `Type: ${t.type}`}
                        </div>
                      </div>
                      <span className="font-semibold tabular-nums text-foreground">
                        {t.type === "lent" || t.type === "repayment_out" ? "+" : "−"}
                        {fmt(t.amount)}
                      </span>
                    </Link>
                  ))}
                </div>
              </GlassCard>
            )}

            {/* Chitti Results */}
            {searchResults.chittis.length > 0 && (
              <GlassCard className="p-3 space-y-2">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground pb-1 border-b border-border/50">
                  <Coins className="h-3.5 w-3.5" /> Chittis
                </div>
                <div className="divide-y divide-border/50">
                  {searchResults.chittis.map((c) => (
                    <Link
                      key={c.id}
                      to="/chitti/$chittiId"
                      params={{ chittiId: c.id }}
                      className="flex items-center justify-between py-2.5 first:pt-1 last:pb-1 text-sm"
                    >
                      <div>
                        <div className="font-medium">{c.name || "Chitti"}</div>
                        <div className="text-[11px] text-muted-foreground capitalize">
                          by {c.organizer?.name}
                        </div>
                      </div>
                      <span className="font-semibold text-accent">{fmt(c.monthlyAmount)}/mo</span>
                    </Link>
                  ))}
                </div>
              </GlassCard>
            )}

            {searchResults.loans.length > 0 && (
              <GlassCard className="space-y-2 p-3">
                <div className="flex items-center gap-1.5 border-b border-border/50 pb-1 text-xs text-muted-foreground">
                  <Landmark className="h-3.5 w-3.5" /> Loans
                </div>
                <div className="divide-y divide-border/50">
                  {searchResults.loans.map((loan) => (
                    <Link
                      key={loan.id}
                      to="/loans/$loanId"
                      params={{ loanId: loan.id }}
                      className="flex items-center justify-between gap-3 py-2.5 text-sm first:pt-1 last:pb-1"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-medium">{loan.name}</div>
                        <div className="truncate text-[11px] capitalize text-muted-foreground">
                          {loan.kind} · {loan.lender}
                        </div>
                      </div>
                      <span className="shrink-0 font-semibold text-primary">
                        {fmt(loan.monthlyAmount)}/mo
                      </span>
                    </Link>
                  ))}
                </div>
              </GlassCard>
            )}

            {searchResults.people.length === 0 &&
              searchResults.transactions.length === 0 &&
              searchResults.chittis.length === 0 &&
              searchResults.loans.length === 0 && (
                <GlassCard className="p-8 text-center text-sm text-muted-foreground">
                  No matching records found for "{searchQuery}".
                </GlassCard>
              )}
          </div>
        ) : (
          /* STANDARD DASHBOARD STATE */
          <div className="grid min-w-0 gap-4 animate-in fade-in duration-150 ease-out sm:gap-5 lg:grid-cols-12 lg:items-start lg:gap-6">
            {/* Net balance hero */}
            <div className="min-w-0 animate-in fade-in slide-in-from-bottom-2 duration-200 ease-out lg:col-span-7">
              <GlassCard
                strong
                className="relative overflow-hidden border-glass-border p-6 shadow-[0_20px_50px_rgba(0,0,0,0.4)] lg:p-8"
              >
                {/* Ambient glow */}
                <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/15 blur-[80px]" />
                <div className="pointer-events-none absolute -left-12 -bottom-12 h-44 w-44 rounded-full bg-accent/10 blur-[60px]" />

                <p className="relative text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                  Net balance
                </p>
                <h2
                  className={cn(
                    "relative mt-1.5 text-5xl font-extrabold tracking-tight tabular-nums lg:text-6xl",
                    "text-foreground",
                  )}
                >
                  {net === 0 ? "All clear" : (net > 0 ? "+" : "−") + fmt(Math.abs(net))}
                </h2>
                <p className="relative mt-1 text-xs text-muted-foreground/80 font-medium">
                  {net > 0
                    ? "overall amount owed to you"
                    : net < 0
                      ? "overall amount you owe"
                      : "everything settled and clear"}
                </p>

                {/* To receive / To pay */}
                <div className="relative mt-5 grid grid-cols-2 gap-3">
                  <div className="glass rounded-[20px] p-3.5 card-glowing-border">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      <span className="flex h-5 w-5 items-center justify-center rounded-lg bg-receive/12 text-receive">
                        <ArrowDownLeft className="h-3 w-3" />
                      </span>
                      To receive
                    </div>
                    <div className="mt-2.5 text-lg font-bold tabular-nums text-foreground">
                      {fmt(totals?.toReceive ?? 0)}
                    </div>
                  </div>
                  <div className="glass rounded-[20px] p-3.5 card-glowing-border">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      <span className="flex h-5 w-5 items-center justify-center rounded-lg bg-pay/12 text-pay">
                        <ArrowUpRight className="h-3 w-3" />
                      </span>
                      To pay
                    </div>
                    <div className="mt-2.5 text-lg font-bold tabular-nums text-foreground">
                      {fmt(totals?.toPay ?? 0)}
                    </div>
                  </div>
                </div>

                {/* Recovery rate bar */}
                {(totals?.lifetimeLent ?? 0) > 0 && (
                  <div className="relative mt-5 pt-3 border-t border-border/50">
                    <div className="mb-1.5 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <TrendingUp className="h-3.5 w-3.5 text-primary" /> Recovery rate
                      </span>
                      <span className="tabular-nums font-bold text-foreground text-xs">
                        {Math.round(recovery)}%
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted border border-border">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-receive to-primary transition-[width] duration-1000 ease-out"
                        style={{ width: `${recovery}%` }}
                      />
                    </div>
                    <p className="mt-2 text-[10px] text-muted-foreground leading-normal">
                      Recovered{" "}
                      <span className="font-semibold text-foreground">
                        {fmt(totals?.lifetimeReceived ?? 0)}
                      </span>{" "}
                      back of{" "}
                      <span className="font-semibold text-foreground">
                        {fmt(totals?.lifetimeLent ?? 0)}
                      </span>{" "}
                      lifetime lent
                    </p>
                  </div>
                )}
              </GlassCard>
            </div>

            <div className="min-w-0 space-y-4 empty:hidden lg:col-span-5">
              {/* Overdue items include their person, category, and due installment. */}
              {overduePayments.length > 0 && (
                <section className="space-y-2 animate-in fade-in zoom-in-95 duration-150 ease-out">
                  <Link to="/people">
                    <GlassCard className="flex items-center gap-3 border border-warning/30 p-3.5">
                      <AlertCircle className="h-4 w-4 shrink-0 text-warning" />
                      <div className="flex-1 text-sm">
                        <span className="font-semibold text-warning">
                          {overduePayments.length} overdue
                        </span>
                        <span className="text-muted-foreground"> — tap to review</span>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </GlassCard>
                  </Link>
                  <GlassCard className="divide-y divide-border/40 overflow-hidden p-0">
                    {overduePayments.slice(0, 3).map((payment) => (
                      <Link
                        key={payment.key}
                        to="/people/$personId"
                        params={{ personId: payment.personId }}
                        className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-foreground/5"
                      >
                        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-warning/10">
                          <Calendar className="h-4 w-4 text-warning" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{payment.personName}</div>
                          <div className="truncate text-xs text-muted-foreground">
                            {payment.categoryName}
                            {payment.month ? " · Month " + payment.month : ""} · Due{" "}
                            {new Date(payment.dueDate).toLocaleDateString(undefined, {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </div>
                        </div>
                        <div className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                          {payment.direction === "pay" ? "−" : "+"}
                          {fmt(payment.amount)}
                        </div>
                      </Link>
                    ))}
                  </GlassCard>
                </section>
              )}

              {/* Upcoming Payments */}
              {upcomingPayments.length > 0 && (
                <section>
                  <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Upcoming Payments
                  </p>
                  <GlassCard className="divide-y divide-border/40 overflow-hidden p-0">
                    {upcomingPayments.map((payment) => (
                      <Link
                        key={payment.key}
                        to="/people/$personId"
                        params={{ personId: payment.personId }}
                        className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-foreground/5"
                      >
                        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-secondary/60 text-xs font-semibold">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{payment.personName}</div>
                          <div className="truncate text-xs text-muted-foreground">
                            {payment.categoryName}
                            {payment.month ? " · Month " + payment.month : ""} · Due{" "}
                            {new Date(payment.dueDate).toLocaleDateString(undefined, {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </div>
                        </div>
                        <div className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                          {payment.direction === "pay" ? "−" : "+"}
                          {fmt(payment.amount)}
                        </div>
                      </Link>
                    ))}
                  </GlassCard>
                </section>
              )}
            </div>

            {/* Recent activity */}
            {recent.length > 0 && (
              <section className="min-w-0 lg:col-span-7">
                <div className="mb-2 flex items-center justify-between px-1">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Recent
                  </p>
                  <Link to="/analytics" className="text-xs text-primary">
                    See insights →
                  </Link>
                </div>
                <GlassCard className="divide-y divide-border/40 overflow-hidden p-0">
                  {recent.map((t) => {
                    const positive = t.type === "lent" || t.type === "repayment_out";
                    const labels: Record<string, string> = {
                      lent: "Lent",
                      borrowed: "Borrowed",
                      repayment_in: "Received",
                      repayment_out: "Paid",
                    };
                    return (
                      <Link
                        key={t.id}
                        to="/people/$personId"
                        params={{ personId: t.personId }}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-foreground/5 transition-colors"
                      >
                        {t.person ? (
                          <PersonAvatar name={t.person.name} seed={t.person.id} size="sm" />
                        ) : (
                          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-[38%] bg-muted text-xs text-muted-foreground">
                            ?
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium capitalize">
                            {t.person?.name ?? "—"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {labels[t.type]} · {relativeDate(t.date)}
                          </div>
                        </div>
                        <div
                          className={cn("text-sm font-semibold tabular-nums", "text-foreground")}
                        >
                          {positive ? "+" : "−"}
                          {fmt(t.amount)}
                        </div>
                      </Link>
                    );
                  })}
                </GlassCard>
              </section>
            )}

            {/* People to follow up with */}
            <div className="min-w-0 space-y-4 empty:hidden lg:col-span-5">
              {topDebtor && (
                <section>
                  <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Owes you the most
                  </p>
                  <AttentionCard row={topDebtor} tone="receive" fmt={fmt} />
                </section>
              )}

              {topCreditor && (
                <section>
                  <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    You owe the most to
                  </p>
                  <AttentionCard row={topCreditor} tone="pay" fmt={fmt} />
                </section>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AttentionCard({
  row,
  tone,
  fmt,
}: {
  row: PersonRow;
  tone: "receive" | "pay";
  fmt: (n: number) => string;
}) {
  const isReceive = tone === "receive";
  const amount = Math.abs(row.balance.outstanding);
  return (
    <Link to="/people/$personId" params={{ personId: row.person.id }}>
      <GlassCard
        className={cn(
          "flex items-center gap-4 p-4 transition-transform active:scale-[0.98] card-glowing-border rounded-2xl",
          isReceive ? "border-receive/20" : "border-pay/20",
        )}
      >
        {/* Avatar */}
        <PersonAvatar
          name={row.person.name}
          seed={row.person.id}
          size="md"
          className="h-12 w-12 text-base"
        />
        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold capitalize text-sm">{row.person.name}</div>
          <div className="text-[11px] text-muted-foreground">
            {row.balance.activeCount} active · {relativeDate(row.balance.lastActivity)}
          </div>
        </div>
        {/* Amount */}
        <div className="text-right mr-1">
          <div
            className={cn(
              "text-base font-extrabold tracking-tight tabular-nums",
              "text-foreground",
            )}
          >
            {fmt(amount)}
          </div>
          <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground mt-0.5">
            {isReceive ? "owes you" : "you owe"}
          </div>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      </GlassCard>
    </Link>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-6 pt-16 text-center">
      <div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Welcome to</p>
        <h1 className="mt-1 bg-gradient-to-br from-foreground to-foreground/50 bg-clip-text text-5xl font-bold text-transparent">
          Ledge
        </h1>
      </div>
      <GlassCard className="max-w-xs p-5 text-left">
        <h2 className="font-semibold">Track money between you and people.</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Record what you lend or borrow, and Ledge keeps all balances tidy. Fully offline. Always
          private.
        </p>
        <p className="mt-4 text-xs text-muted-foreground">
          <span className="lg:hidden">
            Tap the <span className="font-bold text-primary">+</span> button to get started.
          </span>
          <span className="hidden lg:inline">Select New transaction to get started.</span>
        </p>
      </GlassCard>
    </div>
  );
}
