// الفوتر: فوتر النواة وتحته شريط يوضح أن المتجر للعرض ويعرّف بـ Colapia.
import type { SlotProps } from "@/stores-kit";

export default function DemoFooter({ core }: SlotProps) {
  return (
    <>
      {core}
      <div className="dm-band" data-demo-slot="footer">
        <div className="container-x dm-band-in">
          <p className="text-sm">هذا متجر عرض من Colapia: القطع والتقييمات للعرض فقط، وبعض الصور رسوم توضيحية.</p>
          <a className="dm-link text-sm" href="https://colapia.com">تعرّفوا على Colapia</a>
        </div>
      </div>
    </>
  );
}
