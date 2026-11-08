import type { ReactNode } from "react";
import { BottomNav } from "./BottomNav";
import { QuickAddFab } from "@/components/common/QuickAddFab";
import { ClientOnly } from "@/components/common/ClientOnly";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="surface-gradient min-h-dvh w-full">
      <div className="mx-auto w-full max-w-md px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-32 animate-in fade-in duration-150 ease-out lg:max-w-6xl lg:px-8 lg:pb-16 lg:pt-28">
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
