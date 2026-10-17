import { db } from "@/db/client";
import { AGENT_FLAG, DEFAULT_AGENT_CONFIG } from "@/agent/config";
import { featureFlags } from "@/db/schema";
import { FlagsEditor } from "@/components/platform/FlagsEditor";
import { requirePlatformPage } from "@/server/platform-guard";

export const dynamic = "force-dynamic";

const FLAG_DEFAULTS: { key: string; enabled: boolean; description: string; config?: Record<string, unknown> }[] = [
  { key: "bot.enabled", enabled: true, description: "تشغيل الوكيل الآلي على رسائل فيسبوك وإنستجرام لكل المحادثات (مفتاح الطوارئ؛ الإيقاف لمحادثة واحدة من صفحتها)" },
  { key: "bot.instagram", enabled: true, description: "الرد التلقائي على إنستاجرام" },
  { key: AGENT_FLAG, enabled: true, description: "إعداد وكيل الرسائل وإنشاء المتاجر: setupDelayMinutes = دقائق الانتظار قبل إرسال رابط الإعداد، setupDays = أيام الانتظار قبل حذف متجر لم يكتمل إعداده، dailyStoreCap = سقف المتاجر المنشأة آلياً يومياً، handoffPauseHours = مدة إيقاف الوكيل بعد طلب موظف، demoUrl = رابط المتجر التجريبي (فارغ = demo.النطاق)", config: { ...DEFAULT_AGENT_CONFIG } },
  { key: "visual_search", enabled: true, description: "«البحث بالصورة» في كل المتاجر: perMonth = حد البحث الشهري لكل متجر (الإيقاف يخفي الزر)", config: { perMonth: 400 } },
  { key: "change_requests", enabled: true, description: "طلبات التعديل للتاجر بعد الدفع: perYear = عددها لكل سنة اشتراك (يظهر في الهبوط والشروط ولوحة التاجر)", config: { perYear: 2 } },
  { key: "models", enabled: true, description: "تجاوز الموديلات بدون إعادة نشر (Deploy)", config: { chat: null, architect: null, compose: null } },
];

export default async function FlagsPage() {
  await requirePlatformPage({ cap: "settings" });
  const existing = await db.select().from(featureFlags);
  // أي إعداد افتراضي جديد (مثل «agent») يُضاف للقاعدة القائمة أيضاً، لا عند أول تشغيل فقط.
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