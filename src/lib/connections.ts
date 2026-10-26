// connections.ts — حقول «ربط حساباتكم» وفحصها (خالص). المفاتيح تُشفَّر عند الحفظ ولا تُعاد للواجهة؛ تعود حالتها فقط.
export const SECRET_FIELDS = ["neonUrl", "groqKey", "imagekitPublic", "imagekitPrivate", "imagekitEndpoint"] as const;
export type SecretField = (typeof SECRET_FIELDS)[number];
/** حالات يضبطها الفريق (لا يكتبها العميل). */
export type TeamStatus = "pending" | "ready";
export type TeamStatuses = { github: { username: string; repo: string; status: TeamStatus }; cloudflare: { status: TeamStatus } };

const clean = (v: string) => v.trim().replace(/^["']|["']$/g, "").replace(/^[A-Z_]+=/, "").trim();

/** يعيد القيمة النظيفة أو رسالة خطأ عربية. */
export function checkSecret(field: SecretField, raw: string): { ok: true; value: string } | { ok: false; error: string } {
  const v = clean(raw ?? "");
  if (!v) return { ok: false, error: "اللصق فارغ." };
  if (v.length > 600) return { ok: false, error: "القيمة أطول من المتوقع." };
  switch (field) {
    case "neonUrl":
      return /^postgres(ql)?:\/\/[^\s]+@[^\s/]+\/[^\s]+$/.test(v) ? { ok: true, value: v } : { ok: false, error: "الرابط يجب أن يبدأ بـ postgresql:// ويتضمن المستخدم والخادم واسم القاعدة." };
    case "groqKey":
      return /^gsk_[A-Za-z0-9]{20,}$/.test(v) ? { ok: true, value: v } : { ok: false, error: "المفتاح يبدأ بـ gsk_ ويُنسخ كاملاً." };
    case "imagekitEndpoint":
      return /^https:\/\/ik\.imagekit\.io\/[A-Za-z0-9_-]+\/?$/.test(v) ? { ok: true, value: v } : { ok: false, error: "العنوان بالشكل https://ik.imagekit.io/اسم_الحساب" };
    case "imagekitPublic":
      return /^public_[A-Za-z0-9+/=]{10,}$/.test(v) ? { ok: true, value: v } : { ok: false, error: "المفتاح العام يبدأ بـ public_." };
    case "imagekitPrivate":
      return /^private_[A-Za-z0-9+/=]{10,}$/.test(v) ? { ok: true, value: v } : { ok: false, error: "المفتاح الخاص يبدأ بـ private_." };
  }
}

export type ConnectionView = { saved: Record<SecretField, boolean>; team: TeamStatuses };

export const DEFAULT_TEAM: TeamStatuses = { github: { username: "", repo: "", status: "pending" }, cloudflare: { status: "pending" } };

type Rec = Record<string, unknown>;
const rec = (v: unknown): Rec => (v && typeof v === "object" && !Array.isArray(v) ? (v as Rec) : {});

/** يقرأ prefs.connections بتسامح ويعيد حالة الحفظ (منطقية) دون أي قيمة سرية. */
export function viewFrom(prefs: unknown): ConnectionView {
  const c = rec(rec(prefs).connections);
  const secrets = rec(c.secrets);
  const t = rec(c.team);
  const gh = rec(t.github);
  const st = (v: unknown): TeamStatus => (v === "ready" ? "ready" : "pending");
  return {
    saved: Object.fromEntries(SECRET_FIELDS.map((f) => [f, typeof secrets[f] === "string" && secrets[f] !== ""])) as Record<SecretField, boolean>,
    team: {
      github: { username: String(gh.username ?? "").slice(0, 60), repo: String(gh.repo ?? "").slice(0, 100), status: st(gh.status) },
      cloudflare: { status: st(rec(t.cloudflare).status) },
    },
  };
}
