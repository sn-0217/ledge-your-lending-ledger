import { useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Plus, RotateCcw, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { TransactionForm } from "@/components/forms/TransactionForm";
import { PersonForm } from "@/components/forms/PersonForm";
import type { TransactionType } from "@/lib/types";
import { cn } from "@/lib/utils";

type Mode = "menu" | TransactionType | "person";

const ACTIONS: {
  type: Exclude<Mode, "menu" | "person">;
  label: string;
  icon: typeof ArrowUpRight;
  tone: string;
  bg: string;
}[] = [
  { type: "lent", label: "Give money", icon: ArrowUpRight, tone: "text-[oklch(0.78_0.17_155)]", bg: "bg-[oklch(0.78_0.17_155/0.12)]" },
  { type: "borrowed", label: "Borrow money", icon: ArrowDownLeft, tone: "text-[oklch(0.82_0.16_75)]", bg: "bg-[oklch(0.82_0.16_75/0.12)]" },
  { type: "repayment_in", label: "Received repayment", icon: RotateCcw, tone: "text-primary", bg: "bg-primary/10" },
  { type: "repayment_out", label: "Paid repayment", icon: RotateCcw, tone: "text-[oklch(0.7_0.2_22)]", bg: "bg-[oklch(0.7_0.2_22/0.12)]" },
];

export function QuickAddFab({ defaultPersonId }: { defaultPersonId?: string }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("menu");

  function close() {
    setOpen(false);
    setTimeout(() => setMode("menu"), 250);
  }

  const title =
    mode === "menu"
      ? "Quick add"
      : mode === "person"
        ? "Add person"
        : ACTIONS.find((a) => a.type === mode)?.label;

  return (
    <>
      {/* FAB button */}
      <motion.button
        whileTap={{ scale: 0.92 }}
        whileHover={{ scale: 1.06 }}
        transition={{ type: "spring", stiffness: 400, damping: 22 }}
        onClick={() => setOpen(true)}
        className="fixed bottom-[6.5rem] right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_20px_50px_-15px_oklch(0.78_0.17_155/0.7)]"
        aria-label="Quick add"
      >
        <Plus className="h-6 w-6" strokeWidth={2.5} />
      </motion.button>

      {/* Overlay + Modal */}
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={close}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            />

            {/* Panel — bottom sheet on mobile, centered card on desktop */}
            <motion.div
              key="panel"
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              transition={{ type: "spring", stiffness: 340, damping: 32 }}
              className={cn(
                "glass-strong fixed z-50 overflow-y-auto",
                // Mobile: bottom sheet
                "bottom-0 left-0 right-0 max-h-[92dvh] rounded-t-3xl px-4 pb-[max(env(safe-area-inset-bottom),1.25rem)] pt-2",
                // Desktop: centered modal
                "sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:max-h-[85dvh] sm:w-full sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl sm:px-6 sm:pt-6 sm:pb-6",
              )}
            >
              {/* Handle / header */}
              <div className="mb-3 flex items-center justify-between sm:mb-5">
                <div className="hidden h-1 w-10 rounded-full bg-muted sm:block" />
                <div className="mx-auto h-1 w-10 rounded-full bg-muted sm:hidden" />
                <h2 className="hidden text-base font-semibold sm:block">{title}</h2>
                <button
                  onClick={close}
                  className="hidden h-8 w-8 items-center justify-center rounded-full bg-secondary/50 text-muted-foreground hover:text-foreground sm:flex"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Mobile title */}
              <p className="mb-4 text-center text-base font-semibold sm:hidden">{title}</p>

              {/* Menu */}
              {mode === "menu" && (
                <div className="grid grid-cols-2 gap-3">
                  {ACTIONS.map((a) => (
                    <button
                      key={a.type}
                      onClick={() => setMode(a.type)}
                      className={cn(
                        "flex flex-col items-start gap-2 rounded-2xl p-4 text-left transition-all hover:brightness-110 active:scale-[0.97]",
                        a.bg,
                      )}
                    >
                      <a.icon className={cn("h-5 w-5", a.tone)} />
                      <div className="text-sm font-medium">{a.label}</div>
                    </button>
                  ))}
                  <button
                    onClick={() => setMode("person")}
                    className="col-span-2 flex items-center gap-3 rounded-2xl bg-accent/10 p-4 text-left transition-all hover:brightness-110 active:scale-[0.97]"
                  >
                    <UserPlus className="h-5 w-5 text-accent" />
                    <div className="text-sm font-medium">Add a person</div>
                  </button>
                </div>
              )}

              {/* Transaction form */}
              {mode !== "menu" && mode !== "person" && (
                <div>
                  <TransactionForm type={mode} defaultPersonId={defaultPersonId} onSubmitted={close} />
                  <Button type="button" variant="ghost" className="mt-3 w-full" onClick={() => setMode("menu")}>
                    ← Back
                  </Button>
                </div>
              )}

              {/* Person form */}
              {mode === "person" && (
                <div>
                  <PersonForm onSubmitted={close} />
                  <Button type="button" variant="ghost" className="mt-3 w-full" onClick={() => setMode("menu")}>
                    ← Back
                  </Button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
