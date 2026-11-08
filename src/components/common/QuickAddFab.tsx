import { useState, useEffect } from "react";
import { ArrowDownLeft, ArrowUpRight, Plus, RotateCcw, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { TransactionForm } from "@/components/forms/TransactionForm";
import { PersonForm } from "@/components/forms/PersonForm";
import { WebModal } from "@/components/common/WebModal";
import type { TransactionType } from "@/lib/types";
import { cn } from "@/lib/utils";

type Mode = "menu" | TransactionType | "person";

const ACTIONS: {
  type: Exclude<Mode, "person" | "menu">;
  label: string;
  icon: typeof ArrowUpRight;
  tone: string;
  bg: string;
}[] = [
  {
    type: "lent",
    label: "Give money",
    icon: ArrowUpRight,
    tone: "text-receive",
    bg: "bg-receive/12",
  },
  {
    type: "borrowed",
    label: "Borrow money",
    icon: ArrowDownLeft,
    tone: "text-pay",
    bg: "bg-pay/12",
  },
  {
    type: "repayment_in",
    label: "Received repayment",
    icon: RotateCcw,
    tone: "text-receive",
    bg: "bg-receive/12",
  },
  {
    type: "repayment_out",
    label: "Paid repayment",
    icon: RotateCcw,
    tone: "text-pay",
    bg: "bg-pay/12",
  },
];

export function QuickAddFab({ defaultPersonId }: { defaultPersonId?: string }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("menu");

  useEffect(() => {
    const handleOpen = () => setOpen(true);
    window.addEventListener("ledge:open_quick_add", handleOpen);
    return () => window.removeEventListener("ledge:open_quick_add", handleOpen);
  }, []);

  function close() {
    setOpen(false);
    setTimeout(() => setMode("menu"), 250);
  }

  const title =
    mode === "menu"
      ? "Quick add"
      : mode === "person"
        ? "Add person"
        : (ACTIONS.find((a) => a.type === mode)?.label ?? "Add");

  return (
    <>
      {/* FAB */}
      <motion.button
        whileTap={{ scale: 0.92 }}
        whileHover={{ scale: 1.06 }}
        transition={{ type: "spring", stiffness: 400, damping: 22 }}
        onClick={() => setOpen(true)}
        className="fixed bottom-[calc(5rem+max(env(safe-area-inset-bottom),0.75rem))] right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_20px_50px_-15px_var(--primary)/70] lg:right-8 lg:bottom-8 lg:h-12 lg:w-auto lg:gap-2 lg:px-5"
        aria-label="Quick add"
      >
        <Plus className="h-6 w-6" strokeWidth={2.5} />
        <span className="hidden text-sm font-semibold lg:inline">New transaction</span>
      </motion.button>

      {/* Portal modal */}
      <WebModal
        open={open}
        onClose={mode === "menu" ? close : undefined}
        title={title}
        onBack={mode !== "menu" ? () => setMode("menu") : undefined}
      >
        {/* Action menu */}
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
          <TransactionForm type={mode} defaultPersonId={defaultPersonId} onSubmitted={close} />
        )}

        {/* Person form */}
        {mode === "person" && <PersonForm onSubmitted={close} />}
      </WebModal>
    </>
  );
}
