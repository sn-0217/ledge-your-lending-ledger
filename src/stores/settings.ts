import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemeMode = "dark" | "light";

interface SettingsState {
  currency: string;
  locale: string;
  theme: ThemeMode;
  setCurrency: (c: string) => void;
  setTheme: (t: ThemeMode) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      currency: "₹",
      locale: "en-IN",
      theme: "dark",
      setCurrency: (currency) => set({ currency }),
      setTheme: (theme) => set({ theme }),
    }),
    { name: "ledge.settings" },
  ),
);
