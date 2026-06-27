import { Link, useRouterState } from "@tanstack/react-router";
import { BarChart3, Home, PiggyBank, Settings, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

type NavItem = {
  to: "/" | "/people" | "/chitti" | "/analytics" | "/settings";
  label: string;
  icon: typeof Home;
  exact?: boolean;
};

const items: NavItem[] = [
  { to: "/", label: "Home", icon: Home, exact: true },
  { to: "/people", label: "People", icon: Users },
  { to: "/chitti", label: "Chitti", icon: PiggyBank },
  { to: "/analytics", label: "Insights", icon: BarChart3 },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center pb-[max(env(safe-area-inset-bottom),0.75rem)]"
      aria-label="Primary"
    >
      <div className="glass-strong pointer-events-auto mx-3 flex w-full max-w-xl items-center justify-around rounded-full border px-2 py-2">
        {items.map((it) => {
          const active = it.exact ? pathname === it.to : pathname.startsWith(it.to);
          const Icon = it.icon;
          return (
            <Link
              key={it.to}
              to={it.to}
              className={cn(
                "relative flex flex-1 flex-col items-center gap-0.5 rounded-full px-2 py-2 text-[11px] font-medium transition-colors",
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
    </nav>
  );
}
