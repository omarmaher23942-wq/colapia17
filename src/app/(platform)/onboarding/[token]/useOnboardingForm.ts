"use client";

// useOnboardingForm.ts — Hook موحّد لإدارة استمارة الـ onboarding.
//
// التعديلات الجذرية (موجة 2):
//  1) دعم الأسئلة التكيّفية (adaptiveAnswers).
//  2) Auto-save كل 800ms (بدل 900).
//  3) Resume: استئناف من آخر خطوة محفوظة + toast.
//  4) Conflict resolution أقوى (يعيد المحاولة تلقائياً بـ 6 rounds).
//  5) دعم Voice Input (يُمرَّر من الـ steps إلى الحقول).
//  6) دعم Import Library (لإضافة منتجات بضغطة).
//  7) Dirty tracking مضبوط (لا ينبّه عند الحفظ التلقائي الناجح).
//  8) Beforeunload protection ذكي (فقط عند dirty).
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  STEP_ORDER,
  STEP_SCHEMAS,
  type OnboardingSubmission,
  type StepId,
  type ProductsStepValue,
  type AudienceStepValue,
  type IndustryId,
} from "@/onboarding/schema";
import { getAdaptiveQuestions } from "@/onboarding/adaptive-questions";

export type SaveState = "idle" | "saving" | "saved" | "error";

export type InitData = {
  token: string;
  draft: Record<string, unknown>;
  draftVersion: number;
  lastStep: string | null;
  expiresAt: string;
};

export type SubmitResult = {
  ok: true;
  storeId: string;
  subdomain: string;
  reviewDeadlineAt: string | null;
  alreadySubmitted?: boolean;
};

const AUTOSAVE_MS = 800;
const MAX_SAVE_ROUNDS = 6;
const RETRY_DELAYS_MS = [0, 400, 1200];

const isStepId = (v: unknown): v is StepId =>
  (STEP_ORDER as readonly string[]).includes(String(v));

// ─── تطبيع دفاعي ───────────────────────────────────────────────────────────
export function normalizeProductsStep(raw: unknown): ProductsStepValue {
  if (!raw) return { sections: [], products: [] };
  if (Array.isArray(raw)) return { sections: [], products: raw as never };
  if (typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    return {
      sections: Array.isArray(o.sections) ? (o.sections as never) : [],
      products: Array.isArray(o.products) ? (o.products as never) : [],
      inventory: o.inventory === "track" || o.inventory === "always" ? o.inventory : undefined,
    };
  }
  return { sections: [], products: [] };
}

function normalizeAudienceStep(raw: unknown): AudienceStepValue {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    audience: (o.audience as AudienceStepValue["audience"]) ?? {
      ageRange: "all",
      gender: "all",
      incomeLevel: "mixed",
      location: [],
      interests: [],
    },
    competitors: Array.isArray(o.competitors) ? (o.competitors as never) : [],
    usp: typeof o.usp === "string" ? o.usp : undefined,
  };
}

function hydrateDraft(
  server: Record<string, unknown>
): Partial<OnboardingSubmission> {
  const d = server ?? {};
  return {
    schemaVersion: 4,
    store: {
      industry: "fashion",
      desiredSubdomain: "mystore",
      ownerName: "",
      storeName: "",
      phone: "",
      whatsapp: "",
      email: "",
      currentChannels: [],
      workingHours: {
        days: ["sat", "sun", "mon", "tue", "wed", "thu"],
        from: "10:00",
        to: "22:00",
      },
      ...((d.store as object) ?? {}),
    } as never,
    audience: normalizeAudienceStep(d.audience),
    products: normalizeProductsStep(d.products),
    launch: {
      shippingMode: "flat",
      flatFeeEgp: 65,
      deliveryEta: "من 2 إلى 4 أيام عمل",
      inspectionAllowed: true,
      codEnabled: true,
      autoTheme: true,
      colorPreference: "سيبها لتصميم وتنسيق الفريق والذكاء الاصطناعي",
      marketingBudget: "none",
      toneOfVoice: "friendly_egyptian",
      preferredLayoutStyle: "modern",
      preferredCardStyle: "elevated",
      preferredMotionLevel: "balanced",
      acceptedTerms: true,
      features: {},
      ...((d.launch as object) ?? {}),
    } as never,
    adaptive: (d.adaptive as Record<string, string | string[]>) ?? {},
  };
}

function buildPayload(
  data: Partial<OnboardingSubmission>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of ["store", "audience", "products", "launch", "adaptive"] as const) {
    const v = (data as Record<string, unknown>)[k];
    if (v !== undefined) out[k] = v;
  }
  return out;
}

function toPathArray(path: unknown): (string | number)[] {
  if (Array.isArray(path)) return path as (string | number)[];
  if (typeof path === "string" && path) return path.split(".");
  return [];
}

