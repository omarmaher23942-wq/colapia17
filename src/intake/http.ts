import "server-only";
// http.ts — قراءة طلبات API الاستمارة بأمان: حجم أقصى للجسم، وJSON صالح، ومعاملات الحملة المسموحة فقط.
export const MAX_BODY_BYTES = 64 * 1024;

export async function readJson(req: Request, max = MAX_BODY_BYTES): Promise<{ ok: true; body: Record<string, unknown> } | { ok: false; status: 400 | 413 }> {
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > max) return { ok: false, status: 413 };
  const text = await req.text().catch(() => "");
  if (Buffer.byteLength(text) > max) return { ok: false, status: 413 };
  try {
    const body = JSON.parse(text);
    return body && typeof body === "object" && !Array.isArray(body) ? { ok: true, body } : { ok: false, status: 400 };
  } catch {
    return { ok: false, status: 400 };
  }
}

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;

/** معاملات الحملة فقط بقيم قصيرة، وأثر إعلان فيسبوك/جوجل كعلامة (لا تُحفظ المعرّفات نفسها). */
export function cleanUtm(raw: unknown): Record<string, string> | null {
  if (!raw || typeof raw !== "object") return null;
  const src = raw as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const k of UTM_KEYS) {
    const v = src[k];
    if (typeof v === "string" && v.trim()) out[k] = v.trim().slice(0, 100);
  }
  if (typeof src.fbclid === "string" && src.fbclid) out.fbclid = "1";
  if (typeof src.gclid === "string" && src.gclid) out.gclid = "1";
  return Object.keys(out).length ? out : null;
}
