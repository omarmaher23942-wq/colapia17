import { Markdown } from "@/components/storefront/Markdown";

export const metadata = { title: "سياسة الخصوصية | Colapia" };

const BODY = `## Privacy Policy (English summary)
Colapia builds e-commerce stores for merchants. When you message our Facebook Page or Instagram account we receive your name, profile ID and the messages, photos and voice notes you send, solely to build and support your store. Merchant store data (products, orders, customers) is processed on behalf of the merchant. We do not sell data. Contact: privacy@colapia.com. Data deletion: see /data-deletion.

## من نحن وما نجمعه
عندما تراسل صفحتنا على فيسبوك أو إنستجرام نستلم: اسمك ومعرّف حسابك على المنصة، والرسائل والصور والرسائل الصوتية التي ترسلها، ونستخدمها فقط لبناء متجرك ودعمك.

## بيانات متجرك
منتجاتك وطلباتك وبيانات عملائك تُعالج لحسابك أنت كتاجر، وتُخزَّن على خوادم آمنة (Neon، Uploadthing، Vercel) ولا تُشارك مع أي طرف ثالث إلا لتقديم الخدمة.

## بيانات العملاء النهائيين
عند الطلب من متجر تاجر نجمع الاسم ورقم الموبايل والعنوان لإتمام التوصيل فقط، ويحتفظ بها التاجر لإدارة طلباته.

## الاحتفاظ والحذف
نحذف متاجر التجربة غير المفعّلة تلقائيًا بعد فترة السماح. يمكنك طلب حذف بياناتك في أي وقت من صفحة حذف البيانات.

## التواصل
privacy@colapia.com`;

export default function Privacy() {
  return (
    <article className="container-x max-w-3xl py-12">
      <h1 className="mb-6 text-3xl font-black">سياسة الخصوصية</h1>
      <Markdown text={BODY} />
    </article>
  );
}