export function flattenIssues(
  issues: { path?: (string | number)[] | string; message: string }[]
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of issues ?? []) {
    if (!i?.message) continue;
    const raw = toPathArray((i as { path?: unknown }).path);
    const [head, ...rest] = raw;
    const key = isStepId(head) ? rest.join(".") : raw.join(".");
    if (key && !out[key]) out[key] = i.message;
  }
  return out;
}

// ─── Hook الرئيسي ─────────────────────────────────────────────────────────
export function useOnboardingForm(init: InitData) {
  const [data, setData] = useState<Partial<OnboardingSubmission>>(() =>
    hydrateDraft(init.draft)
  );
  const [version, setVersionState] = useState(init.draftVersion);
  const versionRef = useRef(init.draftVersion);

  const [step, setStepState] = useState<StepId>(() =>
    isStepId(init.lastStep) ? init.lastStep : "store"
  );
  const stepRef = useRef<StepId>(step);

  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null);

  const [stepErrors, setStepErrors] = useState<Record<string, string>>({});
  const [showErrors, setShowErrors] = useState(false);

  const [online, setOnline] = useState(true);

  const dataRef = useRef(data);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);
  useEffect(() => {
    stepRef.current = step;
  }, [step]);

  const dirty = useRef(false);
  const saveChain = useRef<Promise<void> | null>(null);
  const hasResumed = useRef(false);

  const setVersion = useCallback((v: number) => {
    versionRef.current = v;
    setVersionState(v);
  }, []);

  // ─── Online tracking ────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof navigator === "undefined") return;
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  // ─── Beforeunload protection ────────────────────────────────────────────
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  // ─── Resume toast ──────────────────────────────────────────────────────
  useEffect(() => {
    if (hasResumed.current) return;
    hasResumed.current = true;
    if (init.draftVersion > 0 && init.lastStep && init.lastStep !== "store") {
      const STEP_LABELS: Record<string, string> = {
        store: "بيانات المتجر",
        audience: "الجمهور والمنافسين",
        products: "المنتجات",
        launch: "الشحن والدفع",
        review: "المراجعة",
      };
      const label = STEP_LABELS[init.lastStep] ?? init.lastStep;
      toast.info(`استأنفنا من حيث توقفت — ${label}`, {
        duration: 5000,
        description: "تقدّمك محفوظ تلقائياً.",
      });
    }
  }, [init.draftVersion, init.lastStep]);

  // ─── doSaveOnce ────────────────────────────────────────────────────────
  const doSaveOnce = useCallback(async (): Promise<
    "ok" | "conflict" | "retry" | "fatal"
  > => {
    try {
      const myData = buildPayload(dataRef.current);
      const myStep = stepRef.current;
      const myVersion = versionRef.current;

      const r = await fetch(
        `/api/onboarding/${encodeURIComponent(init.token)}/draft`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            draftVersion: myVersion,
            step: myStep,
            data: myData,
          }),
        }
      );

      if (r.ok) {
        const j = await r.json();
        if (typeof j.draftVersion === "number") setVersion(j.draftVersion);
        setSavedAt(new Date());
        return "ok";
      }
      if (r.status === 409) {
        const j = await r.json().catch(() => ({}));
        if (typeof j.draftVersion === "number") setVersion(j.draftVersion);
        dirty.current = true;
        return "conflict";
      }
      return r.status >= 500 ? "retry" : "fatal";
    } catch {
      return "retry";
    }
  }, [init.token, setVersion]);

  // ─── save ──────────────────────────────────────────────────────────────
  const save = useCallback((): Promise<void> => {
    if (saveChain.current) {
      dirty.current = true;
      return saveChain.current;
    }

    const chain = (async () => {
      try {
        for (let round = 0; round < MAX_SAVE_ROUNDS; round++) {
          dirty.current = false;
          setSaveState("saving");
          setSaveError(null);

          let result: "ok" | "conflict" | "retry" | "fatal" = "retry";
          for (let attempt = 0; attempt < RETRY_DELAYS_MS.length; attempt++) {
            if (RETRY_DELAYS_MS[attempt]! > 0) {
              await new Promise((res) =>
                setTimeout(res, RETRY_DELAYS_MS[attempt])
              );
            }
            result = await doSaveOnce();
            if (result === "ok" || result === "conflict") break;
            if (result === "fatal") break;
          }

          if (result === "ok") {
            setSaveState("saved");
            setIsDirty(false);
          } else if (result === "conflict") {
            // نستمر للحلقة التالية بـ version محدّث.
          } else {
            setSaveState("error");
            setSaveError("تعذر حفظ التغييرات");
            setIsDirty(true);
          }

          if (!dirty.current) return;
        }
      } finally {
        saveChain.current = null;
      }
    })();

    saveChain.current = chain;
    return chain;
  }, [doSaveOnce]);

  const retrySave = useCallback(() => {
    dirty.current = true;
    setIsDirty(true);
    void save();
  }, [save]);

  // ─── patch ────────────────────────────────────────────────────────────
  const patch = useCallback(
    <K extends StepId>(s: K, patchValue: unknown) => {
      setData((cur) => {
        let val = patchValue;
        if (s === "products") val = normalizeProductsStep(patchValue);
        if (s === "audience") val = normalizeAudienceStep(patchValue);
        return { ...cur, [s]: val } as Partial<OnboardingSubmission>;
      });
      setShowErrors(false);
      setStepErrors({});
      setIsDirty(true);
      dirty.current = true;
    },
    []
  );

  const patchAdaptive = useCallback(
    (key: string, value: string | string[]) => {
      setData((cur) => ({
        ...cur,
        adaptive: { ...(cur.adaptive ?? {}), [key]: value },
      }));
      setIsDirty(true);
      dirty.current = true;
    },
    []
  );

  // ─── autosave ─────────────────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => void save(), AUTOSAVE_MS);
    return () => clearTimeout(t);
  }, [data, step, save]);

  // ─── validateStep ─────────────────────────────────────────────────────
  const validateStep = useCallback((s: StepId): Record<string, string> => {
    const schema = (
      STEP_SCHEMAS as Record<
        string,
        {
          safeParse: (v: unknown) => {
            success: boolean;
            error?: { issues: unknown[] };
          };
        }
      >
    )[s];
    if (!schema) return {};
    const rawVal = (dataRef.current as Record<string, unknown>)[s];
    const val =
      s === "products"
        ? normalizeProductsStep(rawVal)
        : s === "audience"
        ? normalizeAudienceStep(rawVal)
        : rawVal ?? {};
    const r = schema.safeParse(val);
    if (r.success) return {};
    return flattenIssues(
      (r.error?.issues ?? []) as {
        path?: string | (string | number)[];
        message: string;
      }[]
    );
  }, []);

  // ─── Navigation ───────────────────────────────────────────────────────
  const goNext = useCallback(async () => {
    const errs = validateStep(stepRef.current);
    if (Object.keys(errs).length) {
      setStepErrors(errs);
      setShowErrors(true);
      return false;
    }
    const i = STEP_ORDER.indexOf(stepRef.current);
    if (i < 0 || i >= STEP_ORDER.length - 1) return false;
    setStepState(STEP_ORDER[i + 1]!);
    setShowErrors(false);
    setStepErrors({});
    window.scrollTo({ top: 0, behavior: "smooth" });
    return true;
  }, [validateStep]);

  const goPrev = useCallback(() => {
    const i = STEP_ORDER.indexOf(stepRef.current);
    if (i <= 0) return;
    setStepState(STEP_ORDER[i - 1]!);
    setShowErrors(false);
    setStepErrors({});
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const jumpTo = useCallback((s: StepId) => {
    setStepState(s);
    setShowErrors(false);
    setStepErrors({});
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  // ─── submit ───────────────────────────────────────────────────────────
  const submit = useCallback(async () => {
    setSubmitting(true);
    setSubmitError(null);

    try {
      const fullData = buildPayload(dataRef.current);
      const r = await fetch(
        `/api/onboarding/${encodeURIComponent(init.token)}/submit`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            draftVersion: versionRef.current,
            data: fullData,
          }),
        }
      );

      const j = await r.json().catch(() => ({}));

      if (r.ok && j.ok) {
        setSubmitResult(j as SubmitResult);
        return true;
      }

      if (r.status === 422 && j.error === "invalid") {
        const first = (
          j.firstStep && isStepId(j.firstStep) ? j.firstStep : "store"
        ) as StepId;
        const issues = Array.isArray(j.issues) ? j.issues : [];
        setStepErrors(flattenIssues(issues));
        setShowErrors(true);
        setStepState(first);
        const detailedError =
          issues.length > 0
            ? issues[0]?.message
            : "في بيانات ناقصة، راجع الخطوات.";
        setSubmitError(detailedError);
        return false;
      }

      setSubmitError(
        j.message ?? "تعذّر إرسال الاستمارة، يرجى مراجعة البيانات."
      );
      return false;
    } catch {
      setSubmitError("تعذّر الاتصال بالإنترنت.");
      return false;
    } finally {
      setSubmitting(false);
    }
  }, [init.token]);

  // ─── Adaptive questions helper ────────────────────────────────────────
  const industry = (data.store as { industry?: IndustryId } | undefined)?.industry;
  const adaptiveQuestions = getAdaptiveQuestions(industry);

  return {
    token: init.token,
    data,
    setData,
    patch,
    patchAdaptive,
    step,
    version,
    expiresAt: init.expiresAt,
    saveState,
    saveError,
    savedAt,
    isDirty,
    online,
    stepErrors: showErrors ? stepErrors : {},
    submitting,
    submitError,
    submitResult,
    goNext,
    goPrev,
    jumpTo,
    submit,
    validateStep,
    retrySave,
    adaptiveQuestions,
    industry,
  };
}