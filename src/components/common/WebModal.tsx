import { type ReactNode } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Bottom sheet on mobile, centered card on sm+ screens.
 * Rendered via a React Portal so it always floats above everything,
 * regardless of parent overflow or transform contexts.
 */
export function WebModal({
  open,
  onClose,
  onBack,
  title,
  children,
}: {
  open: boolean;
  onClose?: () => void;
  /** If provided, shows a back arrow instead of (or alongside) the X button */
  onBack?: () => void;
  title: string;
  children: ReactNode;
}) {
  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop — click closes only when onClose is provided */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            className="fixed inset-0 z-[100] bg-black/65 backdrop-blur-sm"
          />

          {/* Panel */}
          <motion.div
            key="modal"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ type: "spring", stiffness: 340, damping: 32 }}
            className={cn(
              "glass-strong fixed z-[101] overflow-y-auto",
              // Mobile: bottom sheet
              "bottom-0 left-0 right-0 max-h-[92dvh] rounded-t-3xl px-4 pb-[max(env(safe-area-inset-bottom),1.25rem)] pt-4",
              // Desktop: centered card
              "sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:max-h-[85dvh] sm:w-full sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl sm:px-6 sm:pb-6 sm:pt-6",
            )}
          >
            {/* Handle bar (mobile only) */}
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-muted sm:hidden" />

            {/* Header */}
            <div className="mb-4 flex items-center gap-2">
              {onBack && (
                <button
                  onClick={onBack}
                  aria-label="Back"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary/60 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
              )}
              <h2 className="flex-1 text-base font-semibold">{title}</h2>
              {onClose && (
                <button
                  onClick={onClose}
                  aria-label="Close"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary/60 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
