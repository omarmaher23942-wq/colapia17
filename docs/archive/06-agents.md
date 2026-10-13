
`docs/06-agents.md`

```md
# منظومة الوكلاء (داخلي، سري)

| الوكيل | النموذج | المدخل | المخرج |
|---|---|---|---|
| Onboarding | Claude Sonnet (fallback Groq 70B, Gemini) | رسائل Messenger/Instagram (نص/صوت/صور) | ردود قصيرة + أدوات حفظ + مرحلة + Lead score |
| Architect | Claude Opus (fallback Sonnet) | Intake | Build Plan (اتجاه، أقسام، تصنيفات، نبرة) |
| Composer | Claude Sonnet (fallback Gemini) | Plan + Intake + slugs حقيقية | Theme، Home sections، أوصاف منتجات، صفحات |
| QA | Claude Opus | Blueprint | درجة + إصلاحات JSON |
| Payment Verifier | Gemini Flash (vision) | سكرين شوت | استخراج + توصية |
| Lifecycle | بدون AI (QStash) | أحداث زمنية | تسليم، تذكيرات، تجميد، حذف |

## تدفق كامل
رسالة → `/api/webhooks/meta` (توقيع + dedupe) → QStash → `/api/agents/inbound` (تجميع 4 ثوانٍ + قفل) → `runtime.handleInbound` → أدوات → `finalize_intake` → `startBuild` → Workflow (`/api/workflows/build`) → `stores.status=review` + `delivery.auto` مجدول → المالك يراجع أو يُسلَّم تلقائيًا → `trial` + 5 مهام مجدولة → دفع → تحقق آلي → تأكيد بشري → `active` + Magic Link.

## التحكم في التكلفة
- كل استدعاء مسجّل في `ai_calls` (المزوّد، التوكنز، الزمن، Fallback).
- Onboarding: maxTokens 400 وتاريخ 24 رسالة فقط. Composer: دفعات منتجات 6. QA: مرتان كحد أقصى.
- Prompts قابلة للتعديل من الأدمن بدون Deploy (جدول `prompts` + كاش 60 ثانية).

## السرية
لا يُذكر AI في أي رسالة للعميل عن البناء. الوكيل المحادث لا يعرف بوجود Architect/Composer. الردود عن "من يبني" ثابتة: فريق Colapia.
