export type ID = string;

export type PersonTag = "family" | "friends" | "work" | "other";

export interface Person {
  id: ID;
  name: string;
  phone?: string;
  tags: PersonTag[];
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export interface DebtCategory {
  id: ID;
  personId: ID;
  name: string;
  createdAt: number;
  updatedAt: number;
}

export type TransactionType = "lent" | "borrowed" | "repayment_in" | "repayment_out";
// lent           : I gave money (they owe me)
// borrowed       : They gave me money (I owe them)
// repayment_in   : They paid me back (reduces what they owe me)
// repayment_out  : I paid them back (reduces what I owe them)

export interface Transaction {
  id: ID;
  personId: ID;
  categoryId: ID;
  type: TransactionType;
  amount: number;
  date: number;
  dueDate?: number;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export interface CategoryBalance {
  categoryId: ID;
  personId: ID;
  outstanding: number; // positive = they owe me, negative = I owe them
  totalLent: number;
  totalBorrowed: number;
  totalReceived: number;
  totalPaid: number;
  settled: boolean;
  lastActivity: number;
  nextDue?: number;
  overdue: boolean;
}

export interface PersonBalance {
  personId: ID;
  outstanding: number;
  categoryCount: number;
  activeCount: number;
  settled: boolean;
  lastActivity: number;
}
