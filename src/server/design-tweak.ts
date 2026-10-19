import "server-only";
// design-tweak.ts (خادم) — «اكتبوا ما تريدون تغييره» بوصول كامل لبيانات الشكل والمحتوى:
//  1) اقتراح: الفهم المباشر (lib/design-edit/parse.ts) ثم الفهم الموسّع لما تبقى فقط، بخريطة كل الحقول وقيمها الحالية
//     وقاموس مرادفات، ثم التحقق والتطبيق على نسخة ومعاينة «قبل/بعد». لا شيء يُحفظ.
//  2) تطبيق: نفس العمليات تُفحص من جديد على أحدث نسخة وتُحفظ بنسخة سابقة قابلة للتراجع.
//  3) تراجع وسجل آخر 10 تعديلات.
import { and, desc, eq, like } from "drizzle-orm";
import { aiText, extractJson } from "@/ai/providers";
import { db } from "@/db/client";
import { storeBlueprints, storeSnapshots } from "@/db/schema";
import { blueprintSchema, type StoreBlueprint } from "@/blueprint/schema";
import {
  applyDesignOps,
  designResponseSchema,
  designUserPrompt,
  DESIGN_SYSTEM_PROMPT,
  EDIT_LABEL_PREFIX,
  parseRequest,
  planEdit,
  type DesignOp,
  type PreviewTokens,
} from "@/lib/design-tweak";
import { diffBlueprint } from "@/lib/blueprint-patch";
import { checkAiQuota, recordAi } from "@/server/usage";
import { saveBlueprintAction } from "@/server/actions/blueprint";

/** الأجزاء التي يحق لمحرر الوصف تعديلها. أي تغيير خارجها (دفع، شحن، سياسات بيانات) يُرفض بالكامل. */
const ALLOWED_TOP = new Set(["theme", "design", "brand", "header", "footer", "seo", "copy", "productPage", "home", "pages"]);

export type ProposeOutcome =
  | { ok: true; summary: string; changes: string[]; warnings: string[]; rejected: string[]; ops: DesignOp[]; before: PreviewTokens; after: PreviewTokens }
  | { ok: false; error: string };

export type ApplyOutcome = { ok: true; summary: string; changes: string[]; undoVersion: number | null } | { ok: false; error: string };

async function loadBp(storeId: string): Promise<StoreBlueprint | null> {
  const [row] = await db.select({ data: storeBlueprints.data }).from(storeBlueprints).where(eq(storeBlueprints.storeId, storeId)).limit(1);
  const cur = row ? blueprintSchema.safeParse(row.data) : null;
  return cur?.success ? cur.data : null;
}

const cleanRequest = (t: string) => t.replace(/\s+/g, " ").trim().slice(0, 600);

/** يقترح التعديل ويعرض «قبل/بعد» دون حفظ. */
export async function proposeDesignEdit(storeId: string, text: string): Promise<ProposeOutcome> {
  const request = cleanRequest(text);
  if (request.length < 3) return { ok: false, error: "اكتبوا التعديل المطلوب بجملة قصيرة، مثل: اجعلوا الخلفية بيضاء." };
  const bp = await loadBp(storeId);
  if (!bp) return { ok: false, error: "تعذر قراءة تصميم المتجر" };

  const parsed = parseRequest(request, bp);
  let wide: { ops: DesignOp[]; note?: string } | null = null;
  let wideFailed = false;
  let quotaNote: string | undefined;

  if (parsed.unresolved.length) {
    const q = await checkAiQuota(storeId, "design");
    if (!q.ok) {
      wideFailed = true;
      quotaNote = q.message;
    } else {
      const part = parsed.unresolved.join("، ");
      try {
        const r = await aiText(
          "fast",
          {
            system: DESIGN_SYSTEM_PROMPT,
            messages: [{ role: "user", content: designUserPrompt(bp, parsed.ops.length ? `${request}\nالجزء المطلوب منك فقط: ${part}` : request, parsed.ops) }],
            temperature: 0.1,
            maxTokens: 1400,
            budgetMs: 22_000,
            timeoutMs: 13_000,
            accept: (t) => {
              try {
                return designResponseSchema.safeParse(extractJson(t)).success;
              } catch {
                return false;
              }
            },
          },
          { purpose: "design_edit", storeId }
        );
        wide = designResponseSchema.parse(extractJson(r.text));
        await recordAi(storeId, "design");
      } catch (e) {
        console.error("[design-edit] wide parse failed:", e instanceof Error ? e.message.slice(0, 300) : e);
        wideFailed = true;
      }
    }
  }

  const plan = planEdit(bp, parsed, wide, wideFailed);
  const summary = !plan.changes.length && quotaNote ? quotaNote : plan.summary;
  return { ok: true, summary, changes: plan.changes, warnings: plan.warnings, rejected: plan.rejected, ops: plan.ops, before: plan.before, after: plan.after };
}

