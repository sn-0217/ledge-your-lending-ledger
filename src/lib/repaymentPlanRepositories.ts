import { getDb } from "@/lib/db";
import { queueCloudDelete, queueCloudUpsert } from "@/features/sync/cloudSync";
import { computeCategoryBalance } from "@/lib/repositories";
import type { ID, RepaymentPlan } from "@/lib/types";

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

export async function createRepaymentPlan(input: {
  personId: ID;
  categoryId: ID;
  totalMonths: number;
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
      "This category already has a repayment plan. Resume the existing plan instead.",
    );
  }
  if (!Number.isInteger(input.totalMonths) || input.totalMonths < 1 || input.totalMonths > 600) {
    throw new Error("Choose a repayment duration between 1 and 600 months.");
  }

  const transactions = await db.transactions.where("categoryId").equals(input.categoryId).toArray();
  const balance = computeCategoryBalance(category, transactions);
  if (balance.outstanding >= -0.005) {
    throw new Error("A repayment plan is only available when you owe money in this category.");
  }
  const totalAmount = Math.round(Math.abs(balance.outstanding) * 100) / 100;
  if (input.totalMonths > Math.round(totalAmount * 100)) {
    throw new Error("The duration is too long for the amount owed.");
  }
  const monthlyAmount = Math.round((totalAmount / input.totalMonths) * 100) / 100;

  const timestamp = Date.now();
  const plan: RepaymentPlan = {
    id: uid(),
    personId: input.personId,
    categoryId: input.categoryId,
    totalAmount,
    totalMonths: input.totalMonths,
    monthlyAmount,
    firstDueDate: input.firstDueDate,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await db.repaymentPlans.add(plan);
  await queueCloudUpsert("repaymentPlans", plan as unknown as Record<string, unknown>);
  return plan;
}

export async function deleteRepaymentPlan(id: ID) {
  await getDb().repaymentPlans.delete(id);
  await queueCloudDelete("repaymentPlans", id);
}
