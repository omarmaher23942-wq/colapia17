"use client";

// PasswordField — خانة كلمة مرور بإظهار/إخفاء، وقياس قوة اختياري، وقواعد بالعربية تظهر وتتحقق لحظياً (نفس قواعد الخادم).
import { useId, useState } from "react";
import { Check, Eye, EyeOff } from "lucide-react";
import { PASSWORD_MIN, passwordIssues, passwordStrength } from "@/lib/password-rules";
import { AUTH_INPUT } from "./AuthShell";

const BARS = ["bg-red-400", "bg-red-400", "bg-amber-400", "bg-emerald-400", "bg-emerald-300"];

export function PasswordField({
  label,
  value,
  onChange,
  autoComplete,
  email,
  meter = false,
  describedBy,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: "current-password" | "new-password";
  email?: string | null;
  /** شريط القوة وقواعد الاختيار (لكلمة جديدة فقط). */
  meter?: boolean;
  describedBy?: string;
}) {
  const [show, setShow] = useState(false);
  const id = useId();
  const st = passwordStrength(value);
  const issues = passwordIssues(value, { email });
  const rules = [
    { ok: value.length >= PASSWORD_MIN, text: `${PASSWORD_MIN} أحرف على الأقل` },
    { ok: /[A-Za-z؀-ۿ]/.test(value) && /[0-9٠-٩]/.test(value), text: "حرف ورقم على الأقل" },
    { ok: value.length > 0 && !issues.some((i) => i.startsWith("لا ")), text: "ليست شائعة ولا تتضمن بريدكم" },
  ];
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-bold text-[#c3cdf0]">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          dir="ltr"
          spellCheck={false}
          aria-describedby={describedBy}
          className={`${AUTH_INPUT} pe-12 text-start`}
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          aria-label={show ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
          aria-pressed={show}
          className="absolute inset-y-0 end-1 grid w-11 place-items-center rounded-xl text-[#c3cdf0]/70 hover:text-[#eaf0ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8fa8ff]/60"
        >
          {show ? <EyeOff className="size-5" aria-hidden="true" /> : <Eye className="size-5" aria-hidden="true" />}
        </button>
      </div>
      {meter ? (
        <div className="mt-2.5">
          <div className="flex items-center gap-2" aria-live="polite">
            <div className="grid flex-1 grid-cols-4 gap-1" aria-hidden="true">
              {[1, 2, 3, 4].map((n) => (
                <span key={n} className={`h-1.5 rounded-full ${st.score >= n ? BARS[st.score] : "bg-white/10"}`} />
              ))}
            </div>
            <span className="w-14 text-end text-[12px] font-bold text-[#c3cdf0]/80">{st.label}</span>
          </div>
          <ul className="mt-2 space-y-1 text-[12.5px]">
            {rules.map((r) => (
              <li key={r.text} className={`flex items-center gap-1.5 ${r.ok ? "text-emerald-300" : "text-[#c3cdf0]/60"}`}>
                <Check className={`size-3.5 ${r.ok ? "" : "opacity-30"}`} aria-hidden="true" />
                {r.text}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
