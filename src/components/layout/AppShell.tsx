import type { ReactNode } from "react";
import { BottomNav } from "./BottomNav";
import { QuickAddFab } from "@/components/common/QuickAddFab";
import { ClientOnly } from "@/components/common/ClientOnly";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="surface-gradient relative min-h-dvh">
      <div className="mx-auto w-full max-w-md px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-36">
        {children}
      </div>
      <ClientOnly>
        <QuickAddFab />
      </ClientOnly>
      <BottomNav />
    </div>
  );
}
