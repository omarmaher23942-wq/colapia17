// الهيدر: هيدر النواة كما هو، وفوقه شريط يعرّف بأن كل القطع مصنوعة يدوياً.
import type { SlotProps } from "@/stores-kit";

export default function AtelierHeader({ core }: SlotProps) {
  return (
    <>
      <p className="atelier-ribbon px-4 py-2 text-center text-[13px] font-bold" data-atelier-slot="header">
        كل قطعة مصنوعة يدوياً في الفيوم، فلا تتطابق قطعتان تماماً
      </p>
      {core}
    </>
  );
}
