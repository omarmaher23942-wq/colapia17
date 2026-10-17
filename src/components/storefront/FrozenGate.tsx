import Link from "next/link";
import { Lock, PauseCircle, Wrench } from "lucide-react";

const SW = 1.75;

/**
 * يظهر للزوار بدل المتجر حين لا يعرض محتواه، بلا كشف أي تفاصيل داخلية:
 *  - قيد التجهيز (لم يُسلَّم بعد)، أو محجوز لصاحبه (انتهت تجربته ولم يدفع).
 *  - «paused»: متجر مدفوع انتهت استضافته وفترة السماح (lib/hosting.ts). لا حذف: يعود فور التجديد.
 */
export function FrozenGate({ status, name, activateHref = "/admin/activate" }: { status: string; name?: string; activateHref?: string }) {
  if (status === "paused") {
    return (
      <Gate icon={PauseCircle} title={name ? `${name} متوقف مؤقتاً` : "المتجر متوقف مؤقتاً"}>
        نعود قريباً بإذن الله. شكراً لزيارتك.
      </Gate>
    );
  }
  if (status === "setup") {
    // متجر لم يكتمل إعداده: صفحة محايدة بلا اسم المتجر، ورابط صغير لصاحبه.
    return (
      <Gate icon={Wrench} title="هذا المتجر قيد الإعداد">
        نفتح قريباً بإذن الله. شكراً لزيارتك.
        <span className="mt-8 block text-[13px]">
          <a href="https://colapia.com/dashboard/setup" className="text-slate-400 underline underline-offset-4 hover:text-slate-600">
            صاحب المتجر؟ أكمل الإعداد من لوحتك
          </a>
        </span>
      </Gate>
    );
  }
  if (status === "unavailable") return <Gate icon={Lock} title="المتجر غير متاح حالياً">شكراً لزيارتك.</Gate>;
  const frozen = status === "frozen";
  // الزائر زبون لا صاحب المتجر: نص محايد، ورابط صغير لصاحبه فقط (لا زر «فعّل» يربك الزبون).
  return (
    <Gate icon={frozen ? Lock : Wrench} title={frozen ? (name ? `${name} غير متاح حالياً` : "المتجر غير متاح حالياً") : name ? `${name} قيد التجهيز` : "المتجر قيد التجهيز"}>
      {frozen ? "نعود قريباً بإذن الله. شكراً لزيارتك." : "نجهّز المتجر الآن ونفتح قريباً جداً. شكراً لزيارتك."}
      {frozen ? (
        <span className="mt-8 block text-[13px]">
          <Link href={activateHref} className="text-slate-400 underline underline-offset-4 hover:text-slate-600">
            صاحب المتجر؟ أعد تشغيله من لوحتك
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
        <h1 className="mt-5 text-2xl font-bold text-slate-900">{title}</h1>
        <p className="mt-2 text-slate-500">{children}</p>
      </div>
    </div>
  );
}
