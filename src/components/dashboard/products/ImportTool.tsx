"use client";

// ImportTool — صفحة «استيراد منتجات» في اللوحة: أداة الإعداد نفسها (صور مجمّعة/نص/ملف ← مراجعة ← اعتماد) للإضافات اللاحقة.
import { useState } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { ProductImporter, type CommitStats } from "@/components/onboarding/ProductImporter";
import { btnGhost, btnPrimary } from "@/components/onboarding/ui";
import { fmtNum } from "@/lib/format";
import type { Niche } from "@/lib/niche-attributes";

export function ImportTool({ existingCategories, niche, draftKey }: { existingCategories: string[]; niche: Niche; draftKey: string }) {
  const [done, setDone] = useState<CommitStats | null>(null);
  const [round, setRound] = useState(0);

  if (done) {
    return (
      <div className="dash-card mx-auto max-w-lg space-y-4 p-8 text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-ok/15 text-ok">
          <CheckCircle2 className="size-7" aria-hidden="true" />
        </span>
        <h2 className="text-[18px] font-black text-ink">تم اعتماد المنتجات</h2>
        <p className="text-[13px] leading-7 text-ink-2">
          أُضيف {fmtNum(done.active)} منتج إلى المتجر{done.drafts ? `، و${fmtNum(done.drafts)} مسودة بلا سعر` : ""}
          {done.newCategories ? `، مع ${fmtNum(done.newCategories)} ${done.newCategories === 1 ? "قسم جديد" : "أقسام جديدة"}` : ""}.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Link href={done.drafts ? "/dashboard/products?status=draft" : "/dashboard/products"} className={btnPrimary}>
            {done.drafts ? "إكمال المسودات" : "عرض المنتجات"}
          </Link>
          <button
            type="button"
            className={btnGhost}
            onClick={() => {
              setDone(null);
              setRound((r) => r + 1);
            }}
          >
            استيراد المزيد
          </button>
        </div>
      </div>
    );
  }
  return <ProductImporter key={round} existingCategories={existingCategories} niche={niche} draftKey={draftKey} onCommitted={setDone} />;
}
