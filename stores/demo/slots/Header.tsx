// الهيدر: شريط متحرك بإفصاح العرض الدائم (غير قابل للإغلاق) وحقائق المتجر الصحيحة، ثم هيدر النواة.
import { formatEgp, type SlotProps } from "@/stores-kit";

export default function DemoHeader({ kit, core }: SlotProps) {
  const free = kit.bp.shipping.freeOverPiasters;
  const lines = [
    "متجر عرض من Colapia: الطلبات هنا تجريبية ولا تُشحن",
    ...(free && free > 0 ? [`شحن مجاني للطلبات بقيمة ${formatEgp(free)} فأكثر`] : []),
    ...(kit.facts.some((f) => f.key === "cod") ? ["الدفع عند الاستلام"] : []),
    ...(kit.facts.some((f) => f.key === "inspection") ? ["معاينة الشحنة قبل الدفع"] : []),
    "جرّبوا كود DEMO10 عند إتمام الطلب",
  ];
  const group = (hidden: boolean) => (
    <div className="dm-ribbon-group" aria-hidden={hidden || undefined}>
      {lines.map((t) => (
        <span key={t}>{t}</span>
      ))}
    </div>
  );
  return (
    <>
      <div className="dm-ribbon" role="note" data-demo-slot="header">
        <div className="dm-ribbon-track">
          {group(false)}
          {group(true)}
        </div>
      </div>
      {core}
    </>
  );
}
