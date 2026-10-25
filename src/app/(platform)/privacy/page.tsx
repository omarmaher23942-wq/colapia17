import type { Metadata } from "next";
import { Markdown } from "@/components/storefront/Markdown";
import { BRAND } from "@/lib/landing-content";
import { pageMetadata } from "@/lib/platform-seo";

export const metadata: Metadata = pageMetadata("privacy", {
  title: "سياسة الخصوصية",
  description: "ما تجمعه Colapia (كولابيا) من بيانات عند التواصل والحجز وطلبات المشاريع، وكيف تستخدمها وتحميها ومدة الاحتفاظ بها وطريقة حذفها.",
});

const BODY = `## Privacy Policy (English summary)
Colapia is a web agency. When you message our Instagram account or Facebook Page, book a project, or use the client dashboard, we receive what you send (name, account identifier, email, WhatsApp number, project details, files, payment receipt and requests), solely to answer you, deliver your project and keep our records. An automated assistant may give first replies to messages and hands the conversation to our team when needed. We use infrastructure providers (cloud hosting, database, file storage, email delivery, messaging platforms) to operate our services. After delivery your project runs on your own accounts; we do not keep or access your customers' data unless you ask us to for support. We do not sell data. Contact: ${BRAND.privacyEmail}. Data deletion: see /data-deletion.

## من نحن وما نجمعه
Colapia (كولابيا) وكالة تصميم وبرمجة. نجمع البيانات التالية بحسب ما تستخدمونه من خدماتنا:
- **المحادثة:** عندما تراسلون حسابنا على إنستجرام أو صفحتنا على فيسبوك نستلم اسمكم ومعرّف حسابكم والرسائل والصور والملفات التي ترسلونها. قد يرد عليكم في البداية مساعد آلي، ويحيل المحادثة إلى فريقنا عند الحاجة.
- **صفحة الحجز وطلب المشروع:** اسم المشروع أو المتجر، ونشاطكم، وحسابات التواصل، والبريد الإلكتروني (ومنه تدخلون إلى لوحة العميل)، ورقم واتساب، وتفضيلات التصميم، والمنتجات أو المحتوى الذي تزوّدوننا به، وصورة إيصال الدفع.
- **لوحة العميل:** نتحقق من هويتكم بحساب Google أو برمز يصل إلى بريدكم، ولا نحفظ كلمة مرور Google. ونحفظ ما تدخلونه فيها: حالة مشروعكم وطلبات التعديل وما ترفقونه بها.
- **زيارة موقعنا:** كوكيز ضرورية لتسجيل الدخول وتشغيل الصفحات، ولا نبيع بيانات التصفح.
نستخدم ذلك فقط للرد عليكم وتنفيذ مشروعكم وتسليمه وإدارة الدفع والتواصل معكم بشأنه وحفظ سجلاتنا.

## مع من نشاركها
نعتمد على مزوّدي بنية تشغيل بفئاتهم: مزوّد استضافة سحابية، وقاعدة بيانات سحابية، ومزوّد لتخزين الملفات والصور، ومزوّد لإرسال البريد، ومنصات المراسلة التي تتواصلون معنا عبرها (إنستجرام وفيسبوك وواتساب)، ومزوّدو خدمات معالجة النصوص والصور لتحليل الرسائل والملفات الواردة عند الحاجة. لا نبيع بياناتكم ولا نشاركها مع أي طرف آخر إلا لتقديم الخدمة أو بطلب قانوني.

## مشاريعكم بعد التسليم
بعد التسليم يعمل مشروعكم على حساباتكم أنتم، وبياناته وبيانات زبائنكم عندكم. لا نحتفظ ببيانات زبائنكم ولا نصل إليها إلا إذا طلبتم ذلك صراحةً لدعم فني محدد. وقد نحتفظ بنسخة من ملفات المشروع (الكود والمحتوى الذي زوّدتمونا به) مدة كافية لتنفيذ طلبات التعديل وتصحيح العيوب، ويمكنكم طلب حذفها في أي وقت.

## متجر العرض
متجر العرض التجريبي لا ينشئ فيه الزائر حساباً. نحفظ في متصفح الزائر معرّف جهاز عشوائياً (كوكي) لعدّ الزيارات، وتُحفظ مفضلته وسلته على جهازه نفسه، ولا نرسل بريداً لزوار المتجر.

## الاحتفاظ والحذف
- نحتفظ ببيانات الحجز وإيصالات الدفع وسجل المشروع ما دام ذلك لازماً لتنفيذ الاتفاق وحفظ سجلاتنا المحاسبية والقانونية.
- المحادثات والمسودات غير المكتملة نحذفها بعد مدة لا تتجاوز ما يلزم لمتابعتها.
- يمكنكم في أي وقت طلب نسخة من بياناتكم أو تصحيحها أو حذفها من صفحة تعليمات حذف البيانات، وننفذ طلب الحذف خلال 7 أيام عمل، عدا ما يوجب القانون الاحتفاظ به.

## الأمان
نحصر الوصول إلى بياناتكم في فريقنا بحسب الحاجة، ونستخدم اتصالات مشفّرة وتحقق هوية في لوحة العميل. ومع ذلك لا يوجد نظام آمن بالكامل، ونرجو إبلاغنا فوراً عند الاشتباه في أي اختراق.

## التواصل
${BRAND.privacyEmail}`;

export default function Privacy() {
  return (
    <article className="container-x max-w-3xl py-12">
      <h1 className="mb-6 text-3xl font-black">سياسة الخصوصية</h1>
      <Markdown text={BODY} />
    </article>
  );
}
