import { useLiveQuery } from "dexie-react-hooks";
import { getDb } from "./db";
import type { Chitti, ChittiMonthlyPayment } from "./types";

export function useChittis(): Chitti[] | undefined {
  return useLiveQuery(() => getDb().chittis.orderBy("createdAt").reverse().toArray(), []);
}

export function useChitti(id: string | undefined): Chitti | undefined {
  return useLiveQuery(() => (id ? getDb().chittis.get(id) : undefined), [id]);
}

export function useChittiPayments(chittiId: string | undefined): ChittiMonthlyPayment[] | undefined {
  return useLiveQuery(
    () => (chittiId ? getDb().chittiPayments.where("chittiId").equals(chittiId).toArray() : []),
    [chittiId],
  );
}

/** All payments for active chittis — used for dashboard totals */
export function useAllChittiPayments(): ChittiMonthlyPayment[] | undefined {
  return useLiveQuery(() => getDb().chittiPayments.toArray(), []);
}
