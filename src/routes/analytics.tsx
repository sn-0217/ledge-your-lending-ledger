import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { GlassCard } from "@/components/common/GlassCard";
import { ClientOnly } from "@/components/common/ClientOnly";
import { useAllPersonRows, useAllTransactions } from "@/lib/queries";
import { useFormatMoney } from "@/lib/formatters";
import { useMemo } from "react";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

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
  "oklch(0.78 0.17 155)",
  "oklch(0.72 0.18 280)",
  "oklch(0.82 0.16 75)",
  "oklch(0.7 0.2 22)",
  "oklch(0.75 0.15 220)",
];

function monthKey(t: number) {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function Analytics() {
  const rows = useAllPersonRows();
  const txs = useAllTransactions();
  const fmt = useFormatMoney();

  const monthly = useMemo(() => {
    if (!txs) return [];
    const map = new Map<string, { month: string; lent: number; borrowed: number; received: number; paid: number }>();
    for (const t of txs) {
      const k = monthKey(t.date);
      const cur = map.get(k) ?? { month: k, lent: 0, borrowed: 0, received: 0, paid: 0 };
      if (t.type === "lent") cur.lent += t.amount;
      if (t.type === "borrowed") cur.borrowed += t.amount;
      if (t.type === "repayment_in") cur.received += t.amount;
      if (t.type === "repayment_out") cur.paid += t.amount;
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

  const distribution = useMemo(() => {
    if (!rows) return [];
    return rows
      .filter((r) => r.balance.outstanding !== 0)
      .map((r) => ({
        name: r.person.name,
        value: Math.abs(r.balance.outstanding),
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [rows]);

  if (!rows || !txs) {
    return <div className="h-40 animate-pulse rounded-3xl bg-muted/30" />;
  }

  return (
    <div className="space-y-5">
      <header className="pt-2">
        <h1 className="text-2xl font-bold">Insights</h1>
        <p className="text-sm text-muted-foreground">Your money in motion.</p>
      </header>

      <GlassCard strong className="p-4">
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Last 6 months</h2>
        {monthly.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">No activity yet.</div>
        ) : (
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={monthly}>
                <XAxis dataKey="label" stroke="currentColor" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis hide />
                <Tooltip
                  cursor={{ fill: "oklch(1 0 0 / 0.05)" }}
                  contentStyle={{
                    background: "oklch(0.12 0.012 260)",
                    border: "1px solid oklch(1 0 0 / 0.1)",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                  formatter={(v: number) => fmt(v)}
                />
                <Bar dataKey="lent" fill={CHART_COLORS[0]} radius={[6, 6, 0, 0]} />
                <Bar dataKey="borrowed" fill={CHART_COLORS[3]} radius={[6, 6, 0, 0]} />
                <Bar dataKey="received" fill={CHART_COLORS[1]} radius={[6, 6, 0, 0]} />
                <Bar dataKey="paid" fill={CHART_COLORS[2]} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </GlassCard>

      <GlassCard className="p-4">
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Outstanding by person</h2>
        {distribution.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">Nothing outstanding.</div>
        ) : (
          <div className="grid grid-cols-1 items-center gap-3 sm:grid-cols-2">
            <div className="h-48">
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={distribution}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={42}
                    outerRadius={72}
                    paddingAngle={3}
                  >
                    {distribution.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: "oklch(0.12 0.012 260)", border: "1px solid oklch(1 0 0 / 0.1)", borderRadius: 12, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="space-y-1.5">
              {distribution.map((d, i) => (
                <li key={d.name} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
                    />
                    <span className="truncate">{d.name}</span>
                  </span>
                  <span className="font-medium tabular-nums">{fmt(d.value)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </GlassCard>
    </div>
  );
}
