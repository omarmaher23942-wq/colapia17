import { Markdown } from "@/components/storefront/Markdown";

export const metadata = { title: "سياسة الخصوصية" };

const BODY = `## Privacy Policy (English summary)
Colapia prepares, hosts and operates e-commerce stores for merchants. When you message our Facebook Page or Instagram account, or complete your store setup, we receive what you send (store details, WhatsApp number, email, account link, photos, files and notes), solely to prepare your store and contact you about it. Merchant store data (products, orders, customers) is processed on behalf of the merchant and hosted with our infrastructure providers (application hosting and file storage, a cloud database, caching and job scheduling, and email delivery). Shoppers do not create accounts; their favourites and order list stay on their own device. Images a shopper uploads to a store's visual search, and files a merchant uploads for product import, are analysed automatically by service providers for that purpose only; visual search images are not stored. An active store is never deleted automatically; the merchant may export and delete their data at any time. We do not sell data. Contact: privacy@colapia.com. Data deletion: see /data-deletion.

## من نحن وما نجمعه
Colapia فريق يجهّز المتاجر الإلكترونية ويستضيفها ويشغّلها للتجار.
- **المحادثة:** عندما تراسلون صفحتنا على فيسبوك أو إنستجرام نستلم اسمكم ومعرّف حسابكم والرسائل والصور التي ترسلونها، ونستخدمها للرد عليكم وجمع بيانات متجركم.
- **بيانات الإعداد:** اسم المتجر ونشاطه، وبريد حساب Google، ورقم واتساب، وروابط حسابات التواصل، والشعار وصور المنتجات والملفات التي ترفعونها، وسياسات الدفع والشحن والاستبدال التي تحددونها.
- **الدخول:** نتحقق من هويتكم بحساب Google أو برمز يصل لبريدكم، ولا نحفظ كلمة مرور Google.
- **سجل الرسائل البريدية:** نحتفظ بسجل ما يُرسل من بريد باسم متجركم وحالة وصوله، لتشخيص أي مشكلة في التسليم.
نستخدم ذلك فقط لتجهيز متجركم وتشغيله والتواصل معكم بخصوصه.

## بيانات متجركم
منتجاتكم وطلباتكم وبيانات عملائكم تُعالج لحسابكم أنتم كتجار، وتُخزَّن لدى مزوّدي بنية تشغيل نعتمد عليهم: مزوّد استضافة سحابية (تشغيل التطبيق وتخزين الصور والملفات)، وقاعدة بيانات سحابية، ومزوّد للتخزين المؤقت والمهام المجدولة، ومزوّد لإرسال البريد. وتُحلَّل بعض المحتويات آلياً لدى مزوّدي خدمات متخصصين عند استخدامكم أدوات بعينها (استيراد المنتجات من ملف أو صور، وتعديل الشكل بالوصف، واستوديو المحتوى)، ولا يُشارك إلا ما يلزم لتنفيذ طلبكم. لا نبيع بياناتكم ولا نشاركها مع طرف ثالث إلا لتقديم الخدمة.

## بيانات الزبائن النهائيين
لا ينشئ الزبائن حسابات. عند الطلب من متجر تاجر نجمع الاسم ورقم الموبايل والعنوان لإتمام التوصيل فقط، ويحتفظ بها التاجر لإدارة طلباته. ونحفظ في متصفح الزائر معرّف جهاز عشوائياً (كوكي) لعدّ الزيارات، ونحفظ مفضلته وقائمة «طلباتي» وسلته في تخزين جهازه نفسه، دون أي بيانات شخصية في المعرّف. ولا نرسل بريداً لزبائن التجار.
- **«البحث بالصورة»:** الصورة التي يرفعها الزائر للبحث تُحلَّل آلياً لدى مزوّد خدمة لمعرفة القطعة ومطابقتها بمنتجات المتجر، ثم تُهمَل ولا نخزّنها. ويُحفظ للتاجر وصف نصي قصير للقطع التي لم يجدها البحث (بلا الصورة ولا أي بيانات عن الزائر).

## الاحتفاظ والحذف
- متجر لم يكتمل إعداده يُحذف بعد المهلة التي نعلنها لكم بالرسائل والبريد.
- عند انتهاء التجربة دون دفع يتجمد المتجر وتُقفل اللوحة إلا صفحة الاشتراك، وتبقى بياناتكم ويعود كل شيء فور الدفع. ومتاجر التجربة غير المفعّلة تُحذف بعد فترة السماح والتنبيه الأخير اللذين نخبركم بهما قبل الحذف.
- المتجر المشترك لا يُحذف تلقائياً أبداً حتى لو انتهى اشتراكه: يتوقف عن الظهور فقط وتبقى بياناته حتى تجددوا أو تطلبوا حذفها.
- يمكنكم تنزيل طلباتكم وعملائكم (CSV من لوحتكم) وطلب نسخة من بقية بيانات متجركم، وطلب حذف بياناتكم نهائياً في أي وقت من صفحة حذف البيانات، وننفذه خلال 7 أيام عمل.

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