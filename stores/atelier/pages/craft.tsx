// صفحة /craft: قصة الورشة، مع أبرز القطع من بيانات المتجر الحقيقية.
import { ProductCard, SectionHeading, type PageMeta, type PageProps } from "@/stores-kit";

export const meta: PageMeta = { title: "الورشة", description: "كيف نصنع الفخار يدوياً في الفيوم." };

export default async function CraftPage({ kit }: PageProps) {
  const products = await kit.data.products({ source: { type: "featured" }, limit: 4 });
  return (
    <div className="container-x py-12" data-atelier-page="craft">
      <SectionHeading title={`ورشة ${kit.store.name}`} subtitle="من الطين الخام إلى قطعة على مائدتك." />
      {products.length ? (
        <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
