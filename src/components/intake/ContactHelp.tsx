import { Mail, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export const SUPPORT_EMAIL = "support@colapia.com";

/**
 * «كلّمنا» بقناة فعلية دائماً: واتساب الوكالة إن كان مضبوطاً، وإلا البريد. تُستخدم أينما قلنا للعميل «كلّمنا»
 * (الاستقبال المغلق، رسائل الحدود، الأعطال، صفحة المتابعة) حتى لا يصل إلى طريق مسدود.
 */
export function ContactHelp({ whatsappUrl, className }: { whatsappUrl: string | null; className?: string }) {
  const base = "inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-[14px] font-black";
  return whatsappUrl ? (
    <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className={cn(base, "bg-[#25D366] text-[#062b15]", className)}>
      <MessageCircle className="size-4" aria-hidden="true" /> كلّمنا على واتساب
    </a>
  ) : (
    <a href={`mailto:${SUPPORT_EMAIL}`} className={cn(base, "border border-edge/15 text-ink hover:border-edge/30", className)}>
      <Mail className="size-4" aria-hidden="true" /> راسلنا: <span dir="ltr">{SUPPORT_EMAIL}</span>
    </a>
  );
}
