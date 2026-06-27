import { useEffect, useState, type ReactNode } from "react";

/** Renders children only after first client mount. Avoids SSR for browser-only code (Dexie, IndexedDB). */
export function ClientOnly({ children, fallback = null }: { children: ReactNode; fallback?: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <>{fallback}</>;
  return <>{children}</>;
}
