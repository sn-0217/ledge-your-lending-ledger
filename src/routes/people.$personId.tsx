import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { GlassCard } from "@/components/common/GlassCard";
import { ClientOnly } from "@/components/common/ClientOnly";
import {
  useCategoriesFor,
  usePerson,
  useTransactionsFor,
} from "@/lib/queries";
import {
  computeCategoryBalance,
  createCategory,
  deleteCategory,
  deletePerson,
  deleteTransaction,
  renameCategory,
} from "@/lib/repositories";
import { useFormatMoney, initials, relativeDate } from "@/lib/formatters";
import { ArrowLeft, MoreHorizontal, Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMemo, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { PersonForm } from "@/components/forms/PersonForm";
import { TransactionForm } from "@/components/forms/TransactionForm";
import type { DebtCategory, Transaction, TransactionType } from "@/lib/types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

/** Bottom sheet on mobile, centered card on sm+ screens */
function WebModal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            key="modal"
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 32 }}
            transition={{ type: "spring", stiffness: 340, damping: 32 }}
            className={cn(
              "glass-strong fixed z-50 overflow-y-auto",
              "bottom-0 left-0 right-0 max-h-[92dvh] rounded-t-3xl px-4 pb-[max(env(safe-area-inset-bottom),1.25rem)] pt-4",
              "sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:max-h-[85dvh] sm:w-full sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl sm:px-6 sm:pb-6 sm:pt-6",
            )}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold">{title}</h2>
              <button
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary/50 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export const Route = createFileRoute("/people/$personId")({
  head: () => ({ meta: [{ title: "Person — Ledge" }] }),
  component: () => (
    <AppShell>
      <ClientOnly>
        <PersonDetail />
      </ClientOnly>
    </AppShell>
  ),
});

function PersonDetail() {
  const { personId } = Route.useParams();
  const navigate = useNavigate();
  const person = usePerson(personId);
  const cats = useCategoriesFor(personId);
  const txs = useTransactionsFor(personId);
  const fmt = useFormatMoney();
  const [editing, setEditing] = useState(false);

  const categoryRows = useMemo(() => {
    if (!cats || !txs) return [];
    return cats
      .map((c) => ({
        category: c,
        txs: txs
          .filter((t) => t.categoryId === c.id)
          .sort((a, b) => b.date - a.date),
      }))
      .map((r) => ({
        ...r,
        balance: computeCategoryBalance(r.category, r.txs),
      }))
      .sort((a, b) => b.balance.lastActivity - a.balance.lastActivity);
  }, [cats, txs]);

  const totals = useMemo(() => {
    let out = 0;
    for (const r of categoryRows) out += r.balance.outstanding;
    return out;
  }, [categoryRows]);

  if (person === undefined || cats === undefined || txs === undefined) {
    return <div className="h-40 animate-pulse rounded-3xl bg-muted/30" />;
  }
  if (person === null || !person) {
    return (
      <GlassCard className="p-6 text-center text-sm text-muted-foreground">
        Person not found.{" "}
        <Link to="/people" className="text-primary">
          Back to People
        </Link>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-5">
      <header className="flex items-center gap-2">
        <Link
          to="/people"
          className="grid h-10 w-10 place-items-center rounded-full bg-muted/40 text-muted-foreground hover:text-foreground"
          aria-label="Back"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1" />
        <Button variant="ghost" size="icon" className="rounded-full" onClick={() => setEditing(true)}>
          <Pencil className="h-4 w-4" />
        </Button>
        <WebModal open={editing} onClose={() => setEditing(false)} title="Edit person">
          <PersonForm person={person} onSubmitted={() => setEditing(false)} />
        </WebModal>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full text-destructive">
              <Trash2 className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="glass-strong">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {person.name}?</AlertDialogTitle>
              <AlertDialogDescription>
                This removes the person and all their categories and transactions. This cannot be
                undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={async () => {
                  await deletePerson(person.id);
                  toast.success("Person deleted");
                  navigate({ to: "/people" });
                }}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </header>

      <GlassCard strong className="relative overflow-hidden p-6">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-accent/20 blur-3xl" />
        <div className="flex items-center gap-4">
          <div className="grid h-16 w-16 place-items-center rounded-3xl bg-gradient-to-br from-primary/40 to-accent/40 text-xl font-bold">
            {initials(person.name)}
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold">{person.name}</h1>
            <div className="mt-0.5 flex flex-wrap gap-1.5">
              {person.tags.map((t) => (
                <span
                  key={t}
                  className="rounded-full bg-secondary/60 px-2 py-0.5 text-[10px] font-medium capitalize text-muted-foreground"
                >
                  {t}
                </span>
              ))}
              {person.phone && (
                <span className="rounded-full bg-secondary/60 px-2 py-0.5 text-[10px] text-muted-foreground">
                  {person.phone}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="mt-5">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">
            Net outstanding
          </div>
          <div
            className={cn(
              "text-3xl font-bold tabular-nums",
              totals > 0 && "text-[oklch(0.85_0.18_155)]",
              totals < 0 && "text-[oklch(0.78_0.22_22)]",
              totals === 0 && "text-muted-foreground",
            )}
          >
            {totals === 0 ? "Settled" : fmt(Math.abs(totals))}
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {totals > 0 ? "owes you" : totals < 0 ? "you owe" : "nothing pending"}
          </div>
        </div>
      </GlassCard>

      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-semibold text-muted-foreground">Categories</h2>
          <AddCategoryButton personId={person.id} />
        </div>

        {categoryRows.length === 0 ? (
          <GlassCard className="p-6 text-center text-sm text-muted-foreground">
            No categories yet.
          </GlassCard>
        ) : (
          categoryRows.map((r) => (
            <CategoryBlock
              key={r.category.id}
              category={r.category}
              txs={r.txs}
              balance={r.balance.outstanding}
              personId={person.id}
            />
          ))
        )}
      </section>
    </div>
  );
}

function AddCategoryButton({ personId }: { personId: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 rounded-full bg-primary/15 px-3 py-1 text-xs font-medium text-primary"
      >
        <Plus className="h-3 w-3" /> Category
      </button>
      <WebModal open={open} onClose={() => setOpen(false)} title="Add category">
        <div className="space-y-3">
          <Input
            autoFocus
            placeholder="e.g. Gold Loan"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && name.trim()) {
                createCategory(personId, name).then(() => {
                  toast.success("Category added");
                  setName("");
                  setOpen(false);
                });
              }
            }}
          />
          <Button
            className="w-full"
            onClick={async () => {
              if (!name.trim()) return;
              await createCategory(personId, name);
              toast.success("Category added");
              setName("");
              setOpen(false);
            }}
          >
            Add
          </Button>
        </div>
      </WebModal>
    </>
  );
}