/** يطبّق العمليات المقترحة على أحدث نسخة (تُفحص من جديد) ويحفظها بنسخة سابقة قابلة للتراجع. */
export async function applyDesignEdit(storeId: string, ops: DesignOp[], text: string): Promise<ApplyOutcome> {
  if (!ops.length) return { ok: false, error: "لا يوجد تعديل لتطبيقه" };
  const bp = await loadBp(storeId);
  if (!bp) return { ok: false, error: "تعذر قراءة تصميم المتجر" };
  const r = applyDesignOps(bp, ops);
  if (!r.ops.length) return { ok: false, error: r.unchanged.length ? "هذا التعديل مطبّق بالفعل." : "تغيّرت إعدادات المتجر منذ الاقتراح. اكتبوا الطلب مرة أخرى." };

  const touched = diffBlueprint(bp as unknown as Record<string, unknown>, r.blueprint as unknown as Record<string, unknown>).map((c) => c.path[0]);
  if (touched.some((k) => !ALLOWED_TOP.has(k))) return { ok: false, error: "لم نتمكن من تنفيذ هذا التعديل بأمان." };

  const label = `${EDIT_LABEL_PREFIX}${cleanRequest(text).slice(0, 60) || r.changes[0]?.slice(0, 60) || "تعديل"}`;
  const saved = await saveBlueprintAction(r.blueprint, label);
  if (!saved.ok) return { ok: false, error: saved.error };
  const v = saved.data?.version ?? 1;
  return { ok: true, summary: r.changes.join("، ") + ".", changes: r.changes, undoVersion: v > 1 ? v - 1 : null };
}

/** يعيد المتجر إلى النسخة المحفوظة قبل تعديل (حسب رقمها)، والحالة الحالية تُحفظ أيضاً فيمكن «التراجع عن التراجع». */
export async function undoToVersion(storeId: string, version: number): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!Number.isInteger(version) || version < 1) return { ok: false, error: "نسخة غير صالحة" };
  const [snap] = await db
    .select()
    .from(storeSnapshots)
    .where(and(eq(storeSnapshots.storeId, storeId), eq(storeSnapshots.version, version)))
    .limit(1);
  if (!snap) return { ok: false, error: "النسخة السابقة غير متاحة" };
  const parsed = blueprintSchema.safeParse(snap.data);
  if (!parsed.success) return { ok: false, error: "النسخة السابقة لا تناسب إعدادات المتجر الحالية" };
  const r = await saveBlueprintAction(parsed.data, "تراجع عن تعديل");
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

/** آخر 10 تعديلات بالوصف: الوصف كما كتبه التاجر، والنسخة التي تعيد المتجر إلى ما قبله. */
export async function editHistory(storeId: string): Promise<DesignHistoryItem[]> {
  const rows = await db
    .select({ version: storeSnapshots.version, label: storeSnapshots.label, at: storeSnapshots.createdAt })
    .from(storeSnapshots)
    .where(and(eq(storeSnapshots.storeId, storeId), like(storeSnapshots.label, `${EDIT_LABEL_PREFIX}%`)))
    .orderBy(desc(storeSnapshots.version))
    .limit(10);
  return rows.map((r) => ({ version: r.version, label: (r.label ?? "").slice(EDIT_LABEL_PREFIX.length) || "تعديل", at: r.at.toISOString() }));
}
