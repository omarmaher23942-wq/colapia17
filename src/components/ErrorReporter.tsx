"use client";
// ErrorReporter — يرسل أخطاء المتصفح غير المعالجة وقياسات الأداء (بعيّنة 10%) إلى المنصة دون أي أثر على الزائر.
import { useEffect } from "react";
import { useReportWebVitals } from "next/web-vitals";

const SENT = new Set<string>();
const send = (url: string, body: unknown) => {
  try {
    const data = JSON.stringify(body);
    if (navigator.sendBeacon?.(url, new Blob([data], { type: "text/plain" }))) return;
    void fetch(url, { method: "POST", body: data, keepalive: true, headers: { "Content-Type": "text/plain" } }).catch(() => {});
  } catch { /* لا أثر على الصفحة */ }
};

export function ErrorReporter() {
  useEffect(() => {
    const report = (message: string, stack: string, kind: "error" | "rejection") => {
      const key = `${kind}:${message}`.slice(0, 160);
      if (SENT.has(key) || SENT.size >= 5) return; // لا تكرار ولا إغراق من صفحة واحدة
      SENT.add(key);
      send("/api/client-error", { message, stack, kind, path: location.pathname });
    };
    const onError = (e: ErrorEvent) => report(e.message || "error", e.error?.stack ?? "", "error");
    const onRej = (e: PromiseRejectionEvent) => report(String((e.reason as Error)?.message ?? e.reason ?? "rejection"), (e.reason as Error)?.stack ?? "", "rejection");
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRej);
    return () => { window.removeEventListener("error", onError); window.removeEventListener("unhandledrejection", onRej); };
  }, []);
  useReportWebVitals((m) => {
    if (!["LCP", "INP", "CLS", "FCP", "TTFB"].includes(m.name) || Math.random() > 0.1) return;
    send("/api/vitals", { name: m.name, value: m.name === "CLS" ? m.value : Math.round(m.value), path: location.pathname });
  });
  return null;
}
