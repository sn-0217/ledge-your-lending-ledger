import type { ReactNode } from "react";
import { BottomNav } from "./BottomNav";
import { QuickAddFab } from "@/components/common/QuickAddFab";
import { ClientOnly } from "@/components/common/ClientOnly";
import { motion, AnimatePresence } from "framer-motion";
import { useRouterState } from "@tanstack/react-router";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    /*
     * Fixed viewport shell — fills exactly the screen, no body scroll.
     * This eliminates scrollbar-gutter layout shift and keeps the bottom
     * nav pinned. The inner div handles overflow-y scrolling instead.
     */
    <div className="surface-gradient min-h-dvh w-full">
      <div className="mx-auto w-full max-w-md px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-32">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom nav — fixed to screen bottom */}
      <BottomNav />

      {/* FAB floats above nav */}
      <ClientOnly>
        <QuickAddFab />
      </ClientOnly>
    </div>
  );
}
