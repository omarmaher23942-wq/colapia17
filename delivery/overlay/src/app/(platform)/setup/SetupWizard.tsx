"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, CircleDashed, Database, Loader2, RefreshCw, UserRound } from "lucide-react";
import { authButton, authCard, authGhost, authInput } from "@/components/owner/AuthShell";
import { RecoveryCodeCard } from "@/components/owner/RecoveryCodeCard";
import type { SetupStatus } from "@/server/setup/status";
import { createOwnerAction, migrateAction, type CreateState } from "./actions";

const LEVEL_UI = {
  ok: { icon: CheckCircle2, cls: "text-emerald-300", label: "جاهز" },
  missing: { icon: AlertTriangle, cls: "text-amber-300", label: "مطلوب" },
  optional: { icon: CircleDashed, cls: "text-[#c3cdf0]/70", label: "اختياري" },
} as const;

export function SetupWizard({ status, ownerEmail, needsCode }: { status: SetupStatus; ownerEmail: string; needsCode: boolean }) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const [migrating, setMigrating] = useState(false);
  const [migrateError, setMigrateError] = useState<string | null>(null);
  const [created, createAction, creating] = useActionState<CreateState, FormData>(createOwnerAction, { error: null });

  const migrated = Boolean(status.migrations && status.migrations.total > 0 && status.migrations.pending === 0);

  if (created.recoveryCode) {
    return (
      <div className={`${authCard} space-y-5`}>
        <div className="text-center">
          <CheckCircle2 className="mx-auto size-10 text-emerald-300" aria-hidden="true" />
          <h1 className="mt-3 text-xl font-black">تم إنشاء الحساب</h1>
          <p className="mt-2 text-[14px] leading-7 text-[#c3cdf0]/80">أنتم الآن داخل اللوحة. الخطوة التالية إعداد المتجر نفسه: الاسم والمنتجات والشكل والدفع والشحن.</p>
        </div>
        <RecoveryCodeCard code={created.recoveryCode} />
        <Link href="/onboarding" className={authButton}>
          متابعة إلى إعداد المتجر
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className={authCard}>
        <h1 className="text-xl font-black">إعداد المشروع</h1>
        <p className="mt-2 text-[14px] leading-7 text-[#c3cdf0]/80">ثلاث خطوات قصيرة: التأكد من الربط، تجهيز قاعدة البيانات، ثم إنشاء حساب صاحب المتجر.</p>
      </div>

      <section className={authCard} aria-labelledby="s1">
        <div className="flex items-center justify-between gap-3">
          <h2 id="s1" className="text-[16px] font-black">
            1. الربط
          </h2>
          <button
            type="button"
            onClick={() => startRefresh(() => router.refresh())}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 px-3.5 text-[13px] font-bold hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8fa8ff]/60"
          >
            <RefreshCw className={`size-4 ${refreshing ? "animate-spin" : ""}`} aria-hidden="true" />
            إعادة الفحص
          </button>
        </div>
        <ul className="mt-4 space-y-3">
          {status.checks.map((c) => {
            const ui = LEVEL_UI[c.level];
            return (
              <li key={c.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3.5">
                <div className="flex items-start gap-3">
                  <ui.icon className={`mt-0.5 size-5 shrink-0 ${ui.cls}`} aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-black">
                      {c.label} <span className={`ms-1 text-[11.5px] font-bold ${ui.cls}`}>{ui.label}</span>
                    </p>
                    <p className="mt-0.5 text-[13px] leading-6 text-[#c3cdf0]/80">{c.detail}</p>
                    {c.level !== "ok" && c.fix ? <p className="mt-1 text-[12.5px] leading-6 text-[#c3cdf0]/65">{c.fix}</p> : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className={authCard} aria-labelledby="s2">
        <h2 id="s2" className="flex items-center gap-2 text-[16px] font-black">
          <Database className="size-5" aria-hidden="true" />
          2. تجهيز قاعدة البيانات
        </h2>
        <p className="mt-2 text-[13.5px] leading-7 text-[#c3cdf0]/80">
          {migrated ? "القاعدة جاهزة: كل الجداول منشأة." : status.dbReachable ? "ينشئ الجداول اللازمة للمتجر. آمن للتكرار." : "اربطوا القاعدة أولاً (الخطوة 1) ثم أعيدوا الفحص."}
        </p>
        {migrateError ? (
          <p role="alert" className="mt-3 rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-[13px] font-bold text-rose-200">
            {migrateError}
          </p>
        ) : null}
        <button
          type="button"
          disabled={!status.dbReachable || migrating || migrated}
          onClick={async () => {
            setMigrating(true);
            setMigrateError(null);
            const r = await migrateAction().catch(() => ({ ok: false as const, error: "انقطع الاتصال. أعيدوا المحاولة." }));
            setMigrating(false);
            if (!r.ok) return setMigrateError(r.error);
            router.refresh();
          }}
          className={`${authButton} mt-4`}
        >
          {migrating ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
          {migrated ? "القاعدة جاهزة" : "تجهيز قاعدة البيانات"}
        </button>
      </section>

      <section className={authCard} aria-labelledby="s3">
        <h2 id="s3" className="flex items-center gap-2 text-[16px] font-black">
          <UserRound className="size-5" aria-hidden="true" />
          3. حساب صاحب المتجر
        </h2>
        <form action={createAction} className="mt-4 space-y-4" noValidate>
          <div className="space-y-1.5">
            <label htmlFor="owner-email" className="block text-[13px] font-bold text-[#c3cdf0]">
              البريد (للدخول إلى اللوحة)
            </label>
            <input id="owner-email" value={ownerEmail} readOnly dir="ltr" className={`${authInput} cursor-default opacity-80`} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="password" className="block text-[13px] font-bold text-[#c3cdf0]">
                كلمة المرور <span className="font-normal text-[#c3cdf0]/60">(10 أحرف على الأقل)</span>
              </label>
              <input id="password" name="password" type="password" autoComplete="new-password" dir="ltr" minLength={10} required disabled={!migrated} className={authInput} />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="confirm" className="block text-[13px] font-bold text-[#c3cdf0]">
                تأكيد كلمة المرور
              </label>
              <input id="confirm" name="confirm" type="password" autoComplete="new-password" dir="ltr" minLength={10} required disabled={!migrated} className={authInput} />
            </div>
          </div>
          {needsCode ? (
            <div className="space-y-1.5">
              <label htmlFor="setupCode" className="block text-[13px] font-bold text-[#c3cdf0]">
                رمز الإعداد (SETUP_CODE)
              </label>
              <input id="setupCode" name="setupCode" dir="ltr" autoComplete="off" required disabled={!migrated} className={authInput} />
            </div>
          ) : null}
          {created.error ? (
            <p role="alert" className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-[13px] font-bold text-rose-200">
              {created.error}
            </p>
          ) : null}
          <button type="submit" disabled={!migrated || creating} className={authButton}>
            {creating ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            إنشاء الحساب
          </button>
          <Link href="/login" className={authGhost}>
            لدي حساب بالفعل
          </Link>
        </form>
      </section>
    </div>
  );
}
