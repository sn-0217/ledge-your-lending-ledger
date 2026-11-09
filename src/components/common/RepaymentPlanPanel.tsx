import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Plus,
  WalletCards,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { TransactionForm } from "@/components/forms/TransactionForm";
import { WebModal } from "@/components/common/WebModal";
import { GlassCard } from "@/components/common/GlassCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getDb } from "@/lib/db";
import { useFormatMoney } from "@/lib/formatters";
import { createRepaymentPlan } from "@/lib/repaymentPlanRepositories";
import {
  dateOnly,
  fromLocalDateInput,
  getRepaymentPlanSchedule,
  toLocalDateInput,
  type InstallmentStatus,
  type RepaymentInstallment,
} from "@/lib/repaymentPlanUtils";
import type { Transaction } from "@/lib/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

function nextMonthDateInput() {
  const today = new Date();
  const month = today.getMonth() + 1;
  const lastDay = new Date(today.getFullYear(), month + 1, 0).getDate();
  return toLocalDateInput(
    new Date(today.getFullYear(), month, Math.min(today.getDate(), lastDay)).getTime(),
  );
}

function formatDate(timestamp: number, monthYear = false) {
  return new Date(timestamp).toLocaleDateString(
    undefined,
    monthYear
      ? { month: "long", year: "numeric" }
      : { day: "numeric", month: "short", year: "numeric" },
  );
}

const STATUS_META: Record<
  InstallmentStatus,
  { label: string; className: string; Icon: LucideIcon }
> = {
  paid: { label: "Paid", className: "text-success bg-success/10", Icon: CheckCircle2 },
  partial: { label: "Partially paid", className: "text-warning bg-warning/10", Icon: Clock3 },
  overdue: { label: "Overdue", className: "text-destructive bg-destructive/10", Icon: AlertCircle },
  due: { label: "Due this month", className: "text-primary bg-primary/10", Icon: CalendarDays },
  upcoming: { label: "Upcoming", className: "text-muted-foreground bg-muted", Icon: Clock3 },
  covered: {
    label: "Covered by extra payment",
    className: "text-success bg-success/10",
    Icon: Zap,
  },
};

