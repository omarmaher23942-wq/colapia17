import type { Metadata } from "next";
import { requireStore } from "@/lib/tenant";
import { Suspense } from "react";
import { WishlistView } from "@/components/storefront/WishlistView";

// المفضلة محفوظة على جهاز الزائر، فالصفحة لا تُفهرس.
export const metadata: Metadata = { title: "المفضلة", robots: { index: false, follow: true } };

export default async function WishlistPage({ params }: { params: Promise<{ store: string }> }) {
  const { store: sub } = await params;
  await requireStore(sub);
  return (
    <Suspense fallback={null}>
      <WishlistView />
    </Suspense>
  );
}
