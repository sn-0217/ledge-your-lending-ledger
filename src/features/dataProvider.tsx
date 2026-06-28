import React, { createContext, useContext, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getDb } from "@/lib/db";
import {
  computeCategoryBalance,
  computePersonBalance,
} from "@/lib/repositories";
import * as peopleRepo from "@/lib/repositories";
import * as chittiRepo from "@/lib/chittiRepositories";
import type {
  Person,
  DebtCategory,
  Transaction,
  Chitti,
  ChittiMonthlyPayment,
  TransactionType,
  ChittiStatus,
  ChittiAvailedSlot,
} from "@/lib/types";
import { toast } from "sonner";
import { handleDataChanged } from "./backup/syncService";
import { getDatabaseBackupPayload } from "./backup/backupService";

// Types for undo actions
type DeletedItem =
  | { type: "transaction"; data: Transaction }
  | { type: "person"; data: Person; categories: DebtCategory[]; transactions: Transaction[] }
  | { type: "chitti"; data: Chitti; payments: ChittiMonthlyPayment[] };

export interface PersonRow {
  person: Person;
  balance: ReturnType<typeof computePersonBalance>;
  categories: { category: DebtCategory; balance: ReturnType<typeof computeCategoryBalance> }[];
}

interface DataContextType {
  people: Person[];
  categories: DebtCategory[];
  transactions: Transaction[];
  chittis: Chitti[];
  chittiPayments: ChittiMonthlyPayment[];
  personRows: PersonRow[];
  isLoading: boolean;

  // People Mutations
  createPerson: (input: Omit<Person, "id" | "createdAt" | "updatedAt"> & { defaultCategories?: boolean }) => Promise<Person>;
  updatePerson: (id: string, patch: Partial<Omit<Person, "id" | "createdAt">>) => Promise<void>;
  deletePerson: (id: string) => Promise<void>;

  // Transaction Mutations
  createTransaction: (input: Omit<Transaction, "id" | "createdAt" | "updatedAt">) => Promise<Transaction>;
  updateTransaction: (id: string, patch: Partial<Omit<Transaction, "id" | "createdAt">>) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;

  // Category Mutations
  createCategory: (personId: string, name: string) => Promise<DebtCategory>;
  renameCategory: (id: string, name: string) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;

  // Chitti Mutations
  createChitti: (data: Omit<Chitti, "id" | "status" | "createdAt" | "updatedAt">) => Promise<string>;
  updateChittiStatus: (id: string, status: ChittiStatus) => Promise<void>;
  updateAvailedSlots: (id: string, slots: ChittiAvailedSlot[]) => Promise<void>;
  updateChitti: (id: string, patch: Partial<Omit<Chitti, "id" | "createdAt">>) => Promise<void>;
  deleteChitti: (id: string) => Promise<void>;

  // Chitti Payment Mutations
  recordPayment: (chittiId: string, month: number, paidAmount: number, paidDate: number, notes?: string) => Promise<void>;
  deletePayment: (chittiId: string, month: number) => Promise<void>;

  // Undo delete status
  hasUndo: boolean;
  triggerUndo: () => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [lastDeleted, setLastDeleted] = useState<DeletedItem | null>(null);

  // Helper to trigger auto-sync
  const triggerAutoSync = () => {
    handleDataChanged(getDatabaseBackupPayload);
  };

  // Queries
  const { data: people = [], isLoading: loadingPeople } = useQuery({
    queryKey: ["people"],
    queryFn: async () => {
      const db = getDb();
      return db.people.orderBy("name").toArray();
    },
    placeholderData: (prev) => prev,
  });

