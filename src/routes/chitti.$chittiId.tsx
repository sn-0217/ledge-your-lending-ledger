import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { GlassCard } from "@/components/common/GlassCard";
import { ClientOnly } from "@/components/common/ClientOnly";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WebModal } from "@/components/common/WebModal";
import { useLedge } from "@/features/dataProvider";
import { useFormatMoney, initials } from "@/lib/formatters";
import {
  ArrowLeft, Check, Trophy, Trash2, CheckCircle2, Clock, XCircle,
  Pencil, Calendar, PlusCircle, Trash, AlertCircle, CalendarCheck
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useMemo, useState } from "react";
import { ChittiForm } from "@/components/forms/ChittiForm";

export const Route = createFileRoute("/chitti/$chittiId")({
  head: () => ({ meta: [{ title: "Chitti Details — Ledge" }] }),
  component: () => (
    <AppShell>
      <ClientOnly>
        <ChittiDetail />
      </ClientOnly>
    </AppShell>
  ),
});

const STATUS_META = {
  active: { label: "Active", icon: Clock, color: "text-primary" },
  completed: { label: "Completed", icon: CheckCircle2, color: "text-[oklch(0.78_0.17_155)]" },
  cancelled: { label: "Cancelled", icon: XCircle, color: "text-muted-foreground" },
} as const;

