import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  Car,
  Check,
  CheckCircle2,
  Clock,
  Home,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  Wallet,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { ClientOnly } from "@/components/common/ClientOnly";
import { GlassCard } from "@/components/common/GlassCard";
import { WebModal } from "@/components/common/WebModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { LoanForm } from "@/components/forms/LoanForm";
import { useLedge } from "@/features/dataProvider";
import { useFormatMoney } from "@/lib/formatters";
import {
  loanMonthDate,
  loanMonthLabel,
  loanScheduledRemaining,
  loanScheduledTotal,
  loanTotalPaid,
} from "@/lib/loanUtils";
import type { Loan, LoanMonthlyPayment, LoanStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

export const Route = createFileRoute("/loans/$loanId")({
  head: () => ({ meta: [{ title: "Loan details — Ledge" }] }),
  component: () => (
    <AppShell>
      <ClientOnly>
        <LoanDetail />
      </ClientOnly>
    </AppShell>
  ),
});

const STATUS: Record<LoanStatus, { label: string; icon: typeof Clock; color: string }> = {
  active: { label: "Active", icon: Clock, color: "text-primary" },
  completed: { label: "Completed", icon: CheckCircle2, color: "text-success" },
  cancelled: { label: "Cancelled", icon: AlertCircle, color: "text-muted-foreground" },
};

function LoanDetail() {
  const { loanId } = Route.useParams();
  const navigate = useNavigate();
  const {
    loans,
    loanPayments,
    isLoading,
    updateLoanStatus,
    deleteLoan,
    recordLoanPayment,
    deleteLoanPayment,
  } = useLedge();
  const fmt = useFormatMoney();
  const [editing, setEditing] = useState(false);
  const [paymentMonth, setPaymentMonth] = useState<number | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [savingPayment, setSavingPayment] = useState(false);

  const loan = loans.find((item) => item.id === loanId);
  const payments = useMemo(
    () => loanPayments.filter((payment) => payment.loanId === loanId),
    [loanPayments, loanId],
  );
  const paymentByMonth = useMemo(
    () => new Map(payments.map((payment) => [payment.month, payment])),
    [payments],
  );

  if (isLoading && !loan)
    return <div className="mt-2 h-40 animate-pulse rounded-3xl bg-muted/30" />;
  if (!loan) {
    return (
      <GlassCard className="p-6 text-center text-sm text-muted-foreground">
        Loan not found.{" "}
        <Link to="/loans" className="text-primary">
          Back to Loans
        </Link>
      </GlassCard>
    );
  }

  const status = STATUS[loan.status] ?? STATUS.active;
  const StatusIcon = status.icon;
  const totalScheduled = loanScheduledTotal(loan);
  const totalPaid = loanTotalPaid(payments);
  const remaining = loanScheduledRemaining(loan, payments);
  const progress = Math.min(100, Math.round((totalPaid / Math.max(totalScheduled, 1)) * 100));
  const Icon = loan.kind === "car" ? Car : loan.kind === "house" ? Home : Wallet;
  const now = new Date();
  const currentMonthIndex =
    (now.getFullYear() - new Date(loan.startDate).getFullYear()) * 12 +
    now.getMonth() -
    new Date(loan.startDate).getMonth() +
    1;

  function startPayment(month: number) {
    const existing = paymentByMonth.get(month);
    setPaymentMonth(month);
    setPaymentAmount(existing ? String(existing.paidAmount) : String(loan!.monthlyAmount));
    setPaymentDate(existing ? toDateInput(existing.paidDate) : toDateInput(Date.now()));
    setPaymentNotes(existing?.notes ?? "");
  }

  async function submitPayment() {
    const amount = Number(paymentAmount);
    if (!paymentMonth) return;
    if (!Number.isFinite(amount) || amount <= 0) return toast.error("Enter a valid payment amount");
    const [year, month, day] = paymentDate.split("-").map(Number);
    if (!year || !month || !day) return toast.error("Choose the payment date");
    setSavingPayment(true);
    try {
      await recordLoanPayment(
        loanId,
        paymentMonth,
        amount,
        new Date(year, month - 1, day).getTime(),
        paymentNotes,
      );
      toast.success(paymentByMonth.has(paymentMonth) ? "Payment updated" : "Payment recorded");
      setPaymentMonth(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the payment");
    } finally {
      setSavingPayment(false);
    }
  }

  return (
    <div className="space-y-4 pt-2">
      <header className="flex items-center gap-2">
        <Link
          to="/loans"
          aria-label="Back to loans"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-muted/40 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-bold">{loan.name}</h1>
          <p className="truncate text-xs text-muted-foreground">
            {loan.lender} · {loan.kind}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={cn("gap-1.5 rounded-full text-xs", status.color)}
            >
              <StatusIcon className="h-3.5 w-3.5" /> {status.label}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="glass-strong">
            {(Object.keys(STATUS) as LoanStatus[]).map((key) => {
              const MetaIcon = STATUS[key].icon;
              return (
                <DropdownMenuItem key={key} onClick={() => void updateLoanStatus(loanId, key)}>
                  <MetaIcon className="mr-2 h-4 w-4" /> {STATUS[key].label}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Edit loan"
          className="shrink-0 rounded-full"
          onClick={() => setEditing(true)}
        >
          <Pencil className="h-4 w-4" />
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Delete loan"
              className="shrink-0 rounded-full text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="glass-strong">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this loan?</AlertDialogTitle>
              <AlertDialogDescription>
                Its payment history will also be removed. You can undo this from the confirmation
                toast.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={async () => {
                  await deleteLoan(loanId);
                  navigate({ to: "/loans" });
                }}
              >
                Delete loan
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </header>

      <GlassCard strong className="relative space-y-4 overflow-hidden p-4">
        <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-primary/10 blur-2xl" />
        <div className="relative grid grid-cols-2 gap-3 border-b border-border/40 pb-3">
          <div>
            <p className="text-xs text-muted-foreground">Original amount</p>
            <p className="mt-1 text-xl font-bold tabular-nums">{fmt(loan.principalAmount)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Monthly EMI</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-primary">
              {fmt(loan.monthlyAmount)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Paid so far</p>
            <p className="mt-1 font-semibold tabular-nums">{fmt(totalPaid)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Scheduled remaining</p>
            <p className="mt-1 font-semibold tabular-nums">{fmt(remaining)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Term</p>
            <p className="mt-1 font-semibold">{loan.totalMonths} months</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Total scheduled</p>
            <p className="mt-1 font-semibold tabular-nums">{fmt(totalScheduled)}</p>
          </div>
        </div>
        <div className="relative">
          <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
            <span>Payment progress</span>
            <span className="font-semibold text-foreground">{progress}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-[width]"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        {loan.notes && (
          <p className="relative border-t border-border/40 pt-3 text-sm text-muted-foreground">
            {loan.notes}
          </p>
        )}
      </GlassCard>

      <section className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <div>
            <h2 className="font-semibold">Monthly schedule</h2>
            <p className="text-xs text-muted-foreground">
              Record each payment manually as it happens.
            </p>
          </div>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <CalendarDays className="h-3.5 w-3.5" /> {loan.totalMonths} months
          </span>
        </div>
        {Array.from({ length: loan.totalMonths }, (_, index) => index + 1).map((month) => {
          const payment = paymentByMonth.get(month);
          const dueDate = loanMonthDate(loan, month);
          const dueState = payment
            ? "paid"
            : month < currentMonthIndex
              ? "overdue"
              : month === currentMonthIndex
                ? "due"
                : "upcoming";
          const dueAmount = Math.min(
            loan.monthlyAmount,
            Math.max(0, totalScheduled - loan.monthlyAmount * (month - 1)),
          );
          const amountLabel = fmt(dueAmount);

          return (
            <GlassCard key={month} className="p-3.5">
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "grid h-9 w-9 shrink-0 place-items-center rounded-xl",
                    payment
                      ? "bg-success/12 text-success"
                      : dueState === "overdue"
                        ? "bg-warning/12 text-warning"
                        : "bg-muted/50 text-muted-foreground",
                  )}
                >
                  {payment ? <Check className="h-4 w-4" /> : <CalendarDays className="h-4 w-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-sm font-semibold">{loanMonthLabel(loan, month)}</span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                        payment
                          ? "bg-success/10 text-success"
                          : dueState === "overdue"
                            ? "bg-warning/10 text-warning"
                            : "bg-muted/50 text-muted-foreground",
                      )}
                    >
                      {payment
                        ? "Paid"
                        : dueState === "overdue"
                          ? "Overdue"
                          : dueState === "due"
                            ? "Due this month"
                            : "Upcoming"}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {payment
                      ? `${fmt(payment.paidAmount)} paid · ${new Date(payment.paidDate).toLocaleDateString()}`
                      : `EMI ${amountLabel}`}
                    {payment && payment.paidAmount > dueAmount ? " · extra payment" : ""}
                  </p>
                </div>
                {loan.status === "active" && remaining > 0 && (
                  <Button
                    size="sm"
                    variant={payment ? "outline" : "secondary"}
                    className="h-8 shrink-0 gap-1.5 rounded-full px-3 text-xs"
                    onClick={() => startPayment(month)}
                  >
                    {payment ? (
                      <>
                        <Pencil className="h-3 w-3" /> Edit
                      </>
                    ) : (
                      <>
                        <Plus className="h-3 w-3" /> Pay
                      </>
                    )}
                  </Button>
                )}
                {payment && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 shrink-0 text-muted-foreground"
                        aria-label={`Reset ${loanMonthLabel(loan, month)} payment`}
                        title="Reset this month's payment"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="glass-strong">
                      <AlertDialogHeader>
                        <AlertDialogTitle>Reset this payment?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This removes the recorded {loanMonthLabel(loan, month)} payment. The
                          scheduled EMI remains.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Keep payment</AlertDialogCancel>
                        <AlertDialogAction onClick={() => void deleteLoanPayment(loanId, month)}>
                          Reset payment
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
              {payment?.notes && (
                <p className="mt-2 border-t border-border/30 pt-2 text-xs text-muted-foreground">
                  {payment.notes}
                </p>
              )}
            </GlassCard>
          );
        })}
      </section>

      <WebModal
        open={paymentMonth !== null}
        onClose={() => setPaymentMonth(null)}
        title={paymentByMonth.has(paymentMonth ?? -1) ? "Edit payment" : "Record payment"}
      >
        {paymentMonth !== null && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {loanMonthLabel(loan, paymentMonth)} · EMI {fmt(loan.monthlyAmount)}
            </p>
            <label className="block space-y-1.5 text-sm">
              <span className="text-xs font-medium text-muted-foreground">Actual amount paid</span>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                value={paymentAmount}
                onChange={(event) => setPaymentAmount(event.target.value)}
                autoFocus
              />
              <span className="text-xs text-muted-foreground">
                Partial and extra payments are supported.
              </span>
            </label>
            <label className="block space-y-1.5 text-sm">
              <span className="text-xs font-medium text-muted-foreground">Payment date</span>
              <Input
                type="date"
                value={paymentDate}
                onChange={(event) => setPaymentDate(event.target.value)}
              />
            </label>
            <label className="block space-y-1.5 text-sm">
              <span className="text-xs font-medium text-muted-foreground">Notes (optional)</span>
              <Textarea
                rows={2}
                value={paymentNotes}
                onChange={(event) => setPaymentNotes(event.target.value)}
                placeholder="Reference or payment details"
              />
            </label>
            <Button
              className="w-full"
              disabled={savingPayment}
              onClick={() => void submitPayment()}
            >
              {savingPayment ? "Saving…" : "Save payment"}
            </Button>
          </div>
        )}
      </WebModal>

      <WebModal open={editing} onClose={() => setEditing(false)} title="Edit loan">
        <LoanForm loan={loan} onDone={() => setEditing(false)} />
      </WebModal>
    </div>
  );
}

function toDateInput(timestamp: number) {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
