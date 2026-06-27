import { useSettings } from "@/stores/settings";

export function formatMoney(amount: number, currency?: string, locale?: string): string {
  const settings = useSettings.getState();
  const sym = currency ?? settings.currency;
  const loc = locale ?? settings.locale;
  const abs = Math.abs(amount);
  const formatted = new Intl.NumberFormat(loc, {
    maximumFractionDigits: abs % 1 === 0 ? 0 : 2,
  }).format(abs);
  return `${amount < 0 ? "-" : ""}${sym}${formatted}`;
}

export function useFormatMoney() {
  const { currency, locale } = useSettings();
  return (amount: number) => formatMoney(amount, currency, locale);
}

export function relativeDate(t: number): string {
  const diff = t - Date.now();
  const day = 86_400_000;
  const days = Math.round(diff / day);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  if (days > 0 && days < 7) return `In ${days}d`;
  if (days < 0 && days > -30) return `${Math.abs(days)}d ago`;
  return new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");
}
