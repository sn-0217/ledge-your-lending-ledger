import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { GlassCard } from "@/components/common/GlassCard";
import { ClientOnly } from "@/components/common/ClientOnly";
import { WebModal } from "@/components/common/WebModal";
import { Button } from "@/components/ui/button";
import { useChittis } from "@/lib/chittiQueries";
import { usePeople } from "@/lib/queries";
import { useFormatMoney, initials } from "@/lib/formatters";
import {
  PiggyBank, Plus, ChevronRight, Calendar, Coins,
  CheckCircle2, Clock, XCircle, Trophy,
} from "lucide-react";
import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import type { Chitti } from "@/lib/types";
import { ChittiForm } from "@/components/forms/ChittiForm";

export const Route = createFileRoute("/chitti")({
  head: () => ({ meta: [{ title: "Chitti — Ledge" }] }),
  component: () => (
    <AppShell>
      <ClientOnly>
        <ChittiList />
      </ClientOnly>
    </AppShell>
  ),
});

const STATUS_META = {
  active: { label: "Active", icon: Clock, color: "text-primary", bg: "bg-primary/15" },
  completed: { label: "Completed", icon: CheckCircle2, color: "text-[oklch(0.78_0.17_155)]", bg: "bg-[oklch(0.78_0.17_155/0.15)]" },
  cancelled: { label: "Cancelled", icon: XCircle, color: "text-muted-foreground", bg: "bg-muted/40" },
};

function ChittiList() {
  const chittis = useChittis();
  const people = usePeople();
  const fmt = useFormatMoney();
  const [creating, setCreating] = useState(false);

  const peopleById = useMemo(() => new Map((people ?? []).map((p) => [p.id, p])), [people]);

  const dashboard = useMemo(() => {
    if (!chittis) return null;
    const active = chittis.filter((c) => c.status === "active");
    const totalMonthlyDue = active.reduce((s, c) => s + c.monthlyAmount * c.numChits, 0);
    const totalChits = active.reduce((s, c) => s + c.numChits, 0);
    const availed = active.filter((c) => c.availed).length;
    const notAvailed = active.length - availed;
    return { active: active.length, totalMonthlyDue, totalChits, availed, notAvailed };
  }, [chittis]);

  if (!chittis || !people) {
    return <div className="h-60 animate-pulse rounded-3xl bg-muted/30 mt-2" />;
  }

  const active = chittis.filter((c) => c.status === "active");
  const others = chittis.filter((c) => c.status !== "active");

  return (
    <div className="space-y-4 pt-2">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Chitti</h1>
          <p className="text-sm text-muted-foreground">My chitfund participation.</p>
        </div>
        <Button size="sm" onClick={() => setCreating(true)} className="gap-1.5 rounded-full">
          <Plus className="h-4 w-4" /> Add
        </Button>
      </header>

      {/* Dashboard */}
      {dashboard && dashboard.active > 0 && (
        <div className="space-y-2">
          <GlassCard strong className="relative overflow-hidden p-4">
            <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-accent/10 blur-3xl" />
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Monthly commitment</div>
            <div className="mt-1 text-3xl font-bold text-accent">{fmt(dashboard.totalMonthlyDue)}</div>
            <div className="text-xs text-muted-foreground">across {dashboard.totalChits} chit{dashboard.totalChits !== 1 ? "s" : ""} in {dashboard.active} chitti{dashboard.active !== 1 ? "s" : ""}</div>
          </GlassCard>
          <div className="grid grid-cols-2 gap-2">
            <GlassCard className="p-3 text-center">
              <div className="flex items-center justify-center gap-1.5 text-[oklch(0.85_0.18_155)]">
                <Trophy className="h-4 w-4" />
                <span className="text-xl font-bold">{dashboard.availed}</span>
              </div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Already availed</div>
            </GlassCard>
            <GlassCard className="p-3 text-center">
              <div className="flex items-center justify-center gap-1.5 text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span className="text-xl font-bold">{dashboard.notAvailed}</span>
              </div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Yet to avail</div>
            </GlassCard>
          </div>
        </div>
      )}

      {/* Empty */}
      {chittis.length === 0 && (
        <GlassCard className="flex flex-col items-center gap-3 p-10 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-3xl bg-accent/20 text-accent">
            <PiggyBank className="h-7 w-7" />
          </div>
          <h2 className="font-semibold">No chittis yet</h2>
          <p className="max-w-xs text-sm text-muted-foreground">
            Track your chitfund participations — who organizes them, how much you pay monthly, and whether you've availed.
          </p>
          <Button onClick={() => setCreating(true)} className="gap-2 rounded-full">
            <Plus className="h-4 w-4" /> Add chitti
          </Button>
        </GlassCard>
      )}

      {/* Active chittis */}
      {active.length > 0 && (
        <section className="space-y-2">
          <p className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Active</p>
          {active.map((c, i) => (
            <ChittiCard key={c.id} chitti={c} organizer={peopleById.get(c.organizerId)} fmt={fmt} index={i} />
          ))}
        </section>
      )}

      {/* Past chittis */}
      {others.length > 0 && (
        <section className="space-y-2">
          <p className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Past</p>
          {others.map((c, i) => (
            <ChittiCard key={c.id} chitti={c} organizer={peopleById.get(c.organizerId)} fmt={fmt} index={i} />
          ))}
        </section>
      )}

      <WebModal open={creating} onClose={() => setCreating(false)} title="Add chitti">
        <ChittiForm onDone={() => setCreating(false)} />
      </WebModal>
    </div>
  );
}

function ChittiCard({
  chitti, organizer, fmt, index,
}: {
  chitti: Chitti;
  organizer: ReturnType<typeof usePeople> extends (infer T)[] | undefined ? T : never;
  fmt: (n: number) => string;
  index: number;
}) {
  const status = STATUS_META[chitti.status as keyof typeof STATUS_META] ?? STATUS_META.active;
  const StatusIcon = status.icon;
  const monthly = (chitti.monthlyAmount ?? 0) * (chitti.numChits ?? 1);

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }}>
      <Link to="/chitti/$chittiId" params={{ chittiId: chitti.id }}>
        <GlassCard className={cn("p-4 transition-transform active:scale-[0.98]", chitti.status === "cancelled" && "opacity-60")}>
          <div className="flex items-start gap-3">
            {/* Organizer avatar */}
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-accent/20 text-sm font-bold text-accent">
              {organizer ? initials(organizer.name) : <PiggyBank className="h-5 w-5" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate font-semibold">
                    {chitti.name || (organizer ? `${organizer.name}'s Chitti` : "Chitti")}
                  </div>
                  {organizer && (
                    <div className="text-xs text-muted-foreground capitalize">by {organizer.name}</div>
                  )}
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </div>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Coins className="h-3 w-3" />
                  {fmt(monthly)}/mo
                  {chitti.numChits > 1 && (
                    <span className="text-[10px]">({chitti.numChits} chits × {fmt(chitti.monthlyAmount)})</span>
                  )}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {chitti.totalMonths} months
                </span>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <span className={cn("flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide", status.bg, status.color)}>
                  <StatusIcon className="h-2.5 w-2.5" />
                  {status.label}
                </span>
                {chitti.availed && (
                  <span className="flex items-center gap-1 rounded-full bg-[oklch(0.82_0.16_75/0.2)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[oklch(0.82_0.16_75)]">
                    <Trophy className="h-2.5 w-2.5" /> Availed
                  </span>
                )}
              </div>
            </div>
          </div>
        </GlassCard>
      </Link>
    </motion.div>
  );
}
