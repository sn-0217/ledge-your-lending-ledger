import { getDb } from "./db";
import type { Chitti, ChittiMonthlyPayment, ChittiStatus } from "./types";
import { nanoid } from "nanoid";

// ─── Chitti CRUD ──────────────────────────────────────────────────────────────

export async function createChitti(
  data: Omit<Chitti, "id" | "status" | "createdAt" | "updatedAt">
): Promise<string> {
  const now = Date.now();
  const id = nanoid();
  await getDb().chittis.add({
    id,
    ...data,
    status: "active",
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

export async function recordPayment(
  chittiId: string,
  month: number,
  paidAmount: number,
  paidDate: number,
  notes?: string,
) {
  const db = getDb();
  const existing = await db.chittiPayments
    .where("[chittiId+month]")
    .equals([chittiId, month])
    .first();

  const now = Date.now();
  if (existing) {
    await db.chittiPayments.update(existing.id, {
      paidAmount,
      paidDate,
      notes: notes?.trim() || undefined,
      updatedAt: now,
    });
  } else {
    await db.chittiPayments.add({
      id: nanoid(),
      chittiId,
      month,
      paidAmount,
      paidDate,
      notes: notes?.trim() || undefined,
      createdAt: now,
      updatedAt: now,
    });
  }
}

export async function deletePayment(chittiId: string, month: number) {
  await getDb().chittiPayments
    .where("[chittiId+month]")
    .equals([chittiId, month])
    .delete();
}