export function RepaymentPlanPanel({
  personId,
  categoryId,
  outstanding,
  transactions,
}: {
  personId: string;
  categoryId: string;
  outstanding: number;
  transactions: Transaction[];
}) {
  const fmt = useFormatMoney();
  const plans = useLiveQuery(
    () => getDb().repaymentPlans.where("categoryId").equals(categoryId).toArray(),
    [categoryId],
  );
  const plan = plans?.[0];
  const [planOpen, setPlanOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [monthsInput, setMonthsInput] = useState("12");
  const [firstDueDate, setFirstDueDate] = useState(nextMonthDateInput);
  const [selected, setSelected] = useState<RepaymentInstallment | null>(null);
  const [suggestedPayment, setSuggestedPayment] = useState(0);
  const [saving, setSaving] = useState(false);

  if (outstanding >= -0.005 || !plans) return null;
  const owed = Math.abs(outstanding);
  const months = Number(monthsInput);
  const estimatedMonthly = months > 0 ? Math.round((owed / months) * 100) / 100 : 0;
  const schedule = plan ? getRepaymentPlanSchedule(plan, outstanding, transactions) : undefined;

  async function submitPlan() {
    const totalMonths = Number(monthsInput);
    if (!Number.isInteger(totalMonths) || totalMonths < 1 || totalMonths > 600) {
      toast.error("Choose a duration between 1 and 600 months.");
      return;
    }
    try {
      setSaving(true);
      await createRepaymentPlan({
        personId,
        categoryId,
        totalMonths,
        firstDueDate: fromLocalDateInput(firstDueDate),
      });
      setPlanOpen(false);
      toast.success("Monthly repayment schedule created");
    } catch (error) {
      toast.error((error as Error).message || "Could not create schedule");
    } finally {
      setSaving(false);
    }
  }

  function openPayment(installment: RepaymentInstallment) {
    if (!schedule || schedule.remainingBalance <= 0) return;
    setSelected(installment);
    setSuggestedPayment(
      installment.remainingAmount > 0
        ? Math.min(installment.remainingAmount, schedule.remainingBalance)
        : Math.min(schedule.monthlyAmount, schedule.remainingBalance),
    );
    setPaymentOpen(true);
  }

  const planPayments = plan
    ? transactions.filter(
        (item) => item.type === "repayment_out" && item.repaymentPlanId === plan.id,
      )
    : [];

  return (
    <div className="space-y-4">
      {plan && schedule ? (
        <>
          <GlassCard strong className="space-y-4 p-4">
            <div className="grid grid-cols-2 gap-4 border-b border-border/40 pb-3">
              <div>
                <div className="text-xs text-muted-foreground">Total repayment</div>
                <div className="text-2xl font-bold text-accent">{fmt(schedule.totalAmount)}</div>
                <div className="text-[10px] text-muted-foreground">No interest included</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground">Duration</div>
                <div className="text-2xl font-bold">{schedule.totalMonths}</div>
                <div className="text-[10px] text-muted-foreground">monthly installments</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">Monthly target</div>
                <div className="font-semibold">{fmt(schedule.monthlyAmount)} approx.</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground">Remaining balance</div>
                <div className="font-semibold">{fmt(schedule.remainingBalance)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Total paid</div>
                <div className="font-semibold">{fmt(schedule.totalPaid)}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground">Installments complete</div>
                <div className="font-semibold">
                  {
                    schedule.installments.filter(
                      (item) => item.status === "paid" || item.status === "covered",
                    ).length
                  }{" "}
                  of {schedule.totalMonths}
                </div>
              </div>
            </div>
            <div>
              <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                <span>Repayment progress</span>
                <span className="font-medium text-foreground">{schedule.progressPercent}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-accent transition-all"
                  style={{ width: schedule.progressPercent + "%" }}
                />
              </div>
            </div>
          </GlassCard>

          <section className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Monthly repayments
              </p>
              {schedule.installments.some(
                (item) => item.status === "due" || item.status === "overdue",
              ) && (
                <span className="text-xs font-semibold text-primary">
                  {
                    schedule.installments.filter(
                      (item) => item.status === "due" || item.status === "overdue",
                    ).length
                  }{" "}
                  due
                </span>
              )}
            </div>
            <GlassCard className="divide-y divide-border/40 overflow-hidden p-0">
              {schedule.installments.map((installment) => {
                const meta = STATUS_META[installment.status];
                const StatusIcon = meta.Icon;
                const periodPayments = planPayments
                  .filter(
                    (payment) =>
                      dateOnly(payment.repaymentDueDate ?? payment.date) ===
                      dateOnly(installment.dueDate),
                  )
                  .sort((a, b) => b.date - a.date);
                const latestPayment = periodPayments[0];

                return (
                  <div
                    key={installment.month}
                    className="flex items-center gap-3 px-3 py-3 sm:px-4"
                  >
                    <span
                      className={cn(
                        "grid h-9 w-9 shrink-0 place-items-center rounded-2xl",
                        meta.className,
                      )}
                    >
                      <StatusIcon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-semibold">
                          {formatDate(installment.dueDate, true)}
                        </span>
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-medium",
                            meta.className,
                          )}
                        >
                          {meta.label}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Month {installment.month} of {schedule.totalMonths}
                        {latestPayment && (
                          <>
                            {" "}
                            · Paid on{" "}
                            {new Date(latestPayment.date).toLocaleDateString(undefined, {
                              day: "numeric",
                              month: "short",
                            })}
                          </>
                        )}
                      </div>
                      {periodPayments.length > 1 && (
                        <div className="text-[11px] text-muted-foreground">
                          {periodPayments.length} payments recorded this month
                        </div>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-sm font-semibold tabular-nums">
                        {fmt(installment.scheduledAmount)}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {installment.paidAmount > 0
                          ? fmt(installment.paidAmount) + " paid"
                          : "planned"}
                      </div>
                    </div>
                    {installment.status !== "covered" && schedule.remainingBalance > 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="shrink-0 px-2 sm:px-3"
                        onClick={() => openPayment(installment)}
                      >
                        <WalletCards className="h-3.5 w-3.5 sm:mr-1.5" />
                        <span className="hidden sm:inline">
                          {installment.remainingAmount > 0 ? "Record payment" : "Extra"}
                        </span>
                      </Button>
                    )}
                  </div>
                );
              })}
            </GlassCard>
          </section>
          <p className="px-1 text-[11px] leading-relaxed text-muted-foreground">
            Tracking schedule only. Record each payment manually; partial and extra payments are
            allowed. The final installment adjusts to the remaining balance.
          </p>
        </>
      ) : (
        <section className="rounded-2xl border border-border/60 bg-secondary/20 p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold">Split this debt into monthly repayments</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Current balance: {fmt(owed)} · choose how many months to repay.
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={() => setPlanOpen(true)}>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Set schedule
            </Button>
          </div>
        </section>
      )}

      <WebModal
        open={planOpen}
        onClose={() => setPlanOpen(false)}
        title="Set monthly repayment schedule"
      >
        <div className="space-y-4">
          <div className="rounded-xl bg-secondary/30 p-3">
            <div className="text-xs text-muted-foreground">Amount to split</div>
            <div className="mt-0.5 text-xl font-bold tabular-nums">{fmt(owed)}</div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={"repayment-months-" + categoryId}>Repayment duration</Label>
            <div className="flex items-center gap-2">
              <Input
                id={"repayment-months-" + categoryId}
                type="number"
                min="1"
                max="600"
                step="1"
                inputMode="numeric"
                value={monthsInput}
                onChange={(event) => setMonthsInput(event.target.value)}
              />
              <span className="text-sm text-muted-foreground">months</span>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={"repayment-first-due-" + categoryId}>First due date</Label>
            <Input
              id={"repayment-first-due-" + categoryId}
              type="date"
              value={firstDueDate}
              onChange={(event) => setFirstDueDate(event.target.value)}
            />
          </div>
          <div className="rounded-xl border border-border/50 px-3 py-2.5 text-sm">
            <span className="text-muted-foreground">Estimated monthly amount</span>
            <strong className="float-right">{fmt(estimatedMonthly)}</strong>
            <p className="mt-1 clear-both text-[11px] text-muted-foreground">
              Any rounding difference is added to the final installment.
            </p>
          </div>
          <Button className="w-full" onClick={submitPlan} disabled={saving || !firstDueDate}>
            {saving ? "Creating schedule…" : "Create monthly schedule"}
          </Button>
        </div>
      </WebModal>

      {plan && schedule && selected && (
        <WebModal
          open={paymentOpen}
          onClose={() => setPaymentOpen(false)}
          title={"Record Month " + selected.month + " payment"}
        >
          <div className="mb-4 rounded-xl bg-secondary/30 p-3 text-sm text-muted-foreground">
            {formatDate(selected.dueDate, true)} · installment target{" "}
            {fmt(selected.scheduledAmount)}. You can pay part of it or add an extra amount.
          </div>
          <TransactionForm
            type="repayment_out"
            defaultPersonId={personId}
            defaultCategoryId={categoryId}
            defaultAmount={suggestedPayment}
            repaymentPlanId={plan.id}
            repaymentDueDate={selected.dueDate}
            key={selected.month}
            onSubmitted={() => setPaymentOpen(false)}
          />
        </WebModal>
      )}
    </div>
  );
}
