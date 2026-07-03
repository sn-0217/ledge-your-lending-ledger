import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemeMode = "dark" | "light";
export type AccentTheme = "mint" | "purple" | "blue" | "rose" | "amber";

interface SettingsState {
  currency: string;
  locale: string;
  theme: ThemeMode;
  accentTheme: AccentTheme;
  setCurrency: (c: string) => void;
  setTheme: (t: ThemeMode) => void;
  setAccentTheme: (a: AccentTheme) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      currency: "₹",
      locale: "en-IN",
      theme: "dark",
      accentTheme: "mint",
      setCurrency: (currency) => set({ currency }),
      setTheme: (theme) => set({ theme }),
      setAccentTheme: (accentTheme) => set({ accentTheme }),
    }),
    { name: "ledge.settings" },
  ),
);
