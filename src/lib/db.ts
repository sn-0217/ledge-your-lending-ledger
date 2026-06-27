import Dexie, { type Table } from "dexie";
import type { Chitti, ChittiMonthlyPayment, DebtCategory, Person, Transaction } from "./types";

class LedgeDB extends Dexie {
  people!: Table<Person, string>;
  categories!: Table<DebtCategory, string>;
  transactions!: Table<Transaction, string>;
  chittis!: Table<Chitti, string>;
  chittiPayments!: Table<ChittiMonthlyPayment, string>;

  constructor() {
    super("ledge-db");
    this.version(1).stores({
      people: "id, name, createdAt, updatedAt",
      categories: "id, personId, name, createdAt",
      transactions: "id, personId, categoryId, type, date, dueDate, createdAt",
    });
    // Version 2: Chitti personal participation tracker
    this.version(2).stores({
      people: "id, name, createdAt, updatedAt",
      categories: "id, personId, name, createdAt",
      transactions: "id, personId, categoryId, type, date, dueDate, createdAt",
      chittis: "id, organizerId, status, createdAt, updatedAt",
      chittiPayments: "id, chittiId, month, [chittiId+month]",
    });
  }
}

let _db: LedgeDB | null = null;
export function getDb(): LedgeDB {
  if (typeof window === "undefined") throw new Error("Dexie is browser-only");
  if (!_db) _db = new LedgeDB();
  return _db;
}
