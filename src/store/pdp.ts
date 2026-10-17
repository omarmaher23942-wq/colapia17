"use client";
// حالة الشراء الحالية في صفحة المنتج، يكتبها ProductPurchase ويقرؤها شريط الشراء الثابت (بلا data-attributes ولا MutationObserver).
import { create } from "zustand";

export type PdpState = {
  productId: string;
  slug: string;
  name: string;
  image: string;
  variantId: string;
  variantLabel: string;
  /** سعر الوحدة بعد خصم الكمية. */
  price: number;
  qty: number;
  stock: number | null;
  out: boolean;
  needsVariant: boolean;
  optionNames: string[];
  /** الشريط الثابت: هل منطقة أزرار الشراء ظاهرة. */
  buttonsVisible: boolean;
};

type Store = { s: PdpState | null; set: (s: PdpState) => void; setVisible: (v: boolean) => void; clear: () => void };

export const usePdp = create<Store>((set) => ({
  s: null,
  set: (s) => set((cur) => ({ s: { ...s, buttonsVisible: cur.s?.buttonsVisible ?? true } })),
  setVisible: (v) => set((cur) => (cur.s ? { s: { ...cur.s, buttonsVisible: v } } : cur)),
  clear: () => set({ s: null }),
}));
