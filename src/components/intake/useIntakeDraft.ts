"use client";

// useIntakeDraft.ts — حفظ تلقائي لاستمارة طلب المتجر.
// - لا تُنشأ مسودة على الخادم إلا عند أول تعديل حقيقي (زائر يفتح ويغلق لا يترك صفاً فارغاً).
// - رابط المسودة يُحفظ في المتصفح وفي عنوان الصفحة (?d=): متصفح إنستجرام/فيسبوك الداخلي قد يمسح التخزين عند
//   إغلاقه، والعنوان يبقى في السجل.
// - حفظ واحد في كل لحظة بنسخة متفائلة؛ عند التعارض (تبويب آخر) نتبنى نسخة الخادم رقماً ونعيد حفظ ما على الشاشة.
// - انقطاع النت: نؤجل الحفظ حتى يعود، ونحذّر قبل إغلاق الصفحة إن بقي شيء لم يُحفظ.
import { useCallback, useEffect, useRef, useState } from "react";
import { completion, type IntakeData } from "@/intake/schema";
import type { SaveState } from "./ui";

export const DRAFT_STORAGE_KEY = "clp-intake-draft";
const AUTOSAVE_MS = 800;
const RETRY_MS = [0, 1500, 4000];

type Init = { token: string | null; version: number; data: IntakeData };
export type DraftProblem = { kind: "expired" | "closed" | "unavailable" | "submitted"; message: string } | null;

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
  const tokenRef = useRef(init.token);
  const versionRef = useRef(init.version);
  const dirtyRef = useRef(false);
  const runningRef = useRef<Promise<void> | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (init.token) rememberToken(init.token);
  }, [init.token]);

  const saveNow = useCallback(async (force = false): Promise<void> => {
    if (runningRef.current) {
      await runningRef.current;
      if (!dirtyRef.current && !force) return;
    }
    const run = (async () => {
      const snapshot = dataRef.current;
      // زائر لم يكتب شيئاً بعد: لا مسودة.
      if (!tokenRef.current && !force && completion(snapshot) === 0 && !snapshot.store.oneLine) return;
      if (typeof navigator !== "undefined" && !navigator.onLine) return;
      dirtyRef.current = false;
      setState("saving");
      try {
        if (!tokenRef.current) {
          const r = await post({ data: snapshot, utm: readUtm() });
          if (r.status === 200 && typeof r.json.token === "string") {
            tokenRef.current = r.json.token;
            versionRef.current = Number(r.json.version ?? 0);
            setToken(r.json.token);
            rememberToken(r.json.token);
            // ما تغيّر أثناء الإنشاء يُحفظ في جولة لاحقة.
            if (dataRef.current !== snapshot) dirtyRef.current = true;
          } else {
            dirtyRef.current = true;
            if (r.status === 503) setProblem({ kind: r.json.error === "closed" ? "closed" : "unavailable", message: String(r.json.message ?? "") });
            setState("error");
            return;
          }
        } else {
          let r = await post({ token: tokenRef.current, version: versionRef.current, data: snapshot });
          if (r.status === 409 && r.json.error === "conflict") {
            versionRef.current = Number(r.json.version ?? versionRef.current);
            r = await post({ token: tokenRef.current, version: versionRef.current, data: dataRef.current });
          }
          if (r.status === 200) {
            versionRef.current = Number(r.json.version ?? versionRef.current);
            if (dataRef.current !== snapshot) dirtyRef.current = true;
          } else if (r.status === 409 && r.json.error === "submitted") {
            setProblem({ kind: "submitted", message: "الطلب ده اتبعت بالفعل." });
          } else if (r.status === 410 || r.status === 404) {
            tokenRef.current = null;
            setToken(null);
            rememberToken(null);
            setProblem({ kind: "expired", message: "انتهت مهلة المسودة القديمة، بس كل اللي على الشاشة هيتحفظ في طلب جديد." });
            dirtyRef.current = true;
          } else {
            dirtyRef.current = true;
            setState("error");
            return;
          }
        }
        setState("saved");
      } catch {
        dirtyRef.current = true;
        setState("error");
      }
    })();
    runningRef.current = run;
    try {
      await run;
    } finally {
      if (runningRef.current === run) runningRef.current = null;
    }
    if (dirtyRef.current && (typeof navigator === "undefined" || navigator.onLine)) {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => void saveNow(), AUTOSAVE_MS * 3);
    }
  }, []);

  const update = useCallback(
    (fn: (d: IntakeData) => IntakeData) => {
      setData((prev) => {
        const next = fn(prev);
        dataRef.current = next;
        return next;
      });
      dirtyRef.current = true;
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

  /** قبل الإرسال: انتظر أي حفظ جارٍ. */
  const flush = useCallback(async () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (runningRef.current) await runningRef.current;
  }, []);

  const forget = useCallback(() => {
    dirtyRef.current = false;
    rememberToken(null);
  }, []);

  useEffect(() => {
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
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [saveNow]);

  return { data, update, state, online, problem, token, ensureToken, flush, forget };
}
