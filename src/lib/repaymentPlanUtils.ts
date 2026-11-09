import type { RepaymentPlan, Transaction } from "@/lib/types";

export interface RepaymentPlanProgress {
  complete: boolean;
  dueDate: number | null;
  targetAmount: number;
  paidAmount: number;
  remainingAmount: number;
  overdue: boolean;
}

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

export function getRepaymentPlanProgress(
  plan: RepaymentPlan,
  categoryOutstanding: number,
  transactions: Transaction[],
  now = Date.now(),
): RepaymentPlanProgress {
  const owed = Math.max(0, -categoryOutstanding);
  if (owed < 0.005) {
    return {
      complete: true,
      dueDate: null,
      targetAmount: 0,
      paidAmount: 0,
      remainingAmount: 0,
      overdue: false,
    };
  }

  const paymentsByDueDate = new Map<number, number>();
  for (const transaction of transactions) {
    if (
      transaction.type !== "repayment_out" ||
      transaction.repaymentPlanId !== plan.id ||
      transaction.repaymentDueDate === undefined
    ) {
      continue;
    }
    const dueDate = dateOnly(transaction.repaymentDueDate);
    paymentsByDueDate.set(dueDate, (paymentsByDueDate.get(dueDate) ?? 0) + transaction.amount);
  }

  const firstDueDate = dateOnly(plan.firstDueDate);
  const today = dateOnly(now);
  const dueByToday = Math.max(
    0,
    (new Date(today).getFullYear() - new Date(firstDueDate).getFullYear()) * 12 +
      new Date(today).getMonth() -
      new Date(firstDueDate).getMonth(),
  );

  for (let period = 0; period <= dueByToday + 1; period += 1) {
    const dueDate = dueDateForPeriod(firstDueDate, period);
    const paidAmount = paymentsByDueDate.get(dueDate) ?? 0;
    const targetAmount = Math.min(plan.monthlyAmount, owed + paidAmount);
    const remainingAmount = Math.max(0, targetAmount - paidAmount);

    if (remainingAmount > 0.005) {
      return {
        complete: false,
        dueDate,
        targetAmount,
        paidAmount,
        remainingAmount,
        overdue: dueDate < today,
      };
    }

    const nextDueDate = dueDateForPeriod(firstDueDate, period + 1);
    if (nextDueDate > today) {
      const nextPaid = paymentsByDueDate.get(nextDueDate) ?? 0;
      const nextTarget = Math.min(plan.monthlyAmount, Math.max(0, owed + nextPaid));
      return {
        complete: false,
        dueDate: nextDueDate,
        targetAmount: nextTarget,
        paidAmount: nextPaid,
        remainingAmount: Math.max(0, nextTarget - nextPaid),
        overdue: false,
      };
    }
  }

  const dueDate = dueDateForPeriod(firstDueDate, dueByToday + 2);
  const paidAmount = paymentsByDueDate.get(dueDate) ?? 0;
  const targetAmount = Math.min(plan.monthlyAmount, owed + paidAmount);
  return {
    complete: false,
    dueDate,
    targetAmount,
    paidAmount,
    remainingAmount: Math.max(0, targetAmount - paidAmount),
    overdue: false,
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
