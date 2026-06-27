import Dexie, { type Table } from "dexie";
import type { DebtCategory, Person, Transaction } from "./types";

class LedgeDB extends Dexie {
  people!: Table<Person, string>;
  categories!: Table<DebtCategory, string>;
  transactions!: Table<Transaction, string>;

  constructor() {
    super("ledge-db");
    this.version(1).stores({
      people: "id, name, createdAt, updatedAt",
      categories: "id, personId, name, createdAt",
      transactions: "id, personId, categoryId, type, date, dueDate, createdAt",
    });
  }
}

// Lazy singleton — only instantiate in the browser to avoid SSR crashes.
let _db: LedgeDB | null = null;
export function getDb(): LedgeDB {
  if (typeof window === "undefined") {
    throw new Error("Dexie is browser-only");
  }
  if (!_db) _db = new LedgeDB();
  return _db;
}
