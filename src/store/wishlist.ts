"use client";

// wishlist.ts — قائمة المفضلة لكل متجر على جهاز الزائر (بلا حساب). مفتاح التخزين يحمل storeId كالسلة تماماً،
// فلا تتسرب مفضلة متجر إلى آخر. تحفظ الـ slug فقط: الأسعار والتوفر تُجلب حيّة عند عرض الصفحة.
import { create, useStore as useZustandStore } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { useStore as useStorefront } from "@/components/storefront/StoreProvider";

const MAX = 60;

type WishState = {
  slugs: string[];
  /** أول سعر رآه الزائر لكل منتج في قائمته (لإظهار انخفاض السعر لاحقاً). */
  prices: Record<string, number>;
  notePrices: (current: Record<string, number>) => void;
  addMany: (slugs: string[]) => void;
  toggle: (slug: string) => boolean;
  remove: (slug: string) => void;
  clear: () => void;
};

const clean = (raw: unknown): string[] =>
  Array.isArray(raw) ? Array.from(new Set(raw.filter((x): x is string => typeof x === "string" && x.length > 0 && x.length <= 120))).slice(0, MAX) : [];

function createWishStore(storeId: string) {
  return create<WishState>()(
    persist(
      (set, get) => ({
        slugs: [],
        prices: {},
        notePrices: (current) => {
          const prev = get().prices;
          const next: Record<string, number> = {};
          for (const s of get().slugs) {
            const base = prev[s] ?? current[s];
            if (typeof base === "number" && base > 0) next[s] = base;
          }
          if (JSON.stringify(next) !== JSON.stringify(prev)) set({ prices: next });
        },
        addMany: (add) => set({ slugs: Array.from(new Set([...get().slugs, ...add.filter((x) => x.length > 0 && x.length <= 120)])).slice(0, MAX) }),
        /** يعيد true إن صار المنتج في المفضلة بعد الضغط. */
        toggle: (slug) => {
          const has = get().slugs.includes(slug);
          set({ slugs: has ? get().slugs.filter((s) => s !== slug) : [slug, ...get().slugs].slice(0, MAX) });
          if (!has && typeof window !== "undefined") window.clpTrack?.("add_to_wishlist", { slug });
          return !has;
        },
        remove: (slug) => set({ slugs: get().slugs.filter((s) => s !== slug) }),
        clear: () => set({ slugs: [] }),
      }),
      {
        name: `clp-wish:${storeId}`,
        storage: createJSONStorage(() => localStorage),
        partialize: (s) => ({ slugs: s.slugs, prices: s.prices }),
        merge: (persisted, current) => {
          const p = persisted as { slugs?: unknown; prices?: unknown } | null;
          const prices: Record<string, number> = {};
          if (p?.prices && typeof p.prices === "object") for (const [k, v] of Object.entries(p.prices as Record<string, unknown>)) if (typeof v === "number" && Number.isFinite(v) && v > 0) prices[k] = v;
          return { ...current, slugs: clean(p?.slugs), prices };
        },
      },
    ),
  );
}

type WishStore = ReturnType<typeof createWishStore>;
const cache = new Map<string, WishStore>();

function getWishStore(storeId: string): WishStore {
  let s = cache.get(storeId);
  if (!s) {
    s = createWishStore(storeId);
    cache.set(storeId, s);
  }
  return s;
}

export function useWishlist<T>(selector: (s: WishState) => T): T {
  const { storeId } = useStorefront();
  return useZustandStore(getWishStore(storeId), selector);
}
