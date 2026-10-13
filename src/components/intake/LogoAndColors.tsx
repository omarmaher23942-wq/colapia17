"use client";

// LogoAndColors.tsx — الشعار (اختياري، أو «سيبها للفريق» فيصمم شعاراً نصياً) والألوان (لوحة جاهزة، من الشعار،
// لون معين، أو «سيبها للفريق»).
import { useRef, useState } from "react";
import Image from "next/image";
import { ImagePlus, Loader2, Palette, Trash2 } from "lucide-react";
import { INTAKE_PALETTES } from "@/intake/palettes";
import type { IntakeData } from "@/intake/schema";
import { cn } from "@/lib/utils";
import { ErrorText, TeamToggle } from "./ui";
import { prepareImage, uploadErrorMessage, uploadIntakeImage } from "./upload";

type Base = { data: IntakeData; update: (fn: (d: IntakeData) => IntakeData) => void };

export function LogoPicker({
  data,
  update,
  urls,
  setUrl,
  ensureToken,
  onBusy,
}: Base & { urls: Record<string, string>; setUrl: (k: string, u: string) => void; ensureToken: () => Promise<string | null>; onBusy: (delta: 1 | -1) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const src = data.logo.key ? urls[data.logo.key] : undefined;

  const pick = async (f: File | undefined) => {
    if (!f) return;
    setError(null);
    const token = await ensureToken();
    if (!token) return void setError("ما قدرناش نجهز الرفع. تأكد من النت وجرّب تاني.");
    setBusy(true);
    onBusy(1);
    try {
      const { key, url } = await uploadIntakeImage(token, await prepareImage(f), "logo");
      setUrl(key, url);
      update((d) => ({ ...d, logo: { key, team: false } }));
    } catch (e) {
      setError(uploadErrorMessage(e, "فشل رفع الشعار. مرة أخرى؟"));
    } finally {
      setBusy(false);
      onBusy(-1);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy}
          className="relative grid size-24 shrink-0 place-items-center overflow-hidden rounded-2xl border border-dashed border-nova/40 bg-nova/[0.06] text-nova-2 transition hover:bg-nova/[0.12] disabled:opacity-70"
          aria-label={src ? "تغيير الشعار" : "رفع الشعار"}
        >
          {src ? <Image src={src} alt="الشعار" fill sizes="96px" className="object-contain p-2" unoptimized /> : <ImagePlus className="size-7" aria-hidden="true" />}
          {busy ? (
            <span className="absolute inset-0 grid place-items-center bg-space/60">
              <Loader2 className="size-6 animate-spin text-white" aria-hidden="true" />
            </span>
          ) : null}
        </button>
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-[13px] leading-6 text-ink-2">{src ? "الشعار وصل. تقدر تغيّره بضغطة." : "الشعار لو موجود (PNG بخلفية شفافة أفضل)."}</p>
          <div className="flex flex-wrap gap-2">
            {src ? (
              <button type="button" onClick={() => update((d) => ({ ...d, logo: { team: false } }))} className="inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-[12.5px] font-bold text-ink-3 hover:text-rose-400">
                <Trash2 className="size-3.5" aria-hidden="true" /> احذف الشعار
              </button>
            ) : (
              <TeamToggle on={data.logo.team} onChange={(v) => update((d) => ({ ...d, logo: { team: v } }))} label="مافيش شعار؟ شعار نصي من الفريق" ariaLabel="سيبها للفريق: الشعار" />
            )}
          </div>
        </div>
      </div>
      <ErrorText>{error}</ErrorText>
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => (void pick(e.target.files?.[0]), (e.target.value = ""))} />
    </div>
  );
}

export function ColorChoice({ data, update, error }: Base & { error?: string }) {
  const mode = data.colors.mode;
  const set = (colors: IntakeData["colors"]) => update((d) => ({ ...d, colors }));
  const card = (active: boolean) =>
    cn("rounded-2xl border p-2.5 text-start transition min-h-[72px]", active ? "border-nova/60 bg-nova/[0.12] ring-1 ring-nova/30" : "border-edge/10 hover:border-edge/25");

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {INTAKE_PALETTES.map((p) => {
          const active = mode === "preset" && data.colors.preset === p.id;
          return (
            <button key={p.id} type="button" aria-pressed={active} onClick={() => set({ mode: "preset", preset: p.id })} className={card(active)}>
              <span className="flex h-8 overflow-hidden rounded-lg">
                {p.colors.map((c) => (
                  <span key={c} className="flex-1" style={{ background: c }} />
                ))}
              </span>
              <span className="mt-1.5 block text-[13px] font-black text-ink">{p.name}</span>
            </button>
          );
        })}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" aria-pressed={mode === "logo"} onClick={() => set({ mode: "logo" })} className={card(mode === "logo")}>
          <span className="block text-[13.5px] font-black text-ink">من ألوان شعاري</span>
          <span className="mt-0.5 block text-[12px] leading-5 text-ink-3">الفريق ياخد الألوان من الشعار</span>
        </button>
        <label className={cn(card(mode === "custom"), "cursor-pointer")}>
          <span className="flex items-center gap-2 text-[13.5px] font-black text-ink">
            <Palette className="size-4 text-nova-2" aria-hidden="true" /> لون معين
          </span>
          <span className="mt-1.5 flex items-center gap-2">
            <input
              type="color"
              value={data.colors.custom ?? "#4f5fd9"}
              onChange={(e) => set({ mode: "custom", custom: e.target.value })}
              className="h-8 w-12 cursor-pointer rounded-lg border border-edge/15 bg-transparent"
              aria-label="لونك الأساسي"
            />
            <span className="font-mono text-[12px] text-ink-3" dir="ltr">
              {mode === "custom" ? data.colors.custom : "اختيار"}
            </span>
          </span>
        </label>
      </div>
      <ErrorText>{error}</ErrorText>
    </div>
  );
}
