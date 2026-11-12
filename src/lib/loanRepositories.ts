import { nanoid } from "nanoid";
import { getDb } from "./db";
import { queueCloudDelete, queueCloudUpsert } from "@/features/sync/cloudSync";
import type { Loan, LoanMonthlyPayment, LoanStatus } from "./types";

export type NewLoan = Omit<Loan, "id" | "status" | "createdAt" | "updatedAt">;

export async function createLoan(input: NewLoan): Promise<string> {
  const now = Date.now();
  const loan: Loan = { id: nanoid(), ...input, status: "active", createdAt: now, updatedAt: now };
  await getDb().loans.add(loan);
  await queueCloudUpsert("loans", loan as unknown as Record<string, unknown>);
  return loan.id;
}

export async function updateLoan(id: string, patch: Partial<Omit<Loan, "id" | "createdAt">>) {
  const db = getDb();
  await db.loans.update(id, { ...patch, updatedAt: Date.now() });
  const loan = await db.loans.get(id);
  if (loan) await queueCloudUpsert("loans", loan as unknown as Record<string, unknown>);
}

export async function updateLoanStatus(id: string, status: LoanStatus) {
  await updateLoan(id, { status });
}

export async function deleteLoan(id: string) {
  const db = getDb();
  const payments = await db.loanPayments.where("loanId").equals(id).toArray();
  await db.transaction("rw", db.loans, db.loanPayments, async () => {
    await db.loanPayments.where("loanId").equals(id).delete();
    await db.loans.delete(id);
  });
  await Promise.all([
    ...payments.map((payment) => queueCloudDelete("loanPayments", payment.id)),
    queueCloudDelete("loans", id),
  ]);
}

export async function recordLoanPayment(
  loanId: string,
  month: number,
  paidAmount: number,
  paidDate: number,
  notes?: string,
) {
  const db = getDb();
  const existing = await db.loanPayments.where("[loanId+month]").equals([loanId, month]).first();
  const now = Date.now();
  if (existing) {
    await db.loanPayments.update(existing.id, {
      paidAmount,
      paidDate,
      notes: notes?.trim() || undefined,
      updatedAt: now,
    });
    const updated = await db.loanPayments.get(existing.id);
    if (updated)
      await queueCloudUpsert("loanPayments", updated as unknown as Record<string, unknown>);
    return;
  }

  const payment: LoanMonthlyPayment = {
    id: nanoid(),
    loanId,
    month,
    paidAmount,
    paidDate,
    notes: notes?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
  };
  await db.loanPayments.add(payment);
  await queueCloudUpsert("loanPayments", payment as unknown as Record<string, unknown>);
}

export async function deleteLoanPayment(loanId: string, month: number) {
  const db = getDb();
  const payment = await db.loanPayments.where("[loanId+month]").equals([loanId, month]).first();
  if (!payment) return;
  await db.loanPayments.delete(payment.id);
  await queueCloudDelete("loanPayments", payment.id);
}
