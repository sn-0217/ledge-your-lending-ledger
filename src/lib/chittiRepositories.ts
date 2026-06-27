import { getDb } from "./db";
import type { Chitti, ChittiMonthlyPayment, ChittiStatus } from "./types";
import { nanoid } from "nanoid";

// ─── Chitti CRUD ──────────────────────────────────────────────────────────────

export async function createChitti(
  data: Pick<Chitti,
    "organizerId" | "name" | "monthlyAmount" | "numChits" |
    "startDate" | "totalMonths" | "notes">
): Promise<string> {
  const now = Date.now();
  const id = nanoid();
  await getDb().chittis.add({
    id,
    ...data,
    status: "active",
    availed: false,
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

export async function updateChittiStatus(id: string, status: ChittiStatus) {
  await getDb().chittis.update(id, { status, updatedAt: Date.now() });
}

export async function updateAvailed(
  id: string,
  availed: boolean,
  availedDate?: number,
  availedAmount?: number,
) {
  await getDb().chittis.update(id, {
    availed,
    availedDate: availed ? availedDate : undefined,
    availedAmount: availed ? availedAmount : undefined,
    updatedAt: Date.now(),
  });
}

export async function updateChitti(
  id: string,
  patch: Partial<Omit<Chitti, "id" | "createdAt">>,
) {
  await getDb().chittis.update(id, { ...patch, updatedAt: Date.now() });
}

export async function deleteChitti(id: string) {
  const db = getDb();
  await db.transaction("rw", db.chittis, db.chittiPayments, async () => {
    await db.chittiPayments.where("chittiId").equals(id).delete();
    await db.chittis.delete(id);
  });
}

// ─── Monthly payments ─────────────────────────────────────────────────────────

/** Mark a month as paid. Idempotent. */
export async function setMonthPaid(chittiId: string, month: number, paid: boolean) {
  const db = getDb();
  const existing = await db.chittiPayments
    .where("[chittiId+month]")
    .equals([chittiId, month])
    .first();

  const now = Date.now();
  if (existing) {
    await db.chittiPayments.update(existing.id, {
      paid,
      paidAt: paid ? now : undefined,
      updatedAt: now,
    });
  } else {
    await db.chittiPayments.add({
      id: nanoid(),
      chittiId,
      month,
      paid,
      paidAt: paid ? now : undefined,
      createdAt: now,
      updatedAt: now,
    });
  }
}
