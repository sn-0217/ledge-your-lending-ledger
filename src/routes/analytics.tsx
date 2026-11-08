import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { GlassCard } from "@/components/common/GlassCard";
import { PersonAvatar } from "@/components/common/PersonAvatar";
import { ClientOnly } from "@/components/common/ClientOnly";
import { useAllPersonRows, useAllTransactions } from "@/lib/queries";
import { useFormatMoney, relativeDate } from "@/lib/formatters";
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
import {
  TrendingUp,
  TrendingDown,
  ArrowDownLeft,
  ArrowUpRight,
  Users,
  Activity,
} from "lucide-react";

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

const CHART_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];
const PRIMARY = "var(--color-primary)";

function monthKey(t: number) {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const CustomTooltip = ({ active, payload, label, fmt, name }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="glass rounded-xl p-2.5 border border-glass-border shadow-[0_12px_30px_rgba(0,0,0,0.6)] leading-relaxed text-[11px] animate-in fade-in zoom-in-95 duration-100">
        <p className="font-bold text-muted-foreground uppercase tracking-[0.15em] text-[9px] mb-1">
          {label}
        </p>
        {payload.map((item: any, index: number) => (
          <p
            key={index}
            className="text-xs font-extrabold tabular-nums"
            style={{ color: item.stroke || item.color || "var(--color-primary)" }}
          >
            {name || item.name}: {fmt(item.value)}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

function Analytics() {
  const rows = useAllPersonRows();
  const txs = useAllTransactions();
  const fmt = useFormatMoney();

  const totals = useMemo(() => {
    if (!rows) return null;
    let toReceive = 0,
      toPay = 0,
      totalLent = 0,
      totalBorrowed = 0;
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
    <div className="space-y-5 lg:grid lg:grid-cols-12 lg:items-start lg:gap-5 lg:space-y-0">
      <header className="pt-2 lg:col-span-12">
        <h1 className="text-2xl font-bold">Insights</h1>
        <p className="text-sm text-muted-foreground">Your lending at a glance.</p>
      </header>

      {/* Summary stat pills */}
      <div className="grid grid-cols-2 gap-3 lg:col-span-8 lg:grid-cols-4">
        <GlassCard strong className="relative overflow-hidden p-4">
          <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-receive/15 blur-2xl" />
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ArrowDownLeft className="h-3.5 w-3.5 text-receive" />
            To receive
          </div>
          <div className="mt-1 text-xl font-bold tabular-nums text-foreground">
            {fmt(totals?.toReceive ?? 0)}
          </div>
        </GlassCard>
        <GlassCard strong className="relative overflow-hidden p-4">
          <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-pay/15 blur-2xl" />
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ArrowUpRight className="h-3.5 w-3.5 text-pay" />
            To pay
          </div>
          <div className="mt-1 text-xl font-bold tabular-nums text-foreground">
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
          <div className="mt-1 text-lg font-bold tabular-nums">
            {fmt(totals?.totalBorrowed ?? 0)}
          </div>
        </GlassCard>
      </div>

      {/* People stats */}
      <div className="grid grid-cols-3 gap-2 lg:col-span-4">
        {[
          { label: "People", value: totals?.people ?? 0, icon: Users },
          { label: "Active", value: totals?.active ?? 0, color: "text-primary" },
          { label: "Settled", value: totals?.settled ?? 0, color: "text-success" },
        ].map(({ label, value, icon: Icon, color }) => (
          <GlassCard key={label} className="p-3 text-center">
            <div className={cn("text-2xl font-bold tabular-nums", color)}>{value}</div>
            <div className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
              {label}
            </div>
          </GlassCard>
        ))}
      </div>

      {/* Net balance hero */}
      <GlassCard strong className="relative overflow-hidden p-5 lg:col-span-4">
        <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />
        <div className="text-xs uppercase tracking-widest text-muted-foreground">Net position</div>
        <div className={cn("mt-1 text-4xl font-bold tabular-nums", "text-foreground")}>
          {net === 0 ? "Settled" : (net > 0 ? "+" : "−") + fmt(Math.abs(net))}
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          {net > 0
            ? "Overall, people owe you more than you owe."
            : net < 0
              ? "Overall, you owe more than people owe you."
              : "Everything is perfectly balanced."}
        </div>
      </GlassCard>

      {/* Lending trend – area chart */}
      {monthly.length > 0 && (
        <GlassCard className="overflow-hidden p-4 card-glowing-border lg:col-span-8">
          <h2 className="mb-0.5 text-sm font-semibold">Lending trend</h2>
          <p className="mb-4 text-xs text-muted-foreground">Amount lent over last 6 months</p>
          <div className="h-44">
            <ResponsiveContainer>
              <AreaChart data={monthly} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="lentGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-chart-2)" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="var(--color-chart-2)" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--color-border)"
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  stroke="currentColor"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "var(--color-muted-foreground)" }}
                />
                <Tooltip
                  cursor={{ stroke: "var(--color-chart-2)", strokeWidth: 1 }}
                  content={<CustomTooltip fmt={fmt} name="Lent" />}
                />
                <Area
                  type="monotone"
                  dataKey="lent"
                  stroke="var(--color-chart-2)"
                  strokeWidth={2}
                  fill="url(#lentGrad)"
                  dot={false}
                  activeDot={{ r: 4, fill: "var(--color-chart-2)", strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>
      )}

      {/* Repayments received – line chart */}
      {monthly.length > 0 && (
        <GlassCard className="overflow-hidden p-4 card-glowing-border lg:col-span-6">
          <h2 className="mb-0.5 text-sm font-semibold">Borrowing trend</h2>
          <p className="mb-4 text-xs text-muted-foreground">Amount borrowed over last 6 months</p>
          <div className="h-44">
            <ResponsiveContainer>
              <AreaChart data={monthly} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="borrowGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={PRIMARY} stopOpacity={0.25} />
                    <stop offset="100%" stopColor={PRIMARY} stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--color-border)"
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  stroke="currentColor"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "var(--color-muted-foreground)" }}
                />
                <Tooltip
                  cursor={{ stroke: PRIMARY, strokeWidth: 1 }}
                  content={<CustomTooltip fmt={fmt} name="Borrowed" />}
                />
                <Area
                  type="monotone"
                  dataKey="borrowed"
                  stroke={PRIMARY}
                  strokeWidth={2}
                  fill="url(#borrowGrad)"
                  dot={false}
                  activeDot={{ r: 4, fill: PRIMARY, strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>
      )}

      {/* Outstanding distribution pie */}
      {pieData.length > 0 && (
        <GlassCard className="p-4 lg:col-span-6">
          <h2 className="mb-1 text-sm font-semibold">Outstanding by person</h2>
          <p className="mb-3 text-xs text-muted-foreground">Who holds the most balance</p>
          <div className="grid grid-cols-[1fr_auto] items-center gap-4">
            <div className="h-44">
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={44}
                    outerRadius={70}
                    paddingAngle={3}
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: number) => fmt(v)}
                    contentStyle={{
                      background: "var(--color-popover)",
                      backdropFilter: "blur(8px)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 12,
                      fontSize: 11,
                      boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
                    }}
                    itemStyle={{ color: "var(--color-popover-foreground)", fontWeight: "bold" }}
                    labelStyle={{ color: "var(--color-muted-foreground)" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="space-y-2 pr-1">
              {pieData.map((d, i) => (
                <li key={d.name} className="flex items-center gap-2 text-xs">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
                  />
                  <span className="max-w-[72px] truncate capitalize">{d.name}</span>
                </li>
              ))}
            </ul>
          </div>
        </GlassCard>
      )}

      {/* Who owes you most */}
      {topDebtors.length > 0 && (
        <GlassCard className="p-4 lg:col-span-6">
          <h2 className="mb-3 text-sm font-semibold">They owe you</h2>
          <ul className="space-y-2">
            {topDebtors.map((r, i) => (
              <Link key={r.person.id} to="/people/$personId" params={{ personId: r.person.id }}>
                <li className="flex items-center gap-3 rounded-xl px-1 py-1.5 hover:bg-foreground/5">
                  <PersonAvatar name={r.person.name} seed={r.person.id} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium capitalize">{r.person.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {relativeDate(r.balance.lastActivity)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold tabular-nums text-foreground">
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
        <GlassCard className="p-4 lg:col-span-6">
          <h2 className="mb-3 text-sm font-semibold">You owe them</h2>
          <ul className="space-y-2">
            {topCreditors.map((r, i) => (
              <Link key={r.person.id} to="/people/$personId" params={{ personId: r.person.id }}>
                <li className="flex items-center gap-3 rounded-xl px-1 py-1.5 hover:bg-foreground/5">
                  <PersonAvatar name={r.person.name} seed={r.person.id} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium capitalize">{r.person.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {relativeDate(r.balance.lastActivity)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold tabular-nums text-foreground">
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
        <GlassCard className="p-4 lg:col-span-6">
          <div className="mb-3 flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Recent activity</h2>
          </div>
          <ul className="divide-y divide-border/50">
            {recentTxs.map((t) => {
              const positive = t.type === "lent" || t.type === "repayment_out";
              const labels: Record<string, string> = {
                lent: "Lent",
                borrowed: "Borrowed",
                repayment_in: "Received",
                repayment_out: "Paid",
              };
              return (
                <li key={t.id} className="flex items-center gap-3 py-2.5">
                  <PersonAvatar name={t.personName} seed={t.personId} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium capitalize">{t.personName}</div>
                    <div className="text-xs text-muted-foreground">
                      {labels[t.type]} · {relativeDate(t.date)}
                    </div>
                  </div>
                  <div className={cn("text-sm font-semibold tabular-nums", "text-foreground")}>
                    {positive ? "+" : "−"}
                    {fmt(t.amount)}
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
