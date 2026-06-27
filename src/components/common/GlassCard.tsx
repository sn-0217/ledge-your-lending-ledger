import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

export function GlassCard({
  className,
  strong,
  ...props
}: HTMLAttributes<HTMLDivElement> & { strong?: boolean }) {
  return (
    <div
      className={cn(
        strong ? "glass-strong" : "glass",
        "rounded-3xl shadow-[0_10px_40px_-20px_rgba(0,0,0,0.6)]",
        className,
      )}
      {...props}
    />
  );
}