function ChittiDetail() {
  const { chittiId } = Route.useParams();
  const navigate = useNavigate();
  
  const {
    chittis,
    chittiPayments,
    people,
    recordPayment,
    deletePayment,
    updateAvailedSlots,
    updateChittiStatus,
    deleteChitti,
    isLoading,
  } = useLedge();

  const chitti = chittis.find((c) => c.id === chittiId);
  const payments = chittiPayments.filter((p) => p.chittiId === chittiId);
  const fmt = useFormatMoney();

  const [editing, setEditing] = useState(false);
  const [availedModal, setAvailedModal] = useState(false);
  const [availedDate, setAvailedDate] = useState(new Date().toISOString().slice(0, 10));
  const [availedAmt, setAvailedAmt] = useState("");
  const [targetChitNum, setTargetChitNum] = useState<number | null>(null);

  // Payment modal state
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentMonth, setPaymentMonth] = useState<number | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [isEditMode, setIsEditMode] = useState(false);

  const peopleById = useMemo(() => new Map((people ?? []).map((p) => [p.id, p])), [people]);

  const paymentsMap = useMemo(() => {
    if (!payments) return new Map<number, typeof payments[0]>();
    return new Map(payments.map((p) => [p.month, p]));
  }, [payments]);

  const paidMonths = useMemo(() => {
    return new Set(paymentsMap.keys());
  }, [paymentsMap]);

  if (isLoading && !chittis.length) {
    return <div className="h-40 animate-pulse rounded-3xl bg-muted/30 mt-2" />;
  }

  if (!chitti) {
    return (
      <GlassCard className="p-6 text-center text-sm text-muted-foreground">
        Chitti not found.{" "}
        <Link to="/chitti" className="text-primary">
          Back to Chitti
        </Link>
      </GlassCard>
    );
  }

  // Guard: chitti loaded but record is invalid/stale schema
  if (!chitti.organizerId) {
    return (
      <GlassCard className="p-6 text-center text-sm text-muted-foreground space-y-4">
        <div>This chitti record is from an old format. Please delete it and re-create it.</div>
        <div className="flex justify-center gap-4">
          <Link to="/chitti" className="text-primary hover:underline">← Back to Chitti</Link>
          <button
            onClick={async () => {
              await deleteChitti(chittiId);
              toast.success("Stale chitti deleted");
              navigate({ to: "/chitti" });
            }}
            className="text-destructive font-semibold hover:underline"
          >
            Delete Chitti
          </button>
        </div>
      </GlassCard>
    );
  }

  const organizer = peopleById.get(chitti.organizerId);
  const monthlyTotal = (chitti.monthlyAmount ?? 0) * (chitti.numChits ?? 1);
  const paid = paidMonths.size;
  const totalMonths = chitti.totalMonths;
  const status = STATUS_META[chitti.status as keyof typeof STATUS_META] ?? STATUS_META.active;
  const StatusIcon = status.icon;

  // Monthly stats calculations
  const totalExpectedAmount = monthlyTotal * totalMonths;
  const totalPaidAmount = payments.reduce((sum, p) => sum + p.paidAmount, 0);
  const remainingAmount = Math.max(0, totalExpectedAmount - totalPaidAmount);
  const monthsRemaining = Math.max(0, totalMonths - paid);
  const progressPercent = Math.round((paid / Math.max(totalMonths, 1)) * 100);

  // Current month index based on start date
  const currentCalendarMonth = (() => {
    const start = new Date(chitti.startDate);
    const today = new Date();
    const diff = (today.getFullYear() - start.getFullYear()) * 12 + (today.getMonth() - start.getMonth()) + 1;
    if (diff >= 1 && diff <= totalMonths) return diff;
    return null;
  })();

  // Current Due: first unpaid month
  const currentDueMonth = (() => {
    for (let m = 1; m <= totalMonths; m++) {
      if (!paidMonths.has(m)) return m;
    }
    return null;
  })();

  function monthLabel(month: number) {
    const d = new Date(chitti.startDate);
    d.setMonth(d.getMonth() + month - 1);
    return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  }

  function isCurrentMonth(month: number) {
    const today = new Date();
    const d = new Date(chitti.startDate);
    d.setMonth(d.getMonth() + month - 1);
    return today.getFullYear() === d.getFullYear() && today.getMonth() === d.getMonth();
  }

  function isPastMonth(month: number) {
    const today = new Date();
    const d = new Date(chitti.startDate);
    d.setMonth(d.getMonth() + month - 1);
    return d < today && !isCurrentMonth(month);
  }

  // Payment triggers
  function openNewPayment(month: number) {
    setPaymentMonth(month);
    setPaymentAmount(String(monthlyTotal));
    setPaymentDate(new Date().toISOString().slice(0, 10));
    setPaymentNotes("");
    setIsEditMode(false);
    setPaymentModalOpen(true);
  }

  function openEditPayment(month: number) {
    const existing = paymentsMap.get(month);
    if (!existing) return;
    setPaymentMonth(month);
    setPaymentAmount(String(existing.paidAmount));
    setPaymentDate(new Date(existing.paidDate).toISOString().slice(0, 10));
    setPaymentNotes(existing.notes ?? "");
    setIsEditMode(true);
    setPaymentModalOpen(true);
  }

  async function submitPayment() {
    if (paymentMonth === null) return;
    const amt = Number(paymentAmount);
    if (isNaN(amt) || amt <= 0) return toast.error("Enter a valid payment amount");
    if (!paymentDate) return toast.error("Select a payment date");

    try {
      await recordPayment(
        chittiId,
        paymentMonth,
        amt,
        new Date(paymentDate).getTime(),
        paymentNotes,
      );
      toast.success(isEditMode ? "Payment updated" : "Payment recorded");
      setPaymentModalOpen(false);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function handleUndoPayment(month: number) {
    try {
      await deletePayment(chittiId, month);
      toast.success("Payment deleted");
      setPaymentModalOpen(false);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function handleAvailed(availed: boolean) {
    if (targetChitNum === null) return;
    const updatedSlots = Array.from({ length: chitti.numChits }, (_, idx) => {
      const existing = chitti.availedSlots?.find((s) => s.chitNumber === idx + 1);
      if (idx + 1 === targetChitNum) {
        return {
          chitNumber: targetChitNum,
          availed: true,
          availedDate: new Date(availedDate).getTime(),
          availedAmount: availedAmt ? Number(availedAmt) : undefined,
        };
      }
      return existing ?? { chitNumber: idx + 1, availed: false };
    });
    await updateAvailedSlots(chittiId, updatedSlots);
    toast.success(`Chit #${targetChitNum} availed recorded!`);
    setAvailedModal(false);
  }

  return (
    <div className="space-y-4 pt-2">
      {/* Header */}
      <header className="flex items-center gap-2">
        <Link to="/chitti" className="grid h-10 w-10 place-items-center rounded-full bg-muted/40 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="truncate text-xl font-bold">
            {chitti.name || (organizer ? `${organizer.name}'s Chitti` : "Chitti")}
          </h1>
          {organizer && <p className="text-xs text-muted-foreground capitalize">Organizer: {organizer.name}</p>}
        </div>
        {/* Status dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className={cn("gap-1.5 rounded-full text-xs", status.color)}>
              <StatusIcon className="h-3.5 w-3.5" />
              {status.label}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="glass-strong">
            {(["active", "completed", "cancelled"] as const).map((s) => {
              const m = STATUS_META[s];
              const I = m.icon;
              return (
                <DropdownMenuItem key={s} onClick={() => updateChittiStatus(chittiId, s)} className={m.color}>
                  <I className="h-4 w-4" /> {m.label}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
        {/* Edit */}
        <Button variant="ghost" size="icon" className="rounded-full shrink-0" onClick={() => setEditing(true)}>
          <Pencil className="h-4 w-4" />
        </Button>
        {/* Delete */}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full text-destructive shrink-0">
              <Trash2 className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="glass-strong">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this chitti?</AlertDialogTitle>
              <AlertDialogDescription>All payment records will be removed. Cannot be undone.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={async () => { await deleteChitti(chittiId); toast.success("Deleted"); navigate({ to: "/chitti" }); }}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </header>

      {/* Summary grid */}
      <GlassCard strong className="relative overflow-hidden p-4 space-y-4">
        <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-accent/10 blur-2xl" />
        
        {/* Top details */}
        <div className="grid grid-cols-2 gap-4 border-b border-border/40 pb-3">
          <div>
            <div className="text-xs text-muted-foreground">Monthly payment</div>
            <div className="text-2xl font-bold text-accent">{fmt(monthlyTotal)}</div>
            {chitti.numChits > 1 && (
              <div className="text-[10px] text-muted-foreground">
                {chitti.numChits} chits × {fmt(chitti.monthlyAmount)}
              </div>
            )}
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Total duration</div>
            <div className="text-2xl font-bold">{totalMonths}</div>
            <div className="text-[10px] text-muted-foreground">months</div>
          </div>
        </div>

        {/* Calculations Grid */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <div>
            <div className="text-xs text-muted-foreground">Total Paid</div>
            <div className="font-semibold text-foreground">{fmt(totalPaidAmount)}</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Remaining Amount</div>
            <div className="font-semibold text-foreground">{fmt(remainingAmount)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Months Paid</div>
            <div className="font-semibold text-foreground">{paid} paid</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Months Remaining</div>
            <div className="font-semibold text-foreground">{monthsRemaining} left</div>
          </div>
          {currentDueMonth && (
            <div className="col-span-2 border-t border-border/30 pt-2 flex justify-between items-center text-xs">
              <span className="text-muted-foreground font-medium flex items-center gap-1">
                <AlertCircle className="h-3.5 w-3.5 text-primary" /> Current Due
              </span>
              <span className="font-semibold text-primary">
                Month {currentDueMonth} ({monthLabel(currentDueMonth)})
              </span>
            </div>
          )}
        </div>

        {/* Progress bar */}
        <div>
          <div className="mb-1 flex justify-between text-xs text-muted-foreground">
            <span>Payment progress</span>
            <span className="font-medium text-foreground">{progressPercent}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-white/8">
            <div
              className="h-full rounded-full bg-accent transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </GlassCard>

      {/* Availed slots list */}
      <GlassCard className="p-4 space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Availed Installments</h3>
        <div className="divide-y divide-border/40 space-y-3">
          {Array.from({ length: chitti.numChits }, (_, i) => i + 1).map((chitNum) => {
            const slot = chitti.availedSlots?.find((s) => s.chitNumber === chitNum) ?? {
              chitNumber: chitNum,
              availed: false,
            };

            return (
              <div key={chitNum} className="flex items-center justify-between pt-3 first:pt-0">
                <div>
                  <div className="flex items-center gap-2 font-semibold">
                    <Trophy className={cn("h-4 w-4", slot.availed ? "text-[oklch(0.82_0.16_75)]" : "text-muted-foreground")} />
                    <span className="text-sm font-medium">Chit #{chitNum} {slot.availed ? "Availed ✓" : "Not yet availed"}</span>
                  </div>
                  {slot.availed && (
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {slot.availedDate && new Date(slot.availedDate).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
                      {slot.availedAmount ? ` · ${fmt(slot.availedAmount)} received` : ""}
                    </div>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full text-xs"
                  onClick={() => {
                    if (slot.availed) {
                      const updatedSlots = Array.from({ length: chitti.numChits }, (_, idx) => {
                        const existing = chitti.availedSlots?.find((s) => s.chitNumber === idx + 1);
                        if (idx + 1 === chitNum) return { chitNumber: chitNum, availed: false };
                        return existing ?? { chitNumber: idx + 1, availed: false };
                      });
                      updateAvailedSlots(chittiId, updatedSlots).then(() => toast.success(`Chit #${chitNum} cleared`));
                    } else {
                      setTargetChitNum(chitNum);
                      setAvailedDate(new Date().toISOString().slice(0, 10));
                      setAvailedAmt("");
                      setAvailedModal(true);
                    }
                  }}
                >
                  {slot.availed ? "Clear" : "Mark availed"}
                </Button>
              </div>
            );
          })}
        </div>
      </GlassCard>

      {/* Monthly contributions section */}
      <section className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Monthly contributions
          </p>
          {/* Mark Current Month as Paid action */}
          {currentCalendarMonth && !paidMonths.has(currentCalendarMonth) && (
            <button
              onClick={() => openNewPayment(currentCalendarMonth)}
              className="flex items-center gap-1 text-xs text-primary font-semibold hover:underline"
            >
              <PlusCircle className="h-4 w-4" /> Paid Current Month
            </button>
          )}
        </div>

        <GlassCard className="overflow-hidden divide-y divide-border/40 p-0">
          {Array.from({ length: totalMonths }, (_, i) => i + 1).map((month) => {
            const payment = paymentsMap.get(month);
            const paid = !!payment;
            const current = isCurrentMonth(month);
            const past = isPastMonth(month);
            const unpaidPast = past && !paid;

            return (
              <button
                key={month}
                onClick={() => paid ? openEditPayment(month) : openNewPayment(month)}
                className={cn(
                  "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors",
                  paid ? "bg-[oklch(0.78_0.17_155/0.06)]" : "hover:bg-white/3",
                  current && !paid && "bg-primary/5",
                )}
              >
                {/* Checkbox */}
                <div className={cn(
                  "grid h-6 w-6 shrink-0 place-items-center rounded-lg transition-all mt-0.5",
                  paid ? "bg-[oklch(0.78_0.17_155)] text-black" : unpaidPast ? "border border-destructive/60" : "border border-border"
                )}>
                  {paid && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                </div>

                {/* Month info */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="text-sm font-medium">{monthLabel(month)}</span>
                    {current && (
                      <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-primary">
                        Current
                      </span>
                    )}
                    {unpaidPast && (
                      <span className="rounded-full bg-destructive/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-destructive">
                        Overdue
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">Month {month} of {totalMonths}</div>
                  
                  {/* Payment Metadata (Date/Notes) */}
                  {payment && (
                    <div className="mt-1 space-y-0.5">
                      <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Paid on {new Date(payment.paidDate).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
                      </div>
                      {payment.notes && (
                        <p className="text-[11px] text-accent italic truncate">“{payment.notes}”</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Amount */}
                <div className="text-right shrink-0">
                  <div className={cn(
                    "text-sm font-semibold tabular-nums",
                    paid ? "text-[oklch(0.85_0.18_155)]" : unpaidPast ? "text-destructive/80" : "text-muted-foreground"
                  )}>
                    {paid ? fmt(payment.paidAmount) : `—`}
                  </div>
                  {paid && payment.paidAmount !== monthlyTotal && (
                    <div className="text-[9px] text-muted-foreground line-through">
                      {fmt(monthlyTotal)}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </GlassCard>
      </section>

      {/* Availed modal */}
      <WebModal open={availedModal} onClose={() => setAvailedModal(false)} title={`Record Availed Chit #${targetChitNum}`}>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Record when you received the lump-sum amount for Chit #{targetChitNum}.</p>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Date received</label>
            <Input type="date" value={availedDate} onChange={(e) => setAvailedDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Amount received <span className="opacity-50">(optional)</span></label>
            <Input type="number" inputMode="numeric" placeholder={fmt(chitti.monthlyAmount * chitti.totalMonths)} value={availedAmt} onChange={(e) => setAvailedAmt(e.target.value)} />
          </div>
          <Button className="w-full gap-2" onClick={() => handleAvailed(true)}>
            <CalendarCheck className="h-4 w-4" /> Confirm availed
          </Button>
        </div>
      </WebModal>

      {/* Payment Entry modal */}
      <WebModal
        open={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        title={isEditMode ? `Edit Month ${paymentMonth} Payment` : `Record Month ${paymentMonth} Payment`}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Amount Paid</label>
              <Input
                type="number"
                inputMode="numeric"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Paid Date</label>
              <Input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Notes <span className="opacity-50">(optional)</span></label>
            <Input
              placeholder="e.g. Paid online"
              value={paymentNotes}
              onChange={(e) => setPaymentNotes(e.target.value)}
            />
          </div>

          <div className="flex gap-2 pt-2">
            {isEditMode && (
              <Button
                variant="destructive"
                className="flex-1 gap-1.5"
                onClick={() => paymentMonth !== null && handleUndoPayment(paymentMonth)}
              >
                <Trash className="h-4 w-4" /> Delete
              </Button>
            )}
            <Button className="flex-1" onClick={submitPayment}>
              Save Payment
            </Button>
          </div>
        </div>
      </WebModal>

      {/* Edit Chitti Modal */}
      <WebModal open={editing} onClose={() => setEditing(false)} title="Edit chitti">
        <ChittiForm chitti={chitti} onDone={() => setEditing(false)} />
      </WebModal>
    </div>
  );
}
