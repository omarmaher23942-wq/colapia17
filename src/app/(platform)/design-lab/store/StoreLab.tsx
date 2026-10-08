"use client";

import { StoreProvider } from "@/components/storefront/StoreProvider";
import { ProductGrid } from "@/components/blocks/ProductGrid";
import type { ProductCardProduct } from "@/components/storefront/ProductCard";
import type { StoreBlueprint } from "@/blueprint/schema";
import type { StoreFact } from "@/blueprint/facts";

const NAMES = ["فستان سهرة ستان", "بلوزة شيفون", "جيبة بليسيه", "طقم كتان صيفي", "عباية مطرزة", "شنطة جلد", "كارديجان صوف", "بنطلون واسع", "تيشيرت قطن", "جاكيت جينز", "فستان كاجوال", "إيشارب حرير"];

function mock(i: number): ProductCardProduct {
  return {
    id: `00000000-0000-0000-0000-0000000000${String(i).padStart(2, "0")}`,
    storeId: "s",
    name: NAMES[i % NAMES.length]!,
    slug: `p-${i}`,
    shortDescription: "قصة مريحة بخامة ناعمة، مناسبة للسهرات والمناسبات.",
    pricePiasters: (450 + i * 135) * 100,
    compareAtPiasters: i % 3 === 0 ? (600 + i * 150) * 100 : null,
    images: [{ url: `https://picsum.photos/seed/prod${i}/600/750` }, { url: `https://picsum.photos/seed/prodb${i}/600/750` }],
    stock: i === 2 ? 3 : 20,
    trackStock: true,
    optionNames: [],
    isFeatured: i === 1,
  } as unknown as ProductCardProduct;
}

export function StoreLab({ bp, facts, n, children }: { bp: StoreBlueprint; facts: StoreFact[]; n: number; children: React.ReactNode }) {
  const products = Array.from({ length: n }, (_, i) => mock(i + 1));
  return (
    <StoreProvider
      value={{
        storeId: "s",
        subdomain: "lab",
        brand: bp.brand,
        conversion: { ...bp.conversion, lowStockAlert: { enabled: true, threshold: 5 } },
        channels: bp.channels,
        payments: bp.payments,
        shipping: bp.shipping,
        acceptingOrders: true,
        vacationMessage: null,
        customer: null,
        copy: bp.copy,
        design: bp.design,
        cardStyle: bp.theme.productCardStyle,
        facts,
      }}
    >
      {children}
      <ProductGrid
        s={{ id: "g", type: "product_grid", enabled: true, spacing: "normal", background: "muted", reveal: "none", variant: n >= 5 ? "featured_first" : "grid", title: "الأكثر طلباً هذا الأسبوع", subtitle: "اختيارات عميلاتنا المفضلة", source: { type: "featured" }, limit: 8, columnsMobile: 2, columnsDesktop: 4, showViewAll: true, quickAdd: true } as never}
        products={products}
      />
      {n >= 4 ? (
        <ProductGrid
          s={{ id: "g2", type: "product_grid", enabled: true, spacing: "normal", background: "default", reveal: "none", variant: "carousel", title: "وصل حديثاً", source: { type: "newest" }, limit: 10, columnsMobile: 2, columnsDesktop: 4, showViewAll: false, quickAdd: true } as never}
          products={products}
        />
      ) : null}
    </StoreProvider>
  );
}
