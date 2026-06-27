import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { GlassCard } from "@/components/common/GlassCard";
import { ClientOnly } from "@/components/common/ClientOnly";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WebModal } from "@/components/common/WebModal";
import { useChitti, useChittiPayments } from "@/lib/chittiQueries";
import { usePeople } from "@/lib/queries";
import {
  setMonthPaid, updateAvailed, updateChittiStatus, deleteChitti,
} from "@/lib/chittiRepositories";
import { useFormatMoney, initials } from "@/lib/formatters";
import {
  ArrowLeft, Check, Trophy, Trash2, CheckCircle2, Clock, XCircle,
  ChevronDown, ChevronUp, CalendarCheck, Pencil,
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
  head: () => ({ meta: [{ title: "Chitti — Ledge" }] }),
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
  const chitti = useChitti(chittiId);
  const payments = useChittiPayments(chittiId);
  const people = usePeople();
  const fmt = useFormatMoney();

  const [editing, setEditing] = useState(false);
  const [expandedMonth, setExpandedMonth] = useState<number | null>(null);
  const [availedModal, setAvailedModal] = useState(false);
  const [availedDate, setAvailedDate] = useState(new Date().toISOString().slice(0, 10));
  const [availedAmt, setAvailedAmt] = useState("");

  const peopleById = useMemo(() => new Map((people ?? []).map((p) => [p.id, p])), [people]);

  const paidMonths = useMemo(() => {
    if (!payments) return new Set<number>();
    return new Set(payments.filter((p) => p.paid).map((p) => p.month));
  }, [payments]);

  if (!chitti || !payments || !people) {
    return <div className="h-40 animate-pulse rounded-3xl bg-muted/30 mt-2" />;
  }

  // Guard: chitti loaded but record is invalid/stale schema
  if (!chitti.organizerId) {
    return (
      <GlassCard className="p-6 text-center text-sm text-muted-foreground">
        This chitti record is from an old format. Please delete it and re-create it.
        <Link to="/chitti" className="mt-3 block text-primary">← Back to Chitti</Link>
      </GlassCard>
    );
  }

  const organizer = peopleById.get(chitti.organizerId);
  const monthlyTotal = (chitti.monthlyAmount ?? 0) * (chitti.numChits ?? 1);
  const paid = paidMonths.size;
  const totalMonths = chitti.totalMonths;
  // Fallback for records with no status (old schema)
  const status = STATUS_META[chitti.status as keyof typeof STATUS_META] ?? STATUS_META.active;
  const StatusIcon = status.icon;

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

  async function toggleMonth(month: number) {
    const nowPaid = paidMonths.has(month);
    await setMonthPaid(chittiId, month, !nowPaid);
    toast.success(!nowPaid ? "Marked as paid" : "Unmarked");
  }

  async function handleAvailed(availed: boolean) {
    if (availed) {
      const d = new Date(availedDate).getTime();
      const a = availedAmt ? Number(availedAmt) : undefined;
      await updateAvailed(chittiId, true, d, a);
      toast.success("Availed recorded!");
    } else {
      await updateAvailed(chittiId, false);
      toast.success("Availed cleared");
    }
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

      {/* Summary */}
      <GlassCard strong className="relative overflow-hidden p-4">
        <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-accent/10 blur-2xl" />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-xs text-muted-foreground">Monthly payment</div>
            <div className="text-2xl font-bold text-accent">{fmt(monthlyTotal)}</div>
            {chitti.numChits > 1 && (
              <div className="text-[11px] text-muted-foreground">
                {chitti.numChits} chits × {fmt(chitti.monthlyAmount)}
              </div>
            )}
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Duration</div>
            <div className="text-2xl font-bold">{totalMonths}</div>
            <div className="text-[11px] text-muted-foreground">months</div>
          </div>
        </div>

        {/* Progress */}
        <div className="mt-4">
          <div className="mb-1 flex justify-between text-xs text-muted-foreground">
            <span>Payments made</span>
            <span className="font-medium text-foreground">{paid}/{totalMonths}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-white/8">
            <div
              className="h-full rounded-full bg-accent transition-all duration-500"
              style={{ width: `${(paid / Math.max(totalMonths, 1)) * 100}%` }}
            />
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
            <span>{fmt(monthlyTotal * paid)} paid</span>
            <span>{fmt(monthlyTotal * (totalMonths - paid))} remaining</span>
          </div>
        </div>
      </GlassCard>

      {/* Availed section */}
      <GlassCard className={cn("p-4", chitti.availed && "border-[oklch(0.82_0.16_75/0.3)]")}>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 font-semibold">
              <Trophy className={cn("h-4 w-4", chitti.availed ? "text-[oklch(0.82_0.16_75)]" : "text-muted-foreground")} />
              {chitti.availed ? "Availed ✓" : "Not yet availed"}
            </div>
            {chitti.availed && (
              <div className="mt-0.5 text-xs text-muted-foreground">
                {chitti.availedDate && new Date(chitti.availedDate).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
                {chitti.availedAmount ? ` · ${fmt(chitti.availedAmount)} received` : ""}
              </div>
            )}
            {!chitti.availed && (
              <div className="mt-0.5 text-xs text-muted-foreground">Tap to record when you receive the chitti amount</div>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="rounded-full text-xs"
            onClick={() => {
              if (chitti.availed) {
                updateAvailed(chittiId, false).then(() => toast.success("Availed cleared"));
              } else {
                setAvailedModal(true);
              }
            }}
          >
            {chitti.availed ? "Clear" : "Mark availed"}
          </Button>
        </div>
      </GlassCard>

      {/* Monthly payments */}
      <section>
        <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Monthly contributions
        </p>
        <GlassCard className="overflow-hidden divide-y divide-border/40 p-0">
          {Array.from({ length: totalMonths }, (_, i) => i + 1).map((month) => {
            const paid = paidMonths.has(month);
            const current = isCurrentMonth(month);
            const past = isPastMonth(month);
            const unpaidPast = past && !paid;

            return (
              <button
                key={month}
                onClick={() => toggleMonth(month)}
                className={cn(
                  "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors",
                  paid ? "bg-[oklch(0.78_0.17_155/0.06)]" : "hover:bg-white/3",
                  current && !paid && "bg-primary/5",
                )}
              >
                {/* Checkbox */}
                <div className={cn(
                  "grid h-6 w-6 shrink-0 place-items-center rounded-lg transition-all",
                  paid ? "bg-[oklch(0.78_0.17_155)] text-black" : unpaidPast ? "border border-destructive/60" : "border border-border"
                )}>
                  {paid && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                </div>

                {/* Month info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
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
                </div>

                {/* Amount */}
                <div className={cn(
                  "text-sm font-semibold tabular-nums shrink-0",
                  paid ? "text-[oklch(0.85_0.18_155)]" : unpaidPast ? "text-destructive/80" : "text-muted-foreground"
                )}>
                  {paid ? fmt(monthlyTotal) : `—`}
                </div>
              </button>
            );
          })}
        </GlassCard>
      </section>

      {/* Availed modal */}
      <WebModal open={availedModal} onClose={() => setAvailedModal(false)} title="Record availed">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Record when you received the chitti lump-sum amount.</p>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Date received</label>
            <Input type="date" value={availedDate} onChange={(e) => setAvailedDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Amount received <span className="opacity-50">(optional)</span></label>
            <Input type="number" inputMode="numeric" placeholder={fmt(chitti.monthlyAmount * chitti.numChits * chitti.totalMonths)} value={availedAmt} onChange={(e) => setAvailedAmt(e.target.value)} />
          </div>
          <Button className="w-full gap-2" onClick={() => handleAvailed(true)}>
            <CalendarCheck className="h-4 w-4" /> Confirm availed
          </Button>
        </div>
      </WebModal>

      {/* Edit Chitti Modal */}
      <WebModal open={editing} onClose={() => setEditing(false)} title="Edit chitti">
        <ChittiForm chitti={chitti} onDone={() => setEditing(false)} />
      </WebModal>
    </div>
  );
}
