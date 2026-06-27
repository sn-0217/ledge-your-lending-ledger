import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePeople, useCategoriesFor } from "@/lib/queries";
import { createCategory, createTransaction } from "@/lib/repositories";
import type { TransactionType } from "@/lib/types";
import { toast } from "sonner";

const schema = z.object({
  personId: z.string().min(1, "Pick a person"),
  categoryId: z.string().min(1, "Pick a category"),
  amount: z.coerce.number().positive("Amount must be positive").max(1e12),
  date: z.string().min(1),
  dueDate: z.string().optional(),
  notes: z.string().max(500).optional(),
});

export type TransactionFormValues = z.infer<typeof schema>;

const todayISO = () => new Date().toISOString().slice(0, 10);

export interface TransactionFormProps {
  type: TransactionType;
  defaultPersonId?: string;
  defaultCategoryId?: string;
  onSubmitted?: () => void;
}

const TYPE_LABELS: Record<TransactionType, { title: string; cta: string; success: string }> = {
  lent: { title: "Give Money", cta: "Record loan", success: "Loan recorded" },
  borrowed: {
    title: "Borrow Money",
    cta: "Record borrow",
    success: "Borrow recorded",
  },
  repayment_in: {
    title: "Receive Repayment",
    cta: "Record received",
    success: "Repayment received",
  },
  repayment_out: { title: "Pay Back", cta: "Record paid", success: "Repayment paid" },
};

export function TransactionForm({
  type,
  defaultPersonId,
  defaultCategoryId,
  onSubmitted,
}: TransactionFormProps) {
  const people = usePeople();
  const labels = TYPE_LABELS[type];

  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      personId: defaultPersonId ?? "",
      categoryId: defaultCategoryId ?? "",
      amount: undefined as unknown as number,
      date: todayISO(),
      dueDate: "",
      notes: "",
    },
  });

  const personId = form.watch("personId");
  const categories = useCategoriesFor(personId || undefined);
  const [creatingCat, setCreatingCat] = useState(false);
  const [newCatName, setNewCatName] = useState("");

  // Auto-pick first category when switching people
  useEffect(() => {
    if (!categories || categories.length === 0) return;
    const current = form.getValues("categoryId");
    if (!current || !categories.some((c) => c.id === current)) {
      form.setValue("categoryId", categories[0].id, { shouldValidate: true });
    }
  }, [categories, form]);

  const sortedPeople = useMemo(
    () => (people ? [...people].sort((a, b) => a.name.localeCompare(b.name)) : []),
    [people],
  );

  async function onCreateCategory() {
    if (!personId || !newCatName.trim()) return;
    const c = await createCategory(personId, newCatName);
    setNewCatName("");
    setCreatingCat(false);
    form.setValue("categoryId", c.id, { shouldValidate: true });
    toast.success(`Category "${c.name}" added`);
  }

  async function onSubmit(values: TransactionFormValues) {
    try {
      await createTransaction({
        personId: values.personId,
        categoryId: values.categoryId,
        type,
        amount: Number(values.amount),
        date: new Date(values.date).getTime(),
        dueDate: values.dueDate ? new Date(values.dueDate).getTime() : undefined,
        notes: values.notes?.trim() || undefined,
      });
      toast.success(labels.success);
      onSubmitted?.();
    } catch (e) {
      toast.error((e as Error).message ?? "Could not save");
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1.5">
        <Label>Person</Label>
        <Select
          value={form.watch("personId")}
          onValueChange={(v) => form.setValue("personId", v, { shouldValidate: true })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select person" />
          </SelectTrigger>
          <SelectContent>
            {sortedPeople.length === 0 ? (
              <div className="px-3 py-2 text-sm text-muted-foreground">No people yet</div>
            ) : (
              sortedPeople.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
        {form.formState.errors.personId && (
          <p className="text-xs text-destructive">{form.formState.errors.personId.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label>Category</Label>
          {personId && (
            <button
              type="button"
              className="text-xs text-primary"
              onClick={() => setCreatingCat((v) => !v)}
            >
              {creatingCat ? "Cancel" : "+ New"}
            </button>
          )}
        </div>
        {creatingCat ? (
          <div className="flex gap-2">
            <Input
              autoFocus
              placeholder="e.g. Gold Loan"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
            />
            <Button type="button" onClick={onCreateCategory}>
              Add
            </Button>
          </div>
        ) : (
          <Select
            value={form.watch("categoryId")}
            onValueChange={(v) => form.setValue("categoryId", v, { shouldValidate: true })}
            disabled={!personId}
          >
            <SelectTrigger>
              <SelectValue placeholder={personId ? "Select category" : "Pick a person first"} />
            </SelectTrigger>
            <SelectContent>
              {(categories ?? []).map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {form.formState.errors.categoryId && (
          <p className="text-xs text-destructive">{form.formState.errors.categoryId.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label>Amount</Label>
        <Input
          type="number"
          inputMode="decimal"
          step="0.01"
          placeholder="0"
          {...form.register("amount")}
        />
        {form.formState.errors.amount && (
          <p className="text-xs text-destructive">{form.formState.errors.amount.message}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Date</Label>
          <Input type="date" {...form.register("date")} />
        </div>
        <div className="space-y-1.5">
          <Label>
            {type === "lent" || type === "borrowed" ? "Due date" : "Reminder"}{" "}
            <span className="text-xs text-muted-foreground">(optional)</span>
          </Label>
          <Input type="date" {...form.register("dueDate")} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Notes</Label>
        <Textarea rows={2} placeholder="Anything to remember…" {...form.register("notes")} />
      </div>

      <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
        {labels.cta}
      </Button>
    </form>
  );
}
