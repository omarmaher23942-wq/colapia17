// Steps — «كيف تطلب»: خطوات الشراء الحقيقية في المتجر (من حقائق سياسته، ومفلترة بها في registry).
// على الموبايل قائمة رأسية بخط يصل الخطوات، وعلى الكمبيوتر أعمدة بعدد الخطوات بالضبط.
import { SectionShell, SectionHeading } from "@/components/storefront/SectionShell";
import { Icon } from "@/components/storefront/Icon";
import { cn } from "@/lib/utils";
import type { StepsSection as Sec } from "@/blueprint/schema";

const COLS: Record<number, string> = { 2: "md:grid-cols-2", 3: "md:grid-cols-3", 4: "md:grid-cols-4" };

export function Steps({ s }: { s: Sec }) {
  const items = (s.items ?? []).slice(0, 4);
  if (items.length < 2) return null;
  return (
    <SectionShell s={s}>
      <SectionHeading eyebrow={s.eyebrow} title={s.title} subtitle={s.subtitle} sectionId={s.id} />
      <ol className={cn("relative grid gap-3 md:gap-4", COLS[items.length])} aria-label={s.title || "خطوات الطلب"}>
        {items.map((it, i) => (
          <li key={`${it.title}-${i}`} className="s-card relative flex gap-4 p-5 md:flex-col md:gap-3 md:p-6">
            <span className="relative flex shrink-0 flex-col items-center md:flex-row md:items-center md:gap-3">
              <span className="s-icon">
                <Icon name={it.icon} className="size-5" />
              </span>
              <span
                aria-hidden="true"
                className="absolute -top-2 -end-2 grid size-6 place-items-center rounded-full text-[11px] font-black tabular-nums md:static md:size-7 md:text-[12px]"
                style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
              >
                {i + 1}
              </span>
            </span>
            <span className="min-w-0">
              <span className="sr-only">الخطوة {i + 1}: </span>
              <span className="block text-[15px] font-black leading-snug">{it.title}</span>
              <span className="mt-1 block text-[13px] leading-6 opacity-75">{it.text}</span>
            </span>
          </li>
        ))}
      </ol>
    </SectionShell>
  );
}
