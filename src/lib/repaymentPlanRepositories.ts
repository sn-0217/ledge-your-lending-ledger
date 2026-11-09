import { getDb } from "@/lib/db";
import { queueCloudDelete, queueCloudUpsert } from "@/features/sync/cloudSync";
import { computeCategoryBalance } from "@/lib/repositories";
import type { ID, RepaymentPlan } from "@/lib/types";
import { dateOnly, dueDateForPeriod } from "@/lib/repaymentPlanUtils";

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

export async function createRepaymentPlan(input: {
  personId: ID;
  categoryId: ID;
  totalMonths: number;
  monthlyAmount: number;
  scheduleMode: "months" | "amount";
  firstDueDate: number;
}): Promise<RepaymentPlan> {
  const db = getDb();
  const category = await db.categories.get(input.categoryId);
  if (!category || category.personId !== input.personId) {
    throw new Error("Choose a valid debt category.");
  }
  const existingPlan = await db.repaymentPlans.where("categoryId").equals(input.categoryId).first();
  if (existingPlan) {
    throw new Error(
      "This category already has a repayment plan. Edit or remove the existing schedule.",
    );
  }
  if (!Number.isInteger(input.totalMonths) || input.totalMonths < 1 || input.totalMonths > 600) {
    throw new Error("Choose a repayment duration between 1 and 600 months.");
  }
  if (!Number.isFinite(input.monthlyAmount) || input.monthlyAmount <= 0) {
    throw new Error("Enter a monthly amount greater than zero.");
  }

  const transactions = await db.transactions.where("categoryId").equals(input.categoryId).toArray();
  const balance = computeCategoryBalance(category, transactions);
  if (balance.outstanding >= -0.005) {
    throw new Error("A repayment plan is only available when you owe money in this category.");
  }
  const totalAmount = Math.round(Math.abs(balance.outstanding) * 100) / 100;
  const monthlyAmount =
    input.scheduleMode === "months"
      ? Math.round((totalAmount / input.totalMonths) * 100) / 100
      : Math.round(input.monthlyAmount * 100) / 100;
  const totalMonths =
    input.scheduleMode === "amount"
      ? Math.ceil(totalAmount / Math.max(monthlyAmount, 0.01))
      : input.totalMonths;
  if (totalMonths > 600 || totalMonths > Math.round(totalAmount * 100)) {
    throw new Error("The duration is too long for the amount owed.");
  }
  if (monthlyAmount <= 0) throw new Error("Monthly amount must be at least 0.01.");

  const timestamp = Date.now();
  const plan: RepaymentPlan = {
    id: uid(),
    personId: input.personId,
    categoryId: input.categoryId,
    totalAmount,
    totalMonths,
    scheduleMode: input.scheduleMode,
    monthlyAmount,
    firstDueDate: input.firstDueDate,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await db.repaymentPlans.add(plan);
  await queueCloudUpsert("repaymentPlans", plan as unknown as Record<string, unknown>);
  return plan;
}

export async function updateRepaymentPlan(
  id: ID,
  input: {
    totalMonths: number;
    monthlyAmount: number;
    scheduleMode: "months" | "amount";
    firstDueDate: number;
  },
): Promise<RepaymentPlan> {
  const db = getDb();
  const plan = await db.repaymentPlans.get(id);
  if (!plan) throw new Error("Repayment schedule not found.");
  if (!Number.isInteger(input.totalMonths) || input.totalMonths < 1 || input.totalMonths > 600) {
    throw new Error("Choose a repayment duration between 1 and 600 months.");
  }
  if (!Number.isFinite(input.monthlyAmount) || input.monthlyAmount <= 0) {
    throw new Error("Enter a monthly amount greater than zero.");
  }

  const category = await db.categories.get(plan.categoryId);
  if (!category) throw new Error("The debt category for this schedule no longer exists.");
  const [transactions, payments] = await Promise.all([
    db.transactions.where("categoryId").equals(plan.categoryId).toArray(),
    db.transactions.where("repaymentPlanId").equals(plan.id).toArray(),
  ]);
  const balance = computeCategoryBalance(category, transactions).outstanding;
  const totalPaid = payments.reduce((sum, payment) => sum + payment.amount, 0);
  const totalAmount =
    plan.totalAmount ?? Math.round((Math.max(0, -balance) + totalPaid) * 100) / 100;
  const monthlyAmount =
    input.scheduleMode === "months"
      ? Math.round((totalAmount / input.totalMonths) * 100) / 100
      : Math.round(input.monthlyAmount * 100) / 100;
  const totalMonths =
    input.scheduleMode === "amount"
      ? Math.ceil(totalAmount / Math.max(monthlyAmount, 0.01))
      : input.totalMonths;
  if (totalMonths > 600 || totalMonths > Math.round(totalAmount * 100)) {
    throw new Error("The duration is too long for the amount owed.");
  }
  if (dateOnly(input.firstDueDate) !== dateOnly(plan.firstDueDate) && payments.length > 0) {
    throw new Error("The first due date cannot change after payments have been recorded.");
  }

  const lastPaidPeriod = payments.reduce((lastPeriod, payment) => {
    const paidDueDate = dateOnly(payment.repaymentDueDate ?? payment.date);
    for (let period = 0; period < 600; period += 1) {
      if (dateOnly(dueDateForPeriod(plan.firstDueDate, period)) === paidDueDate) {
        return Math.max(lastPeriod, period + 1);
      }
    }
    return lastPeriod;
  }, 0);
  if (totalMonths < lastPaidPeriod) {
    throw new Error("The schedule cannot be shortened past a month with a recorded payment.");
  }

  if (monthlyAmount <= 0) throw new Error("Monthly amount must be at least 0.01.");

  const updated: RepaymentPlan = {
    ...plan,
    totalAmount,
    totalMonths,
    monthlyAmount,
    scheduleMode: input.scheduleMode,
    firstDueDate: input.firstDueDate,
    updatedAt: Date.now(),
  };
  await db.repaymentPlans.put(updated);
  await queueCloudUpsert("repaymentPlans", updated as unknown as Record<string, unknown>);
  return updated;
}

export async function deleteRepaymentPlan(id: ID) {
  const db = getDb();
  const payments = await db.transactions.where("repaymentPlanId").equals(id).toArray();
  await db.transaction("rw", db.repaymentPlans, db.transactions, async () => {
    await db.repaymentPlans.delete(id);
    for (const payment of payments) {
      const { repaymentPlanId: _planId, repaymentDueDate: _dueDate, ...unlinkedPayment } = payment;
      await db.transactions.put({ ...unlinkedPayment, updatedAt: Date.now() });
    }
  });
  await queueCloudDelete("repaymentPlans", id);
  await Promise.all(
    payments.map(async (payment) => {
      const updated = await db.transactions.get(payment.id);
      if (updated)
        await queueCloudUpsert("transactions", updated as unknown as Record<string, unknown>);
    }),
  );
}
