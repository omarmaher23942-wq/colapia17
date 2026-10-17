"use server";

// design.ts — إجراءات صفحة «شكل المتجر»: شريط الإعلان، وترتيب أقسام الرئيسية وإظهارها وإخفاؤها، وسجل نسخ التصميم.
// تُدمج في الـ Blueprint الحالي (لا نسخة قديمة كاملة)، وكل حفظ يُبقي النسخة السابقة قابلة للاستعادة.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { storeFor } from "@/server/merchant-guard";
import { designHistory, type DesignHistoryItem } from "@/server/design-tweak";
import { loadBlueprint } from "@/server/setup-data";
import { saveBlueprintAction } from "./blueprint";

type Res = { ok: true } | { ok: false; error: string };
const SESSION_ERR = "انتهت جلستكم، سجّلوا الدخول من جديد";

const LOCKED = new Set(["hero", "announcement"]);

const sectionsInput = z.object({ items: z.array(z.object({ id: z.string().min(1).max(80), enabled: z.boolean() })).min(1).max(30) });

/** يعيد ترتيب أقسام الرئيسية ويضبط ظهورها. الواجهة وشريط الإعلان يبقيان في مكانهما ولا يُخفيان من هنا. */
export async function saveSectionsAction(raw: unknown): Promise<Res> {
  const s = await storeFor("content");
  if (!s) return { ok: false, error: SESSION_ERR };
  const p = sectionsInput.safeParse(raw);
  if (!p.success) return { ok: false, error: "بيانات غير صالحة" };
  const bp = await loadBlueprint(s.storeId);
  if (!bp) return { ok: false, error: "تعذر قراءة إعدادات المتجر" };

  const movable = bp.home.filter((x) => !LOCKED.has(x.type));
  const byId = new Map(movable.map((x) => [x.id, x]));
  if (p.data.items.length !== movable.length || !p.data.items.every((i) => byId.has(i.id)) || new Set(p.data.items.map((i) => i.id)).size !== movable.length) {
    return { ok: false, error: "تغيّرت أقسام الصفحة. حدّثوا الصفحة ثم أعيدوا المحاولة." };
  }
  const reordered = p.data.items.map((i) => ({ ...byId.get(i.id)!, enabled: i.enabled }));
  // الواجهة والإعلان في مواضعهما الأصلية، وما عداهما بالترتيب الجديد.
  let k = 0;
  const home = bp.home.map((x) => (LOCKED.has(x.type) ? x : reordered[k++]!));
  const r = await saveBlueprintAction({ ...bp, home }, "ترتيب أقسام الرئيسية");
  if (r.ok) revalidatePath("/dashboard/design");
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}

const announcementInput = z.object({ text: z.string().trim().max(120, "النص 120 حرفاً على الأكثر"), enabled: z.boolean() });

export async function saveAnnouncementAction(raw: unknown): Promise<Res> {
  const s = await storeFor("content");
  if (!s) return { ok: false, error: SESSION_ERR };
  const p = announcementInput.safeParse(raw);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "بيانات غير صالحة" };
  if (p.data.enabled && !p.data.text) return { ok: false, error: "اكتبوا نص الشريط أو أوقفوه" };
  const bp = await loadBlueprint(s.storeId);
  if (!bp) return { ok: false, error: "تعذر قراءة إعدادات المتجر" };
  const i = bp.home.findIndex((x) => x.type === "announcement");
  let home = bp.home;
  if (i >= 0) {
    home = bp.home.map((x, k) => (k === i && x.type === "announcement" ? { ...x, enabled: p.data.enabled, messages: p.data.text ? [{ ...x.messages[0], text: p.data.text }] : x.messages } : x));
  } else if (p.data.enabled) {
    home = [{ id: "announcement-1", type: "announcement", enabled: true, spacing: "normal", background: "primary", reveal: "none", variant: "static", messages: [{ text: p.data.text }], dismissible: true, sticky: true }, ...bp.home];
  }
  const r = await saveBlueprintAction({ ...bp, home }, "شريط الإعلان");
  if (r.ok) revalidatePath("/dashboard/design");
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}

export async function designHistoryAction(): Promise<DesignHistoryItem[]> {
  const s = await storeFor("content", "view");
  if (!s) return [];
  return designHistory(s.storeId);
}
