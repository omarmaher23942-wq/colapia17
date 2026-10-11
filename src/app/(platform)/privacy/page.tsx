import { Markdown } from "@/components/storefront/Markdown";

export const metadata = { title: "سياسة الخصوصية | Colapia" };

const BODY = `## Privacy Policy (English summary)
Colapia designs, builds and hosts e-commerce stores for merchants. When you fill in our store request form or message our Facebook Page or Instagram account we receive what you send (store details, WhatsApp number, email, page link, photos, logo, voice notes and notes), solely to build your store and contact you about it. Voice notes are transcribed automatically by an AI provider (Groq). Unsent form drafts are deleted with their files after 21 days. Merchant store data (products, orders, customers) is processed on behalf of the merchant and hosted with our infrastructure providers (Vercel, Neon, UploadThing, Upstash, Resend). A paid store is never deleted automatically; the merchant may export and delete their data at any time. We do not sell data. Contact: privacy@colapia.com. Data deletion: see /data-deletion.

## من نحن وما نجمعه
Colapia فريق يصمم المتاجر الإلكترونية ويبنيها ويستضيفها للتجار.
- **استمارة طلب المتجر:** اسم متجرك ووصفه، ورقم واتساب، وبريدك، ورابط صفحتك، وصور منتجاتك وشعارك، ورسالتك الصوتية وملاحظاتك، ومصدر زيارتك (مثل اسم الحملة الإعلانية). ونحفظ بصمة مشفّرة لعنوان IP (لا العنوان نفسه) لحماية الاستمارة من الإساءة.
- **الرسائل:** عندما تراسل صفحتنا على فيسبوك أو إنستجرام نستلم اسمك ومعرّف حسابك والرسائل والصور والرسائل الصوتية التي ترسلها.
نستخدم ذلك فقط لبناء متجرك والتواصل معك بخصوصه. الرسائل الصوتية تُحوَّل إلى نص آلياً عبر مزوّد ذكاء اصطناعي (Groq) ليقرأها الفريق، ويبقى التسجيل نفسه متاحاً لهم.

## بيانات متجرك
منتجاتك وطلباتك وبيانات عملائك تُعالج لحسابك أنت كتاجر، وتُخزَّن لدى مزوّدي بنية تشغيل نعتمد عليهم: Vercel (تشغيل التطبيق)، Neon (قاعدة البيانات)، UploadThing (الصور والملفات)، Upstash (التخزين المؤقت والمهام المجدولة)، Resend (البريد). ونستخدم مزوّدي ذكاء اصطناعي (Google Gemini وGroq وغيرهم) لتصميم المتجر وكتابة نصوصه ومساعدتك، ويُرسَل إليهم ما يلزم لذلك فقط من بيانات متجرك. لا نبيع بياناتك ولا نشاركها مع طرف ثالث إلا لتقديم الخدمة.

## بيانات العملاء النهائيين
عند الطلب من متجر تاجر نجمع الاسم ورقم الموبايل والعنوان لإتمام التوصيل فقط، ويحتفظ بها التاجر لإدارة طلباته. ونحفظ في متصفح الزائر معرّف جهاز عشوائياً (كوكي) لعدّ الزيارات وربط «طلباتي» بجهازه، دون أي بيانات شخصية فيه.

## الاحتفاظ والحذف
- استمارة بدأتها ولم ترسلها تُحذف مع صورها وتسجيلاتها بعد 21 يوماً من آخر تعديل.
- الطلب المُرسل نحتفظ به ما دمنا نعمل على متجرك أو نستضيفه، ويمكنك طلب حذفه في أي وقت.
- لا نرسل لك بريداً عن طلبك إلا ما يخصه (تأكيد الاستلام ومراحل التنفيذ).
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