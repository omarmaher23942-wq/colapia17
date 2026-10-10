import { Markdown } from "@/components/storefront/Markdown";

export const metadata = { title: "سياسة الخصوصية | Colapia" };

const BODY = `## Privacy Policy (English summary)
Colapia builds e-commerce stores for merchants. When you message our Facebook Page or Instagram account we receive your name, profile ID and the messages, photos and voice notes you send, solely to build and support your store. Merchant store data (products, orders, customers) is processed on behalf of the merchant and hosted with our infrastructure providers (Railway, Neon, UploadThing, Cloudflare, Upstash, Resend). A paid store is never deleted automatically; the merchant may export and delete their data at any time. We do not sell data. Contact: privacy@colapia.com. Data deletion: see /data-deletion.

## من نحن وما نجمعه
عندما تراسل صفحتنا على فيسبوك أو إنستجرام نستلم: اسمك ومعرّف حسابك على المنصة، والرسائل والصور والرسائل الصوتية التي ترسلها، ونستخدمها فقط لبناء متجرك ودعمك.

## بيانات متجرك
منتجاتك وطلباتك وبيانات عملائك تُعالج لحسابك أنت كتاجر، وتُخزَّن لدى مزوّدي بنية تشغيل نعتمد عليهم: Railway (تشغيل التطبيق)، Neon (قاعدة البيانات)، UploadThing (الصور)، Cloudflare (حماية النطاق وتسريعه)، Upstash (التخزين المؤقت والمهام المجدولة)، Resend (البريد). ونستخدم مزوّدي ذكاء اصطناعي (Google Gemini وGroq وغيرهم) لتصميم المتجر وكتابة نصوصه ومساعدتك، ويُرسَل إليهم ما يلزم لذلك فقط من بيانات متجرك. لا نبيع بياناتك ولا نشاركها مع طرف ثالث إلا لتقديم الخدمة.

## بيانات العملاء النهائيين
عند الطلب من متجر تاجر نجمع الاسم ورقم الموبايل والعنوان لإتمام التوصيل فقط، ويحتفظ بها التاجر لإدارة طلباته. ونحفظ في متصفح الزائر معرّف جهاز عشوائياً (كوكي) لعدّ الزيارات وربط «طلباتي» بجهازه، دون أي بيانات شخصية فيه.

## الاحتفاظ والحذف
- متاجر التجربة غير المفعّلة تُحذف بعد فترة السماح التي نخبرك بها بالبريد.
- المتجر المشترك لا يُحذف تلقائياً أبداً، حتى لو انتهى اشتراكه: يتوقف عن الظهور فقط وتبقى بياناته حتى تجدد أو تطلب حذفها.
- يمكنك حذف بياناتك من لوحتك (بعد نقل نسخة منها لحساباتك إن رغبت)، أو بطلب من صفحة حذف البيانات، وننفذه خلال 7 أيام عمل.

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