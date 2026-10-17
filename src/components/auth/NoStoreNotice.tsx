// NoStoreNotice — شاشة لطيفة حين لا يوجد متجر مرتبط بالحساب الذي دخل به المستخدم: تعرض البريد المتوقع مخفياً (إن عُرف من رابط
// الإعداد)، وزر «تبديل الحساب» لاختيار حساب Google آخر، وإرشاداً للتواصل مع المساعد في المحادثة. لا رابط لاستمارة (حُذفت).
import { UserRoundX } from "lucide-react";

export function NoStoreNotice({
  maskedEmail,
  switchAction,
  className = "",
}: {
  maskedEmail?: string | null;
  /** إجراء خادم يبدّل الحساب (يخرج من الجلسة الحالية ثم يفتح اختيار حساب Google). */
  switchAction: () => Promise<void>;
  className?: string;
}) {
  return (
    <div role="alert" className={`rounded-2xl border border-amber-300/30 bg-amber-300/10 p-5 text-center ${className}`}>
      <span className="mx-auto mb-3 grid size-11 place-items-center rounded-2xl bg-amber-300/15 text-amber-200">
        <UserRoundX className="size-5" aria-hidden="true" />
      </span>
      <h2 className="text-[17px] font-black text-[#eaf0ff]">لا يوجد متجر مرتبط بهذا البريد</h2>
      <p className="mx-auto mt-2 max-w-sm text-[13.5px] leading-7 text-[#c3cdf0]/85">
        {maskedEmail ? (
          <>
            المتجر مسجّل على البريد <bdi dir="ltr" className="font-mono font-bold text-[#eaf0ff]">{maskedEmail}</bdi>. ادخلوا بحساب Google المرتبط به.
          </>
        ) : (
          "ادخلوا بحساب Google المرتبط بالبريد الذي أعطيتموه للمساعد في المحادثة."
        )}
      </p>
      <form action={switchAction} className="mt-4">
        <button
          type="submit"
          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-white px-5 text-[14px] font-black text-[#0b0f1e] transition hover:bg-[#eaf0ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8fa8ff]"
        >
          تبديل الحساب
        </button>
      </form>
      <p className="mt-4 text-[12.5px] leading-6 text-[#c3cdf0]/60">
        لم تتواصلوا معنا بعد، أو كتبتم بريداً مختلفاً؟ راسلونا على إنستجرام وسيجهّز لكم المساعد متجركم أو يصحّح البريد.
      </p>
    </div>
  );
}
