"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
/** تحديث هادئ للبيانات كل فترة (بدون WebSocket): يكفي لمتابعة المحادثات والدفعات لحظيًا تقريبًا */
export function AutoRefresh({ everyMs = 15000 }: { everyMs?: number }) {
  const r = useRouter();
  useEffect(() => { const iv = setInterval(() => { if (document.visibilityState === "visible" && !document.activeElement?.matches("input,textarea")) r.refresh(); }, everyMs); return () => clearInterval(iv); }, [r, everyMs]);
  return null;
}
