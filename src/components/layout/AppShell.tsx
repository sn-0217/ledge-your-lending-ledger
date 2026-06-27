import type { ReactNode } from "react";
import { BottomNav } from "./BottomNav";
import { QuickAddFab } from "@/components/common/QuickAddFab";
import { ClientOnly } from "@/components/common/ClientOnly";
import { motion, AnimatePresence } from "framer-motion";
import { useRouterState } from "@tanstack/react-router";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="surface-gradient relative min-h-dvh">
      {/* min-h prevents layout shift while live queries resolve */}
      <div className="mx-auto w-full max-w-md px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-36 min-h-dvh">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </div>
      <ClientOnly>
        <QuickAddFab />
      </ClientOnly>
      <BottomNav />
    </div>
  );
}
