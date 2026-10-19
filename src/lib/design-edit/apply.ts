// apply.ts — التحقق من عمليات التعديل { path, value } وتطبيقها على نسخة من الـ Blueprint. خالص ومختبَر.
// القواعد: لا مسار خارج خريطة التعديل (schema-map.ts)، كل قيمة تُفحص بمخطط حقلها وحدوده، الألوان hex صالحة، ثم:
//  - تغيير الخلفية يشتق الأسطح (البطاقات، الخلفيات الخفيفة، الحدود) ويضبط لون النص، ولا يلمس الأزرار أبداً.
//  - تغيير لون الأزرار أو المميز يضبط النص فوقهما فقط.
//  - حارس التباين (WCAG AA) يعدّل ألوان النص وحدها، ولا يغيّر لوناً طلبه التاجر للخلفية أو الأزرار.
// ويعيد وصفاً عربياً بشرياً لكل تغيير.
import { z } from "zod";
import { buildFullPalette, contrastRatio, ensureContrast, readableOn } from "@/blueprint/palette";
import { deriveCorePalette } from "@/blueprint/core-palette";
import { blueprintSchema, type StoreBlueprint } from "@/blueprint/schema";
import { applyTheme, isThemeId, THEMES } from "@/blueprint/themes";
import { colorsIn, describeColor } from "./colors";
import { labelForPath, optionLabel } from "./labels";
import { editableFields, fieldIndex, getAt, resolvePath, schemaHas, setAt, type EditableField, type Seg } from "./schema-map";

// ─── رد النموذج ──────────────────────────────────────────────────────────────
export const designOpSchema = z.object({
  path: z.string().max(160),
  value: z.union([z.string().max(12000), z.number(), z.boolean(), z.array(z.string().max(80)).max(30), z.null()]),
  reason: z.string().max(240).optional(),
});
export const designResponseSchema = z.object({
  ops: z.array(designOpSchema).max(30).default([]),
  /** إن لم يُفهم جزء من الطلب أو كان خارج المتاح: سبب قصير بالعربية. */
  note: z.string().max(300).optional(),
});
export type DesignOp = z.infer<typeof designOpSchema>;

export type EditResult = {
  blueprint: StoreBlueprint;
  /** العمليات المقبولة بعد التطبيع (تُعاد للتاجر وتُرسل كما هي عند «تطبيق»). */
  ops: DesignOp[];
  /** سطر عربي لكل تغيير طُبّق. */
  changes: string[];
  /** ما رُفض مع السبب. */
  rejected: string[];
  /** ما طُلب وهو مضبوط بالفعل. */
  unchanged: string[];
  /** ما أصلحه حارس التباين لأن التاجر طلب لوناً غير مقروء. */
  contrastFixes: string[];
  /** تنبيهات لطيفة (لون أزرار قريب من الخلفية مثلاً). */
  warnings: string[];
};

const P = "theme.palette.";
type Palette = StoreBlueprint["theme"]["palette"];
const isDarkHex = (hex: string) => contrastRatio(hex, "#000000") < contrastRatio(hex, "#ffffff");

const CORNERS: Record<string, { card: number; button: number; input: number; image: number; chip: number }> = {
  none: { card: 0, button: 0, input: 0, image: 0, chip: 0 },
  sm: { card: 6, button: 6, input: 6, image: 6, chip: 999 },
  md: { card: 10, button: 10, input: 8, image: 10, chip: 999 },
  lg: { card: 16, button: 14, input: 12, image: 14, chip: 999 },
  xl: { card: 22, button: 18, input: 14, image: 20, chip: 999 },
  full: { card: 28, button: 999, input: 18, image: 24, chip: 999 },
};

