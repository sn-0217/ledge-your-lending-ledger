import { initials } from "@/lib/formatters";
import { cn } from "@/lib/utils";

const AVATAR_PALETTE_SIZE = 6;

function paletteIndex(seed: string) {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) | 0;
  }
  return (Math.abs(hash) % AVATAR_PALETTE_SIZE) + 1;
}

export function PersonAvatar({
  name,
  seed,
  size = "md",
  className,
}: {
  name: string;
  seed?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const colorIndex = paletteIndex(seed || name);

  return (
    <div
      aria-hidden="true"
      className={cn(
        "grid shrink-0 place-items-center rounded-[38%] font-semibold tracking-wide ring-1 ring-inset ring-current/15 select-none",
        size === "sm" && "h-8 w-8 text-[10px]",
        size === "md" && "h-11 w-11 text-xs",
        size === "lg" && "h-16 w-16 text-lg",
        className,
      )}
      style={{
        color: `var(--person-avatar-color-${colorIndex})`,
        backgroundColor: `var(--person-avatar-surface-${colorIndex})`,
      }}
    >
      {initials(name) || "?"}
    </div>
  );
}
