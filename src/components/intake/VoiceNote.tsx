"use client";

// VoiceNote.tsx — «احكيلنا بصوتك» بدل الكتابة: تسجيل (حتى 3 دقائق) ← سماع قبل الإرسال ← رفع ← تفريغ آلي يراه
// العميل ويصححه. الصيغة حسب المتصفح (mp4 على iOS/Safari، webm على Chrome/Android). متصفح لا يدعم التسجيل (بعض
// متصفحات التطبيقات الداخلية) أو رفض الميكروفون: رفع ملف صوتي جاهز، أو إرسال الرسالة للفريق على واتساب.
import { useEffect, useRef, useState } from "react";
import { Loader2, Mic, RotateCcw, Square, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import type { IntakeData } from "@/intake/schema";
import { cn } from "@/lib/utils";
import { uploadErrorMessage, uploadIntakeVoice } from "./upload";

const MAX_MS = 180_000;
type Phase = "idle" | "recording" | "uploading" | "transcribing";

function pickMime(): string | undefined {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") return undefined;
  return ["audio/mp4", "audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"].find((m) => MediaRecorder.isTypeSupported(m));
}

const fmt = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export function VoiceNote({
  data,
  update,
  urls,
  setUrl,
  ensureToken,
  whatsappUrl,
}: {
  data: IntakeData;
  update: (fn: (d: IntakeData) => IntakeData) => void;
  urls: Record<string, string>;
  setUrl: (k: string, u: string) => void;
  ensureToken: () => Promise<string | null>;
  whatsappUrl?: string | null;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [supported, setSupported] = useState(true);
  const [denied, setDenied] = useState(false);
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const started = useRef(0);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const src = data.voice.key ? urls[data.voice.key] : undefined;

  useEffect(() => {
    setSupported(typeof window !== "undefined" && typeof MediaRecorder !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia));
    return () => {
      if (tick.current) clearInterval(tick.current);
      rec.current?.stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const send = async (file: File, durationMs: number) => {
    const token = await ensureToken();
    if (!token) return void toast.error("ما قدرناش نجهز الرفع. تأكد من النت وجرّب تاني.");
    setPhase("uploading");
    try {
      const { key, url } = await uploadIntakeVoice(token, file, durationMs);
      setUrl(key, url);
      update((d) => ({ ...d, voice: { key, transcript: undefined } }));
      setPhase("transcribing");
      const res = await fetch("/api/intake/transcribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, key }) });
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; text?: string; message?: string };
      if (j.ok && j.text) update((d) => ({ ...d, voice: { key, transcript: j.text } }));
      else toast.message(j.message ?? "التسجيل وصل، والفريق هيسمعه.");
    } catch (e) {
      toast.error(uploadErrorMessage(e, "فشل رفع التسجيل، جرّب تاني."));
    } finally {
      setPhase("idle");
    }
  };

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const mime = pickMime();
      const r = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunks.current = [];
      r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      r.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        if (tick.current) clearInterval(tick.current);
        const type = (r.mimeType || mime || "audio/webm").split(";")[0]!;
        const blob = new Blob(chunks.current, { type });
        const ms = Date.now() - started.current;
        if (ms < 1500 || blob.size < 2000) {
          setPhase("idle");
          return void toast.message("التسجيل قصير جداً، جرّب تاني.");
        }
        void send(new File([blob], `voice.${type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "webm"}`, { type }), ms);
      };
      rec.current = r;
      started.current = Date.now();
      setElapsed(0);
      r.start(1000);
      setPhase("recording");
      tick.current = setInterval(() => {
        const ms = Date.now() - started.current;
        setElapsed(ms);
        if (ms >= MAX_MS && r.state === "recording") r.stop();
      }, 250);
    } catch (e) {
      const name = (e as DOMException)?.name;
      if (name === "NotAllowedError" || name === "SecurityError") setDenied(true);
      else setSupported(false);
    }
  };

  const stop = () => {
    if (rec.current?.state === "recording") rec.current.stop();
  };

  const busy = phase === "uploading" || phase === "transcribing";

  return (
    <div className="space-y-3">
      {src ? (
        <div className="space-y-3 rounded-2xl border border-edge/10 bg-edge/[0.03] p-3">
          <audio src={src} controls preload="none" className="w-full" />
          <label htmlFor="voice-transcript" className="block text-[13px] font-black text-ink">
            اللي فهمناه من تسجيلك (صحّحه لو فيه غلط)
          </label>
          <textarea
            id="voice-transcript"
            value={data.voice.transcript ?? ""}
            maxLength={4000}
            onChange={(e) => update((d) => ({ ...d, voice: { ...d.voice, transcript: e.target.value } }))}
            placeholder={phase === "transcribing" ? "بنحوّل التسجيل لنص…" : "مفيش نص؟ عادي، الفريق هيسمع التسجيل نفسه."}
            rows={4}
            className="w-full rounded-xl border border-edge/10 bg-edge/[0.04] p-3 text-base leading-7 text-ink outline-none focus:border-nova focus:ring-2 focus:ring-nova/25 sm:text-[15px]"
          />
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy || !supported} onClick={() => void start()} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-edge/10 px-3 text-[13px] font-bold text-ink-2 hover:text-ink disabled:opacity-50">
              <RotateCcw className="size-4" aria-hidden="true" /> سجّل من جديد
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => update((d) => ({ ...d, voice: {} }))}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-xl px-3 text-[13px] font-bold text-ink-3 hover:text-rose-400 disabled:opacity-50"
            >
              <Trash2 className="size-4" aria-hidden="true" /> احذف التسجيل
            </button>
          </div>
        </div>
      ) : null}

      {phase === "recording" ? (
        <div className="flex items-center gap-3 rounded-2xl border border-rose-400/40 bg-rose-400/10 p-3" role="status">
          <span className="relative flex size-3">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-rose-400 opacity-75" />
            <span className="relative inline-flex size-3 rounded-full bg-rose-500" />
          </span>
          <span className="font-mono text-[15px] font-black text-ink" dir="ltr">
            {fmt(elapsed)} / {fmt(MAX_MS)}
          </span>
          <button type="button" onClick={stop} className="ms-auto inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-rose-500 px-4 text-[14px] font-black text-white">
            <Square className="size-4" aria-hidden="true" /> خلّصت
          </button>
        </div>
      ) : !src ? (
        <div className="flex flex-wrap gap-2">
          {supported && !denied ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void start()}
              className={cn("inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-nova px-4 text-[14px] font-black text-white shadow-lg shadow-nova/30 sm:flex-none", busy && "opacity-70")}
            >
              {busy ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : <Mic className="size-5" aria-hidden="true" />}
              {phase === "uploading" ? "بنرفع التسجيل…" : phase === "transcribing" ? "بنحوّله لنص…" : "سجّل رسالة صوتية"}
            </button>
          ) : null}
          <button
            type="button"
            disabled={busy}
            onClick={() => fileInput.current?.click()}
            className="inline-flex min-h-12 items-center justify-center gap-1.5 rounded-2xl border border-edge/10 px-4 text-[13.5px] font-bold text-ink-2 hover:text-ink disabled:opacity-50"
          >
            <Upload className="size-4" aria-hidden="true" /> ارفع ملف صوتي
          </button>
        </div>
      ) : null}

      {denied ? <p className="text-[12.5px] leading-6 text-amber-300">المتصفح رافض الميكروفون. اسمح له من الإعدادات، أو ارفع ملف صوتي، أو اكتب تحت.</p> : null}
      {!supported ? (
        <p className="text-[12.5px] leading-6 text-ink-3">
          المتصفح ده مش بيسجّل صوت. افتح الرابط في Chrome أو Safari، أو ارفع ملف صوتي من تطبيق التسجيل
          {whatsappUrl ? (
            <>
              ، أو{" "}
              <a href={whatsappUrl} target="_blank" rel="noopener" className="font-bold text-nova-2 underline">
                ابعته لنا على واتساب
              </a>
            </>
          ) : null}
          .
        </p>
      ) : null}
      <input
        ref={fileInput}
        type="file"
        accept="audio/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          if (f.size > 8 * 1024 * 1024) return void toast.error("الملف أكبر من 8 ميجا. سجّل رسالة أقصر.");
          void send(new File([f], f.name, { type: (f.type || "audio/mp4").split(";")[0] }), 0);
        }}
      />
    </div>
  );
}
