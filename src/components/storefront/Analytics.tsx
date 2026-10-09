"use client";

// Analytics — محرك تتبع خفيف بدون مكتبات:
// - Batching كل 4s + flush عند pagehide/visibilitychange.
// - keepalive=true في الـ fetch الأخير.
// - يحدّث Live Viewers في Redis كل 15s عبر /api/live.
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

declare global {
  interface Window {
    clpTrack?: (name: string, props?: Record<string, unknown>) => void;
  }
}

type TrackedEvent = {
  name: string;
  props?: Record<string, unknown>;
  path: string;
  referrer: string;
  utm: string | null;
  device: "mobile" | "desktop";
  t: number;
};

const FLUSH_INTERVAL_MS = 4_000;
const LIVE_PING_INTERVAL_MS = 15_000;
const MAX_QUEUE = 40;

function id(prefix: string, storage: Storage): string {
  try {
    const existing = storage.getItem(prefix);
    if (existing) return existing;
    const next = crypto.randomUUID();
    storage.setItem(prefix, next);
    return next;
  } catch {
    return crypto.randomUUID();
  }
}

/** الموقع الذي جاء منه الزائر (التنقل داخل المتجر نفسه ليس مصدراً). */
function externalReferrer(): string {
  try {
    return document.referrer && new URL(document.referrer).origin !== location.origin ? document.referrer.slice(0, 500) : "";
  } catch {
    return "";
  }
}

/** مصدر الحملة: utm_source، أو معرّف النقر الذي تضيفه إعلانات ميتا وجوجل وتيك توك للرابط. */
function sourceParam(): string | null {
  const q = new URLSearchParams(location.search);
  return q.get("utm_source") ?? (q.has("fbclid") ? "meta" : q.has("gclid") || q.has("gbraid") ? "google" : q.has("ttclid") ? "tiktok" : null);
}

export function Analytics({ storeId }: { storeId: string }) {
  const path = usePathname();
  const queueRef = useRef<TrackedEvent[]>([]);
  const flushedRef = useRef(false);

  // Bootstrap: راكع واحد لكل تحميل صفحة.
  useEffect(() => {
    if (typeof window === "undefined") return;

    const vid = id("clp-vid", localStorage);
    const sid = id("clp-sid", sessionStorage);

    const doFlush = () => {
      if (queueRef.current.length === 0) return;
      const body = JSON.stringify({
        storeId,
        vid,
        sid,
        events: queueRef.current.splice(0, MAX_QUEUE),
      });
      try {
        if (navigator.sendBeacon) {
          const blob = new Blob([body], { type: "application/json" });
          const ok = navigator.sendBeacon("/api/track", blob);
          if (!ok) throw new Error("beacon rejected");
        } else {
          void fetch("/api/track", {
            method: "POST",
            body,
            keepalive: true,
            headers: { "Content-Type": "application/json" },
          });
        }
        flushedRef.current = true;
      } catch {
        void fetch("/api/track", {
          method: "POST",
          body,
          keepalive: true,
          headers: { "Content-Type": "application/json" },
        });
      }
    };

    window.clpTrack = (name, props) => {
      queueRef.current.push({
        name,
        props,
        path: location.pathname,
        referrer: externalReferrer(),
        utm: sourceParam(),
        device: /Mobi|Android/i.test(navigator.userAgent) ? "mobile" : "desktop",
        t: Date.now(),
      });
      if (queueRef.current.length >= MAX_QUEUE) doFlush();
    };

    const iv = setInterval(doFlush, FLUSH_INTERVAL_MS);
    const onHide = () => {
      if (document.visibilityState === "hidden") doFlush();
    };
    const onPageHide = () => doFlush();

    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("beforeunload", onPageHide);

    // أول flush بعد 1.2s لتسجيل page_view سريعاً.
    const firstTick = setTimeout(doFlush, 1_200);

    return () => {
      clearInterval(iv);
      clearTimeout(firstTick);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("beforeunload", onPageHide);
      doFlush();
    };
  }, [storeId]);

  // سجل page_view عند تغيير المسار.
  useEffect(() => {
    window.clpTrack?.("page_view", { path });
  }, [path]);

  // Live viewers ping.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const ping = () => {
      const vid = (() => {
        try {
          return localStorage.getItem("clp-vid") ?? "";
        } catch {
          return "";
        }
      })();
      const body = JSON.stringify({ storeId, vid, path: window.location.pathname });
      if (navigator.sendBeacon) {
        const blob = new Blob([body], { type: "application/json" });
        navigator.sendBeacon("/api/live", blob);
      } else {
        void fetch("/api/live", {
          method: "POST",
          body,
          keepalive: true,
          headers: { "Content-Type": "application/json" },
        });
      }
    };
    ping();
    const iv = setInterval(ping, LIVE_PING_INTERVAL_MS);
    return () => clearInterval(iv);
  }, [storeId]);

  return null;
}