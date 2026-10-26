"use client";

// AccountTab (مشروعك الخاص) — حسابك: الاسم والموبايل، والصورة الشخصية، وتغيير كلمة المرور، وإشعارات الطلبات، والخروج.
import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, KeyRound, Loader2, LogOut, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { isHostedImage } from "@/lib/media-hosts";
import { updateMerchantProfileAction, merchantLogoutAction, type ActionResult } from "@/server/actions/auth";
import { changePasswordAction, setAvatarAction } from "@/server/actions/account";
import { useImageUpload } from "@/editor/useImageUpload";
import { Field, Section, inputCls } from "../product/parts";
import type { StoreInfo } from "./SettingsPage";
import { OrderAlertsCard } from "./OrderAlertsCard";

export type AccountInfo = { displayName: string; email: string | null; phone: string | null; avatarUrl: string | null };

export function AccountTab({ account }: { account: AccountInfo; store?: StoreInfo | null }) {
  return (
    <div className="space-y-5">
      <ProfileCard account={account} />
      <PasswordCard />
      <OrderAlertsCard />
      <Section title="الخروج" hint="ينهي جلستك على هذا الجهاز">
        <form action={merchantLogoutAction}>
          <button type="submit" className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-edge/10 px-3.5 text-[12.5px] font-bold text-ink-2 hover:bg-edge/[0.05] hover:text-ink">
            <LogOut className="size-4" aria-hidden="true" />
            تسجيل الخروج
          </button>
        </form>
      </Section>
    </div>
  );
}

function ProfileCard({ account }: { account: AccountInfo }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(async (_p, fd) => updateMerchantProfileAction(fd), null);
  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast.success("حُفظت بيانات الحساب");
      router.refresh();
    } else toast.error(state.error);
  }, [state, router]);
  const err = (k: string) => (state && !state.ok ? state.fieldErrors?.[k] : undefined);

  return (
    <Section title="البيانات" hint="تظهر في اللوحة">
      <Avatar account={account} />
      <form action={action} className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="الاسم" error={err("displayName")}>
            {(a) => <input {...a} name="displayName" defaultValue={account.displayName} required minLength={2} maxLength={80} dir="auto" className={inputCls} />}
          </Field>
        </div>
        <Field label="الموبايل" optional hint="للتواصل بخصوص الحساب" error={err("phone")}>
          {(a) => <input {...a} name="phone" type="tel" inputMode="tel" dir="ltr" defaultValue={account.phone ?? ""} placeholder="01xxxxxxxxx" className={cn(inputCls, "font-mono")} />}
        </Field>
        <Field label="البريد" hint="بريد الدخول إلى اللوحة">
          {(a) => <input {...a} value={account.email ?? ""} readOnly dir="ltr" className={cn(inputCls, "cursor-default font-mono opacity-70")} />}
        </Field>
        <div className="flex justify-end sm:col-span-2">
          <button type="submit" disabled={pending} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-gradient-to-b from-nova to-nova-deep px-4 text-[12.5px] font-black text-white shadow-md disabled:opacity-60">
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Save className="size-4" aria-hidden="true" />}
            حفظ البيانات
          </button>
        </div>
      </form>
    </Section>
  );
}

function Avatar({ account }: { account: AccountInfo }) {
  const router = useRouter();
  const { upload, busy } = useImageUpload();
  const [url, setUrl] = useState(account.avatarUrl);
  const [working, setWorking] = useState(false);
  const initial = account.displayName.trim().charAt(0) || "؟";

  const apply = async (next: string | null) => {
    setWorking(true);
    const r = await setAvatarAction(next).catch(() => ({ ok: false as const, error: "انقطع الاتصال" }));
    setWorking(false);
    if (!r.ok) return void toast.error(r.error);
    setUrl(next);
    toast.success(next ? "تغيّرت الصورة" : "حُذفت الصورة");
    router.refresh();
  };

  return (
    <div className="flex flex-wrap items-center gap-4">
      {url && isHostedImage(url) ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="size-16 rounded-full border border-edge/15 object-cover" referrerPolicy="no-referrer" />
      ) : (
        <span className="grid size-16 place-items-center rounded-full bg-gradient-to-br from-nova to-aurora text-xl font-black text-white">{initial}</span>
      )}
      <div className="flex flex-wrap gap-2">
        <label className={cn("inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-xl border border-edge/10 px-3 text-[12px] font-bold text-ink-2 hover:bg-edge/[0.05] hover:text-ink", (busy || working) && "pointer-events-none opacity-60")}>
          {busy || working ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <ImagePlus className="size-4" aria-hidden="true" />}
          {url ? "تغيير الصورة" : "رفع صورة"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={async (e) => {
              const files = Array.from(e.target.files ?? []);
              e.target.value = "";
              const [u] = await upload(files, 1);
              if (u) await apply(u);
            }}
          />
        </label>
        {url ? (
          <button type="button" disabled={working} onClick={() => apply(null)} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-bad/20 px-3 text-[12px] font-bold text-bad hover:bg-bad/10">
            <Trash2 className="size-4" aria-hidden="true" />
            حذف الصورة
          </button>
        ) : null}
      </div>
    </div>
  );
}

function PasswordCard() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Section title="كلمة المرور" hint="تغييرها ينهي جلساتك الأخرى">
      <form
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const r = await changePasswordAction({ current, next }).catch(() => ({ ok: false as const, error: "انقطع الاتصال" }));
          setBusy(false);
          if (!r.ok) return void toast.error(r.error);
          setCurrent("");
          setNext("");
          toast.success("تغيّرت كلمة المرور");
        }}
      >
        <Field label="كلمة المرور الحالية">
          {(a) => <input {...a} type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required dir="ltr" className={inputCls} />}
        </Field>
        <Field label="كلمة المرور الجديدة" hint="10 أحرف على الأقل">
          {(a) => <input {...a} type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} required minLength={10} dir="ltr" className={inputCls} />}
        </Field>
        <div className="flex justify-end sm:col-span-2">
          <button type="submit" disabled={busy} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-edge/10 px-4 text-[12.5px] font-black text-ink-2 hover:bg-edge/[0.05] disabled:opacity-60">
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <KeyRound className="size-4" aria-hidden="true" />}
            تغيير كلمة المرور
          </button>
        </div>
      </form>
    </Section>
  );
}