function coerce(f: EditableField, raw: unknown): { ok: true; value: unknown } | { ok: false; reason: string } {
  let v: unknown = raw;
  switch (f.kind) {
    case "color": {
      const s = typeof raw === "string" ? raw.trim() : "";
      const hex = /^#?[0-9a-f]{6}$/i.test(s) ? `#${s.replace(/^#/, "").toLowerCase()}` : /^#?[0-9a-f]{3}$/i.test(s) ? colorsIn(`#${s.replace(/^#/, "")}`)[0]?.hex : colorsIn(s)[0]?.hex;
      if (!hex) return { ok: false, reason: "لون غير صالح" };
      v = hex;
      break;
    }
    case "enum": {
      const s = typeof raw === "string" ? raw.trim() : String(raw);
      const hit = f.options!.find((o) => o === s) ?? f.options!.find((o) => optionLabel(o) === s);
      if (!hit) return { ok: false, reason: "خيار غير متاح" };
      v = hit;
      break;
    }
    case "number": {
      let n = typeof raw === "number" ? raw : Number(String(raw).trim());
      if (!Number.isFinite(n)) return { ok: false, reason: "رقم غير صالح" };
      if (f.min !== undefined) n = Math.max(f.min, n);
      if (f.max !== undefined) n = Math.min(f.max, n);
      v = f.int ? Math.round(n) : Math.round(n * 1000) / 1000;
      break;
    }
    case "boolean": {
      if (raw === true || raw === "true") v = true;
      else if (raw === false || raw === "false") v = false;
      else return { ok: false, reason: "قيمة غير صالحة" };
      break;
    }
    case "text": {
      if (typeof raw !== "string" && raw !== null) return { ok: false, reason: "نص غير صالح" };
      const t = (raw ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim().slice(0, f.maxLen ?? 300);
      if ((f.minLen ?? 0) > 0 && t.length < f.minLen!) return { ok: false, reason: "النص لا يمكن أن يكون فارغاً" };
      v = t;
      break;
    }
    case "order": {
      if (!Array.isArray(raw) || !raw.every((x) => typeof x === "string")) return { ok: false, reason: "ترتيب غير صالح" };
      v = raw;
      break;
    }
  }
  if (f.schema) {
    // نص اختياري فارغ = حذفه (يعود للنص التلقائي).
    const candidate = f.kind === "text" && v === "" && (f.minLen ?? 0) === 0 ? undefined : v;
    const r = f.schema.safeParse(candidate);
    if (!r.success) return { ok: false, reason: "القيمة خارج المسموح" };
  }
  return { ok: true, value: v };
}

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

function describe(f: EditableField, before: unknown, after: unknown): string {
  if (f.path === "theme.preset") return `طبّقنا تصميم «${THEMES.find((t) => t.id === after)?.name ?? String(after)}»`;
  if (f.path === "announcement.text") return after ? `حدّثنا نص شريط الإعلان إلى «${String(after).slice(0, 50)}»` : "أخفينا شريط الإعلان";
  if (f.path === "home.order") return "أعدنا ترتيب أقسام الرئيسية";
  switch (f.kind) {
    case "color":
      return `غيّرنا ${f.label} إلى ${describeColor(String(after))}`;
    case "enum":
      return `جعلنا ${f.label}: ${optionLabel(String(after))}`;
    case "number":
      return Number(after) > Number(before ?? 0) ? `كبّرنا ${f.label}` : `صغّرنا ${f.label}`;
    case "boolean":
      if (f.path.endsWith(".enabled") && f.path.startsWith("home:")) return `${after ? "أظهرنا" : "أخفينا"} ${f.label.replace(/: ظاهر$/, "")}`;
      return `${after ? "فعّلنا" : "أوقفنا"} ${f.label}`;
    case "text":
      return after ? `عدّلنا ${f.label} إلى «${String(after).slice(0, 50)}${String(after).length > 50 ? "…" : ""}»` : `أعدنا ${f.label} إلى النص التلقائي`;
    default:
      return `عدّلنا ${f.label}`;
  }
}

/** حقول مسار خلفية جديد (theme.background في نسخ التصميم الأحدث) إن وُجد في المخطط. */
function backgroundObjectFields(fields: EditableField[]) {
  const sub = fields.filter((f) => f.path.startsWith("theme.background."));
  const kind = sub.find((f) => f.kind === "enum" && f.options?.includes("solid"));
  const colors = sub.filter((f) => f.kind === "color" && /\.(color|solid|from|base|value)$/.test(f.path));
  return { kind, colors };
}

type Core = { blueprint: StoreBlueprint; accepted: { op: DesignOp; field: EditableField; before: unknown }[]; rejected: string[]; unchanged: string[]; contrastFixes: string[]; warnings: string[] };

function applyCore(bp: StoreBlueprint, ops: readonly DesignOp[]): Core {
  let next: StoreBlueprint = structuredClone(bp);
  const rejected: string[] = [];
  const unchanged: string[] = [];
  const accepted: Core["accepted"] = [];
  const explicit = new Set<string>();

  // التصميم الكامل أولاً، فما بعده في الطلب نفسه يعدّل فوقه.
  const sorted = [...ops].sort((a, b) => (a.path === "theme.preset" ? -1 : 0) - (b.path === "theme.preset" ? -1 : 0));
  const seen = new Set<string>();
  for (const op of sorted) {
    if (seen.has(op.path)) continue;
    seen.add(op.path);
    // الخريطة تُبنى من الحالة الحالية (بعد التصميم الكامل إن طُبّق) فتظهر حقوله الجديدة.
    const fields = fieldIndex(editableFields(next));
    const f = fields.get(op.path);
    if (!f) {
      rejected.push(`«${String(op.path).slice(0, 40)}» ليس من التعديلات المتاحة`);
      continue;
    }
    const c = coerce(f, op.value);
    if (!c.ok) {
      rejected.push(`${f.label}: ${c.reason}`);
      continue;
    }
    const before = f.value;
    if (same(before, c.value) && f.kind !== "order") {
      unchanged.push(`${f.label} مضبوط بالفعل على هذه القيمة`);
      continue;
    }

    if (f.path === "theme.preset") {
      if (!isThemeId(c.value)) {
        rejected.push(`${f.label}: تصميم غير معروف`);
        continue;
      }
      const themed = structuredClone(applyTheme(structuredClone(next), c.value));
      if (schemaHas("design.theme")) (themed.design as Record<string, unknown>).theme = c.value;
      if (JSON.stringify(themed) === JSON.stringify(next)) {
        unchanged.push("هذا التصميم مطبّق بالفعل");
        continue;
      }
      next = themed;
    } else if (f.path === "announcement.text") {
      const t = String(c.value);
      const cur = next.header.announcement;
      if (!t && !cur?.enabled && !next.home.some((s) => s.type === "announcement" && s.enabled !== false)) {
        unchanged.push("شريط الإعلان مخفي بالفعل");
        continue;
      }
      next.header.announcement = { enabled: !!t, items: t ? [{ text: t }] : cur?.items ?? [], dismissible: cur?.dismissible ?? true, rotate: cur?.rotate ?? true };
      // قسم الإعلان القديم في الرئيسية لا يُعرض متى وُجد شريط الهيدر، فنطفئه حتى لا يعود نصه القديم.
      for (const s of next.home) if (s.type === "announcement") s.enabled = false;
    } else if (f.path === "home.order") {
      const ids = (c.value as string[]).filter((id, i, a) => a.indexOf(id) === i && next.home.some((s) => s.id === id));
      if (!ids.length) {
        rejected.push(`${f.label}: لا توجد أقسام بهذه المعرّفات`);
        continue;
      }
      const top = next.home.filter((s) => s.type === "hero" || s.type === "announcement");
      const rest = next.home.filter((s) => s.type !== "hero" && s.type !== "announcement");
      const rank = (id: string) => (ids.includes(id) ? ids.indexOf(id) : ids.length + rest.findIndex((s) => s.id === id));
      const reordered = [...rest].sort((a, b) => rank(a.id) - rank(b.id));
      if (reordered.every((s, i) => s === rest[i])) {
        unchanged.push("ترتيب الأقسام كما هو");
        continue;
      }
      next.home = [...top, ...reordered];
    } else {
      if (/^home:[^.]+\.enabled$/.test(f.path) && c.value === false) {
        const segs = resolvePath(next, f.path)!;
        if ((next.home[segs[1] as number] as { type: string }).type === "hero") {
          rejected.push("الواجهة لا تُخفى، ويمكن تغيير محتواها أو صورتها");
          continue;
        }
      }
      const segs = resolvePath(next, f.path);
      if (!segs) {
        rejected.push(`${f.label}: غير متاح`);
        continue;
      }
      const empty = f.kind === "text" && c.value === "" && (f.minLen ?? 0) === 0;
      setAt(next as unknown as Record<string, unknown>, segs, empty ? undefined : c.value);
    }
    explicit.add(f.path);
    accepted.push({ op: { path: f.path, value: c.value as DesignOp["value"], ...(op.reason ? { reason: op.reason.slice(0, 240) } : {}) }, field: f, before });
  }

  const contrastFixes: string[] = [];
  const warnings: string[] = [];
  const touchedPalette = [...explicit].some((p) => p.startsWith(P)) || explicit.has("theme.preset") || explicit.has("theme.mode") || [...explicit].some((p) => p.startsWith("theme.background."));
  if (touchedPalette) {
    const pal: Palette = { ...next.theme.palette };
    const t = (k: keyof Palette) => explicit.has(P + k);
    const allFields = editableFields(next);
    const bgObj = backgroundObjectFields(allFields);

    // لون خلفية مكتوب في حقل الخلفية الجديد وحده ← يصل للوحة أيضاً (المتجر يقرأ اللوحة).
    const objColor = bgObj.colors.find((f) => explicit.has(f.path));
    if (objColor && !t("background")) {
      const v = getAt(next, resolvePath(next, objColor.path) ?? []);
      if (typeof v === "string") {
        pal.background = v;
        explicit.add(P + "background");
      }
    }
    const bgTouched = explicit.has(P + "background");

    // الوضع الداكن/الفاتح بلا لون خلفية محدد: نشتق أسطحاً تناسبه ونحافظ على لون الأزرار والمميز.
    if (explicit.has("theme.mode") && !bgTouched && next.theme.mode !== "auto") {
      const mode = next.theme.mode;
      if ((mode === "dark") !== isDarkHex(pal.background)) {
        const d = deriveCorePalette(pal.primary, mode);
        for (const k of ["background", "card", "muted", "border", "secondary", "foreground", "mutedForeground", "cardForeground", "secondaryForeground"] as const) if (!t(k)) pal[k] = d[k];
      }
    }

    if (bgTouched) {
      const full = buildFullPalette(pal.background, pal.primary, pal.accent);
      for (const k of ["card", "muted", "border", "secondary"] as const) if (!t(k)) pal[k] = full[k];
      if (!explicit.has("theme.mode")) {
        const dark = isDarkHex(pal.background);
        if (next.theme.mode === "auto") warnings.push("ثبّتنا وضع المتجر على الخلفية الجديدة ليظهر اللون لكل الزوار");
        next.theme.mode = dark ? "dark" : "light";
      }
      // حقل الخلفية الجديد (إن وُجد): لون مصمت بنفس اللون.
      if (bgObj.kind && !explicit.has(bgObj.kind.path)) {
        const s = resolvePath(next, bgObj.kind.path);
        if (s) setAt(next as unknown as Record<string, unknown>, s, "solid");
      }
      for (const f of bgObj.colors) {
        if (explicit.has(f.path)) continue;
        const s = resolvePath(next, f.path);
        if (s) setAt(next as unknown as Record<string, unknown>, s, pal.background);
      }
    }

    // ألوان النص فقط تُعدَّل لتبلغ AA. ما طلبه التاجر صراحةً لنص غير مقروء يُذكر في الملخص.
    const textPairs: [keyof Palette, keyof Palette, string][] = [
      ["foreground", "background", "لون النص"],
      ["cardForeground", "card", "نص البطاقات"],
      ["mutedForeground", "background", "النص الثانوي"],
      ["mutedForeground", "muted", "النص الثانوي"],
      ["secondaryForeground", "secondary", "نص الأسطح الثانوية"],
    ];
    for (const [fg, bg, label] of textPairs) {
      if (contrastRatio(pal[fg], pal[bg]) >= 4.5) continue;
      pal[fg] = ensureContrast(pal[fg], pal[bg], 4.5);
      if (contrastRatio(pal[fg], pal[bg]) < 4.5) pal[fg] = readableOn(pal[bg]);
      if (t(fg) && !contrastFixes.includes(label)) contrastFixes.push(label);
    }
    // النص فوق الأزرار والمميز: الأبيض أو الأسود الأوضح (أحدهما يبلغ 4.5 مع أي لون).
    for (const [fg, bg, label] of [["primaryForeground", "primary", "نص الأزرار"], ["accentForeground", "accent", "نص الشارات"]] as const) {
      if (contrastRatio(pal[fg], pal[bg]) >= 4.5) continue;
      pal[fg] = readableOn(pal[bg]);
      if (t(fg) && !contrastFixes.includes(label)) contrastFixes.push(label);
    }
    if (contrastRatio(pal.primary, pal.background) < 1.6) {
      warnings.push("لون الأزرار قريب جداً من لون الخلفية فقد لا تظهر بوضوح. يمكن تغييره بطلب مثل: اجعلوا الأزرار سوداء");
    }
    next.theme.palette = pal;
  }

  // ربط الحقول المتلازمة: الزوايا ← أشكال العناصر، وشكل الأزرار وأسلوب البطاقة في الحقلين المقروءين.
  if (explicit.has("theme.radius") && ![...explicit].some((p) => p.startsWith("design.shape."))) {
    const c = CORNERS[next.theme.radius];
    if (c) next.design.shape = { ...next.design.shape, ...c };
  }
  if (explicit.has("theme.buttonStyle") && !explicit.has("design.button.fill")) next.design.button = { ...next.design.button, fill: next.theme.buttonStyle };
  if (explicit.has("design.button.fill") && !explicit.has("theme.buttonStyle")) next.theme.buttonStyle = next.design.button.fill;
  const cardOpt = editableFields(next).find((f) => f.path === "design.cardStyle");
  if (cardOpt?.options) {
    const d = next.design as Record<string, unknown>;
    if (explicit.has("theme.productCardStyle") && !explicit.has("design.cardStyle") && cardOpt.options.includes(next.theme.productCardStyle)) d.cardStyle = next.theme.productCardStyle;
    if (explicit.has("design.cardStyle") && !explicit.has("theme.productCardStyle")) {
      const v = d.cardStyle as StoreBlueprint["theme"]["productCardStyle"];
      const opts = (editableFields(next).find((f) => f.path === "theme.productCardStyle")?.options ?? []) as string[];
      if (opts.includes(v)) next.theme.productCardStyle = v;
    }
  }
  return { blueprint: next, accepted, rejected, unchanged, contrastFixes, warnings };
}

/** يحدد العملية المسؤولة عن خطأ تحقق في الناتج (بمقارنة بداية المسار). */
function culprit(bp: StoreBlueprint, ops: readonly DesignOp[], issuePath: (string | number)[]): number {
  let best = -1;
  let bestLen = 0;
  ops.forEach((op, i) => {
    const segs: Seg[] = op.path === "announcement.text" ? ["header", "announcement"] : op.path === "theme.preset" ? ["theme"] : resolvePath(bp, op.path) ?? op.path.split(".");
    let n = 0;
    while (n < segs.length && n < issuePath.length && String(segs[n]) === String(issuePath[n])) n++;
    if (n > bestLen) {
      bestLen = n;
      best = i;
    }
  });
  return best;
}

/** يتحقق من العمليات ويطبّقها. الناتج يجتاز مخطط الـ Blueprint دائماً (عملية تكسره تُرفض وحدها). */
export function applyDesignOps(bp: StoreBlueprint, ops: readonly DesignOp[]): EditResult {
  let list = [...ops].slice(0, 30);
  const extraRejected: string[] = [];
  for (let attempt = 0; attempt < 8; attempt++) {
    const r = applyCore(bp, list);
    const parsed = blueprintSchema.safeParse(r.blueprint);
    if (parsed.success) {
      return {
        blueprint: parsed.data,
        ops: r.accepted.map((a) => a.op),
        changes: mergeLines(r.accepted.map((a) => ({ path: a.field.path, line: describe(a.field, a.before, a.op.value) }))),
        rejected: [...extraRejected, ...r.rejected],
        unchanged: r.unchanged,
        contrastFixes: r.contrastFixes,
        warnings: r.warnings,
      };
    }
    const issue = parsed.error.issues[0]!;
    const i = culprit(bp, list, issue.path);
    if (i < 0) break;
    extraRejected.push(`${labelForPath(list[i]!.path)}: لا يناسب إعدادات المتجر الحالية`);
    list = list.filter((_, k) => k !== i);
  }
  return { blueprint: bp, ops: [], changes: [], rejected: [...extraRejected, "لم نتمكن من تطبيق التعديل بأمان"], unchanged: [], contrastFixes: [], warnings: [] };
}

/** يدمج الأسطر المتشابهة: خطا العناوين والنصوص بنفس الخط ← سطر واحد. */
function mergeLines(items: { path: string; line: string }[]): string[] {
  const h = items.find((x) => x.path === "theme.fonts.heading");
  const b = items.find((x) => x.path === "theme.fonts.body");
  if (h && b && h.line.split(": ")[1] === b.line.split(": ")[1]) {
    const font = h.line.split(": ")[1];
    return items.filter((x) => x !== b).map((x) => (x === h ? { ...x, line: `غيّرنا الخط إلى «${font}»` } : x)).map((x) => x.line);
  }
  return items.map((x) => x.line);
}

/** جملة واحدة مفهومة عما تغيّر، أو لماذا لم يتغير شيء. لا تذكر أي تقنية. */
export function summarizeEdit(r: Pick<EditResult, "changes" | "contrastFixes" | "rejected" | "warnings" | "unchanged">, extra?: { unresolved?: string[]; note?: string }): string {
  const parts: string[] = [];
  if (r.changes.length) parts.push(`${r.changes.join("، ")}.`);
  if (r.contrastFixes.length) parts.push(`وضبطنا ${r.contrastFixes.join(" و")} ليبقى مقروءاً بوضوح.`);
  for (const w of r.warnings) parts.push(`${w}.`);
  if (!r.changes.length) {
    if (r.unchanged.length) parts.push(`${r.unchanged[0]}.`);
    else if (extra?.note) parts.push(extra.note);
    else if (r.rejected.length) parts.push("لم نتمكن من تنفيذ هذا الطلب. جرّبوا وصفاً أوضح مثل: اجعلوا الخلفية بيضاء والأزرار سوداء.");
    else parts.push("لم نفهم التعديل المطلوب. اكتبوه بجملة قصيرة وواضحة، مثل: كبّروا الخط.");
  } else if (extra?.unresolved?.length) {
    parts.push(`ولم نتمكن من تنفيذ: «${extra.unresolved.join("»، «").slice(0, 160)}».`);
  }
  return parts.join(" ");
}

export const _internal = { coerce, describe };
