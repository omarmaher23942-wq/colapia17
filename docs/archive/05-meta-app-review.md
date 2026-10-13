# Meta: ضبط الـ Webhooks والحصول على موافقة App Review

## أ) الـ Webhook (بعد النشر على Vercel)
1. developers.facebook.com → تطبيقك → **Messenger → Settings → Webhooks** → Add Callback URL:
   - URL: `https://colapia.com/api/webhooks/meta`
   - Verify token: قيمة `META_VERIFY_TOKEN`
2. اشترك في الحقول: `messages`, `messaging_postbacks`, `messaging_optins`, `message_deliveries` (اختياري).
3. في قسم **Access Tokens** اختر الصفحة → Add Subscriptions → نفس الحقول.
4. **Instagram → Settings → Webhooks**: نفس الـ URL، الحقول: `messages`, `messaging_postbacks`. اربط حساب Instagram Business بالصفحة.
5. اختبر: أرسل رسالة للصفحة من حساب أدمن/تستر؛ يجب أن يرد الوكيل خلال ثوانٍ. راقب `system_events` وسجل Vercel.

## ب) وضع التطوير مقابل الإطلاق
- في **Development**: يرد البوت فقط على من لديهم دور في التطبيق (Roles → Testers). أضف نفسك وفريقك وعدة عملاء أوائل كـ Testers للتجربة الحقيقية.
- للجمهور تحتاج **Live mode** + **Advanced Access** للصلاحيات: `pages_messaging`, `pages_manage_metadata`, `instagram_basic`, `instagram_manage_messages`, `pages_show_list`.

## ج) Business Verification
Settings → Business Verification: سجل تجاري أو بطاقة ضريبية أو مستندات الشركة + الدومين `colapia.com` (تحقق عبر Meta tag يوضع في `layout.tsx` للمنصة).

## د) App Review: ما تقدّمه بالضبط
- **وصف حالة الاستخدام** (بالإنجليزية): "Colapia builds e-commerce stores for Egyptian merchants. Merchants message our Page to request a store; our assistant collects their business details and product photos, then we deliver the store link and support them in the same conversation."
- **فيديو Screencast** (2 إلى 4 دقائق): من رسالة العميل الأولى → جمع البيانات → استلام رابط المتجر. أظهر أن الرسائل رد على العميل.
- صفحات مطلوبة على `colapia.com`: **Privacy Policy** و**Terms** و**Data Deletion Instructions** (نضيفها في الجزء 3، وتُربط في Settings → Basic).
- رد على السؤال "Why do you need this permission?" لكل صلاحية بجملة عملية.
- المدة عادةً 2 إلى 7 أيام. الرفض الشائع: فيديو غير واضح، أو صفحة خصوصية ناقصة، أو رسائل تبدو تسويقية غير مطلوبة. التزم بأن كل رسالة رد على تفاعل العميل.

## هـ) سياسة الـ 24 ساعة
- Messenger: خارج النافذة نستخدم tag `ACCOUNT_UPDATE` لرسائل حالة المتجر/الدفع/التفعيل فقط (مسموح). التذكيرات التسويقية تُصاغ كرد على تفاعل أو تُرسل داخل النافذة.
- Instagram: لا tags؛ الرسائل خارج النافذة تُخزَّن وتُرسل تلقائيًا عند أول رسالة من العميل.

## و) اختبار محلي للـ Webhook
```bash
npx localtunnel --port 3000   # أو cloudflared tunnel --url http://localhost:3000