  const { data: categories = [], isLoading: loadingCategories } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const db = getDb();
      return db.categories.toArray();
    },
    placeholderData: (prev) => prev,
  });

  const { data: transactions = [], isLoading: loadingTransactions } = useQuery({
    queryKey: ["transactions"],
    queryFn: async () => {
      const db = getDb();
      return db.transactions.toArray();
    },
    placeholderData: (prev) => prev,
  });

  const { data: chittis = [], isLoading: loadingChittis } = useQuery({
    queryKey: ["chittis"],
    queryFn: async () => {
      const db = getDb();
      return db.chittis.orderBy("createdAt").reverse().toArray();
    },
    placeholderData: (prev) => prev,
  });

  const { data: chittiPayments = [], isLoading: loadingPayments } = useQuery({
    queryKey: ["chittiPayments"],
    queryFn: async () => {
      const db = getDb();
      return db.chittiPayments.toArray();
    },
    placeholderData: (prev) => prev,
  });

  // Derived personRows (computed using useMemo to avoid recalculation lags)
  const personRows = useMemo<PersonRow[]>(() => {
    if (!people.length) return [];

    const txByCat = new Map<string, Transaction[]>();
    for (const t of transactions) {
      const arr = txByCat.get(t.categoryId) ?? [];
      arr.push(t);
      txByCat.set(t.categoryId, arr);
    }

    return people.map((person) => {
      const personCats = categories.filter((c) => c.personId === person.id);
      const catRows = personCats.map((category) => ({
        category,
        balance: computeCategoryBalance(category, txByCat.get(category.id) ?? []),
      }));
      return {
        person,
        balance: computePersonBalance(
          person.id,
          catRows.map((r) => r.balance)
        ),
        categories: catRows,
      };
    });
  }, [people, categories, transactions]);

  const isLoading =
    loadingPeople ||
    loadingCategories ||
    loadingTransactions ||
    loadingChittis ||
    loadingPayments;

  // --- Mutators using useMutation ---

  // 1. People
  const createPersonMutation = useMutation({
    mutationFn: peopleRepo.createPerson,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["people"] });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      triggerAutoSync();
    },
  });

  const updatePersonMutation = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: any }) => peopleRepo.updatePerson(id, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["people"] });
      triggerAutoSync();
    },
  });

  const deletePersonMutation = useMutation({
    mutationFn: async (id: string) => {
      const db = getDb();
      
      // Store all related items for undo before deleting
      const person = await db.people.get(id);
      if (person) {
        const cats = await db.categories.where("personId").equals(id).toArray();
        const txs = await db.transactions.where("personId").equals(id).toArray();
        setLastDeleted({
          type: "person",
          data: person,
          categories: cats,
          transactions: txs,
        });
      }

      await peopleRepo.deletePerson(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["people"] });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      triggerAutoSync();
      toast.success("Person deleted", {
        action: {
          label: "Undo",
          onClick: () => triggerUndo(),
        },
      });
    },
  });

  // 2. Transactions
  const createTransactionMutation = useMutation({
    mutationFn: peopleRepo.createTransaction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      triggerAutoSync();
    },
  });

  const updateTransactionMutation = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: any }) => peopleRepo.updateTransaction(id, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      triggerAutoSync();
    },
  });

  const deleteTransactionMutation = useMutation({
    mutationFn: async (id: string) => {
      const db = getDb();
      const tx = await db.transactions.get(id);
      if (tx) {
        setLastDeleted({ type: "transaction", data: tx });
      }
      await peopleRepo.deleteTransaction(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      triggerAutoSync();
      toast.success("Transaction deleted", {
        action: {
          label: "Undo",
          onClick: () => triggerUndo(),
        },
      });
    },
  });

  // 3. Categories
  const createCategoryMutation = useMutation({
    mutationFn: ({ personId, name }: { personId: string; name: string }) => peopleRepo.createCategory(personId, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      triggerAutoSync();
    },
  });

  const renameCategoryMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => peopleRepo.renameCategory(id, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      triggerAutoSync();
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: peopleRepo.deleteCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      triggerAutoSync();
    },
  });

  // 4. Chittis
  const createChittiMutation = useMutation({
    mutationFn: chittiRepo.createChitti,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chittis"] });
      triggerAutoSync();
    },
  });

  const updateChittiStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ChittiStatus }) => chittiRepo.updateChittiStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chittis"] });
      triggerAutoSync();
    },
  });

  const updateAvailedSlotsMutation = useMutation({
    mutationFn: ({ id, slots }: { id: string; slots: ChittiAvailedSlot[] }) => chittiRepo.updateAvailedSlots(id, slots),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chittis"] });
      triggerAutoSync();
    },
  });

  const updateChittiMutation = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: any }) => chittiRepo.updateChitti(id, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chittis"] });
      triggerAutoSync();
    },
  });

  const deleteChittiMutation = useMutation({
    mutationFn: async (id: string) => {
      const db = getDb();
      const chitti = await db.chittis.get(id);
      if (chitti) {
        const payments = await db.chittiPayments.where("chittiId").equals(id).toArray();
        setLastDeleted({
          type: "chitti",
          data: chitti,
          payments,
        });
      }
      await chittiRepo.deleteChitti(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chittis"] });
      queryClient.invalidateQueries({ queryKey: ["chittiPayments"] });
      triggerAutoSync();
      toast.success("Chitti deleted", {
        action: {
          label: "Undo",
          onClick: () => triggerUndo(),
        },
      });
    },
  });

  // 5. Chitti Payments
  const recordPaymentMutation = useMutation({
    mutationFn: ({ chittiId, month, paidAmount, paidDate, notes }: { chittiId: string; month: number; paidAmount: number; paidDate: number; notes?: string }) =>
      chittiRepo.recordPayment(chittiId, month, paidAmount, paidDate, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chittiPayments"] });
      triggerAutoSync();
    },
  });

  const deletePaymentMutation = useMutation({
    mutationFn: ({ chittiId, month }: { chittiId: string; month: number }) => chittiRepo.deletePayment(chittiId, month),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chittiPayments"] });
      triggerAutoSync();
    },
  });

  // Undo Delete trigger
  async function triggerUndo() {
    if (!lastDeleted) return;
    const db = getDb();
    
    try {
      if (lastDeleted.type === "transaction") {
        await db.transactions.add(lastDeleted.data);
        toast.success("Restored transaction");
      } else if (lastDeleted.type === "person") {
        await db.people.add(lastDeleted.data);
        if (lastDeleted.categories.length) {
          await db.categories.bulkAdd(lastDeleted.categories);
        }
        if (lastDeleted.transactions.length) {
          await db.transactions.bulkAdd(lastDeleted.transactions);
        }
        toast.success(`Restored "${lastDeleted.data.name}" and all records`);
      } else if (lastDeleted.type === "chitti") {
        await db.chittis.add(lastDeleted.data);
        if (lastDeleted.payments.length) {
          await db.chittiPayments.bulkAdd(lastDeleted.payments);
        }
        toast.success(`Restored Chitti "${lastDeleted.data.name || "Chitti"}"`);
      }
      
      // Invalidate all queries to show restored item
      queryClient.invalidateQueries();
      triggerAutoSync();
      setLastDeleted(null);
    } catch (e) {
      toast.error("Could not undo deletion: " + (e as Error).message);
    }
  }

  const contextValue = useMemo<DataContextType>(() => ({
    people,
    categories,
    transactions,
    chittis,
    chittiPayments,
    personRows,
    isLoading,

    createPerson: (input) => createPersonMutation.mutateAsync(input),
    updatePerson: (id, patch) => updatePersonMutation.mutateAsync({ id, patch }),
    deletePerson: (id) => deletePersonMutation.mutateAsync(id),

    createTransaction: (input) => createTransactionMutation.mutateAsync(input),
    updateTransaction: (id, patch) => updateTransactionMutation.mutateAsync({ id, patch }),
    deleteTransaction: (id) => deleteTransactionMutation.mutateAsync(id),

    createCategory: (personId, name) => createCategoryMutation.mutateAsync({ personId, name }),
    renameCategory: (id, name) => renameCategoryMutation.mutateAsync({ id, name }),
    deleteCategory: (id) => deleteCategoryMutation.mutateAsync(id),

    createChitti: (data) => createChittiMutation.mutateAsync(data),
    updateChittiStatus: (id, status) => updateChittiStatusMutation.mutateAsync({ id, status }),
    updateAvailedSlots: (id, slots) => updateAvailedSlotsMutation.mutateAsync({ id, slots }),
    updateChitti: (id, patch) => updateChittiMutation.mutateAsync({ id, patch }),
    deleteChitti: (id) => deleteChittiMutation.mutateAsync(id),

    recordPayment: (chittiId, month, paidAmount, paidDate, notes) =>
      recordPaymentMutation.mutateAsync({ chittiId, month, paidAmount, paidDate, notes }),
    deletePayment: (chittiId, month) => deletePaymentMutation.mutateAsync({ chittiId, month }),

    hasUndo: lastDeleted !== null,
    triggerUndo,
  }), [
    people,
    categories,
    transactions,
    chittis,
    chittiPayments,
    personRows,
    isLoading,
    lastDeleted,
  ]);

  return <DataContext.Provider value={contextValue}>{children}</DataContext.Provider>;
}

export function useLedge() {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error("useLedge must be used within a DataProvider");
  }
  return context;
}
