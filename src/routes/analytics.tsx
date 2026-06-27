import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { GlassCard } from "@/components/common/GlassCard";
import { ClientOnly } from "@/components/common/ClientOnly";
import { useAllPersonRows, useAllTransactions } from "@/lib/queries";
import { useFormatMoney, initials, relativeDate } from "@/lib/formatters";
import { useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";
import { TrendingUp, TrendingDown, ArrowDownLeft, ArrowUpRight, Users, Activity } from "lucide-react";

export const Route = createFileRoute("/analytics")({
  head: () => ({ meta: [{ title: "Insights — Ledge" }] }),
  component: () => (
    <AppShell>
      <ClientOnly>
        <Analytics />
      </ClientOnly>
    </AppShell>
  ),
});

const GREEN = "oklch(0.78 0.17 155)";
const RED = "oklch(0.72 0.2 22)";
const PURPLE = "oklch(0.72 0.18 280)";
const AMBER = "oklch(0.82 0.16 75)";
const BLUE = "oklch(0.75 0.15 220)";

const CHART_COLORS = [GREEN, PURPLE, AMBER, RED, BLUE, "oklch(0.78 0.12 300)"];

function monthKey(t: number) {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function Analytics() {
  const rows = useAllPersonRows();
  const txs = useAllTransactions();
  const fmt = useFormatMoney();

  const totals = useMemo(() => {
    if (!rows) return null;
    let toReceive = 0, toPay = 0, totalLent = 0, totalBorrowed = 0;
    for (const r of rows) {
      for (const c of r.categories) {
        if (c.balance.outstanding > 0) toReceive += c.balance.outstanding;
        if (c.balance.outstanding < 0) toPay += -c.balance.outstanding;
        totalLent += c.balance.totalLent;
        totalBorrowed += c.balance.totalBorrowed;
      }
    }
    const settled = rows.filter((r) => r.balance.settled).length;
    const active = rows.filter((r) => !r.balance.settled).length;
    return { toReceive, toPay, totalLent, totalBorrowed, settled, active, people: rows.length };
  }, [rows]);

  const monthly = useMemo(() => {
    if (!txs) return [];
    const map = new Map<string, { month: string; lent: number; borrowed: number }>();
    for (const t of txs) {
      const k = monthKey(t.date);
      const cur = map.get(k) ?? { month: k, lent: 0, borrowed: 0 };
      if (t.type === "lent") cur.lent += t.amount;
      if (t.type === "borrowed") cur.borrowed += t.amount;
      map.set(k, cur);
    }
    return Array.from(map.values())
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-6)
      .map((m) => ({
        ...m,
        label: new Date(m.month + "-01").toLocaleDateString(undefined, { month: "short" }),
      }));
  }, [txs]);

  const topDebtors = useMemo(() => {
    if (!rows) return [];
    return rows
      .filter((r) => r.balance.outstanding > 0)
      .sort((a, b) => b.balance.outstanding - a.balance.outstanding)
      .slice(0, 5);
  }, [rows]);

  const topCreditors = useMemo(() => {
    if (!rows) return [];
    return rows
      .filter((r) => r.balance.outstanding < 0)
      .sort((a, b) => a.balance.outstanding - b.balance.outstanding)
      .slice(0, 5);
  }, [rows]);

  const pieData = useMemo(() => {
    if (!rows) return [];
    return rows
      .filter((r) => r.balance.outstanding !== 0)
      .map((r) => ({ name: r.person.name, value: Math.abs(r.balance.outstanding) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [rows]);

  const recentTxs = useMemo(() => {
    if (!txs || !rows) return [];
    const personMap = new Map(rows.map((r) => [r.person.id, r.person.name]));
    return [...txs]
      .sort((a, b) => b.date - a.date)
      .slice(0, 5)
      .map((t) => ({ ...t, personName: personMap.get(t.personId) ?? "Unknown" }));
  }, [txs, rows]);

  if (!rows || !txs) {
    return (
      <div className="space-y-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-3xl bg-muted/30" />
        ))}
      </div>
    );
  }

  const net = (totals?.toReceive ?? 0) - (totals?.toPay ?? 0);

  return (
    <div className="space-y-5">
      <header className="pt-2">
        <h1 className="text-2xl font-bold">Insights</h1>
        <p className="text-sm text-muted-foreground">Your lending at a glance.</p>
      </header>

      {/* Summary stat pills */}
      <div className="grid grid-cols-2 gap-3">
        <GlassCard strong className="relative overflow-hidden p-4">
          <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-[oklch(0.78_0.17_155/0.15)] blur-2xl" />
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ArrowDownLeft className="h-3.5 w-3.5 text-[oklch(0.78_0.17_155)]" />
            To receive
          </div>
          <div className="mt-1 text-xl font-bold tabular-nums text-[oklch(0.85_0.18_155)]">
            {fmt(totals?.toReceive ?? 0)}
          </div>
        </GlassCard>
        <GlassCard strong className="relative overflow-hidden p-4">
          <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-[oklch(0.78_0.22_22/0.15)] blur-2xl" />
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ArrowUpRight className="h-3.5 w-3.5 text-[oklch(0.78_0.22_22)]" />
            To pay
          </div>
          <div className="mt-1 text-xl font-bold tabular-nums text-[oklch(0.78_0.22_22)]">
            {fmt(totals?.toPay ?? 0)}
          </div>
        </GlassCard>
        <GlassCard className="p-4">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <TrendingUp className="h-3.5 w-3.5" /> Total lent
          </div>
          <div className="mt-1 text-lg font-bold tabular-nums">{fmt(totals?.totalLent ?? 0)}</div>
        </GlassCard>
        <GlassCard className="p-4">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <TrendingDown className="h-3.5 w-3.5" /> Total borrowed
          </div>
          <div className="mt-1 text-lg font-bold tabular-nums">{fmt(totals?.totalBorrowed ?? 0)}</div>
        </GlassCard>
      </div>

      {/* People stats */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "People", value: totals?.people ?? 0, icon: Users },
          { label: "Active", value: totals?.active ?? 0, color: "text-[oklch(0.78_0.22_22)]" },
          { label: "Settled", value: totals?.settled ?? 0, color: "text-[oklch(0.78_0.17_155)]" },
        ].map(({ label, value, icon: Icon, color }) => (
          <GlassCard key={label} className="p-3 text-center">
            <div className={cn("text-2xl font-bold tabular-nums", color)}>{value}</div>
            <div className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
          </GlassCard>
        ))}
      </div>

      {/* Net balance hero */}
      <GlassCard strong className="relative overflow-hidden p-5">
        <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />
        <div className="text-xs uppercase tracking-widest text-muted-foreground">Net position</div>
        <div className={cn(
          "mt-1 text-4xl font-bold tabular-nums",
          net > 0 ? "text-[oklch(0.85_0.18_155)]" : net < 0 ? "text-[oklch(0.78_0.22_22)]" : "text-muted-foreground"
        )}>
          {net === 0 ? "Settled" : (net > 0 ? "+" : "−") + fmt(Math.abs(net))}
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          {net > 0 ? "Overall, people owe you more than you owe." :
           net < 0 ? "Overall, you owe more than people owe you." :
           "Everything is perfectly balanced."}
        </div>
      </GlassCard>

      {/* Lending trend – area chart */}
      {monthly.length > 0 && (
        <GlassCard className="overflow-hidden p-4">
          <h2 className="mb-0.5 text-sm font-semibold">Lending trend</h2>
          <p className="mb-4 text-xs text-muted-foreground">Amount lent over last 6 months</p>
          <div className="h-44">
            <ResponsiveContainer>
              <AreaChart data={monthly} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="lentGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.75 0.15 220)" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="oklch(0.75 0.15 220)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 0.06)" vertical={false} />
                <XAxis dataKey="label" stroke="currentColor" fontSize={11} tickLine={false} axisLine={false} tick={{ fill: "oklch(0.65 0.02 260)" }} />
                <Tooltip
                  cursor={{ stroke: "oklch(0.75 0.15 220 / 0.4)", strokeWidth: 1 }}
                  contentStyle={{ background: "oklch(0.1 0.01 260)", border: "1px solid oklch(1 0 0 / 0.1)", borderRadius: 12, fontSize: 12 }}
                  formatter={(v: number) => [fmt(v), "Lent"]}
                />
                <Area
                  type="monotone"
                  dataKey="lent"
                  stroke="oklch(0.75 0.15 220)"
                  strokeWidth={2}
                  fill="url(#lentGrad)"
                  dot={false}
                  activeDot={{ r: 4, fill: "oklch(0.75 0.15 220)", strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>
      )}

      {/* Repayments received – line chart */}
      {monthly.length > 0 && (
        <GlassCard className="overflow-hidden p-4">
          <h2 className="mb-0.5 text-sm font-semibold">Borrowing trend</h2>
          <p className="mb-4 text-xs text-muted-foreground">Amount borrowed over last 6 months</p>
          <div className="h-44">
            <ResponsiveContainer>
              <LineChart data={monthly} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 0.06)" vertical={false} />
                <XAxis dataKey="label" stroke="currentColor" fontSize={11} tickLine={false} axisLine={false} tick={{ fill: "oklch(0.65 0.02 260)" }} />
                <Tooltip
                  cursor={{ stroke: `${GREEN}66`, strokeWidth: 1 }}
                  contentStyle={{ background: "oklch(0.1 0.01 260)", border: "1px solid oklch(1 0 0 / 0.1)", borderRadius: 12, fontSize: 12 }}
                  formatter={(v: number) => [fmt(v), "Borrowed"]}
                />
                <Line
                  type="monotone"
                  dataKey="borrowed"
                  stroke={GREEN}
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: GREEN, strokeWidth: 0 }}
                  activeDot={{ r: 6, fill: GREEN, strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>
      )}

      {/* Outstanding distribution pie */}
      {pieData.length > 0 && (
        <GlassCard className="p-4">
          <h2 className="mb-1 text-sm font-semibold">Outstanding by person</h2>
          <p className="mb-3 text-xs text-muted-foreground">Who holds the most balance</p>
          <div className="grid grid-cols-[1fr_auto] items-center gap-4">
            <div className="h-44">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={44} outerRadius={70} paddingAngle={3}>
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: number) => fmt(v)}
                    contentStyle={{ background: "oklch(0.12 0.012 260)", border: "1px solid oklch(1 0 0 / 0.1)", borderRadius: 12, fontSize: 12 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="space-y-2 pr-1">
              {pieData.map((d, i) => (
                <li key={d.name} className="flex items-center gap-2 text-xs">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                  <span className="max-w-[72px] truncate capitalize">{d.name}</span>
                </li>
              ))}
            </ul>
          </div>
        </GlassCard>
      )}

      {/* Who owes you most */}
      {topDebtors.length > 0 && (
        <GlassCard className="p-4">
          <h2 className="mb-3 text-sm font-semibold">They owe you</h2>
          <ul className="space-y-2">
            {topDebtors.map((r, i) => (
              <Link key={r.person.id} to="/people/$personId" params={{ personId: r.person.id }}>
                <li className="flex items-center gap-3 rounded-xl px-1 py-1.5 hover:bg-white/5">
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary/30 to-accent/30 text-xs font-bold">
                    {initials(r.person.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium capitalize">{r.person.name}</div>
                    <div className="text-xs text-muted-foreground">{relativeDate(r.balance.lastActivity)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold tabular-nums text-[oklch(0.85_0.18_155)]">
                      {fmt(r.balance.outstanding)}
                    </div>
                    <div className="text-[10px] text-muted-foreground">#{i + 1}</div>
                  </div>
                </li>
              </Link>
            ))}
          </ul>
        </GlassCard>
      )}

      {/* You owe */}
      {topCreditors.length > 0 && (
        <GlassCard className="p-4">
          <h2 className="mb-3 text-sm font-semibold">You owe them</h2>
          <ul className="space-y-2">
            {topCreditors.map((r, i) => (
              <Link key={r.person.id} to="/people/$personId" params={{ personId: r.person.id }}>
                <li className="flex items-center gap-3 rounded-xl px-1 py-1.5 hover:bg-white/5">
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-destructive/20 to-orange-500/20 text-xs font-bold">
                    {initials(r.person.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium capitalize">{r.person.name}</div>
                    <div className="text-xs text-muted-foreground">{relativeDate(r.balance.lastActivity)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold tabular-nums text-[oklch(0.78_0.22_22)]">
                      {fmt(Math.abs(r.balance.outstanding))}
                    </div>
                    <div className="text-[10px] text-muted-foreground">#{i + 1}</div>
                  </div>
                </li>
              </Link>
            ))}
          </ul>
        </GlassCard>
      )}

      {/* Recent activity */}
      {recentTxs.length > 0 && (
        <GlassCard className="p-4">
          <div className="mb-3 flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Recent activity</h2>
          </div>
          <ul className="divide-y divide-border/50">
            {recentTxs.map((t) => {
              const positive = t.type === "lent" || t.type === "repayment_out";
              const labels: Record<string, string> = {
                lent: "Lent", borrowed: "Borrowed", repayment_in: "Received", repayment_out: "Paid",
              };
              return (
                <li key={t.id} className="flex items-center gap-3 py-2.5">
                  <div className={cn(
                    "grid h-8 w-8 shrink-0 place-items-center rounded-xl text-xs font-bold",
                    positive ? "bg-[oklch(0.78_0.17_155/0.18)] text-[oklch(0.85_0.18_155)]"
                             : "bg-[oklch(0.78_0.22_22/0.18)] text-[oklch(0.85_0.22_22)]"
                  )}>
                    {labels[t.type][0]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium capitalize">{t.personName}</div>
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
                </li>
              );
            })}
          </ul>
        </GlassCard>
      )}

      {rows.length === 0 && (
        <GlassCard className="p-10 text-center text-sm text-muted-foreground">
          No data yet. Add people and transactions to see insights.
        </GlassCard>
      )}
    </div>
  );
}
