import { Markdown } from "@/components/storefront/Markdown";

export const metadata = { title: "الشروط والأحكام | Colapia" };

const BODY = `## Terms of Service (English summary)
Colapia provides a storefront platform for independent merchants in Egypt. Merchants are solely responsible for their catalog, products, prices, fulfillment, and customer service. Stores with prohibited or illegal products are subject to immediate suspension.

## شروط الاستخدام
1. متجرك الإلكتروني مخصص للأعمال التجارية القانونية في جمهورية مصر العربية.
2. التاجر هو المسؤول الأول والأخير عن جودة وتوصيل المنتجات المعروضة وعن التعامل المالي المباشر مع عملائه.
3. يُمنع منعاً باتاً بيع أي منتجات تخالف القانون أو تتعدى على الملكية الفكرية.
4. يحق للمنصة تجميد أو إيقاف المتاجر المخالفة لشروط الاستخدام.`;

export default function Terms() {
  return (
    <article className="container-x max-w-3xl py-12">
      <h1 className="mb-6 text-3xl font-black">الشروط والأحكام</h1>
      <Markdown text={BODY} />
    </article>
  );
}