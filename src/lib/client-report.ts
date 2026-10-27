// client-report.ts — تنظيف تقارير أخطاء المتصفح وقياسات الأداء قبل حفظها (خالص ومختبَر).
import { redactText } from "./log-format";

export type ClientError = { message: string; stack: string; path: string; kind: "error" | "rejection" | "boundary" };

const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

/** يعيد null لما لا يستحق الحفظ: فارغ، أو ضجيج الإضافات والمتصفح المعروف. */
export function cleanClientError(raw: unknown): ClientError | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const message = redactText(str(o.message, 300)).trim();
  if (!message) return null;
  if (/ResizeObserver loop|Script error\.?$|chrome-extension:|moz-extension:|Non-Error promise rejection/i.test(message + str(o.stack, 400))) return null;
  const kind = o.kind === "rejection" || o.kind === "boundary" ? o.kind : "error";
  let path = str(o.path, 200);
  try { path = new URL(path, "https://x.invalid").pathname; } catch { path = ""; }
  return { message, stack: redactText(str(o.stack, 1200)), path, kind };
}

export type Vital = { name: "LCP" | "INP" | "CLS" | "FCP" | "TTFB"; value: number; path: string };
const VITALS = new Set(["LCP", "INP", "CLS", "FCP", "TTFB"]);

export function cleanVital(raw: unknown): Vital | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.name !== "string" || !VITALS.has(o.name)) return null;
  const value = Number(o.value);
  if (!Number.isFinite(value) || value < 0 || value > 600_000) return null;
  let path = "";
  try { path = new URL(str(o.path, 200), "https://x.invalid").pathname; } catch { /* بلا مسار */ }
  return { name: o.name as Vital["name"], value, path };
}

/** حدود Google «جيد»: LCP ≤ 2500ms، INP ≤ 200ms، CLS ≤ 0.1. */
export const VITAL_GOOD: Record<Vital["name"], number> = { LCP: 2500, INP: 200, CLS: 0.1, FCP: 1800, TTFB: 800 };

export function percentile(values: number[], p: number): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.ceil((p / 100) * s.length) - 1))]!;
}

export function summarizeVitals(rows: Vital[]): { name: Vital["name"]; p75: number; n: number; good: boolean }[] {
  const out: { name: Vital["name"]; p75: number; n: number; good: boolean }[] = [];
  for (const name of Object.keys(VITAL_GOOD) as Vital["name"][]) {
    const vals = rows.filter((r) => r.name === name).map((r) => r.value);
    const p75 = percentile(vals, 75);
    if (p75 !== null) out.push({ name, p75, n: vals.length, good: p75 <= VITAL_GOOD[name] });
  }
  return out;
}
