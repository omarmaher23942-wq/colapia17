// plan.ts — يجمع الفهم المباشر (parse.ts) والفهم الموسّع (رد النموذج) في خطة واحدة: العمليات المقبولة، والملخص العربي،
// ومعاينة «قبل/بعد». خالص: الخادم يستدعيه للاقتراح، ثم يعيد تطبيق العمليات نفسها عند «تطبيق» على أحدث نسخة.
import type { StoreBlueprint } from "@/blueprint/schema";
import { applyDesignOps, summarizeEdit, type DesignOp, type EditResult } from "./apply";
import type { ParseResult } from "./parse";
import { previewTokens, type PreviewTokens } from "./preview";

export type EditPlan = Omit<EditResult, "blueprint"> & {
  blueprint: StoreBlueprint;
  summary: string;
  unresolved: string[];
  before: PreviewTokens;
  after: PreviewTokens;
};

/** العمليات المباشرة أولاً (أدق في الألوان والأحجام)، ثم ما أضافه الفهم الموسّع لمسارات أخرى. */
export function combineOps(direct: readonly DesignOp[], extra: readonly DesignOp[]): DesignOp[] {
  const out = [...direct];
  for (const o of extra) if (!out.some((x) => x.path === o.path)) out.push(o);
  return out.slice(0, 30);
}

export function planEdit(bp: StoreBlueprint, parsed: ParseResult, wide?: { ops: DesignOp[]; note?: string } | null, wideFailed = false): EditPlan {
  const ops = combineOps(parsed.ops, wide?.ops ?? []);
  const r = applyDesignOps(bp, ops);
  // ما لم يفهمه المحلّل المباشر يُعد منفّذاً إن أضاف الفهم الموسّع عمليات مقبولة.
  const unresolved = wide && r.ops.some((o) => !parsed.ops.some((p) => p.path === o.path)) ? [] : wideFailed || !wide ? parsed.unresolved : [];
  const note = wide?.note?.trim() || (wideFailed && parsed.unresolved.length ? "تعذر فهم هذا الطلب الآن. جرّبوا صياغة أبسط، مثل: اجعلوا الخلفية بيضاء، أو عدّلوا من خيارات الشكل يدوياً." : undefined);
  return {
    ...r,
    summary: summarizeEdit(r, { unresolved, note }),
    unresolved,
    before: previewTokens(bp),
    after: previewTokens(r.blueprint),
  };
}
