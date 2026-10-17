import "server-only";
// design-tweak.ts (خادم) — تنفيذ «اكتبوا ما تريدون تغييره»: النص ← عمليات على قائمة بيضاء (lib/design-tweak.ts) ← تحقق
// بمخطط الـ Blueprint ← حفظ بنسخة سابقة قابلة للتراجع. لا يعدّل إلا theme وdesign وhome، وأي مفتاح آخر يُرفض بالكامل.
import { and, desc, eq } from "drizzle-orm";
import { aiObject } from "@/ai/providers";
import { db } from "@/db/client";
import { storeBlueprints, storeSnapshots } from "@/db/schema";
import { blueprintSchema, type StoreBlueprint } from "@/blueprint/schema";
import { applyTweak, summarizeTweak, tweakResponseSchema, TWEAK_KEYS, SECTION_LABELS } from "@/lib/design-tweak";
import { diffBlueprint } from "@/lib/blueprint-patch";
import { checkAiQuota, recordAi } from "@/server/usage";
import { saveBlueprintAction } from "@/server/actions/blueprint";

const ALLOWED_TOP = new Set(["theme", "design", "home"]);

const SYSTEM = `أنت تحوّل طلباً بالعربية (قد يكون بالعامية المصرية) لتعديل شكل متجر إلكتروني إلى عمليات محددة من قائمة مغلقة.
أخرج JSON فقط بالشكل { "ops": [{ "key": "...", "value": ... }], "note": "..." }.
المفاتيح المسموحة وقيمها، ولا مفتاح غيرها أبداً:
${Object.entries(TWEAK_KEYS).map(([k, v]) => `- ${k}: ${v}`).join("\n")}
أنواع الأقسام لمفاتيح sections.*: ${Object.keys(SECTION_LABELS).join(", ")}
قواعد:
- نفّذ ما طُلب فقط ولا تضف تعديلات لم تُطلب. الألوان بصيغة hex كاملة (#rrggbb) تختارها مناسبة لما وُصف.
- «كبّر الخط» = text.size larger، و«صغّر الخط» = smaller.
- «غيّر الأسود للأبيض» عن الخلفية = color.background، وعن النص = color.foreground، وعن الأزرار = color.primary.
- لا تغيّر أسعاراً ولا منتجات ولا سياسات ولا بيانات اتصال. إن كان الطلب خارج القائمة فاترك ops فارغة واكتب في note سبباً قصيراً مهذباً بالعربية.
- لا تذكر الذكاء الاصطناعي في note.`;

function context(bp: StoreBlueprint): string {
  const p = bp.theme.palette;
  const sections = bp.home.map((s) => `${s.type}${s.enabled === false ? "(مخفي)" : ""}`).join(", ");
  return `الحالة الحالية: الوضع ${bp.theme.mode}، الأزرار ${p.primary}، المميز ${p.accent}، الخلفية ${p.background}، النص ${p.foreground}، حجم الخط ${bp.theme.fonts.baseSize}، الأقسام: ${sections}.`;
}

export type TweakOutcome =
  | { ok: true; applied: boolean; summary: string; undoVersion: number | null; changes: string[] }
  | { ok: false; error: string };

export async function tweakDesign(storeId: string, text: string): Promise<TweakOutcome> {
  const request = text.trim().slice(0, 400);
  if (request.length < 3) return { ok: false, error: "اكتبوا التعديل المطلوب بجملة قصيرة، مثل: اجعلوا الأزرار خضراء." };

  const q = await checkAiQuota(storeId, "design");
  if (!q.ok) return { ok: false, error: q.message };

  const [row] = await db.select().from(storeBlueprints).where(eq(storeBlueprints.storeId, storeId)).limit(1);
  const cur = row ? blueprintSchema.safeParse(row.data) : null;
  if (!cur?.success) return { ok: false, error: "تعذر قراءة تصميم المتجر" };
  const bp = cur.data;

  let resp: ReturnType<typeof tweakResponseSchema.parse>;
  try {
    resp = await aiObject(
      "fast",
      {
        schema: tweakResponseSchema,
        schemaName: "design_tweak",
        system: SYSTEM,
        prompt: `${context(bp)}\n\nطلب التاجر: ${request}`,
        temperature: 0.1,
        maxTokens: 900,
        budgetMs: 22_000,
        timeoutMs: 14_000,
      },
      { purpose: "design_tweak", storeId }
    );
  } catch (e) {
    console.error("[design-tweak]", e);
    return { ok: false, error: "تعذر تنفيذ الطلب الآن. حاولوا بعد لحظات، أو عدّلوا من خيارات الشكل يدوياً." };
  }
  await recordAi(storeId, "design");

  const r = applyTweak(bp, resp.ops);
  if (!r.changes.length) return { ok: true, applied: false, summary: summarizeTweak(r, resp.note), undoVersion: null, changes: [] };

  // سياج أخير: لا يتغير إلا theme/design/home، والنتيجة تجتاز مخطط الـ Blueprint كاملاً.
  const touched = diffBlueprint(bp as unknown as Record<string, unknown>, r.blueprint as unknown as Record<string, unknown>).map((c) => c.path[0]);
  if (touched.some((k) => !ALLOWED_TOP.has(k))) return { ok: false, error: "لم نتمكن من تنفيذ هذا التعديل بأمان." };
  const valid = blueprintSchema.safeParse(r.blueprint);
  if (!valid.success) return { ok: false, error: "التعديل المطلوب لا يناسب إعدادات المتجر الحالية. جرّبوا صيغة أخرى." };

  const saved = await saveBlueprintAction(valid.data, `تعديل بالكلام: ${request.slice(0, 40)}`);
  if (!saved.ok) return { ok: false, error: saved.error };
  // saveBlueprintAction يحتفظ بالنسخة السابقة تحت رقمها: هي ما يعود إليه التراجع.
  return { ok: true, applied: true, summary: summarizeTweak(r, resp.note), undoVersion: (saved.data?.version ?? 1) - 1, changes: r.changes };
}

/** يعيد المتجر إلى النسخة المحفوظة قبل تعديل (حسب رقمها)، وهي نفسها تُحفظ فيمكن «التراجع عن التراجع». */
export async function undoToVersion(storeId: string, version: number): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!Number.isInteger(version) || version < 1) return { ok: false, error: "نسخة غير صالحة" };
  const [snap] = await db
    .select()
    .from(storeSnapshots)
    .where(and(eq(storeSnapshots.storeId, storeId), eq(storeSnapshots.version, version)))
    .limit(1);
  if (!snap) return { ok: false, error: "النسخة السابقة غير متاحة" };
  const r = await saveBlueprintAction(snap.data, "تراجع عن تعديل");
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}

export type DesignHistoryItem = { version: number; label: string; at: string };

/** آخر نسخ التصميم (للاستعادة): كل نسخة هي حالة ما قبل حفظ. */
export async function designHistory(storeId: string, limit = 12): Promise<DesignHistoryItem[]> {
  const rows = await db
    .select({ version: storeSnapshots.version, label: storeSnapshots.label, at: storeSnapshots.createdAt })
    .from(storeSnapshots)
    .where(eq(storeSnapshots.storeId, storeId))
    .orderBy(desc(storeSnapshots.version))
    .limit(limit);
  return rows.map((r) => ({ version: r.version, label: r.label ?? "تعديل", at: r.at.toISOString() }));
}
