import { useState, useMemo } from "react";
import { usePeople } from "@/lib/queries";
import { createChitti, updateChitti } from "@/lib/chittiRepositories";
import { initials } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Chitti } from "@/lib/types";
import { Link } from "@tanstack/react-router";

interface ChittiFormProps {
  chitti?: Chitti; // If provided, we are editing this chitti
  onDone: () => void;
}

export function ChittiForm({ chitti, onDone }: ChittiFormProps) {
  const people = usePeople();

  const [organizerId, setOrganizerId] = useState(chitti?.organizerId ?? "");
  const [name, setName] = useState(chitti?.name ?? "");
  const [monthlyAmount, setMonthlyAmount] = useState(
    chitti?.monthlyAmount ? String(chitti.monthlyAmount) : ""
  );
  const [numChits, setNumChits] = useState(
    chitti?.numChits ? String(chitti.numChits) : "1"
  );
  const [startDate, setStartDate] = useState(() => {
    if (chitti?.startDate) {
      return new Date(chitti.startDate).toISOString().slice(0, 7);
    }
    return new Date().toISOString().slice(0, 7);
  });
  const [totalMonths, setTotalMonths] = useState(
    chitti?.totalMonths ? String(chitti.totalMonths) : ""
  );
  const [notes, setNotes] = useState(chitti?.notes ?? "");
  const [saving, setSaving] = useState(false);

  const [availed, setAvailed] = useState(chitti?.availed ?? false);
  const [availedDate, setAvailedDate] = useState(() => {
    if (chitti?.availedDate) {
      return new Date(chitti.availedDate).toISOString().slice(0, 10);
    }
    return new Date().toISOString().slice(0, 10);
  });
  const [availedAmount, setAvailedAmount] = useState(
    chitti?.availedAmount ? String(chitti.availedAmount) : ""
  );

  const monthly = (Number(monthlyAmount) || 0) * (Number(numChits) || 1);

  async function submit() {
    if (!organizerId) return toast.error("Select the chitti organizer");
    const amt = Number(monthlyAmount);
    if (!amt || amt <= 0) return toast.error("Enter a valid monthly amount");
    const n = Number(numChits);
    if (!n || n < 1) return toast.error("Enter number of chits joined (at least 1)");
    const m = Number(totalMonths);
    if (!m || m <= 0) return toast.error("Enter total duration in months");

    setSaving(true);
    try {
      const [y, mo] = startDate.split("-").map(Number);
      const startTimestamp = new Date(y, mo - 1, 1).getTime();
      const availedTimestamp = availed ? new Date(availedDate).getTime() : undefined;
      const availedAmtNum = availed && availedAmount ? Number(availedAmount) : undefined;

      if (chitti) {
        // Edit flow
        await updateChitti(chitti.id, {
          organizerId,
          name: name.trim() || undefined,
          monthlyAmount: amt,
          numChits: n,
          startDate: startTimestamp,
          totalMonths: m,
          availed,
          availedDate: availedTimestamp,
          availedAmount: availedAmtNum,
          notes: notes.trim() || undefined,
        });
        toast.success("Chitti updated!");
      } else {
        // Create flow
        await createChitti({
          organizerId,
          name: name.trim() || undefined,
          monthlyAmount: amt,
          numChits: n,
          startDate: startTimestamp,
          totalMonths: m,
          availed,
          availedDate: availedTimestamp,
          availedAmount: availedAmtNum,
          notes: notes.trim() || undefined,
        });
        toast.success("Chitti added!");
      }
      onDone();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Organizer */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Organizer (who runs this chitti)</label>
        <div className="grid grid-cols-2 gap-1.5 max-h-36 overflow-y-auto">
          {people === undefined ? (
            <div className="col-span-2 text-xs text-muted-foreground py-2 text-center">Loading organizers...</div>
          ) : people.length === 0 ? (
            <div className="col-span-2 text-xs text-muted-foreground py-4 text-center">
              No people found. Please add a person in the{" "}
              <Link to="/people" onClick={onDone} className="text-primary hover:underline font-semibold">
                People
              </Link>{" "}
              tab first to select them as organizer.
            </div>
          ) : (
            people.map((p: any) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setOrganizerId(p.id)}
                className={cn(
                  "flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-left transition-all",
                  organizerId === p.id
                    ? "bg-accent/20 text-accent ring-1 ring-accent/40"
                    : "bg-secondary/40 hover:bg-secondary/70"
                )}
              >
                <div className={cn(
                  "grid h-7 w-7 shrink-0 place-items-center rounded-full text-[10px] font-bold",
                  organizerId === p.id ? "bg-accent/30" : "bg-muted"
                )}>
                  {initials(p.name)}
                </div>
                <span className="truncate capitalize">{p.name}</span>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Name */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Chitti name <span className="opacity-50">(optional)</span></label>
        <Input placeholder="e.g. Gold Chitti" value={name} onChange={(e) => setName(e.target.value)} />
      </div>

      {/* Amount + Chits */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Amount / chit / month</label>
          <Input type="number" placeholder="5000" inputMode="numeric" value={monthlyAmount} onChange={(e) => setMonthlyAmount(e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">No. of chits joined</label>
          <Input type="number" placeholder="1" inputMode="numeric" value={numChits} onChange={(e) => setNumChits(e.target.value)} />
        </div>
      </div>

      {/* Duration + Start */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Total months</label>
          <Input type="number" placeholder="20" inputMode="numeric" value={totalMonths} onChange={(e) => setTotalMonths(e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Start month</label>
          <Input type="month" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
      </div>

      {/* Preview */}
      {monthly > 0 && (
        <div className="rounded-2xl bg-accent/10 px-4 py-3 text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-muted-foreground">My monthly payment</span>
            <span className="font-bold text-accent">{(monthly).toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })}</span>
          </div>
          {Number(totalMonths) > 0 && (
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Total contribution</span>
              <span>{(monthly * Number(totalMonths)).toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })}</span>
            </div>
          )}
        </div>
      )}

      {/* Availed Status */}
      <div className="space-y-2 border-t border-border/40 pt-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={availed}
            onChange={(e) => setAvailed(e.target.checked)}
            className="rounded bg-secondary border-border text-primary focus:ring-primary h-4 w-4"
          />
          <span className="text-xs font-semibold text-foreground uppercase tracking-wide">
            Availed / Received lump-sum amount?
          </span>
        </label>

        {availed && (
          <div className="grid grid-cols-2 gap-3 pl-6">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Availed Date</label>
              <Input
                type="date"
                value={availedDate}
                onChange={(e) => setAvailedDate(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Availed Amount <span className="opacity-50">(optional)</span></label>
              <Input
                type="number"
                placeholder="Lump-sum received"
                inputMode="numeric"
                value={availedAmount}
                onChange={(e) => setAvailedAmount(e.target.value)}
              />
            </div>
          </div>
        )}
      </div>

      {/* Notes */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Notes <span className="opacity-50">(optional)</span></label>
        <Input placeholder="Any details..." value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      <Button className="w-full" onClick={submit} disabled={saving}>
        {saving ? "Saving…" : chitti ? "Update chitti" : "Add chitti"}
      </Button>
    </div>
  );
}
