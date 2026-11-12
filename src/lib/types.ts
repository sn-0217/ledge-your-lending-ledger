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
  repaymentPlanId?: ID;
  repaymentDueDate?: number;
  createdAt: number;
  updatedAt: number;
}

/** A no-interest schedule for manually repaying an existing person/category debt. */
export interface RepaymentPlan {
  id: ID;
  personId: ID;
  categoryId: ID;
  /** Snapshot of the amount owed when the plan was created. */
  totalAmount?: number;
  /** Number of monthly installments. Optional for compatibility with early plan records. */
  totalMonths?: number;
  /** Whether the user chose the duration or the fixed monthly target. */
  scheduleMode?: "months" | "amount";
  monthlyAmount: number;
  firstDueDate: number;
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

// ─── Chitti / Chitfund (My Participation Tracker) ─────────────────────────────
// Completely independent of the lending/borrowing module.
// Uses the same People list only to identify the organizer.

export type ChittiStatus = "active" | "completed" | "cancelled";

export interface ChittiAvailedSlot {
  chitNumber: number; // 1 to numChits
  availed: boolean;
  availedDate?: number;
  availedAmount?: number;
}

export interface Chitti {
  id: ID;
  organizerId: ID; // Person.id who runs this chitti
  name?: string; // optional label
  monthlyAmount: number; // amount per chit per month (e.g. 5000)
  numChits: number; // how many chits I joined (e.g. 2)
  startDate: number; // timestamp of month-1 (first day of start month)
  totalMonths: number; // total duration in months
  status: ChittiStatus;
  // Availed slots (one per joined chit)
  availedSlots?: ChittiAvailedSlot[];
  // Legacy availed fields (for fallback)
  availed: boolean;
  availedDate?: number;
  availedAmount?: number;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export interface ChittiMonthlyPayment {
  id: ID;
  chittiId: ID;
  month: number; // 1-based round number
  paidAmount: number;
  paidDate: number; // timestamp
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export type LoanKind = "house" | "car" | "personal" | "other";
export type LoanStatus = "active" | "completed" | "cancelled";

/** A no-interest tracking record for a manually repaid house, car, or other loan. */
export interface Loan {
  id: ID;
  name: string;
  kind: LoanKind;
  lender: string;
  principalAmount: number;
  monthlyAmount: number;
  totalMonths: number;
  startDate: number;
  status: LoanStatus;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

/** One manually recorded payment for a loan month. */
export interface LoanMonthlyPayment {
  id: ID;
  loanId: ID;
  month: number;
  paidAmount: number;
  paidDate: number;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}
