"use client";

import { StoreProvider } from "@/components/storefront/StoreProvider";
import { ProductCard, type ProductCardProduct } from "@/components/storefront/ProductCard";
import type { StoreBlueprint } from "@/blueprint/schema";

const img = (seed: string) => [{ id: seed, url: `https://picsum.photos/seed/${seed}/600/600` }];

function product(i: number, name: string, price: number, compare: number | null): ProductCardProduct {
  return {
    id: `00000000-0000-0000-0000-00000000000${i}`,
    storeId: "s",
    name,
    slug: `p-${i}`,
    pricePiasters: price * 100,
    compareAtPiasters: compare ? compare * 100 : null,
    images: img(`clp${i}`),
    stock: i === 2 ? 3 : 20,
    trackStock: true,
    optionNames: [],
    isSpotlight: i === 1,
  } as unknown as ProductCardProduct;
}

export function CardsDemo({ bp }: { bp: StoreBlueprint }) {
  return (
    <StoreProvider
      value={{
        storeId: "s",
        subdomain: "nova",
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
        facts: [],
      }}
    >
      <div className="mx-auto grid max-w-5xl grid-cols-2 gap-5 md:grid-cols-4">
        <ProductCard product={product(1, "حقيبة جلد طبيعي بتصميم كلاسيكي", 1250, 1600)} />
        <ProductCard product={product(2, "ساعة يد رجالي فضية", 2100, null)} />
        <ProductCard product={product(3, "عطر الورد الشرقي 100 مل", 890, 1100)} />
        <ProductCard product={product(4, "نظارة شمسية مستقطبة", 640, null)} />
      </div>
    </StoreProvider>
  );
}
