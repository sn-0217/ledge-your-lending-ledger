import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { GlassCard } from "@/components/common/GlassCard";
import { ClientOnly } from "@/components/common/ClientOnly";
import { useLedge } from "@/features/dataProvider";
import { useFormatMoney, initials, relativeDate } from "@/lib/formatters";
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
  Keyboard,
  XCircle,
} from "lucide-react";
import { useMemo, useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Ledge — Home" },
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

function Dashboard() {
  const { personRows: rows, transactions: txs, chittis, isLoading } = useLedge();
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
    if (!rows.length) return { toReceive: 0, toPay: 0, lifetimeLent: 0, lifetimeReceived: 0, recoveryRate: 0 };
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

  // Overdue entries count
  const overdueCount = useMemo(() => {
    if (!rows.length || !txs.length) return 0;
    const now = Date.now();
    const settled = new Set(
      rows.flatMap((r) => r.categories.filter((c) => c.balance.settled).map((c) => c.category.id))
    );
    return txs.filter(
      (t) =>
        t.dueDate &&
        t.dueDate < now &&
        !settled.has(t.categoryId) &&
        (t.type === "lent" || t.type === "borrowed")
    ).length;
  }, [rows, txs]);

  // Upcoming payments (due within next 30 days)
  const upcomingPayments = useMemo(() => {
    if (!txs.length || !rows.length) return [];
    const now = Date.now();
    const settled = new Set(
      rows.flatMap((r) => r.categories.filter((c) => c.balance.settled).map((c) => c.category.id))
    );
    const personMap = new Map(rows.map((r) => [r.person.id, r.person]));

    return txs
      .filter(
        (t) =>
          t.dueDate &&
          t.dueDate >= now &&
          !settled.has(t.categoryId) &&
          (t.type === "lent" || t.type === "borrowed")
      )
      .sort((a, b) => (a.dueDate || 0) - (b.dueDate || 0))
      .slice(0, 3)
      .map((t) => ({ ...t, person: personMap.get(t.personId) }));
  }, [txs, rows]);

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
      .filter(
        (t) =>
          (t.notes && t.notes.toLowerCase().includes(q)) ||
          String(t.amount).includes(q)
      )
      .map((t) => {
        const p = rows.find((r) => r.person.id === t.personId)?.person;
        return { ...t, person: p };
      });

    const chittiResult = chittis
      .filter(
        (c) =>
          (c.name && c.name.toLowerCase().includes(q)) ||
          rows.find((r) => r.person.id === c.organizerId)?.person.name.toLowerCase().includes(q)
      )
      .map((c) => {
        const p = rows.find((r) => r.person.id === c.organizerId)?.person;
        return { ...c, organizer: p };
      });

    return {
      people: peopleResult,
      transactions: txResult,
      chittis: chittiResult,
    };
  }, [searchQuery, rows, txs, chittis]);

  if (isLoading) return <DashboardSkeleton />;
  if (rows.length === 0) return <EmptyState />;

  const net = (totals?.toReceive ?? 0) - (totals?.toPay ?? 0);
  const recovery = totals?.recoveryRate ?? 0;

  return (
    <div className="space-y-4 pt-2">
      {/* Search Header */}
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">{todayLabel()}</p>
            <h1 className="text-xl font-bold">{greeting()} 👋</h1>
          </div>
          {/* Quick Keyboard shortcuts hint */}
          <div className="hidden sm:flex items-center gap-1 text-[10px] text-muted-foreground bg-white/5 px-2 py-1 rounded-md">
            <Keyboard className="h-3 w-3" />
            <span>Shortcuts: <kbd className="font-semibold">/</kbd> search, <kbd className="font-semibold">N</kbd> add</span>
          </div>
        </div>

        <div className="relative">
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
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Search Results</h2>
              <button onClick={() => setSearchQuery("")} className="text-xs text-primary">Clear search</button>
            </div>

            {/* People Results */}
            {searchResults.people.length > 0 && (
              <GlassCard className="p-3 space-y-2">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground pb-1 border-b border-white/5">
                  <Users className="h-3.5 w-3.5" /> People
                </div>
                <div className="divide-y divide-white/5">
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
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground pb-1 border-b border-white/5">
                  <Layers className="h-3.5 w-3.5" /> Transactions
                </div>
                <div className="divide-y divide-white/5">
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
                      <span
                        className={cn(
                          "font-semibold tabular-nums",
                          (t.type === "lent" || t.type === "repayment_out")
                            ? "text-[oklch(0.85_0.18_155)]"
                            : "text-[oklch(0.85_0.22_22)]"
                        )}
                      >
                        {(t.type === "lent" || t.type === "repayment_out") ? "+" : "−"}
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
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground pb-1 border-b border-white/5">
                  <Coins className="h-3.5 w-3.5" /> Chittis
                </div>
                <div className="divide-y divide-white/5">
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

            {searchResults.people.length === 0 &&
              searchResults.transactions.length === 0 &&
              searchResults.chittis.length === 0 && (
                <GlassCard className="p-8 text-center text-sm text-muted-foreground">
                  No matching records found for "{searchQuery}".
                </GlassCard>
              )}
          </div>
        ) : (
          /* STANDARD DASHBOARD STATE */
          <div className="space-y-4 animate-in fade-in duration-150 ease-out">
            {/* Net balance hero */}
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-200 ease-out">
              <GlassCard strong className="relative overflow-hidden p-5">
                {/* Ambient glow */}
                <div className="pointer-events-none absolute -right-16 -top-16 h-52 w-52 rounded-full bg-primary/12 blur-3xl" />
                <div className="pointer-events-none absolute -left-10 -bottom-10 h-36 w-36 rounded-full bg-accent/8 blur-2xl" />

                <p className="relative text-[11px] uppercase tracking-widest text-muted-foreground">Net balance</p>
                <p className={cn(
                  "relative mt-1 text-4xl font-bold tabular-nums",
                  net > 0 ? "text-[oklch(0.85_0.18_155)]" : net < 0 ? "text-[oklch(0.78_0.22_22)]" : "text-muted-foreground"
                )}>
                  {net === 0 ? "All clear" : (net > 0 ? "+" : "−") + fmt(Math.abs(net))}
                </p>
                <p className="relative mt-0.5 text-xs text-muted-foreground">
                  {net > 0 ? "people owe you overall" : net < 0 ? "you owe overall" : "everything settled"}
                </p>

                {/* To receive / To pay */}
                <div className="relative mt-4 grid grid-cols-2 gap-2.5">
                  <div className="glass rounded-2xl p-3">
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <ArrowDownLeft className="h-3 w-3 text-[oklch(0.85_0.18_155)]" />
                      To receive
                    </div>
                    <div className="mt-1 text-base font-semibold tabular-nums text-[oklch(0.85_0.18_155)]">
                      {fmt(totals?.toReceive ?? 0)}
                    </div>
                  </div>
                  <div className="glass rounded-2xl p-3">
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <ArrowUpRight className="h-3 w-3 text-[oklch(0.78_0.22_22)]" />
                      To pay
                    </div>
                    <div className="mt-1 text-base font-semibold tabular-nums text-[oklch(0.78_0.22_22)]">
                      {fmt(totals?.toPay ?? 0)}
                    </div>
                  </div>
                </div>

                {/* Recovery rate bar */}
                {(totals?.lifetimeLent ?? 0) > 0 && (
                  <div className="relative mt-4">
                    <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" /> Recovery rate
                      </span>
                      <span className="tabular-nums font-medium text-foreground">{Math.round(recovery)}%</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/8">
                      <div
                        className="h-full rounded-full bg-[oklch(0.78_0.17_155)] transition-[width] duration-700 ease-out"
                        style={{ width: `${recovery}%` }}
                      />
                    </div>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {fmt(totals?.lifetimeReceived ?? 0)} received back of {fmt(totals?.lifetimeLent ?? 0)} lent
                    </p>
                  </div>
                )}
              </GlassCard>
            </div>


            {/* Overdue alert */}
            {overdueCount > 0 && (
              <div className="animate-in fade-in zoom-in-95 duration-150 ease-out">
                <Link to="/people">
                  <GlassCard className="flex items-center gap-3 border border-orange-500/30 p-3.5">
                    <AlertCircle className="h-4 w-4 shrink-0 text-orange-400" />
                    <div className="flex-1 text-sm">
                      <span className="font-semibold text-orange-400">{overdueCount} overdue</span>
                      <span className="text-muted-foreground"> — tap to review</span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </GlassCard>
                </Link>
              </div>
            )}


            {/* Upcoming Payments */}
            {upcomingPayments.length > 0 && (
              <section>
                <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Upcoming Payments
                </p>
                <GlassCard className="divide-y divide-border/40 overflow-hidden p-0">
                  {upcomingPayments.map((t) => {
                    const isLent = t.type === "lent";
                    return (
                      <Link
                        key={t.id}
                        to="/people/$personId"
                        params={{ personId: t.personId }}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-white/3 transition-colors"
                      >
                        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-white/5 text-xs font-semibold">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium capitalize">{t.person?.name ?? "—"}</div>
                          <div className="text-xs text-muted-foreground">
                            Due on {new Date(t.dueDate!).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                          </div>
                        </div>
                        <div className={cn(
                          "text-sm font-semibold tabular-nums",
                          isLent ? "text-[oklch(0.85_0.18_155)]" : "text-[oklch(0.78_0.22_22)]"
                        )}>
                          {isLent ? "+" : "−"}{fmt(t.amount)}
                        </div>
                      </Link>
                    );
                  })}
                </GlassCard>
              </section>
            )}

            {/* Attention: top debtor */}
            {topDebtor && (
              <section>
                <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Owes you the most
                </p>
                <AttentionCard row={topDebtor} tone="receive" fmt={fmt} />
              </section>
            )}

            {/* Attention: top creditor */}
            {topCreditor && (
              <section>
                <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  You owe the most to
                </p>
                <AttentionCard row={topCreditor} tone="pay" fmt={fmt} />
              </section>
            )}

            {/* Recent activity */}
            {recent.length > 0 && (
              <section>
                <div className="mb-2 flex items-center justify-between px-1">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recent</p>
                  <Link to="/analytics" className="text-xs text-primary">See insights →</Link>
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
                        className="flex items-center gap-3 px-4 py-3 hover:bg-white/3 transition-colors"
                      >
                        <div className={cn(
                          "grid h-8 w-8 shrink-0 place-items-center rounded-xl text-xs font-bold",
                          positive
                            ? "bg-[oklch(0.78_0.17_155/0.18)] text-[oklch(0.85_0.18_155)]"
                            : "bg-[oklch(0.78_0.22_22/0.18)] text-[oklch(0.85_0.22_22)]",
                        )}>
                          {t.person ? initials(t.person.name) : "?"}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium capitalize">{t.person?.name ?? "—"}</div>
                          <div className="text-xs text-muted-foreground">
                            {labels[t.type]} · {relativeDate(t.date)}
                          </div>
                        </div>
                        <div className={cn(
                          "text-sm font-semibold tabular-nums",
                          positive ? "text-[oklch(0.85_0.18_155)]" : "text-[oklch(0.78_0.22_22)]"
                        )}>
                          {positive ? "+" : "−"}{fmt(t.amount)}
                        </div>
                      </Link>
                    );
                  })}
                </GlassCard>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function AttentionCard({ row, tone, fmt }: { row: PersonRow; tone: "receive" | "pay"; fmt: (n: number) => string }) {
  const isReceive = tone === "receive";
  const amount = Math.abs(row.balance.outstanding);
  return (
    <Link to="/people/$personId" params={{ personId: row.person.id }}>
      <GlassCard className={cn(
        "flex items-center gap-4 p-4 transition-transform active:scale-[0.98]",
        isReceive ? "border-[oklch(0.78_0.17_155/0.2)]" : "border-[oklch(0.78_0.22_22/0.2)]"
      )}>
        {/* Avatar */}
        <div className={cn(
          "grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-base font-bold",
          isReceive
            ? "bg-[oklch(0.78_0.17_155/0.15)] text-[oklch(0.85_0.18_155)]"
            : "bg-[oklch(0.78_0.22_22/0.15)] text-[oklch(0.85_0.22_22)]"
        )}>
          {initials(row.person.name)}
        </div>
        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold capitalize">{row.person.name}</div>
          <div className="text-xs text-muted-foreground">
            {row.balance.activeCount} active · last {relativeDate(row.balance.lastActivity)}
          </div>
        </div>
        {/* Amount */}
        <div className="text-right">
          <div className={cn(
            "text-lg font-bold tabular-nums",
            isReceive ? "text-[oklch(0.85_0.18_155)]" : "text-[oklch(0.78_0.22_22)]"
          )}>
            {fmt(amount)}
          </div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
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
          Record what you lend or borrow, and Ledge keeps all balances tidy. Fully offline. Always private.
        </p>
        <p className="mt-4 text-xs text-muted-foreground">
          Tap the <span className="font-bold text-primary">+</span> button to get started.
        </p>
      </GlassCard>
    </div>
  );
}

