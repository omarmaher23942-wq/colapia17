// معمل التصميم: بطاقات المنتجات بثيم متجر تجريبي (تطوير فقط).
import { notFound } from "next/navigation";
import { defaultBlueprint } from "@/blueprint/defaults";
import { themeToCssVars } from "@/blueprint/theme";
import { CardsDemo } from "./CardsDemo";
import { ProductReviews } from "@/components/storefront/product/ProductReviews";

export const dynamic = "force-dynamic";

export default function CardsLab() {
  if (process.env.NODE_ENV !== "development") notFound();
  const bp = defaultBlueprint({ name: "متجر نوفا" });
  const vars = themeToCssVars(bp.theme, "light");
  return (
    <div dir="rtl" className="storefront min-h-dvh bg-[var(--background)] p-6 md:p-10" style={vars as React.CSSProperties}>
      <CardsDemo bp={bp} />
      <div className="mx-auto max-w-5xl">
        <ProductReviews
          avg={4.6}
          count={5}
          reviews={[
            { id: "1", customerName: "منى أحمد", rating: 5, body: "الخامة ممتازة والمقاس مظبوط جداً، والتوصيل كان سريع. هطلب تاني أكيد.", imageUrls: [], isVerified: true, createdAt: new Date("2026-09-20") },
            { id: "2", customerName: "كريم", rating: 4, body: "حلو جداً بس اللون أغمق شوية من الصورة.", imageUrls: [], isVerified: true, createdAt: new Date("2026-09-12") },
            { id: "3", customerName: "سارة", rating: 5, body: null, imageUrls: [], isVerified: false, createdAt: new Date("2026-08-30") },
          ]}
        />
      </div>
    </div>
  );
}
