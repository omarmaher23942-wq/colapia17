import Link from "next/link";
import { Lock, PauseCircle, Wrench } from "lucide-react";

const SW = 1.75;

/**
 * يظهر للزوار بدل المتجر حين لا يعرض محتواه، بلا كشف أي تفاصيل داخلية:
 *  - قيد التجهيز (لم يُسلَّم بعد)، أو محجوز لصاحبه (انتهت تجربته ولم يدفع).
 *  - «paused»: متجر مدفوع انتهت استضافته وفترة السماح (lib/hosting.ts). لا حذف: يعود فور التجديد.
 *  - «offline»: أوقف صاحبه نسخته هنا بنفسه ولا موقع خاص نحوّل إليه.
 */
export function FrozenGate({ status, name, activateHref = "/admin/activate" }: { status: string; name?: string; activateHref?: string }) {
  if (status === "paused" || status === "offline") {
    return (
      <Gate icon={PauseCircle} title={name ? `${name} متوقف مؤقتاً` : "المتجر متوقف مؤقتاً"}>
        نعود قريباً بإذن الله. شكراً لزيارتك.
      </Gate>
    );
  }
  const frozen = status === "frozen";
  return (
    <Gate icon={frozen ? Lock : Wrench} title={frozen ? "المتجر محجوز لصاحبه" : "المتجر قيد التجهيز"}>
      {frozen ? "لو أنت صاحب المتجر، أكمل التفعيل من لوحة التحكم ليعود المتجر للعمل فورًا." : "هنكون جاهزين قريبًا جدًا."}
      {frozen ? (
        <span className="mt-6 block">
          <Link href={activateHref} className="btn-brand">
            تفعيل المتجر
          </Link>
        </span>
      ) : null}
    </Gate>
  );
}

function Gate({ icon: Icon, title, children }: { icon: typeof Lock; title: string; children: React.ReactNode }) {
  return (
    <div className="container-x grid min-h-[60vh] place-items-center py-20 text-center">
      <div className="max-w-md">
        <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20" aria-hidden="true">
          <Icon strokeWidth={SW} className="size-7" />
        </span>
        <h1 className="mt-5 text-2xl">{title}</h1>
        <p className="mt-2 text-muted-foreground">{children}</p>
      </div>
    </div>
  );
}
