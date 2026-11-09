import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { CalendarClock, Plus, WalletCards } from "lucide-react";
import { WebModal } from "@/components/common/WebModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TransactionForm } from "@/components/forms/TransactionForm";
import { getDb } from "@/lib/db";
import { useFormatMoney } from "@/lib/formatters";
import { createRepaymentPlan } from "@/lib/repaymentPlanRepositories";
import {
  fromLocalDateInput,
  getRepaymentPlanProgress,
  toLocalDateInput,
} from "@/lib/repaymentPlanUtils";
import type { Transaction } from "@/lib/types";
import { toast } from "sonner";

function nextMonthDateInput() {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth() + 1;
  const day = today.getDate();
  const lastDay = new Date(year, month + 1, 0).getDate();
  const date = new Date(year, month, Math.min(day, lastDay));
  return toLocalDateInput(date.getTime());
}

function formatDate(timestamp: number) {
  return new Date(timestamp).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

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
  const [monthlyAmount, setMonthlyAmount] = useState("");
  const [firstDueDate, setFirstDueDate] = useState(nextMonthDateInput);
  const [saving, setSaving] = useState(false);

  if (outstanding >= -0.005) return null;
  if (!plans) return null;

  const progress = plan ? getRepaymentPlanProgress(plan, outstanding, transactions) : undefined;

  async function submitPlan() {
    const amount = Number(monthlyAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter a monthly amount greater than zero.");
      return;
    }
    try {
      setSaving(true);
      await createRepaymentPlan({
        personId,
        categoryId,
        monthlyAmount: amount,
        firstDueDate: fromLocalDateInput(firstDueDate),
      });
      setPlanOpen(false);
      setMonthlyAmount("");
      toast.success("Monthly repayment plan created");
    } catch (error) {
      toast.error((error as Error).message || "Could not create plan");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-border/60 bg-secondary/20 p-3">
      {plan && progress ? (
        <>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-2.5">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                <CalendarClock className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold">Monthly repayment plan</h3>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {fmt(plan.monthlyAmount)} per month · first due {formatDate(plan.firstDueDate)}
                </p>
              </div>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-3 rounded-xl bg-background/70 px-3 py-2.5">
            <div>
              <div className="text-xs text-muted-foreground">
                {progress.complete
                  ? "Plan complete"
                  : progress.overdue
                    ? "Installment overdue"
                    : `Next installment · ${formatDate(progress.dueDate!)}`}
              </div>
              <div className="mt-0.5 text-sm font-semibold tabular-nums">
                {progress.complete
                  ? "No balance remaining"
                  : progress.paidAmount > progress.targetAmount
                    ? `${fmt(progress.paidAmount)} paid · ${fmt(progress.targetAmount)} target`
                    : `${fmt(progress.paidAmount)} of ${fmt(progress.targetAmount)} paid`}
              </div>
              {!progress.complete && (
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {fmt(progress.remainingAmount)} remaining this installment · balance{" "}
                  {fmt(Math.abs(outstanding))}
                </div>
              )}
            </div>
            {!progress.complete && (
              <Button size="sm" onClick={() => setPaymentOpen(true)}>
                <WalletCards className="mr-1.5 h-3.5 w-3.5" /> Record payment
              </Button>
            )}
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
            Scheduled amounts are reminders only. Your balance changes when you record a payment.
            Partial and extra payments are allowed.
          </p>
        </>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">Set a monthly repayment plan</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Track a target amount and due date. Payments remain manual.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => setPlanOpen(true)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" /> Create plan
          </Button>
        </div>
      )}

      <WebModal open={planOpen} onClose={() => setPlanOpen(false)} title="Monthly repayment plan">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Choose a monthly target and the first due date. This schedule will not change the
            balance; record each payment separately.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor={`monthly-amount-${categoryId}`}>Monthly amount</Label>
            <Input
              id={`monthly-amount-${categoryId}`}
              type="number"
              min="0.01"
              step="0.01"
              inputMode="decimal"
              placeholder="0.00"
              value={monthlyAmount}
              onChange={(event) => setMonthlyAmount(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`first-due-${categoryId}`}>First due date</Label>
            <Input
              id={`first-due-${categoryId}`}
              type="date"
              value={firstDueDate}
              onChange={(event) => setFirstDueDate(event.target.value)}
            />
          </div>
          <Button className="w-full" onClick={submitPlan} disabled={saving || !firstDueDate}>
            {saving ? "Creating plan…" : "Create plan"}
          </Button>
        </div>
      </WebModal>

      {plan && progress && (
        <WebModal open={paymentOpen} onClose={() => setPaymentOpen(false)} title="Record repayment">
          <div className="mb-4 rounded-xl bg-secondary/30 p-3 text-sm text-muted-foreground">
            Suggested installment: {fmt(progress.remainingAmount)}. You can record a partial or
            extra payment; it cannot exceed the remaining balance.
          </div>
          <TransactionForm
            type="repayment_out"
            defaultPersonId={personId}
            defaultCategoryId={categoryId}
            defaultAmount={progress.remainingAmount}
            onSubmitted={() => setPaymentOpen(false)}
          />
        </WebModal>
      )}
    </section>
  );
}
