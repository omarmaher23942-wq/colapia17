"use client";

// wishlist.ts — قائمة المفضلة لكل متجر على جهاز الزائر (بلا حساب). مفتاح التخزين يحمل storeId كالسلة تماماً،
// فلا تتسرب مفضلة متجر إلى آخر. تحفظ الـ slug فقط: الأسعار والتوفر تُجلب حيّة عند عرض الصفحة.
import { create, useStore as useZustandStore } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { useStore as useStorefront } from "@/components/storefront/StoreProvider";

const MAX = 60;

type WishState = {
  slugs: string[];
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
        partialize: (s) => ({ slugs: s.slugs }),
        merge: (persisted, current) => ({ ...current, slugs: clean((persisted as { slugs?: unknown } | null)?.slugs) }),
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
