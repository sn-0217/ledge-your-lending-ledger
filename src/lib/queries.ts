import { useLiveQuery } from "dexie-react-hooks";
import { getDb } from "./db";
import {
  computeCategoryBalance,
  computePersonBalance,
} from "./repositories";
import type { CategoryBalance, DebtCategory, Person, PersonBalance, Transaction } from "./types";

export function usePeople(): Person[] | undefined {
  return useLiveQuery(() => getDb().people.orderBy("name").toArray(), []);
}

export function usePerson(id: string | undefined): Person | undefined {
  return useLiveQuery(() => (id ? getDb().people.get(id) : undefined), [id]);
}

export function useCategoriesFor(personId: string | undefined): DebtCategory[] | undefined {
  return useLiveQuery(
    () => (personId ? getDb().categories.where("personId").equals(personId).toArray() : []),
    [personId],
  );
}

export function useAllCategories(): DebtCategory[] | undefined {
  return useLiveQuery(() => getDb().categories.toArray(), []);
}

export function useTransactionsFor(
  personId: string | undefined,
): Transaction[] | undefined {
  return useLiveQuery(
    () =>
      personId
        ? getDb().transactions.where("personId").equals(personId).toArray()
        : [],
    [personId],
  );
}

export function useAllTransactions(): Transaction[] | undefined {
  return useLiveQuery(() => getDb().transactions.toArray(), []);
}

export interface PersonRow {
  person: Person;
  balance: PersonBalance;
  categories: { category: DebtCategory; balance: CategoryBalance }[];
}

export function useAllPersonRows(): PersonRow[] | undefined {
  const people = usePeople();
  const cats = useAllCategories();
  const txs = useAllTransactions();
  if (!people || !cats || !txs) return undefined;

  const txByCat = new Map<string, Transaction[]>();
  for (const t of txs) {
    const arr = txByCat.get(t.categoryId) ?? [];
    arr.push(t);
    txByCat.set(t.categoryId, arr);
  }

  return people.map((person) => {
    const personCats = cats.filter((c) => c.personId === person.id);
    const catRows = personCats.map((category) => ({
      category,
      balance: computeCategoryBalance(category, txByCat.get(category.id) ?? []),
    }));
    return {
      person,
      balance: computePersonBalance(
        person.id,
        catRows.map((r) => r.balance),
      ),
      categories: catRows,
    };
  });
}
