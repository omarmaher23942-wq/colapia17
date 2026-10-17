import { db } from "@/db/client";
import { DEFAULT_INTAKE_LIMITS } from "@/intake/rules";
import { DEFAULT_CAPACITY_PER_DAY } from "@/intake/eta";
import { DEFAULT_SLA_HOURS } from "@/agency/production";
import { featureFlags } from "@/db/schema";
import { FlagsEditor } from "@/components/platform/FlagsEditor";
import { requirePlatformPage } from "@/server/platform-guard";

export const dynamic = "force-dynamic";

const FLAG_DEFAULTS: { key: string; enabled: boolean; description: string; config?: Record<string, unknown> }[] = [
  { key: "bot.enabled", enabled: true, description: "تشغيل الوكيل الآلي على رسائل فيسبوك وإنستجرام لكل المحادثات (مفتاح الطوارئ؛ الإيقاف لمحادثة واحدة من صفحتها)" },
  { key: "bot.instagram", enabled: true, description: "الرد التلقائي على إنستاجرام" },
  { key: "production", enabled: true, description: "مهلة كل حالة إنتاج بالساعات قبل تنبيه التأخر", config: { sla: { ...DEFAULT_SLA_HOURS } } },
  { key: "visual_search", enabled: true, description: "«البحث بالصورة» في كل المتاجر: perMonth = حد البحث الشهري لكل متجر (الإيقاف يخفي الزر)", config: { perMonth: 400 } },
  { key: "change_requests", enabled: true, description: "طلبات التعديل للتاجر بعد الدفع: perYear = عددها لكل سنة اشتراك (يظهر في الهبوط والشروط ولوحة التاجر)", config: { perYear: 2 } },
  { key: "models", enabled: true, description: "تجاوز الموديلات بدون إعادة نشر (Deploy)", config: { chat: null, architect: null, compose: null } },
  {
    key: "intake",
    enabled: true,
    description: "استمارة طلب المتجر (/start): الإيقاف يغلق استقبال الطلبات. capacityPerDay = متاجر يسلّمها الفريق يومياً (لحساب موعد التسليم الصادق)، والباقي حدود الحماية من الإساءة",
    config: { capacityPerDay: DEFAULT_CAPACITY_PER_DAY, ...DEFAULT_INTAKE_LIMITS },
  },
];

export default async function FlagsPage() {
  await requirePlatformPage({ cap: "settings" });
  const existing = await db.select().from(featureFlags);
  // أي إعداد افتراضي جديد (مثل «intake») يُضاف للقاعدة القائمة أيضاً، لا عند أول تشغيل فقط.
  const missing = FLAG_DEFAULTS.filter((f) => !existing.some((r) => r.key === f.key));
  if (missing.length) await db.insert(featureFlags).values(missing).onConflictDoNothing();
  const rows = missing.length ? await db.select().from(featureFlags) : existing;

  // «pricing» و«lifecycle» تُعدَّلان من صفحة «الأسعار» فقط (بتحقق وسجل نشاط)، فلا تظهران في المحرر الخام.
  const all = (rows.length ? rows : FLAG_DEFAULTS.map((f) => ({ ...f, config: f.config ?? null, updatedAt: new Date() }))).filter((r) => r.key !== "pricing" && r.key !== "lifecycle");

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