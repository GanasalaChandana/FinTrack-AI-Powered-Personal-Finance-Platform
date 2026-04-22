// lib/stores/taxStore.ts
// localStorage-backed store for tax-deductible transaction tagging.
// No backend changes required — all stored client-side.

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type TaxCategory =
  | "business"
  | "medical"
  | "charitable"
  | "education"
  | "home_office"
  | "other";

export interface TaxEntry {
  taxCategory: TaxCategory;
  note?: string;
}

interface TaxStore {
  entries: Record<string, TaxEntry>; // transactionId → TaxEntry
  mark: (id: string, taxCategory: TaxCategory, note?: string) => void;
  unmark: (id: string) => void;
  isMarked: (id: string) => boolean;
  getEntry: (id: string) => TaxEntry | undefined;
  getMarkedIds: () => string[];
  clear: () => void;
}

export const useTaxStore = create<TaxStore>()(
  persist(
    (set, get) => ({
      entries: {},

      mark: (id, taxCategory, note) =>
        set((s) => ({
          entries: { ...s.entries, [id]: { taxCategory, note } },
        })),

      unmark: (id) =>
        set((s) => {
          const next = { ...s.entries };
          delete next[id];
          return { entries: next };
        }),

      isMarked: (id) => id in get().entries,
      getEntry: (id) => get().entries[id],
      getMarkedIds: () => Object.keys(get().entries),
      clear: () => set({ entries: {} }),
    }),
    { name: "fintrack-tax-entries" }
  )
);

export const TAX_CATEGORY_META: Record<
  TaxCategory,
  { label: string; color: string; bg: string; border: string; description: string }
> = {
  business:    { label: "Business",    color: "text-blue-600",   bg: "bg-blue-50",   border: "border-blue-200",   description: "Office supplies, travel, software, meals" },
  medical:     { label: "Medical",     color: "text-red-600",    bg: "bg-red-50",    border: "border-red-200",    description: "Doctor visits, prescriptions, insurance" },
  charitable:  { label: "Charitable",  color: "text-purple-600", bg: "bg-purple-50", border: "border-purple-200", description: "Donations to qualified organizations" },
  education:   { label: "Education",   color: "text-green-600",  bg: "bg-green-50",  border: "border-green-200",  description: "Tuition, books, courses, certifications" },
  home_office: { label: "Home Office", color: "text-amber-600",  bg: "bg-amber-50",  border: "border-amber-200",  description: "Internet, utilities, equipment (if WFH)" },
  other:       { label: "Other",       color: "text-gray-600",   bg: "bg-gray-50",   border: "border-gray-200",   description: "Other deductible expenses" },
};
