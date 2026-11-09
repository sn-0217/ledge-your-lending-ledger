import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Plus,
  Pencil,
  Trash2,
  WalletCards,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { TransactionForm } from "@/components/forms/TransactionForm";
import { WebModal } from "@/components/common/WebModal";
import { GlassCard } from "@/components/common/GlassCard";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getDb } from "@/lib/db";
import { useFormatMoney } from "@/lib/formatters";
import {
  createRepaymentPlan,
  deleteRepaymentPlan,
  updateRepaymentPlan,
} from "@/lib/repaymentPlanRepositories";
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
  const [monthlyAmountInput, setMonthlyAmountInput] = useState("");
  const [scheduleMode, setScheduleMode] = useState<"months" | "amount">("months");
  const [editingPlan, setEditingPlan] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [firstDueDate, setFirstDueDate] = useState(nextMonthDateInput);
  const [selected, setSelected] = useState<RepaymentInstallment | null>(null);
  const [suggestedPayment, setSuggestedPayment] = useState(0);
  const [saving, setSaving] = useState(false);

  if (!plans) return null;
  if (outstanding >= -0.005 && !plan) return null;
  const owed = Math.abs(outstanding);
  const months = Number(monthsInput);
  const schedule = plan ? getRepaymentPlanSchedule(plan, outstanding, transactions) : undefined;
  const amountToSchedule = schedule?.totalAmount ?? owed;
  const estimatedMonthly =
    scheduleMode === "months"
      ? months > 0
        ? Math.round((amountToSchedule / months) * 100) / 100
        : 0
      : Number(monthlyAmountInput) || 0;
  const estimatedMonths =
    scheduleMode === "amount" && estimatedMonthly > 0
      ? Math.ceil(amountToSchedule / estimatedMonthly)
      : months;

  const planPayments = plan
    ? transactions.filter(
        (item) => item.type === "repayment_out" && item.repaymentPlanId === plan.id,
      )
    : [];

  function openCreateSchedule() {
    setEditingPlan(false);
    setScheduleMode("months");
    const defaultMonths = Math.min(12, Math.max(1, Math.round(owed * 100)));
    setMonthsInput(String(defaultMonths));
    setMonthlyAmountInput((Math.round((owed / defaultMonths) * 100) / 100).toFixed(2));
    setFirstDueDate(nextMonthDateInput());
    setPlanOpen(true);
  }

  function openEditSchedule() {
    if (!plan || !schedule) return;
    setEditingPlan(true);
    setScheduleMode(plan.scheduleMode ?? "amount");
    setMonthsInput(String(schedule.totalMonths));
    setMonthlyAmountInput(schedule.monthlyAmount.toFixed(2));
    setFirstDueDate(toLocalDateInput(plan.firstDueDate));
    setPlanOpen(true);
  }

  function onMonthsChange(value: string) {
    setScheduleMode("months");
    setMonthsInput(value);
    const nextMonths = Number(value);
    if (nextMonths > 0) {
      setMonthlyAmountInput((Math.round((amountToSchedule / nextMonths) * 100) / 100).toFixed(2));
    } else setMonthlyAmountInput("");
  }

  function onMonthlyAmountChange(value: string) {
    setScheduleMode("amount");
    setMonthlyAmountInput(value);
    const amount = Number(value);
    if (amount > 0) setMonthsInput(String(Math.ceil(amountToSchedule / amount)));
  }

  async function submitPlan() {
    const chosenMonthly = Math.round(Number(monthlyAmountInput) * 100) / 100;
    const totalMonths =
      scheduleMode === "months"
        ? Number(monthsInput)
        : chosenMonthly > 0
          ? Math.ceil(amountToSchedule / chosenMonthly)
          : 0;
    if (!Number.isInteger(totalMonths) || totalMonths < 1 || totalMonths > 600) {
      toast.error("Choose a duration between 1 and 600 months.");
      return;
    }
    const monthlyAmount =
      scheduleMode === "months"
        ? Math.round((amountToSchedule / totalMonths) * 100) / 100
        : chosenMonthly;
    if (!Number.isFinite(monthlyAmount) || monthlyAmount <= 0) {
      toast.error("Enter a monthly amount greater than zero.");
      return;
    }
    try {
      setSaving(true);
      if (editingPlan && plan) {
        await updateRepaymentPlan(plan.id, {
          totalMonths,
          monthlyAmount,
          scheduleMode,
          firstDueDate: fromLocalDateInput(firstDueDate),
        });
      } else {
        await createRepaymentPlan({
          personId,
          categoryId,
          totalMonths,
          monthlyAmount,
          scheduleMode,
          firstDueDate: fromLocalDateInput(firstDueDate),
        });
      }
      setPlanOpen(false);
      toast.success(
        editingPlan ? "Repayment schedule updated" : "Monthly repayment schedule created",
      );
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

  return (
    <div className="space-y-4">
      {plan && schedule ? (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold">Monthly repayment schedule</h3>
              <p className="text-xs text-muted-foreground">
                First due {formatDate(plan.firstDueDate)}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <Button variant="outline" size="sm" onClick={openEditSchedule}>
                <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit schedule
              </Button>
              <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="text-destructive">
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Remove
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="glass-strong">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remove this repayment schedule?</AlertDialogTitle>
                    <AlertDialogDescription>
                      The schedule will be removed. Payments already recorded stay in the ledger and
                      continue to affect the balance.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Keep schedule</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={async () => {
                        try {
                          await deleteRepaymentPlan(plan.id);
                          setDeleteConfirmOpen(false);
                          toast.success("Repayment schedule removed");
                        } catch (error) {
                          toast.error((error as Error).message || "Could not remove schedule");
                        }
                      }}
                    >
                      Remove schedule
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
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
            <Button size="sm" variant="outline" onClick={openCreateSchedule}>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Set schedule
            </Button>
          </div>
        </section>
      )}

      <WebModal
        open={planOpen}
        onClose={() => setPlanOpen(false)}
        title={editingPlan ? "Edit repayment schedule" : "Set monthly repayment schedule"}
      >
        <div className="space-y-4">
          <div className="rounded-xl bg-secondary/30 p-3">
            <div className="text-xs text-muted-foreground">Amount to split</div>
            <div className="mt-0.5 text-xl font-bold tabular-nums">{fmt(owed)}</div>
          </div>
          <p className="text-xs text-muted-foreground">
            Monthly amount = total ÷ months. Months = total ÷ monthly amount, rounded up; the final
            installment is adjusted to the remaining balance.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="min-w-0 space-y-1.5">
              <Label htmlFor={"repayment-months-" + categoryId}>Number of months</Label>
              <Input
                id={"repayment-months-" + categoryId}
                type="number"
                min="1"
                max="600"
                step="1"
                inputMode="numeric"
                value={monthsInput}
                onChange={(event) => onMonthsChange(event.target.value)}
              />
            </div>
            <div className="min-w-0 space-y-1.5">
              <Label htmlFor={"repayment-monthly-" + categoryId}>Amount per month</Label>
              <Input
                id={"repayment-monthly-" + categoryId}
                type="number"
                min="0.01"
                step="0.01"
                inputMode="decimal"
                value={monthlyAmountInput}
                onChange={(event) => onMonthlyAmountChange(event.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={"repayment-first-due-" + categoryId}>First due date</Label>
            <Input
              id={"repayment-first-due-" + categoryId}
              type="date"
              value={firstDueDate}
              onChange={(event) => setFirstDueDate(event.target.value)}
              disabled={editingPlan && planPayments.length > 0}
            />
            {editingPlan && planPayments.length > 0 && (
              <p className="text-[11px] text-muted-foreground">
                The first due date is locked after a payment is recorded so payment months stay
                aligned.
              </p>
            )}
          </div>
          <div className="rounded-xl border border-border/50 px-3 py-2.5 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Estimated schedule</span>
              <strong className="text-right">
                {estimatedMonths} months · {fmt(estimatedMonthly)} / month
              </strong>
            </div>
            <p className="mt-1 clear-both text-[11px] text-muted-foreground">
              {scheduleMode === "amount"
                ? "The month count rounds up; the final installment is capped at the remaining amount."
                : "Rounding is spread across installments so they add up to the total."}
            </p>
          </div>
          <Button className="w-full" onClick={submitPlan} disabled={saving || !firstDueDate}>
            {saving
              ? editingPlan
                ? "Saving schedule…"
                : "Creating schedule…"
              : editingPlan
                ? "Save schedule"
                : "Create monthly schedule"}
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
