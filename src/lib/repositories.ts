import { getDb } from "./db";
import type {
  CategoryBalance,
  DebtCategory,
  ID,
  Person,
  PersonBalance,
  Transaction,
  TransactionType,
} from "./types";

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

const now = () => Date.now();

export const DEFAULT_CATEGORIES = ["General"] as const;

/* ---------------- People ---------------- */

export async function createPerson(
  input: Omit<Person, "id" | "createdAt" | "updatedAt"> & { defaultCategories?: boolean },
): Promise<Person> {
  const db = getDb();
  const ts = now();
  const nameTrimmed = input.name.trim();
  const person: Person = {
    id: uid(),
    name: nameTrimmed,
    phone: input.phone?.trim() || undefined,
    tags: input.tags ?? [],
    notes: input.notes?.trim() || undefined,
    createdAt: ts,
    updatedAt: ts,
  };
  await db.transaction("rw", db.people, db.categories, async () => {
    const existing = await db.people
      .filter((p) => p.name.toLowerCase() === nameTrimmed.toLowerCase())
      .first();
    if (existing) {
      throw new Error(`A person named "${nameTrimmed}" already exists.`);
    }

    await db.people.add(person);
    if (input.defaultCategories !== false) {
      for (const name of DEFAULT_CATEGORIES) {
        await db.categories.add({
          id: uid(),
          personId: person.id,
          name,
          createdAt: ts,
          updatedAt: ts,
        });
      }
    }
  });
  return person;
}

export async function updatePerson(id: ID, patch: Partial<Omit<Person, "id" | "createdAt">>) {
  const db = getDb();
  if (patch.name) {
    const nameTrimmed = patch.name.trim();
    await db.transaction("rw", db.people, async () => {
      const existing = await db.people
        .filter((p) => p.name.toLowerCase() === nameTrimmed.toLowerCase() && p.id !== id)
        .first();
      if (existing) {
        throw new Error(`A person named "${nameTrimmed}" already exists.`);
      }
      await db.people.update(id, { ...patch, name: nameTrimmed, updatedAt: now() });
    });
  } else {
    await db.people.update(id, { ...patch, updatedAt: now() });
  }
}

export async function deletePerson(id: ID) {
  const db = getDb();
  await db.transaction("rw", db.people, db.categories, db.transactions, async () => {
    await db.transactions.where("personId").equals(id).delete();
    await db.categories.where("personId").equals(id).delete();
    await db.people.delete(id);
  });
}

/* ---------------- Categories ---------------- */

export async function createCategory(personId: ID, name: string): Promise<DebtCategory> {
  const db = getDb();
  const ts = now();
  const c: DebtCategory = {
    id: uid(),
    personId,
    name: name.trim(),
    createdAt: ts,
    updatedAt: ts,
  };
  await db.categories.add(c);
  return c;
}

export async function renameCategory(id: ID, name: string) {
  await getDb().categories.update(id, { name: name.trim(), updatedAt: now() });
}

export async function deleteCategory(id: ID) {
  const db = getDb();
  await db.transaction("rw", db.categories, db.transactions, async () => {
    await db.transactions.where("categoryId").equals(id).delete();
    await db.categories.delete(id);
  });
}

/* ---------------- Transactions ---------------- */

export async function createTransaction(
  input: Omit<Transaction, "id" | "createdAt" | "updatedAt">,
): Promise<Transaction> {
  const ts = now();
  const tx: Transaction = { ...input, id: uid(), createdAt: ts, updatedAt: ts };
  await getDb().transactions.add(tx);
  return tx;
}

export async function updateTransaction(
  id: ID,
  patch: Partial<Omit<Transaction, "id" | "createdAt">>,
) {
  await getDb().transactions.update(id, { ...patch, updatedAt: now() });
}

export async function deleteTransaction(id: ID) {
  await getDb().transactions.delete(id);
}

/* ---------------- Derived: balances ---------------- */

/**
 * Sign convention: outstanding is positive when the other person owes us.
 * - lent           : +amount (they owe us)
 * - repayment_in   : -amount (they paid us back)
 * - borrowed       : -amount (we owe them)
 * - repayment_out  : +amount (we paid back what we owed)
 */
export function signedDelta(type: TransactionType, amount: number): number {
  switch (type) {
    case "lent":
      return amount;
    case "repayment_in":
      return -amount;
    case "borrowed":
      return -amount;
    case "repayment_out":
      return amount;
  }
}

export function computeCategoryBalance(
  category: DebtCategory,
  txs: Transaction[],
): CategoryBalance {
  let outstanding = 0;
  let totalLent = 0;
  let totalBorrowed = 0;
  let totalReceived = 0;
  let totalPaid = 0;
  let lastActivity = category.createdAt;
  let nextDue: number | undefined;
  const today = startOfDay(now());

  for (const t of txs) {
    outstanding += signedDelta(t.type, t.amount);
    if (t.type === "lent") totalLent += t.amount;
    if (t.type === "borrowed") totalBorrowed += t.amount;
    if (t.type === "repayment_in") totalReceived += t.amount;
    if (t.type === "repayment_out") totalPaid += t.amount;
    if (t.date > lastActivity) lastActivity = t.date;
    if (t.dueDate && (t.type === "lent" || t.type === "borrowed")) {
      if (nextDue === undefined || t.dueDate < nextDue) nextDue = t.dueDate;
    }
  }
  const settled = Math.abs(outstanding) < 0.005;
  return {
    categoryId: category.id,
    personId: category.personId,
    outstanding,
    totalLent,
    totalBorrowed,
    totalReceived,
    totalPaid,
    settled,
    lastActivity,
    nextDue,
    overdue: !settled && nextDue !== undefined && nextDue < today,
  };
}

export function computePersonBalance(
  personId: ID,
  balances: CategoryBalance[],
): PersonBalance {
  let outstanding = 0;
  let active = 0;
  let lastActivity = 0;
  for (const b of balances) {
    outstanding += b.outstanding;
    if (!b.settled) active++;
    if (b.lastActivity > lastActivity) lastActivity = b.lastActivity;
  }
  return {
    personId,
    outstanding,
    categoryCount: balances.length,
    activeCount: active,
    settled: active === 0,
    lastActivity,
  };
}

export function startOfDay(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
