"use client";

// ReviewsList — بطاقات مراجعات مع مشغل صوتي + أزرار اعتماد/تمييز/حذف.
import { useState, useTransition } from "react";
import {
  Star,
  Volume2,
  CheckCircle2,
  XCircle,
  Sparkles,
  Trash2,
  Loader2,
  Mic,
  Pause,
  Play,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  approveReviewAction,
  rejectReviewAction,
  toggleFeaturedReviewAction,
  deleteReviewAction,
} from "@/server/actions/platform-review";

const SW = 1.75;

type Row = {
  id: string;
  storeName: string;
  authorName: string;
  authorRole: string | null;
  avatarUrl: string | null;
  rating: number;
  content: string;
  audioUrl: string | null;
  audioDurationSeconds: number | null;
  isApproved: boolean;
  isFeatured: boolean;
  createdAt: string;
};

export function ReviewsList({ rows }: { rows: Row[] }) {
  const [pending, start] = useTransition();

  const doApprove = (id: string) =>
    start(async () => {
      const r = await approveReviewAction(id);
      if (r.ok) toast.success("تم اعتماد المراجعة");
      else toast.error(r.error);
    });

  const doReject = (id: string) =>
    start(async () => {
      const r = await rejectReviewAction(id);
      if (r.ok) toast.success("تم رفض المراجعة");
      else toast.error(r.error);
    });

  const doToggleFeatured = (id: string, next: boolean) =>
    start(async () => {
      const r = await toggleFeaturedReviewAction(id, next);
      if (r.ok) toast.success(next ? "تم التمييز" : "تم إلغاء التمييز");
      else toast.error(r.error);
    });

  const doDelete = (id: string) =>
    start(async () => {
      if (!confirm("سيتم الحذف النهائي. متأكد؟")) return;
      const r = await deleteReviewAction(id);
      if (r.ok) toast.success("تم الحذف");
      else toast.error(r.error);
    });

  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li
          key={r.id}
          className={cn(
            "rounded-2xl border bg-white/[0.02] p-5 transition-colors",
            r.isFeatured
              ? "border-amber-400/30 bg-amber-500/[0.04]"
              : r.isApproved
                ? "border-emerald-400/20"
                : "border-white/10"
          )}
        >
          <div className="flex flex-wrap items-start gap-4">
            {/* Avatar + identity */}
            <div className="flex items-center gap-3">
              {r.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={r.avatarUrl}
                  alt=""
                  className="size-12 shrink-0 rounded-full border border-white/10 object-cover"
                />
              ) : (
                <span className="grid size-12 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.03] text-sm font-black text-[#8fa8ff]">
                  {r.authorName.charAt(0)}
                </span>
              )}
              <div className="min-w-0">
                <p className="text-sm font-black text-white">{r.authorName}</p>
                <p className="mt-0.5 text-[11px] text-[#8d97c4]">
                  {r.authorRole ?? "صاحب المتجر"} · {r.storeName}
                </p>
                <div className="mt-1 flex items-center gap-1">
                  <RatingStars value={r.rating} />
                  <span className="ms-1 font-mono text-[11px] text-[#8d97c4]">
                    {r.rating}/5
                  </span>
                </div>
              </div>
            </div>

            {/* Status chips */}
            <div className="ms-auto flex flex-wrap items-center gap-1.5">
              {r.isFeatured ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-500/15 px-2.5 py-1 text-[10.5px] font-black text-amber-300">
                  <Sparkles className="size-3" strokeWidth={2.5} aria-hidden="true" />
                  مميّز
                </span>
              ) : null}
              {r.isApproved ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-500/15 px-2.5 py-1 text-[10.5px] font-black text-emerald-300">
                  <CheckCircle2 className="size-3" strokeWidth={2.5} aria-hidden="true" />
                  معتمد
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-500/10 px-2.5 py-1 text-[10.5px] font-black text-amber-300">
                  بانتظار
                </span>
              )}
              <span className="font-mono text-[10.5px] text-[#8d97c4]">
                {new Date(r.createdAt).toLocaleDateString("ar-EG")}
              </span>
            </div>
          </div>

          {/* Content */}
          <p className="mt-4 text-sm leading-relaxed text-[#eaf0ff]">
            {r.content}
          </p>

          {/* Audio */}
          {r.audioUrl ? (
            <AudioPlayer
              src={r.audioUrl}
              duration={r.audioDurationSeconds ?? undefined}
            />
          ) : null}

          {/* Actions */}
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/5 pt-4">
            {!r.isApproved ? (
              <button
                type="button"
                onClick={() => doApprove(r.id)}
                disabled={pending}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-emerald-500/15 px-4 text-xs font-bold text-emerald-300 transition-colors hover:bg-emerald-500/25 disabled:opacity-50"
              >
                <CheckCircle2 className="size-3.5" strokeWidth={2.25} aria-hidden="true" />
                اعتماد ونشر
              </button>
            ) : (
              <button
                type="button"
                onClick={() => doReject(r.id)}
                disabled={pending}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-4 text-xs font-bold text-[#c3cdf0] transition-colors hover:bg-white/[0.06] disabled:opacity-50"
              >
                <XCircle className="size-3.5" strokeWidth={2.25} aria-hidden="true" />
                إلغاء الاعتماد
              </button>
            )}

            <button
              type="button"
              onClick={() => doToggleFeatured(r.id, !r.isFeatured)}
              disabled={pending || !r.isApproved}
              className={cn(
                "inline-flex h-10 items-center gap-1.5 rounded-xl px-4 text-xs font-bold transition-colors disabled:opacity-50",
                r.isFeatured
                  ? "bg-amber-500/20 text-amber-300 hover:bg-amber-500/30"
                  : "border border-amber-400/30 bg-amber-500/[0.06] text-amber-300 hover:bg-amber-500/15"
              )}
            >
              <Sparkles className="size-3.5" strokeWidth={2.25} aria-hidden="true" />
              {r.isFeatured ? "إلغاء التمييز" : "تمييز"}
            </button>

            <button
              type="button"
              onClick={() => doDelete(r.id)}
              disabled={pending}
              className="ms-auto inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-xs font-bold text-rose-400 transition-colors hover:bg-rose-500/10 disabled:opacity-50"
              aria-label="حذف المراجعة"
            >
              <Trash2 className="size-3.5" strokeWidth={2.25} aria-hidden="true" />
              حذف
            </button>

            {pending ? (
              <Loader2
                className="size-4 animate-spin text-[#8fa8ff]"
                strokeWidth={2.25}
                aria-hidden="true"
              />
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

// ─── Rating stars ───────────────────────────────────────────────────────────
function RatingStars({ value }: { value: number }) {
  const filled = Math.max(0, Math.min(5, Math.round(value)));
  return (
    <span className="flex text-amber-400" role="img" aria-label={`${filled} من 5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={cn("size-3", i < filled ? "fill-current" : "opacity-25")}
          strokeWidth={SW}
          aria-hidden="true"
        />
      ))}
    </span>
  );
}

// ─── Audio player ───────────────────────────────────────────────────────────
function AudioPlayer({ src, duration }: { src: string; duration?: number }) {
  const [playing, setPlaying] = useState(false);
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);

  const toggle = () => {
    if (!audio) {
      const a = new Audio(src);
      a.onended = () => setPlaying(false);
      a.onerror = () => {
        toast.error("تعذّر تشغيل التسجيل");
        setPlaying(false);
      };
      setAudio(a);
      void a.play();
      setPlaying(true);
      return;
    }
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      void audio.play();
      setPlaying(true);
    }
  };

  const format = (s?: number) => {
    if (!s) return "--:--";
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className="mt-3 flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3">
      <button
        type="button"
        onClick={toggle}
        className="grid size-10 shrink-0 place-items-center rounded-full bg-[#6f86ff]/20 text-[#8fa8ff] transition-colors hover:bg-[#6f86ff]/30"
        aria-label={playing ? "إيقاف" : "تشغيل"}
      >
        {playing ? (
          <Pause className="size-4" strokeWidth={SW} aria-hidden="true" />
        ) : (
          <Play className="size-4" strokeWidth={SW} aria-hidden="true" />
        )}
      </button>
      <div className="flex items-center gap-2 text-[11px] text-[#8d97c4]">
        <Mic className="size-3.5" strokeWidth={SW} aria-hidden="true" />
        <span>تسجيل صوتي</span>
        {duration ? <span className="font-mono">{format(duration)}</span> : null}
      </div>
      <Volume2
        className="ms-auto size-4 text-[#8d97c4]"
        strokeWidth={SW}
        aria-hidden="true"
      />
    </div>
  );
}