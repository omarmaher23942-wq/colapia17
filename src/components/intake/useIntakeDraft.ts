"use client";

// useIntakeDraft.ts — حفظ تلقائي لاستمارة طلب المتجر.
// - لا تُنشأ مسودة على الخادم إلا عند أول تعديل حقيقي (زائر يفتح ويغلق لا يترك صفاً فارغاً).
// - رابط المسودة يُحفظ في المتصفح وفي عنوان الصفحة (?d=): متصفح إنستجرام/فيسبوك الداخلي قد يمسح التخزين عند
//   إغلاقه، والعنوان يبقى في السجل.
// - حفظ واحد في كل لحظة بنسخة متفائلة؛ عند التعارض (تبويب آخر) ندمج ثلاثياً (ما غيّرته أنا يبقى، وما غيّره الآخر
//   يُؤخذ، وما لم يُغيَّر في أحدهما يُؤخذ من الآخر) بدل أن نمحو تعديلات الطرف الآخر.
// - انقطاع النت: نؤجل الحفظ حتى يعود، ونحذّر قبل إغلاق الصفحة إن بقي شيء لم يُحفظ.
// - أخطاء لا تُصلحها إعادة المحاولة (400/403/413، أو الاستمارة مغلقة، أو الطلب أُرسل) تتوقف عندها المحاولات وتظهر
//   رسالة الخادم العربية حتى يعدّل المستخدم شيئاً؛ والازدحام (429/503) يعاد بتباعد متزايد لا كل ثانيتين.
import { useCallback, useEffect, useRef, useState } from "react";
import { completion, type IntakeData } from "@/intake/schema";
import type { SaveState } from "./ui";

export const DRAFT_STORAGE_KEY = "clp-intake-draft";
const AUTOSAVE_MS = 800;
const RETRY_MS = [0, 1500, 4000];

type Init = { token: string | null; version: number; data: IntakeData };
export type DraftProblem = { kind: "expired" | "closed" | "unavailable" | "submitted" | "rejected" | "limited"; message: string; href?: string } | null;

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** دمج ثلاثي: base = آخر ما أقرّه الخادم عندي، server = ما على الخادم الآن، local = ما على شاشتي. */
export function merge3(base: unknown, server: unknown, local: unknown, depth = 0): unknown {
  if (same(local, base)) return server;
  if (same(server, base)) return local;
  if (depth < 2 && isObj(base) && isObj(server) && isObj(local)) {
    const keys = new Set([...Object.keys(base), ...Object.keys(server), ...Object.keys(local)]);
    return Object.fromEntries([...keys].map((k) => [k, merge3(base[k], server[k], local[k], depth + 1)]));
  }
  return local;
}

function readUtm(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const q = new URLSearchParams(window.location.search);
  const out: Record<string, string> = {};
  for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid", "gclid"]) {
    const v = q.get(k);
    if (v) out[k] = v;
  }
  return out;
}

