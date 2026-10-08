"use client";

// زر Google موحّد يستخدم Server Action مباشرة داخل <form>.
// - يعمل بدون JavaScript (Progressive Enhancement — E4).
// - يعرض حالة تحميل عبر useFormStatus (بدون أي flicker — E1).
// - يستقبل redirectTo لتمريره للـ server action (E2).
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { GoogleIcon } from "./shared";
import { initiateMerchantGoogleAuthAction } from "@/app/(platform)/login/actions";

type Props = {
  redirectTo?: string;
  label?: string;
  className?: string;
};

function SubmitButton({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={className}
    >
      {pending ? (
        <Loader2 className="size-5 animate-spin" aria-hidden="true" />
      ) : (
        <GoogleIcon className="size-5" aria-hidden="true" />
      )}
      <span>{pending ? "جارِ التحويل..." : label}</span>
    </button>
  );
}

export function GoogleAuthCta({
  redirectTo = "/dashboard",
  label = "ابدأ بحساب Google",
  className,
}: Props) {
  const boundAction = initiateMerchantGoogleAuthAction.bind(null, redirectTo);

  return (
    // "contents" يجعل الـ form لا يشغل مساحة في التخطيط، فيبقى الزر عنصراً
    // مباشراً بصرياً للـ flex/grid الحاوي دون كسر التصميم.
    <form action={boundAction} className="contents">
      <SubmitButton label={label} className={className} />
    </form>
  );
}