import { useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Plus, RotateCcw, UserPlus } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { TransactionForm } from "@/components/forms/TransactionForm";
import { PersonForm } from "@/components/forms/PersonForm";
import type { TransactionType } from "@/lib/types";
import { cn } from "@/lib/utils";

type Mode = "menu" | TransactionType | "person";

const ACTIONS: { type: Exclude<Mode, "menu" | "person">; label: string; icon: typeof ArrowUpRight; tone: string }[] = [
  { type: "lent", label: "Give money", icon: ArrowUpRight, tone: "text-[oklch(0.78_0.17_155)]" },
  { type: "borrowed", label: "Borrow money", icon: ArrowDownLeft, tone: "text-[oklch(0.82_0.16_75)]" },
  { type: "repayment_in", label: "Received repayment", icon: RotateCcw, tone: "text-primary" },
  { type: "repayment_out", label: "Paid repayment", icon: RotateCcw, tone: "text-[oklch(0.7_0.2_22)]" },
];

export function QuickAddFab({ defaultPersonId }: { defaultPersonId?: string }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("menu");

  function close() {
    setOpen(false);
    setTimeout(() => setMode("menu"), 200);
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setTimeout(() => setMode("menu"), 200);
      }}
    >
      <SheetTrigger asChild>
        <motion.button
          whileTap={{ scale: 0.92 }}
          whileHover={{ scale: 1.05 }}
          transition={{ type: "spring", stiffness: 400, damping: 22 }}
          className="fixed bottom-[6.5rem] right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_20px_50px_-15px_oklch(0.78_0.17_155/0.7)]"
          aria-label="Quick add"
        >
          <Plus className="h-6 w-6" strokeWidth={2.5} />
        </motion.button>
      </SheetTrigger>
      <SheetContent side="bottom" className="glass-strong max-h-[92dvh] overflow-y-auto rounded-t-3xl border-t pb-[max(env(safe-area-inset-bottom),1rem)]">
        <SheetHeader>
          <SheetTitle>
            {mode === "menu"
              ? "Quick add"
              : mode === "person"
                ? "Add person"
                : ACTIONS.find((a) => a.type === mode)?.label}
          </SheetTitle>
        </SheetHeader>

        {mode === "menu" && (
          <div className="grid grid-cols-2 gap-3 pt-4">
            {ACTIONS.map((a) => (
              <button
                key={a.type}
                onClick={() => setMode(a.type)}
                className="glass flex flex-col items-start gap-2 rounded-2xl p-4 text-left transition-transform active:scale-[0.97]"
              >
                <a.icon className={cn("h-5 w-5", a.tone)} />
                <div className="text-sm font-medium">{a.label}</div>
              </button>
            ))}
            <button
              onClick={() => setMode("person")}
              className="glass col-span-2 flex items-center gap-3 rounded-2xl p-4 text-left transition-transform active:scale-[0.97]"
            >
              <UserPlus className="h-5 w-5 text-accent" />
              <div className="text-sm font-medium">Add a person</div>
            </button>
          </div>
        )}

        {mode !== "menu" && mode !== "person" && (
          <div className="pt-4">
            <TransactionForm type={mode} defaultPersonId={defaultPersonId} onSubmitted={close} />
            <Button
              type="button"
              variant="ghost"
              className="mt-3 w-full"
              onClick={() => setMode("menu")}
            >
              Back
            </Button>
          </div>
        )}

        {mode === "person" && (
          <div className="pt-4">
            <PersonForm onSubmitted={close} />
            <Button
              type="button"
              variant="ghost"
              className="mt-3 w-full"
              onClick={() => setMode("menu")}
            >
              Back
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
