import { Markdown } from "@/components/storefront/Markdown";

export const metadata = { title: "سياسة الخصوصية" };

const BODY = `## Privacy Policy (English summary)
Colapia designs, builds and hosts e-commerce stores for merchants. When you fill in our store request form or message our Facebook Page or Instagram account we receive what you send (store details, WhatsApp number, email, page link, photos, logo, voice notes and notes), solely to build your store and contact you about it. Voice notes are converted to text automatically by a service provider so our team can read them. Unsent form drafts are deleted with their files after 21 days. Merchant store data (products, orders, customers) is processed on behalf of the merchant and hosted with our infrastructure providers (cloud application hosting and file storage, a cloud database, caching and job scheduling, and email delivery). Images a shopper uploads to a store's visual search are analysed automatically by a service provider to find matching products and are not stored. A paid store is never deleted automatically; the merchant may export and delete their data at any time. We do not sell data. Contact: privacy@colapia.com. Data deletion: see /data-deletion.

## من نحن وما نجمعه
Colapia فريق يصمم المتاجر الإلكترونية ويبنيها ويستضيفها للتجار.
- **استمارة طلب المتجر:** اسم متجرك ووصفه، ورقم واتساب، وبريدك، ورابط صفحتك، وصور منتجاتك وشعارك، وملاحظاتك، ومصدر زيارتك (مثل اسم الحملة الإعلانية). ولحماية الاستمارة من الإساءة نحفظ بصمة مشفّرة لعنوان IP (لا العنوان نفسه) ونوع المتصفح الذي أرسلتها منه، وعدّادات مؤقتة مبنية على بصمات مشفّرة لا تتجاوز 7 أيام.
- **الرسائل:** عندما تراسل صفحتنا على فيسبوك أو إنستجرام نستلم اسمك ومعرّف حسابك والرسائل والصور والرسائل الصوتية التي ترسلها.
نستخدم ذلك فقط لبناء متجرك والتواصل معك بخصوصه.

## بيانات متجرك
منتجاتك وطلباتك وبيانات عملائك تُعالج لحسابك أنت كتاجر، وتُخزَّن لدى مزوّدي بنية تشغيل نعتمد عليهم: مزوّد استضافة سحابية (تشغيل التطبيق وتخزين الصور والملفات)، وقاعدة بيانات سحابية، ومزوّد للتخزين المؤقت والمهام المجدولة، ومزوّد لإرسال البريد. وقد يعمل فريقنا على بيانات طلبك (الاسم ووسائل التواصل والصور ونص رسالتك الصوتية) باستخدام أدوات عمل مقدّمة من مزوّدي خدمات، ولا يُشارك منها إلا ما يلزم لتجهيز متجرك. لا نبيع بياناتك ولا نشاركها مع طرف ثالث إلا لتقديم الخدمة.

## بيانات العملاء النهائيين
عند الطلب من متجر تاجر نجمع الاسم ورقم الموبايل والعنوان لإتمام التوصيل فقط، ويحتفظ بها التاجر لإدارة طلباته. ونحفظ في متصفح الزائر معرّف جهاز عشوائياً (كوكي) لعدّ الزيارات وربط «طلباتي» بجهازه، دون أي بيانات شخصية فيه.
- **«البحث بالصورة»:** الصورة التي يرفعها الزائر للبحث تُحلَّل آلياً لدى مزوّد خدمة لمعرفة القطعة ومطابقتها بمنتجات المتجر، ثم تُهمَل ولا نخزّنها. ويُحفظ للتاجر وصف نصي قصير للقطع التي لم يجدها البحث (بلا الصورة ولا أي بيانات عن الزائر) ليعرف ما يطلبه عملاؤه.

## الاحتفاظ والحذف
- استمارة بدأتها ولم ترسلها تُحذف مع صورها وتسجيلاتها بعد 21 يوماً من آخر تعديل.
- الطلب المُرسل نحتفظ به ما دمنا نعمل على متجرك أو نستضيفه، ويمكنك طلب حذفه في أي وقت.
- لا نرسل لك بريداً عن طلبك إلا ما يخصه (تأكيد الاستلام ومراحل التنفيذ).
- متاجر التجربة غير المفعّلة تُحذف بعد فترة السماح التي نخبرك بها بالبريد أو واتساب (حسب وسيلة التواصل التي كتبتها).
- المتجر المشترك لا يُحذف تلقائياً أبداً، حتى لو انتهى اشتراكه: يتوقف عن الظهور فقط وتبقى بياناته حتى تجدد أو تطلب حذفها.
- يمكنك طلب حذف طلبك المُرسل بصوره وتسجيلاته نهائياً في أي وقت (اذكر كود طلبك REQ-…)، وننفذه خلال 7 أيام عمل. ويمكنك حذف بيانات متجرك من لوحتك (بعد نقل نسخة منها لحساباتك إن رغبت)، أو بطلب من صفحة حذف البيانات.

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