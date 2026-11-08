import { getDb } from "./db";
import { queueCloudDelete, queueCloudUpsert } from "@/features/sync/cloudSync";
import type { Chitti, ChittiMonthlyPayment, ChittiStatus, ChittiAvailedSlot } from "./types";
import { nanoid } from "nanoid";

// ─── Chitti CRUD ──────────────────────────────────────────────────────────────

export async function createChitti(
  data: Omit<Chitti, "id" | "status" | "createdAt" | "updatedAt">,
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
  const row = await getDb().chittis.get(id);
  if (row) await queueCloudUpsert("chittis", row as unknown as Record<string, unknown>);
  return id;
}

export async function updateChittiStatus(id: string, status: ChittiStatus) {
  await updateChitti(id, { status });
}

export async function updateAvailedSlots(id: string, slots: ChittiAvailedSlot[]) {
  const hasAnyAvailed = slots.some((s) => s.availed);
  const firstAvailed = slots.find((s) => s.availed);
  await updateChitti(id, {
    availedSlots: slots,
    availed: hasAnyAvailed,
    availedDate: firstAvailed?.availedDate,
    availedAmount: firstAvailed?.availedAmount,
  });
}

export async function updateChitti(id: string, patch: Partial<Omit<Chitti, "id" | "createdAt">>) {
  const db = getDb();
  await db.chittis.update(id, { ...patch, updatedAt: Date.now() });
  const row = await db.chittis.get(id);
  if (row) await queueCloudUpsert("chittis", row as unknown as Record<string, unknown>);
}

export async function deleteChitti(id: string) {
  const db = getDb();
  const payments = await db.chittiPayments.where("chittiId").equals(id).toArray();
  await db.transaction("rw", db.chittis, db.chittiPayments, async () => {
    await db.chittiPayments.where("chittiId").equals(id).delete();
    await db.chittis.delete(id);
  });
  await Promise.all([
    ...payments.map((row) => queueCloudDelete("chittiPayments", row.id)),
    queueCloudDelete("chittis", id),
  ]);
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
    const updated = await db.chittiPayments.get(existing.id);
    if (updated)
      await queueCloudUpsert("chittiPayments", updated as unknown as Record<string, unknown>);
  } else {
    const payment = {
      id: nanoid(),
      chittiId,
      month,
      paidAmount,
      paidDate,
      notes: notes?.trim() || undefined,
      createdAt: now,
      updatedAt: now,
    };
    await db.chittiPayments.add(payment);
    await queueCloudUpsert("chittiPayments", payment as unknown as Record<string, unknown>);
  }
}

export async function deletePayment(chittiId: string, month: number) {
  const db = getDb();
  const row = await db.chittiPayments.where("[chittiId+month]").equals([chittiId, month]).first();
  if (!row) return;
  await db.chittiPayments.delete(row.id);
  await queueCloudDelete("chittiPayments", row.id);
}
