import Dexie, { type Table } from "dexie";
import type {
  Chitti,
  ChittiMonthlyPayment,
  DebtCategory,
  Person,
  RepaymentPlan,
  Transaction,
} from "./types";

export const LEDGE_COLLECTIONS = [
  "people",
  "categories",
  "transactions",
  "chittis",
  "chittiPayments",
  "repaymentPlans",
] as const;

export type LedgeCollection = (typeof LEDGE_COLLECTIONS)[number];

export interface SyncOutboxEntry {
  ownerId: string;
  collection: LedgeCollection;
  recordId: string;
  operation: "upsert" | "delete";
  payload: Record<string, unknown> | null;
  changedAt: number;
}

class LedgeDB extends Dexie {
  people!: Table<Person, string>;
  categories!: Table<DebtCategory, string>;
  transactions!: Table<Transaction, string>;
  chittis!: Table<Chitti, string>;
  chittiPayments!: Table<ChittiMonthlyPayment, string>;
  repaymentPlans!: Table<RepaymentPlan, string>;
  syncOutbox!: Table<SyncOutboxEntry, [string, string, string]>;

  constructor(name: string) {
    super(name);
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
    this.version(3).stores({
      people: "id, name, createdAt, updatedAt",
      categories: "id, personId, name, createdAt",
      transactions: "id, personId, categoryId, type, date, dueDate, createdAt",
      chittis: "id, organizerId, status, createdAt, updatedAt",
      chittiPayments: "id, chittiId, month, [chittiId+month]",
      syncOutbox: "[ownerId+collection+recordId], ownerId, changedAt",
    });
    this.version(4).stores({
      people: "id, name, createdAt, updatedAt",
      categories: "id, personId, name, createdAt",
      transactions: "id, personId, categoryId, type, date, dueDate, createdAt",
      chittis: "id, organizerId, status, createdAt, updatedAt",
      chittiPayments: "id, chittiId, month, [chittiId+month]",
      syncOutbox: "[ownerId+collection+recordId], ownerId, changedAt",
      repaymentPlans: "id, personId, categoryId, firstDueDate, createdAt, updatedAt",
    });
    this.version(5).stores({
      people: "id, name, createdAt, updatedAt",
      categories: "id, personId, name, createdAt",
      transactions: "id, personId, categoryId, repaymentPlanId, type, date, dueDate, createdAt",
      chittis: "id, organizerId, status, createdAt, updatedAt",
      chittiPayments: "id, chittiId, month, [chittiId+month]",
      syncOutbox: "[ownerId+collection+recordId], ownerId, changedAt",
      repaymentPlans: "id, personId, categoryId, firstDueDate, createdAt, updatedAt",
    });
  }
}

const databases = new Map<string, LedgeDB>();
let activeUserId: string | null = null;

function getDatabase(name: string): LedgeDB {
  let db = databases.get(name);
  if (!db) {
    db = new LedgeDB(name);
    databases.set(name, db);
  }
  return db;
}

export function setActiveDatabaseUser(userId: string | null) {
  activeUserId = userId;
}

export function getDb(): LedgeDB {
  if (typeof window === "undefined") throw new Error("Dexie is browser-only");
  return getDatabase(activeUserId ? `ledge-db-user-${activeUserId}` : "ledge-db");
}

/** Claim the pre-account local database for the first Ledge account on this device. */
export async function migrateLegacyLocalDatabase(userId: string) {
  if (typeof window === "undefined") return;

  const legacyOwner = localStorage.getItem("ledge:legacy-local-owner");
  if (legacyOwner && legacyOwner !== userId) return;

  const legacy = getDatabase("ledge-db");
  const accountDb = getDatabase(`ledge-db-user-${userId}`);
  const [
    legacyPeople,
    legacyCategories,
    legacyTransactions,
    legacyChittis,
    legacyPayments,
    legacyRepaymentPlans,
  ] = await Promise.all([
    legacy.people.toArray(),
    legacy.categories.toArray(),
    legacy.transactions.toArray(),
    legacy.chittis.toArray(),
    legacy.chittiPayments.toArray(),
    legacy.repaymentPlans.toArray(),
  ]);
  const localRecords = [
    ...legacyPeople,
    ...legacyCategories,
    ...legacyTransactions,
    ...legacyChittis,
    ...legacyPayments,
    ...legacyRepaymentPlans,
  ];
  if (localRecords.length === 0) return;

  const accountRecordCount = await Promise.all([
    accountDb.people.count(),
    accountDb.categories.count(),
    accountDb.transactions.count(),
    accountDb.chittis.count(),
    accountDb.chittiPayments.count(),
    accountDb.repaymentPlans.count(),
  ]).then((counts) => counts.reduce((total, count) => total + count, 0));

  if (accountRecordCount === 0) {
    await accountDb.transaction(
      "rw",
      [
        accountDb.people,
        accountDb.categories,
        accountDb.transactions,
        accountDb.chittis,
        accountDb.chittiPayments,
        accountDb.repaymentPlans,
      ],
      async () => {
        if (legacyPeople.length) await accountDb.people.bulkPut(legacyPeople);
        if (legacyCategories.length) await accountDb.categories.bulkPut(legacyCategories);
        if (legacyTransactions.length) await accountDb.transactions.bulkPut(legacyTransactions);
        if (legacyChittis.length) await accountDb.chittis.bulkPut(legacyChittis);
        if (legacyPayments.length) await accountDb.chittiPayments.bulkPut(legacyPayments);
        if (legacyRepaymentPlans.length)
          await accountDb.repaymentPlans.bulkPut(legacyRepaymentPlans);
      },
    );
  }

  localStorage.setItem("ledge:legacy-local-owner", userId);
}
