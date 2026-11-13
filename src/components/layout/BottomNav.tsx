import { Link, useRouterState } from "@tanstack/react-router";
import { BarChart3, Home, Landmark, PiggyBank, Settings, Users, WalletCards } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

type NavItem = {
  to: "/" | "/people" | "/chitti" | "/loans" | "/analytics" | "/settings";
  label: string;
  icon: typeof Home;
  exact?: boolean;
};

const items: NavItem[] = [
  { to: "/", label: "Home", icon: Home, exact: true },
  { to: "/people", label: "People", icon: Users },
  { to: "/chitti", label: "Chitti", icon: PiggyBank },
  { to: "/loans", label: "Loans", icon: Landmark },
  { to: "/analytics", label: "Insights", icon: BarChart3 },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 flex justify-center px-3 pt-2 pb-[max(env(safe-area-inset-bottom),0.75rem)] pointer-events-none lg:bottom-auto lg:top-0 lg:px-8 lg:pt-5 lg:pb-0"
      aria-label="Primary"
    >
      <div className="backdrop-blur-xl bg-card/75 flex w-full max-w-md items-center justify-around rounded-full border border-glass-border px-2.5 py-2 pointer-events-auto shadow-[0_20px_50px_rgba(0,0,0,0.45)] lg:max-w-6xl lg:justify-between lg:rounded-2xl lg:px-5 lg:py-3">
        <Link to="/" className="hidden items-center gap-3 lg:flex">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/15 text-primary">
            <WalletCards className="h-5 w-5" />
          </span>
          <span>
            <span className="block text-base font-bold tracking-tight text-foreground">Ledge</span>
            <span className="block text-[10px] tracking-wide text-muted-foreground">
              PERSONAL FINANCE
            </span>
          </span>
        </Link>
        <div className="flex w-full items-center justify-around lg:w-auto lg:justify-end lg:gap-1">
          {items.map((it) => {
            const active = it.exact ? pathname === it.to : pathname.startsWith(it.to);
            const Icon = it.icon;
            return (
              <Link
                key={it.to}
                to={it.to}
                className={cn(
                  "relative flex flex-1 flex-col items-center gap-0.5 rounded-full px-2 py-2 text-[11px] font-medium transition-colors lg:flex-initial lg:flex-row lg:gap-2 lg:px-3 lg:py-2 lg:text-sm",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {active && (
                  <motion.span
                    layoutId="nav-active"
                    className="absolute inset-0 -z-10 rounded-full bg-primary/10"
                    transition={{ type: "spring", stiffness: 500, damping: 40 }}
                  />
                )}
                <Icon className="h-5 w-5" strokeWidth={2.2} />
                <span>{it.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
