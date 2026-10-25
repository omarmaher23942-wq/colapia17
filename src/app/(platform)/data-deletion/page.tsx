import type { Metadata } from "next";
import { Markdown } from "@/components/storefront/Markdown";
import { BRAND } from "@/lib/landing-content";
import { pageMetadata } from "@/lib/platform-seo";

export const metadata: Metadata = pageMetadata("deletion", {
  title: "تعليمات حذف البيانات",
  description: "كيف تطلبون حذف بياناتكم التي تعالجها Colapia (كولابيا) عبر إنستجرام أو فيسبوك أو صفحة الحجز أو لوحة العميل.",
});

const BODY = `## Data Deletion Instructions
To request deletion of the personal or business data Colapia holds about you (messages from our Instagram account or Facebook Page, booking details, files, receipts and client-dashboard data):

1. **Via message:** Send a message to our Instagram account or Facebook Page saying "حذف بياناتي" or "Delete my data".
2. **Via email:** Write to **${BRAND.privacyEmail}** with your booking code (if you booked through our website) or your account name and profile link (if you contacted us through Instagram or Facebook).

We complete the deletion within 7 business days and confirm it to you. Records we are legally required to keep (such as payment records) are retained only as required. A delivered project that runs on your own accounts is yours; delete it from those accounts directly.

## كيف تطلبون حذف بياناتكم
1. **برسالة:** راسلوا حسابنا على إنستجرام أو صفحتنا على فيسبوك واكتبوا «حذف بياناتي».
2. **بالبريد:** اكتبوا إلى **${BRAND.privacyEmail}** ومعكم كود الحجز إن حجزتم من موقعنا، أو اسم حسابكم ورابطه إن تواصلتم عبر إنستجرام أو فيسبوك.

## ماذا يُحذف؟
- المحادثات والرسائل والملفات والصور التي أرسلتموها لنا.
- بيانات الحجز وطلبات التعديل وملفات المشروع التي نحتفظ بها.
- نحتفظ فقط بما يوجب القانون حفظه، كسجلات الدفع، وبالقدر اللازم.

وبعد التسليم يعمل مشروعكم على حساباتكم أنتم؛ فالنسخة الموجودة هناك ملككم وتحذفونها من حساباتكم مباشرة، ونحن مستعدون لمساعدتكم في ذلك.

## المدة
ننفذ طلب الحذف خلال 7 أيام عمل من وصوله ونؤكد لكم إتمامه.`;

export default function DataDeletion() {
  return (
    <article className="container-x max-w-3xl py-12">
      <h1 className="mb-6 text-3xl font-black">تعليمات حذف البيانات</h1>
      <Markdown text={BODY} />
    </article>
  );
}