function CategoryBlock({
  category,
  txs,
  balance,
  personId,
}: {
  category: DebtCategory;
  txs: Transaction[];
  balance: number;
  personId: string;
}) {
  const fmt = useFormatMoney();
  const [open, setOpen] = useState(balance !== 0);
  const [addOpen, setAddOpen] = useState(false);
  const [addType, setAddType] = useState<TransactionType>("lent");
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState(category.name);

  return (
    <GlassCard className="overflow-hidden">
      <Collapsible open={open} onOpenChange={setOpen}>
        <div className="flex items-center gap-2 p-4">
          <CollapsibleTrigger asChild>
            <button className="flex flex-1 items-center gap-2 text-left">
              <ChevronDown
                className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")}
              />
              <div className="min-w-0">
                {renaming ? (
                  <Input
                    autoFocus
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onBlur={async () => {
                      if (newName.trim() && newName !== category.name) {
                        await renameCategory(category.id, newName);
                      }
                      setRenaming(false);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.currentTarget.blur();
                      if (e.key === "Escape") {
                        setNewName(category.name);
                        setRenaming(false);
                      }
                    }}
                    className="h-7"
                  />
                ) : (
                  <div className="truncate font-semibold">{category.name}</div>
                )}
                <div className="text-xs text-muted-foreground">
                  {txs.length} {txs.length === 1 ? "entry" : "entries"}
                </div>
              </div>
            </button>
          </CollapsibleTrigger>
          <div className="text-right">
            <div
              className={cn(
                "text-sm font-semibold tabular-nums",
                balance > 0 && "text-[oklch(0.85_0.18_155)]",
                balance < 0 && "text-[oklch(0.78_0.22_22)]",
                balance === 0 && "text-muted-foreground",
              )}
            >
              {balance === 0 ? "Settled" : fmt(Math.abs(balance))}
            </div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {balance > 0 ? "to receive" : balance < 0 ? "to pay" : ""}
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="glass-strong">
              <DropdownMenuItem onClick={() => setRenaming(true)}>
                <Pencil className="h-4 w-4" /> Rename
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive"
                onClick={async () => {
                  await deleteCategory(category.id);
                  toast.success("Category deleted");
                }}
              >
                <Trash2 className="h-4 w-4" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <CollapsibleContent>
          <div className="space-y-2 border-t border-border/60 p-3">
            <div className="grid grid-cols-4 gap-1.5">
              {(
                [
                  ["lent", "Give"],
                  ["borrowed", "Borrow"],
                  ["repayment_in", "Got back"],
                  ["repayment_out", "Paid back"],
                ] as const
              ).map(([t, label]) => (
                <button
                  key={t}
                  onClick={() => {
                    setAddType(t);
                    setAddOpen(true);
                  }}
                  className="rounded-xl bg-secondary/40 px-2 py-2 text-[11px] font-medium text-foreground/80 hover:text-foreground"
                >
                  + {label}
                </button>
              ))}
            </div>

            {txs.length === 0 ? (
              <div className="px-2 py-6 text-center text-xs text-muted-foreground">
                No entries yet.
              </div>
            ) : (
              <TxList txs={txs} />
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>

      <WebModal open={addOpen} onClose={() => setAddOpen(false)} title="Add entry">
        <TransactionForm
          type={addType}
          defaultPersonId={personId}
          defaultCategoryId={category.id}
          onSubmitted={() => setAddOpen(false)}
        />
      </WebModal>
    </GlassCard>
  );
}

const TYPE_META: Record<TransactionType, { label: string; sign: "in" | "out" }> = {
  lent: { label: "Lent", sign: "out" },
  borrowed: { label: "Borrowed", sign: "in" },
  repayment_in: { label: "Received", sign: "in" },
  repayment_out: { label: "Paid", sign: "out" },
};

const INITIAL_VISIBLE = 3;

function TxList({ txs }: { txs: Transaction[] }) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? txs : txs.slice(0, INITIAL_VISIBLE);
  return (
    <>
      <ul className="divide-y divide-border/60">
        {visible.map((t) => (
          <TxRow key={t.id} tx={t} />
        ))}
      </ul>
      {txs.length > INITIAL_VISIBLE && (
        <button
          onClick={() => setShowAll((v) => !v)}
          className="mt-1 w-full rounded-xl py-1.5 text-center text-xs font-medium text-primary hover:underline"
        >
          {showAll ? "Show less" : `Show all ${txs.length} entries`}
        </button>
      )}
    </>
  );
}

function TxRow({ tx }: { tx: Transaction }) {
  const fmt = useFormatMoney();
  const meta = TYPE_META[tx.type];
  const positive = tx.type === "lent" || tx.type === "repayment_out";
  const [editOpen, setEditOpen] = useState(false);
  return (
    <li className="flex items-center gap-3 py-2.5">
      <div
        className={cn(
          "grid h-9 w-9 place-items-center rounded-2xl text-xs font-bold",
          positive
            ? "bg-[oklch(0.78_0.17_155/0.18)] text-[oklch(0.85_0.18_155)]"
            : "bg-[oklch(0.78_0.22_22/0.18)] text-[oklch(0.85_0.22_22)]",
        )}
      >
        {meta.label[0]}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">{meta.label}</div>
        <div className="text-xs text-muted-foreground">
          {new Date(tx.date).toLocaleDateString(undefined, {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
          {tx.dueDate ? ` · due ${relativeDate(tx.dueDate)}` : ""}
        </div>
        {tx.notes && (
          <div className="mt-0.5 truncate text-xs text-muted-foreground">{tx.notes}</div>
        )}
      </div>
      <div className="text-right">
        <div
          className={cn(
            "text-sm font-semibold tabular-nums",
            positive ? "text-[oklch(0.85_0.18_155)]" : "text-[oklch(0.78_0.22_22)]",
          )}
        >
          {positive ? "+" : "−"}
          {fmt(tx.amount)}
        </div>
      </div>

      {/* Edit */}
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 rounded-full text-muted-foreground"
        onClick={() => setEditOpen(true)}
      >
        <Pencil className="h-3.5 w-3.5" />
      </Button>
      <WebModal open={editOpen} onClose={() => setEditOpen(false)} title="Edit entry">
        <TransactionForm
          type={tx.type}
          transaction={tx}
          onSubmitted={() => setEditOpen(false)}
        />
      </WebModal>

      {/* Delete */}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full text-muted-foreground">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent className="glass-strong">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete entry?</AlertDialogTitle>
            <AlertDialogDescription>
              This entry will be removed and balances will recalculate.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                await deleteTransaction(tx.id);
                toast.success("Entry deleted");
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  );
}
