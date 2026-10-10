import { db } from "@/db/client";
import { platformPricing } from "@/lib/platform-pricing";
import { featureFlags } from "@/db/schema";
import { FlagsEditor } from "@/components/platform/FlagsEditor";

export const dynamic = "force-dynamic";

const FLAG_DEFAULTS: { key: string; enabled: boolean; description: string; config?: Record<string, unknown> }[] = [
  { key: "bot.enabled", enabled: true, description: "تشغيل مستشار المبيعات الذكي عالمياً (مفتاح الطوارئ)" },
  { key: "bot.instagram", enabled: true, description: "الرد التلقائي على إنستاجرام" },
  { key: "build.auto_deliver", enabled: true, description: "التسليم الفوري التلقائي بمجرد اكتمال البناء بالـ AI" },
  { key: "build.qa_second_pass", enabled: true, description: "جولة فحص جودة ثانية في حال كانت الدرجة أقل من 75" },
  { key: "trial.enabled", enabled: true, description: "تفعيل التجربة المجانية للتاجر" },
  { key: "payments.ai_verify", enabled: true, description: "الفحص الآلي لإيصالات التحويل بـ Gemini Vision" },
  { key: "showcase.enabled", enabled: true, description: "عرض المتاجر المميزة في الصفحة الرئيسية" },
  { key: "pricing", enabled: true, description: "أسعار الباقة والتجديد (من المتغيرات PLATFORM_*_EGP)", config: { ...platformPricing() } },
  { key: "sla", enabled: true, description: "مدد التشغيل والتجربة", config: { deliveryMinutes: 5, demoActiveMinutes: 180, graceDays: 7 } },
  { key: "models", enabled: true, description: "تجاوز الموديلات بدون إعادة نشر (Deploy)", config: { chat: null, architect: null, compose: null } },
];

export default async function FlagsPage() {
  const rows = await db.select().from(featureFlags);
  
  if (!rows.length) {
    await db.insert(featureFlags).values(FLAG_DEFAULTS).onConflictDoNothing();
  }
  
  const all = rows.length ? rows : FLAG_DEFAULTS.map((f) => ({ ...f, config: f.config ?? null, updatedAt: new Date() }));

  return (
    <div className="space-y-6 bg-[#07091a] text-[#eaf0ff]" dir="rtl">
      <div className="border-b border-white/10 pb-5">
        <h1 className="text-2xl font-black text-white">إعدادات ومزايا المنصة (Feature Flags)</h1>
        <p className="mt-1 text-xs text-slate-400">تغييرات فورية تنعكس على كافة المتاجر والبوتات بدون أي Deploy.</p>
      </div>
      
      <FlagsEditor
        rows={all.map((r) => ({
          key: r.key,
          enabled: r.enabled,
          description: r.description ?? "",
          config: r.config ? JSON.stringify(r.config, null, 2) : "",
        }))}
      />
    </div>
  );
}