import type { ReactNode } from "react";
import { BottomNav } from "./BottomNav";
import { QuickAddFab } from "@/components/common/QuickAddFab";
import { ClientOnly } from "@/components/common/ClientOnly";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    /*
     * Fixed viewport shell — fills exactly the screen, no body scroll.
     * This eliminates scrollbar-gutter layout shift and keeps the bottom
     * nav pinned. The inner div handles overflow-y scrolling instead.
     */
    <div className="surface-gradient min-h-dvh w-full">
      <div className="mx-auto w-full max-w-md px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-32 animate-in fade-in duration-150 ease-out">
        {children}
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
