"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Send, Loader2 } from "lucide-react";
import { sendBroadcastEmailAction } from "@/server/actions/platform-email";

export function BroadcastEmailForm() {
  const [subject, setSubject] = useState("");
  const [headline, setHeadline] = useState("");
  const [content, setContent] = useState("");
  const [buttonTitle, setButtonTitle] = useState("");
  const [buttonUrl, setButtonUrl] = useState("");
  const [pending, start] = useTransition();

  const handleSend = () => {
    if (!subject.trim() || !content.trim()) {
      toast.error("يرجى كتابة عنوان الرسالة والمحتوى أولاً");
      return;
    }

    if (!confirm("هل أنت متأكد من رغبتك في إرسال هذا الإيميل لجميع التجار المسجلين في كولابيا؟")) {
      return;
    }

    start(async () => {
      const res = await sendBroadcastEmailAction({
        subject: subject.trim(),
        headline: headline.trim() || undefined,
        content: content.trim(),
        buttonTitle: buttonTitle.trim() || undefined,
        buttonUrl: buttonUrl.trim() || undefined,
      });

      if (res.ok) {
        toast.success(`تم إرسال البرودكاست بنجاح إلى ${res.sentCount || 0} تاجر 🎉`);
        setSubject("");
        setHeadline("");
        setContent("");
        setButtonTitle("");
        setButtonUrl("");
      } else {
        toast.error(res.error || "فشل إرسال البرودكاست");
      }
    });
  };

  return (
    <div className="space-y-3" dir="rtl">
      <div className="grid gap-3 sm:grid-cols-2">
        <input
          className="w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-xs text-white outline-none focus:border-[#8fa8ff]"
          placeholder="عنوان الإيميل (Subject) *"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        />
        <input
          className="w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-xs text-white outline-none focus:border-[#8fa8ff]"
          placeholder="العنوان الداخلي الكبير (اختياري)"
          value={headline}
          onChange={(e) => setHeadline(e.target.value)}
        />
      </div>

      <textarea
        rows={4}
        className="w-full rounded-xl border border-white/10 bg-white/5 p-3.5 text-xs leading-relaxed text-white outline-none focus:border-[#8fa8ff]"
        placeholder="محتوى الإيميل (كل سطر جديد يتحول لفقرة منفصلة بشكل راقٍ تلقائياً)... *"
        value={content}
        onChange={(e) => setContent(e.target.value)}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <input
          className="w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-xs text-white outline-none focus:border-[#8fa8ff]"
          placeholder="نص الزر (مثال: فتح لوحة التحكم) اختياري"
          value={buttonTitle}
          onChange={(e) => setButtonTitle(e.target.value)}
        />
        <input
          className="w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-xs text-white outline-none focus:border-[#8fa8ff]"
          placeholder="رابط الزر (https://...) اختياري"
          dir="ltr"
          value={buttonUrl}
          onChange={(e) => setButtonUrl(e.target.value)}
        />
      </div>

      <div className="flex justify-end pt-1">
        <button
          type="button"
          disabled={pending || !subject.trim() || !content.trim()}
          onClick={handleSend}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-l from-[#6f86ff] to-[#8fa8ff] px-5 py-2.5 text-xs font-black text-[#07091a] shadow-md hover:brightness-105 active:scale-95 disabled:opacity-40 transition-all"
        >
          {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
          <span>{pending ? "جاري الإرسال لكل التجار..." : "إرسال الإيميل الجماعي الآن"}</span>
        </button>
      </div>
    </div>
  );
}