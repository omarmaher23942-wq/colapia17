// brief.ts — يحوّل طلب المتجر إلى BRIEF.md بنفس أقسام stores/_template/BRIEF.md (منطق خالص).
// يستخدمه زر «انسخ الـ brief» في لوحة المالك الآن، والتجهيز الآلي (المرحلة 4) لاحقاً لكتابة stores/<slug>/BRIEF.md.
// كل ما كتبه العميل يُنقل كما هو ويُعلَّم مصدره؛ ما تركه للفريق يُكتب «سيبها للفريق» صراحة.
import { DELIVERY_OPTIONS, PAYMENT_OPTIONS, safeUrl, socialUrl, type IntakeData } from "./schema";
import { paletteById } from "./palettes";

export type BriefAsset = { key: string; url: string; kind: "image" | "logo" | "voice"; transcript?: string | null };

export type BriefInput = {
  code: string;
  data: IntakeData;
  assets: BriefAsset[];
  submittedAt?: Date | null;
};

const TEAM = "سيبها للفريق";
const NONE = "—";

/** نص سطر واحد آمن داخل Markdown (لا عناوين ولا قوائم مزروعة من نص العميل). */
const line = (s: string | undefined | null) => (s ?? "").replace(/\s+/g, " ").replace(/^[#>*\-\s]+/, "").trim();

export function renderBrief({ code, data: d, assets, submittedAt }: BriefInput): string {
  const byKey = new Map(assets.map((a) => [a.key, a]));
  const url = (key: string | undefined) => (key ? (byKey.get(key)?.url ?? null) : null);

  const colors = (() => {
    switch (d.colors.mode) {
      case "preset": {
        const p = paletteById(d.colors.preset);
        return p ? `لوحة جاهزة «${p.name}»: ${p.colors.join(" ")}` : TEAM;
      }
      case "logo":
        return "من ألوان الشعار";
      case "custom":
        return d.colors.custom ? `لون أساسي ${d.colors.custom}` : TEAM;
      default:
        return TEAM;
    }
  })();

  const logo = d.logo.key && url(d.logo.key) ? `brief/assets/logo (${url(d.logo.key)})` : d.logo.team ? `${TEAM} (شعار نصي مناسب)` : NONE;
  const social = socialUrl(d.social.url);
  const inspiration = safeUrl(d.inspiration.url);
  const payment = d.payment.unsure
    ? "مش متأكد (الفريق يقترح)"
    : d.payment.methods.map((m) => PAYMENT_OPTIONS.find((p) => p.id === m)?.label ?? m).join("، ") || NONE;
  const delivery = DELIVERY_OPTIONS.find((o) => o.id === d.delivery.scope)?.label ?? NONE;

  const products = (() => {
    if (d.products.mode === "team") return [`- ${TEAM}: يجمعها الفريق من الصفحة${social ? ` (${social})` : ""}.`];
    if (d.products.mode === "later") return ["- يضيفها التاجر بنفسه لاحقاً من لوحته."];
    if (!d.products.items.length) return [`- ${NONE}`];
    return d.products.items.map((p, i) => {
      const img = url(p.key);
      return `${i + 1}. ${line(p.line) || "(بلا وصف)"}${img ? ` — صورة: ${img}` : ""}`;
    });
  })();

  const voice = d.voice.key ? byKey.get(d.voice.key) : undefined;
  const transcript = line(d.voice.transcript ?? voice?.transcript ?? "");

  return [
    `# Brief — ${line(d.store.name) || "(بلا اسم)"}`,
    "",
    `> طلب ${code}${submittedAt ? ` · أُرسل ${submittedAt.toISOString().slice(0, 10)}` : ""}. من استمارة العميل حرفياً؛ ما بعد «${TEAM}» قرار الفريق.`,
    "",
    "## المتجر",
    `- **الاسم:** ${line(d.store.name) || NONE}`,
    `- **النشاط وما يبيعه (بكلام التاجر):** ${line(d.store.oneLine) || NONE}`,
    "",
    "## التواصل",
    `- **البريد الأساسي (مالك لوحة المتجر):** ${line(d.contact.email) || NONE}`,
    `- **واتساب:** ${line(d.contact.whatsapp) || NONE}`,
    `- **إنستجرام / فيسبوك:** ${social ?? NONE}${d.social.teamCollects ? " — ☑ الفريق يستخرج المنتجات من الصفحة" : ""}`,
    "",
    "## الهوية",
    `- **الشعار:** ${logo}`,
    `- **الألوان:** ${colors}`,
    `- **موقع إلهام:** ${inspiration ?? (d.inspiration.team ? TEAM : NONE)}`,
    "",
    "## السياسات (كما اختارها التاجر؛ لا تضف وعداً غير مذكور)",
    `- **الدفع:** ${payment}`,
    `- **الشحن:** ${delivery}${d.delivery.note ? ` — ${line(d.delivery.note)}` : ""}`,
    "- **المعاينة والاستبدال والاسترجاع:** لم تُسأل في الاستمارة؛ يؤكدها الفريق مع التاجر.",
    "",
    "## المنتجات",
    ...products,
    "",
    "## ملاحظات العميل (ومنها تفريغ الرسالة الصوتية)",
    d.notes?.trim() ? d.notes.trim().split(/\n+/).map((l) => `> ${line(l)}`).join("\n") : `- ${NONE}`,
    voice ? `- **رسالة صوتية:** ${voice.url}` : "",
    transcript ? `> (تفريغ آلي، قد يحتوي أخطاء) ${transcript}` : "",
    "",
    "## ملاحظات المالك والفريق",
    "",
  ]
    .filter((l, i, all) => !(l === "" && all[i - 1] === ""))
    .join("\n");
}
