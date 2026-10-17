"use client";

// OrderAlertsCard — تفعيل إشعارات المتصفح للطلبات الجديدة، مع شرح صريح لحدودها وزر تجربة.
import { useEffect, useState } from "react";
import { BellRing } from "lucide-react";
import { toast } from "sonner";
import { disableNotify, enableNotify, notifyState, showOrderNotification, type NotifyState } from "@/lib/order-notify";
import { Section } from "../product/parts";

const TEXT: Record<NotifyState, string> = {
  unsupported: "هذا المتصفح لا يدعم الإشعارات. ستصلكم نغمة الطلب وتنبيه داخل اللوحة.",
  denied: "الإشعارات محظورة لهذا الموقع في المتصفح. فعّلوها من إعدادات الموقع (رمز القفل بجانب العنوان) ثم أعيدوا فتح الصفحة.",
  default: "فعّلوا الإشعارات لتصلكم رسالة عند وصول طلب جديد وأنتم في تبويب آخر.",
  on: "الإشعارات مفعّلة على هذا الجهاز.",
  off: "الإشعارات متوقفة على هذا الجهاز. يمكنكم تفعيلها متى شئتم.",
};

export function OrderAlertsCard() {
  const [state, setState] = useState<NotifyState>("unsupported");
  useEffect(() => setState(notifyState()), []);
  return (
    <Section title="إشعارات الطلبات" hint="تنبيه المتصفح عند وصول طلب جديد">
      <p className="text-[12.5px] leading-6 text-ink-2">{TEXT[state]}</p>
      <ul className="mt-2 list-disc space-y-1 ps-5 text-[12px] leading-5 text-ink-3">
        <li>تصل الإشعارات واللوحة مفتوحة في أي تبويب، ولا تصل بعد إغلاق المتصفح أو التبويب.</li>
        <li>الإعداد لكل جهاز ومتصفح على حدة، ونغمة الطلب تُضبط من زر الصوت أعلى اللوحة.</li>
      </ul>
      <div className="mt-3 flex flex-wrap gap-2">
        {state === "default" || state === "off" ? (
          <button type="button" onClick={async () => setState(await enableNotify())} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-gradient-to-b from-nova to-nova-deep px-4 text-[13px] font-black text-white shadow-sm">
            <BellRing className="size-4" aria-hidden="true" />
            تفعيل الإشعارات
          </button>
        ) : null}
        {state === "on" ? (
          <>
            <button
              type="button"
              onClick={() => {
                showOrderNotification("طلب جديد (تجربة)", "هكذا يصلكم إشعار الطلب الجديد.", { force: true });
                toast.message("أُرسل إشعار تجريبي");
              }}
              className="min-h-11 rounded-xl border border-edge/10 px-4 text-[13px] font-bold text-ink hover:bg-edge/[0.06]"
            >
              إشعار تجريبي
            </button>
            <button type="button" onClick={() => setState(disableNotify())} className="min-h-11 rounded-xl px-4 text-[13px] font-bold text-ink-2 hover:bg-edge/[0.06]">
              إيقاف
            </button>
          </>
        ) : null}
      </div>
    </Section>
  );
}
