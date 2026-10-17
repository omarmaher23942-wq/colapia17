"use client";

// StepProducts — خطوة المنتجات: ملخص ما اعتُمد حتى الآن، ثم أداة الاستيراد نفسها (تصلح للإضافة المتكررة).
import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { fmtNum } from "@/lib/format";
import type { SetupData } from "@/lib/onboarding";
import { ProductImporter, type CommitStats } from "./ProductImporter";
import { btnGhost, btnPrimary, Notice } from "./ui";

export function StepProducts({
  data,
  dmImages,
  onCommitted,
  onNext,
  onBack,
}: {
  data: SetupData["products"];
  dmImages: string[];
  onCommitted: (s: CommitStats) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const [last, setLast] = useState<CommitStats | null>(null);
  return (
    <div className="space-y-6">
      {data.total > 0 ? (
        <Notice tone="ok">
          <p className="font-black">{data.active > 0 ? `لديكم ${fmtNum(data.active)} منتج ظاهر في المتجر` : "اعتمدتم منتجات، لكن بلا أسعار بعد"}.</p>
          {data.drafts > 0 ? <p>{fmtNum(data.drafts)} منها مسودة بلا سعر ولن تظهر حتى تحددوا سعرها من «المنتجات» بلوحة التحكم.</p> : null}
          {last ? (
            <p className="mt-1 flex items-center gap-1.5">
              <CheckCircle2 className="size-4" aria-hidden="true" />
              آخر اعتماد: {fmtNum(last.active + last.drafts)} منتج{last.newCategories ? ` و${fmtNum(last.newCategories)} ${last.newCategories === 1 ? "قسم جديد" : "أقسام جديدة"}` : ""}.
            </p>
          ) : null}
        </Notice>
      ) : null}

      <ProductImporter
        existingCategories={data.categories}
        dmImages={dmImages}
        onCommitted={(s) => {
          setLast(s);
          onCommitted(s);
        }}
      />

      <div className="flex flex-wrap items-center gap-2 border-t border-edge/10 pt-5">
        <button type="button" className={btnPrimary} onClick={onNext}>
          {data.total > 0 ? "متابعة" : "متابعة وإضافة المنتجات لاحقاً"}
        </button>
        <button type="button" className={btnGhost} onClick={onBack}>
          رجوع
        </button>
        {data.active === 0 ? <p className="text-[12px] text-ink-3">تحتاجون منتجاً واحداً على الأقل بسعر قبل تفعيل المتجر.</p> : null}
      </div>
    </div>
  );
}