function rememberToken(token: string | null) {
  try {
    if (token) localStorage.setItem(DRAFT_STORAGE_KEY, token);
    else localStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch {
    /* تخزين محجوب (وضع خاص): العنوان يكفي */
  }
  try {
    const url = new URL(window.location.href);
    if (token) url.searchParams.set("d", token);
    else url.searchParams.delete("d");
    window.history.replaceState(window.history.state, "", url.toString());
  } catch {
    /* لا شيء */
  }
}

async function post(body: unknown): Promise<{ status: number; json: Record<string, unknown> }> {
  let last: unknown;
  for (const wait of RETRY_MS) {
    if (wait) await new Promise((r) => setTimeout(r, wait));
    try {
      const res = await fetch("/api/intake/draft", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (res.status >= 500 && res.status !== 503) {
        last = new Error(String(res.status));
        continue;
      }
      return { status: res.status, json };
    } catch (e) {
      last = e;
    }
  }
  throw last;
}

export function useIntakeDraft(init: Init) {
  const [data, setData] = useState<IntakeData>(init.data);
  const [state, setState] = useState<SaveState>("idle");
  const [online, setOnline] = useState(true);
  const [problem, setProblem] = useState<DraftProblem>(null);
  const [token, setToken] = useState<string | null>(init.token);

  const dataRef = useRef(init.data);
  /** آخر نسخة أقرّها الخادم (أساس الدمج عند التعارض). */
  const baseRef = useRef(init.data);
  const unmountedRef = useRef(false);
  /** أخطاء متتالية لتباعد المحاولات، وتوقف تام حتى تعديل جديد. */
  const failsRef = useRef(0);
  const stoppedRef = useRef(false);
  const tokenRef = useRef(init.token);
  const versionRef = useRef(init.version);
  const dirtyRef = useRef(false);
  const runningRef = useRef<Promise<void> | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (init.token) rememberToken(init.token);
  }, [init.token]);

  const fail = useCallback((problemValue: DraftProblem, stop: boolean) => {
    dirtyRef.current = true;
    failsRef.current += 1;
    if (stop) stoppedRef.current = true;
    if (problemValue) setProblem(problemValue);
    setState("error");
  }, []);

  const saveNow = useCallback(async (force = false): Promise<void> => {
    if (unmountedRef.current) return;
    if (runningRef.current) {
      await runningRef.current;
      if (!dirtyRef.current && !force) return;
    } else if (!dirtyRef.current && !force) {
      return;
    }
    const run = (async () => {
      const snapshot = dataRef.current;
      // زائر لم يكتب شيئاً بعد: لا مسودة.
      if (!tokenRef.current && !force && completion(snapshot) === 0 && !snapshot.store.oneLine) {
        dirtyRef.current = false;
        return;
      }
      if (typeof navigator !== "undefined" && !navigator.onLine) return;
      dirtyRef.current = false;
      setState("saving");
      try {
        if (!tokenRef.current) {
          const r = await post({ data: snapshot, utm: readUtm() });
          if (r.status === 200 && typeof r.json.token === "string") {
            tokenRef.current = r.json.token;
            versionRef.current = Number(r.json.version ?? 0);
            baseRef.current = snapshot;
            setToken(r.json.token);
            rememberToken(r.json.token);
            // ما تغيّر أثناء الإنشاء يُحفظ في جولة لاحقة.
            if (dataRef.current !== snapshot) dirtyRef.current = true;
          } else {
            const msg = typeof r.json.message === "string" ? r.json.message : "";
            if (r.status === 503) fail({ kind: r.json.error === "closed" ? "closed" : "unavailable", message: msg || "الاستمارة مش متاحة دلوقتي." }, r.json.error === "closed");
            else if (r.status === 429) fail({ kind: "limited", message: msg || "محاولات كتير، جرّب بعد شوية." }, false);
            else if (r.status === 400 || r.status === 403 || r.status === 413) fail({ kind: "rejected", message: msg || "الحفظ التلقائي اترفض. حدّث الصفحة وجرّب تاني." }, true);
            else fail(null, false);
            return;
          }
        } else {
          let r = await post({ token: tokenRef.current, version: versionRef.current, data: snapshot });
          if (r.status === 409 && r.json.error === "conflict") {
            // تبويب أو جهاز آخر حفظ قبلنا: ندمج تعديلاته مع تعديلاتي بدل أن نمحوها.
            const serverData = r.json.data;
            versionRef.current = Number(r.json.version ?? versionRef.current);
            const merged = (serverData ? merge3(baseRef.current, serverData, dataRef.current) : dataRef.current) as IntakeData;
            baseRef.current = (serverData as IntakeData | undefined) ?? baseRef.current;
            dataRef.current = merged;
            setData(merged);
            r = await post({ token: tokenRef.current, version: versionRef.current, data: merged });
          }
          if (r.status === 200) {
            versionRef.current = Number(r.json.version ?? versionRef.current);
            baseRef.current = snapshot;
            if (dataRef.current !== snapshot) dirtyRef.current = true;
          } else if (r.status === 409 && r.json.error === "submitted") {
            // الطلب اتبعت (من تبويب آخر أو قبل ثانية): لا نُنشئ بديلاً، ونوقف الحفظ.
            stoppedRef.current = true;
            dirtyRef.current = false;
            setProblem({ kind: "submitted", message: "الطلب ده اتبعت بالفعل.", href: `/start?d=${tokenRef.current}` });
          } else if (r.status === 409) {
            fail(null, false); // تعارض ثانٍ متتالٍ: نعيد بالدمج في الجولة القادمة
            return;
          } else if (r.status === 410 || r.status === 404) {
            tokenRef.current = null;
            setToken(null);
            rememberToken(null);
            setProblem({ kind: "expired", message: "انتهت مهلة المسودة القديمة، بس كل اللي على الشاشة هيتحفظ في طلب جديد." });
            dirtyRef.current = true;
          } else {
            const msg = typeof r.json.message === "string" ? r.json.message : "";
            if (r.status === 429) fail({ kind: "limited", message: msg || "حفظ كتير في وقت قصير، هنكمل بعد شوية." }, false);
            else if (r.status === 400 || r.status === 403 || r.status === 413) fail({ kind: "rejected", message: msg || "الحفظ التلقائي اترفض. حدّث الصفحة وجرّب تاني." }, true);
            else fail(r.status === 503 ? { kind: "unavailable", message: msg || "الخدمة مشغولة، هنحاول تاني." } : null, false);
            return;
          }
        }
        failsRef.current = 0;
        setProblem((p) => (p && (p.kind === "limited" || p.kind === "unavailable" || p.kind === "rejected") ? null : p));
        setState("saved");
      } catch {
        fail(null, false);
      }
    })();
    runningRef.current = run;
    try {
      await run;
    } finally {
      if (runningRef.current === run) runningRef.current = null;
    }
    if (dirtyRef.current && !stoppedRef.current && !unmountedRef.current && (typeof navigator === "undefined" || navigator.onLine)) {
      if (timerRef.current) clearTimeout(timerRef.current);
      // تباعد متزايد (حتى دقيقة) بعد الإخفاق المتكرر بدل ضرب الخادم كل ثانيتين.
      const wait = Math.min(60_000, AUTOSAVE_MS * 3 * 2 ** Math.min(failsRef.current, 6));
      timerRef.current = setTimeout(() => void saveNow(), wait);
    }
  }, [fail]);

  const update = useCallback(
    (fn: (d: IntakeData) => IntakeData) => {
      setData((prev) => {
        const next = fn(prev);
        dataRef.current = next;
        return next;
      });
      dirtyRef.current = true;
      stoppedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => void saveNow(), AUTOSAVE_MS);
    },
    [saveNow],
  );

  /** رابط المسودة (يُنشئها إن لم توجد): يحتاجه الرفع قبل أي حفظ. */
  const ensureToken = useCallback(async (): Promise<string | null> => {
    if (tokenRef.current) return tokenRef.current;
    await saveNow(true);
    return tokenRef.current;
  }, [saveNow]);

  /** قبل الإرسال: احفظ آخر تعديل (إن وُجد) وانتظر أي حفظ جارٍ. */
  const flush = useCallback(async () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    stoppedRef.current = false;
    await saveNow();
  }, [saveNow]);

  /** أحدث بيانات على الشاشة وقت الاستدعاء (لا نسخة التقطها مكوّن قبل ثوانٍ). */
  const getData = useCallback(() => dataRef.current, []);

  const forget = useCallback(() => {
    dirtyRef.current = false;
    stoppedRef.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);
    rememberToken(null);
  }, []);

  useEffect(() => {
    unmountedRef.current = false;
    const on = () => {
      setOnline(true);
      if (dirtyRef.current) void saveNow();
    };
    const off = () => setOnline(false);
    setOnline(navigator.onLine);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current || runningRef.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      window.removeEventListener("beforeunload", beforeUnload);
      unmountedRef.current = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [saveNow]);

  return { data, getData, update, state, online, problem, token, ensureToken, flush, forget };
}
