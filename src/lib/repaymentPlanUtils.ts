import type { RepaymentPlan, Transaction } from "@/lib/types";

export type InstallmentStatus = "paid" | "partial" | "overdue" | "due" | "upcoming" | "covered";

export interface RepaymentInstallment {
  month: number;
  dueDate: number;
  scheduledAmount: number;
  paidAmount: number;
  remainingAmount: number;
  status: InstallmentStatus;
}

export interface RepaymentPlanSchedule {
  totalAmount: number;
  totalMonths: number;
  monthlyAmount: number;
  totalPaid: number;
  remainingBalance: number;
  progressPercent: number;
  installments: RepaymentInstallment[];
}

const roundCurrency = (amount: number) => Math.round((amount + Number.EPSILON) * 100) / 100;

export function localDate(year: number, monthIndex: number, day: number) {
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  return new Date(year, monthIndex, Math.min(day, lastDay)).getTime();
}

export function dateOnly(timestamp: number) {
  const date = new Date(timestamp);
  return localDate(date.getFullYear(), date.getMonth(), date.getDate());
}

export function dueDateForPeriod(firstDueDate: number, period: number) {
  const first = new Date(firstDueDate);
  return localDate(first.getFullYear(), first.getMonth() + period, first.getDate());
}

export function getRepaymentPlanSchedule(
  plan: RepaymentPlan,
  categoryOutstanding: number,
  transactions: Transaction[],
  now = Date.now(),
): RepaymentPlanSchedule {
  const remainingBalance = Math.max(0, -categoryOutstanding);
  const planPayments = transactions.filter(
    (transaction) =>
      transaction.type === "repayment_out" && transaction.repaymentPlanId === plan.id,
  );
  const totalPaid = roundCurrency(
    planPayments.reduce((sum, transaction) => sum + transaction.amount, 0),
  );
  const totalAmount = roundCurrency(plan.totalAmount ?? remainingBalance + totalPaid);
  const totalMonths = Math.max(
    1,
    plan.totalMonths ?? Math.ceil(totalAmount / Math.max(plan.monthlyAmount, 0.01)),
  );
  const monthlyAmount = plan.monthlyAmount || roundCurrency(totalAmount / totalMonths);
  const totalCents = Math.round(totalAmount * 100);
  const baseCents = Math.floor(totalCents / totalMonths);
  const extraCents = totalCents % totalMonths;
  const hasFixedDuration = plan.totalAmount !== undefined && plan.totalMonths !== undefined;
  const paymentsByDueDate = new Map<number, number>();
  for (const payment of planPayments) {
    const dueDate = dateOnly(payment.repaymentDueDate ?? payment.date);
    paymentsByDueDate.set(dueDate, (paymentsByDueDate.get(dueDate) ?? 0) + payment.amount);
  }

  const today = dateOnly(now);
  let extraCredit = 0;
  const installments: RepaymentInstallment[] = Array.from({ length: totalMonths }, (_, index) => {
    const dueDate = dateOnly(dueDateForPeriod(plan.firstDueDate, index));
    const isFinal = index === totalMonths - 1;
    const scheduledBase = hasFixedDuration
      ? (baseCents + (index < extraCents ? 1 : 0)) / 100
      : isFinal
        ? roundCurrency(totalAmount - monthlyAmount * (totalMonths - 1))
        : monthlyAmount;
    const creditUsed = Math.min(extraCredit, scheduledBase);
    extraCredit = roundCurrency(extraCredit - creditUsed);
    let scheduledAmount = Math.max(0, roundCurrency(scheduledBase - creditUsed));
    const paidAmount = roundCurrency(paymentsByDueDate.get(dueDate) ?? 0);

    // Keep the last scheduled amount within the debt still owed, accounting for
    // payments already assigned to that installment.
    if (isFinal) {
      scheduledAmount = Math.min(scheduledAmount, roundCurrency(remainingBalance + paidAmount));
    }
    const remainingAmount = Math.max(0, roundCurrency(scheduledAmount - paidAmount));
    if (paidAmount > scheduledAmount) {
      extraCredit = roundCurrency(extraCredit + paidAmount - scheduledAmount);
    }

    const sameCalendarMonth =
      new Date(dueDate).getFullYear() === new Date(today).getFullYear() &&
      new Date(dueDate).getMonth() === new Date(today).getMonth();
    const status: InstallmentStatus =
      scheduledAmount <= 0.005
        ? "covered"
        : remainingAmount <= 0.005
          ? "paid"
          : paidAmount > 0
            ? "partial"
            : dueDate < today
              ? "overdue"
              : sameCalendarMonth
                ? "due"
                : "upcoming";

    return { month: index + 1, dueDate, scheduledAmount, paidAmount, remainingAmount, status };
  });

  return {
    totalAmount,
    totalMonths,
    monthlyAmount,
    totalPaid,
    remainingBalance: roundCurrency(remainingBalance),
    progressPercent:
      totalAmount > 0 ? Math.min(100, Math.round((totalPaid / totalAmount) * 100)) : 100,
    installments,
  };
}

export function toLocalDateInput(timestamp: number) {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function fromLocalDateInput(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) throw new Error("Choose a valid due date.");
  return localDate(year, month - 1, day);
}
