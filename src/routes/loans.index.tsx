import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Banknote,
  Building2,
  CalendarClock,
  Car,
  ChevronRight,
  Home,
  Plus,
  Wallet,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { ClientOnly } from "@/components/common/ClientOnly";
import { GlassCard } from "@/components/common/GlassCard";
import { WebModal } from "@/components/common/WebModal";
import { Button } from "@/components/ui/button";
import { LoanForm } from "@/components/forms/LoanForm";
import { useLedge } from "@/features/dataProvider";
import { useFormatMoney } from "@/lib/formatters";
import { loanScheduledRemaining, loanTotalPaid } from "@/lib/loanUtils";
import type { Loan, LoanKind, LoanMonthlyPayment } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/loans/")({
  head: () => ({ meta: [{ title: "Loans — Ledge" }] }),
  component: () => (
    <AppShell>
      <ClientOnly>
        <LoansList />
      </ClientOnly>
    </AppShell>
  ),
});

const TYPE_META: Record<LoanKind, { label: string; icon: typeof Home }> = {
  house: { label: "House", icon: Home },
  car: { label: "Car", icon: Car },
  personal: { label: "Personal", icon: Banknote },
  other: { label: "Other", icon: Building2 },
};

function LoansList() {
  const { loans, loanPayments, isLoading } = useLedge();
  const fmt = useFormatMoney();
  const [creating, setCreating] = useState(false);

  const paymentsByLoan = useMemo(() => {
    const map = new Map<string, LoanMonthlyPayment[]>();
    for (const payment of loanPayments) {
      const list = map.get(payment.loanId) ?? [];
      list.push(payment);
      map.set(payment.loanId, list);
    }
    return map;
  }, [loanPayments]);

  const active = loans.filter((loan) => loan.status === "active");
  const past = loans.filter((loan) => loan.status !== "active");
  const scheduledRemaining = active.reduce(
    (sum, loan) => sum + loanScheduledRemaining(loan, paymentsByLoan.get(loan.id) ?? []),
    0,
  );
  const monthlyCommitment = active.reduce((sum, loan) => sum + loan.monthlyAmount, 0);

  if (isLoading && loans.length === 0) {
    return <div className="mt-2 h-60 animate-pulse rounded-3xl bg-muted/30" />;
  }

  return (
    <div className="space-y-4 pt-2">
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">Loans</h1>
          <p className="text-sm text-muted-foreground">Track your house, car, and other EMIs.</p>
        </div>
        <Button
          size="sm"
          onClick={() => setCreating(true)}
          className="shrink-0 gap-1.5 rounded-full"
        >
          <Plus className="h-4 w-4" /> Add loan
        </Button>
      </header>

      {active.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2">
          <GlassCard strong className="relative overflow-hidden p-4">
            <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-primary/10 blur-2xl" />
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
              <Wallet className="h-3.5 w-3.5 text-primary" /> Scheduled remaining
            </div>
            <div className="mt-1 text-2xl font-bold tabular-nums">{fmt(scheduledRemaining)}</div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Across {active.length} active loan{active.length === 1 ? "" : "s"}
            </p>
          </GlassCard>
          <GlassCard className="p-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
              <CalendarClock className="h-3.5 w-3.5 text-accent" /> Monthly EMIs
            </div>
            <div className="mt-1 text-2xl font-bold tabular-nums">{fmt(monthlyCommitment)}</div>
            <p className="mt-0.5 text-xs text-muted-foreground">Planned each month</p>
          </GlassCard>
        </div>
      )}

      {loans.length === 0 && (
        <GlassCard className="flex flex-col items-center gap-3 p-10 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-3xl bg-primary/12 text-primary">
            <Building2 className="h-7 w-7" />
          </div>
          <div>
            <h2 className="font-semibold">No loans tracked yet</h2>
            <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">
              Add a house, car, or personal loan, then record each monthly payment as it happens.
            </p>
          </div>
          <Button onClick={() => setCreating(true)} className="gap-2 rounded-full">
            <Plus className="h-4 w-4" /> Add your first loan
          </Button>
        </GlassCard>
      )}

      {active.length > 0 && (
        <section className="space-y-2">
          <h2 className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Active loans
          </h2>
          {active.map((loan) => (
            <LoanCard
              key={loan.id}
              loan={loan}
              payments={paymentsByLoan.get(loan.id) ?? []}
              fmt={fmt}
            />
          ))}
        </section>
      )}

      {past.length > 0 && (
        <section className="space-y-2">
          <h2 className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Past loans
          </h2>
          {past.map((loan) => (
            <LoanCard
              key={loan.id}
              loan={loan}
              payments={paymentsByLoan.get(loan.id) ?? []}
              fmt={fmt}
            />
          ))}
        </section>
      )}

      <WebModal open={creating} onClose={() => setCreating(false)} title="Add a loan">
        <LoanForm onDone={() => setCreating(false)} />
      </WebModal>
    </div>
  );
}

function LoanCard({
  loan,
  payments,
  fmt,
}: {
  loan: Loan;
  payments: LoanMonthlyPayment[];
  fmt: (amount: number) => string;
}) {
  const meta = TYPE_META[loan.kind] ?? TYPE_META.other;
  const Icon = meta.icon;
  const totalScheduled = loan.monthlyAmount * loan.totalMonths;
  const paid = loanTotalPaid(payments);
  const remaining = loanScheduledRemaining(loan, payments);
  const progress = Math.min(100, Math.round((paid / Math.max(totalScheduled, 1)) * 100));

  return (
    <Link to="/loans/$loanId" params={{ loanId: loan.id }} className="block">
      <GlassCard
        className={cn(
          "p-4 transition-transform active:scale-[0.99]",
          loan.status !== "active" && "opacity-75",
        )}
      >
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[38%] bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h3 className="truncate font-semibold">{loan.name}</h3>
                <p className="truncate text-xs text-muted-foreground">
                  {meta.label} · {loan.lender}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div>
                <p className="text-muted-foreground">Scheduled remaining</p>
                <p className="mt-0.5 font-semibold tabular-nums">{fmt(remaining)}</p>
              </div>
              <div className="text-right">
                <p className="text-muted-foreground">Monthly EMI</p>
                <p className="mt-0.5 font-semibold tabular-nums">{fmt(loan.monthlyAmount)}</p>
              </div>
            </div>
            <div className="mt-3">
              <div className="mb-1 flex justify-between text-[10px] text-muted-foreground">
                <span>{payments.length} payment months recorded</span>
                <span>{progress}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
              </div>
            </div>
          </div>
        </div>
      </GlassCard>
    </Link>
  );
}
