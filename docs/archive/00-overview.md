# Colapia | نظرة عامة

Colapia منصة ووكالة لبناء متاجر إلكترونية للتجار المصريين خلال أقل من 12 ساعة، بتجربة 24 ساعة قبل الدفع، ودفعة واحدة بدون اشتراكات.

## المبدأ المعماري
- **Config-as-Data**: كل متجر = Blueprint (JSON محقق بـ Zod) يُصيَّر عبر Block Registry من أقسام مبنية مسبقًا. لا كود لكل متجر، لا Deploy لكل متجر.
- **Multi-tenant**: تطبيق Next.js واحد، قاعدة Neon واحدة، `*.colapia.com` عبر Middleware.
- **طبقات**: `src/blueprint` (العقد) ← `src/components/blocks` (العرض) ← `src/server` (المنطق) ← `src/db` (البيانات).

## المسارات
| المسار | الوصف |
|---|---|
| `colapia.com` | المنصة (تسويق + `/admin` أدمن المنصة في الجزء 3) |
| `shop.colapia.com` | متجر التاجر (يُعاد كتابته داخليًا إلى `/s/shop`) |
| `shop.colapia.com/admin` | داشبورد التاجر |
| `shop.colapia.com/admin/activate` | دفع تفعيل المتجر للمنصة |
| `/api/uploadthing`, `/api/track`, `/api/proof`, `/api/live` | خدمات داخلية |

## الأجزاء
1. النواة + المتجر + داشبورد التاجر (هذا الجزء)
2. الوكلاء + Messenger/Instagram + Pipeline البناء + دورة التجربة
3. أدمن المنصة + AI Editor + المراقبة + التشغيل
