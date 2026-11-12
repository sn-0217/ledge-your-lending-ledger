import { useState } from "react";
import { toast } from "sonner";
import { useLedge } from "@/features/dataProvider";
import type { Loan, LoanKind } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useFormatMoney } from "@/lib/formatters";

const KIND_LABELS: Record<LoanKind, string> = {
  house: "House",
  car: "Car",
  personal: "Personal",
  other: "Other",
};

function toMonthInput(timestamp: number) {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function LoanForm({ loan, onDone }: { loan?: Loan; onDone: () => void }) {
  const { createLoan, updateLoan } = useLedge();
  const fmt = useFormatMoney();
  const [name, setName] = useState(loan?.name ?? "");
  const [kind, setKind] = useState<LoanKind>(loan?.kind ?? "house");
  const [lender, setLender] = useState(loan?.lender ?? "");
  const [principal, setPrincipal] = useState(loan ? String(loan.principalAmount) : "");
  const [monthlyAmount, setMonthlyAmount] = useState(loan ? String(loan.monthlyAmount) : "");
  const [totalMonths, setTotalMonths] = useState(loan ? String(loan.totalMonths) : "");
  const [startMonth, setStartMonth] = useState(() => toMonthInput(loan?.startDate ?? Date.now()));
  const [notes, setNotes] = useState(loan?.notes ?? "");
  const [saving, setSaving] = useState(false);

  const principalAmount = Number(principal);
  const monthly = Number(monthlyAmount);
  const months = Number(totalMonths);
  const scheduledTotal = monthly > 0 && months > 0 ? monthly * months : 0;

  async function submit() {
    const amount = Number(principal);
    const installment = Number(monthlyAmount);
    const duration = Number(totalMonths);
    if (!name.trim()) return toast.error("Enter a name for this loan");
    if (!lender.trim()) return toast.error("Enter the lender");
    if (!Number.isFinite(amount) || amount <= 0) return toast.error("Enter a valid loan amount");
    if (!Number.isFinite(installment) || installment <= 0)
      return toast.error("Enter a valid monthly installment");
    if (!Number.isInteger(duration) || duration < 1 || duration > 600)
      return toast.error("Enter a loan term between 1 and 600 months");
    const [year, month] = startMonth.split("-").map(Number);
    if (!year || !month) return toast.error("Choose the first payment month");
    const startDate = new Date(year, month - 1, 1).getTime();

    setSaving(true);
    try {
      const data = {
        name: name.trim(),
        kind,
        lender: lender.trim(),
        principalAmount: amount,
        monthlyAmount: installment,
        totalMonths: duration,
        startDate,
        notes: notes.trim() || undefined,
      };
      if (loan) {
        await updateLoan(loan.id, data);
        toast.success("Loan updated");
      } else {
        await createLoan(data);
        toast.success("Loan added");
      }
      onDone();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save this loan");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1.5 text-sm sm:col-span-2">
          <span className="text-xs font-medium text-muted-foreground">Loan name</span>
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Home loan"
            autoFocus
          />
        </label>
        <label className="space-y-1.5 text-sm">
          <span className="text-xs font-medium text-muted-foreground">Loan type</span>
          <select
            value={kind}
            onChange={(event) => setKind(event.target.value as LoanKind)}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {Object.entries(KIND_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1.5 text-sm">
          <span className="text-xs font-medium text-muted-foreground">Lender</span>
          <Input
            value={lender}
            onChange={(event) => setLender(event.target.value)}
            placeholder="Bank or lender"
          />
        </label>
        <label className="space-y-1.5 text-sm">
          <span className="text-xs font-medium text-muted-foreground">Original loan amount</span>
          <Input
            type="number"
            min="1"
            step="0.01"
            value={principal}
            onChange={(event) => setPrincipal(event.target.value)}
            placeholder="0"
          />
        </label>
        <label className="space-y-1.5 text-sm">
          <span className="text-xs font-medium text-muted-foreground">Monthly installment</span>
          <Input
            type="number"
            min="1"
            step="0.01"
            value={monthlyAmount}
            onChange={(event) => setMonthlyAmount(event.target.value)}
            placeholder="0"
          />
        </label>
        <label className="space-y-1.5 text-sm">
          <span className="text-xs font-medium text-muted-foreground">Term in months</span>
          <Input
            type="number"
            min="1"
            max="600"
            step="1"
            value={totalMonths}
            onChange={(event) => setTotalMonths(event.target.value)}
            placeholder="e.g. 60"
          />
        </label>
        <label className="space-y-1.5 text-sm">
          <span className="text-xs font-medium text-muted-foreground">First payment month</span>
          <Input
            type="month"
            value={startMonth}
            onChange={(event) => setStartMonth(event.target.value)}
          />
        </label>
        <label className="space-y-1.5 text-sm sm:col-span-2">
          <span className="text-xs font-medium text-muted-foreground">Notes (optional)</span>
          <Textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Account reference or other details"
            rows={2}
          />
        </label>
      </div>

      {scheduledTotal > 0 && (
        <div className="rounded-xl border border-border/60 bg-muted/20 px-3.5 py-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Scheduled payments</span>
            <span className="font-semibold tabular-nums">{fmt(scheduledTotal)}</span>
          </div>
          {principalAmount > 0 && scheduledTotal < principalAmount && (
            <p className="mt-1 text-xs text-warning">
              Your scheduled payments total less than the original loan amount.
            </p>
          )}
        </div>
      )}
      <p className="text-xs leading-relaxed text-muted-foreground">
        Ledge tracks the installment amount you enter and payments you record. Interest and lender
        calculations are not computed here.
      </p>
      <Button className="w-full" onClick={() => void submit()} disabled={saving}>
        {saving ? "Saving…" : loan ? "Save loan changes" : "Add loan"}
      </Button>
    </div>
  );
}
