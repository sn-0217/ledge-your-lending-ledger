import type { Loan, LoanMonthlyPayment } from "./types";

export function loanScheduledTotal(loan: Loan) {
  return loan.monthlyAmount * loan.totalMonths;
}

export function loanTotalPaid(payments: LoanMonthlyPayment[]) {
  return payments.reduce((sum, payment) => sum + payment.paidAmount, 0);
}

export function loanScheduledRemaining(loan: Loan, payments: LoanMonthlyPayment[]) {
  return Math.max(0, loanScheduledTotal(loan) - loanTotalPaid(payments));
}

export function loanMonthDate(loan: Loan, month: number) {
  const start = new Date(loan.startDate);
  return new Date(start.getFullYear(), start.getMonth() + month - 1, 1);
}

export function loanMonthLabel(loan: Loan, month: number) {
  return loanMonthDate(loan, month).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}
