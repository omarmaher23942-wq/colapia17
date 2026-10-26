// patches.ts — تعديلات نصية دقيقة على ملفات المنصة وقت التوليد (حين لا يستحق الأمر نسخة overlay كاملة من الملف).
//
// كل تعديل يجب أن يطابق مرة واحدة على الأقل، وإلا يفشل التوليد بصخب: هكذا لا يتغير ملف المنصة صامتاً فيصل
// إلى العميل معطوباً. الأولوية دائماً لتعديل المنصة نفسها بنقطة تمديد صغيرة؛ هذه آخر الحلول.
export type Patch =
  | { path: string; find: string | RegExp; replace: string; why: string }
  /** حذف كل سطر يطابق النمط. */
  | { path: string; dropLines: RegExp; why: string };

export function applyPatches(path: string, code: string, patches: Patch[] = PATCHES): string {
  let out = code;
  for (const p of patches) {
    if (p.path !== path) continue;
    if ("dropLines" in p) {
      const lines = out.split("\n");
      const kept = lines.filter((l) => !p.dropLines.test(l));
      if (kept.length === lines.length) throw new Error(`patch لم يطابق: ${path} (${p.why})`);
      out = kept.join("\n");
    } else {
      const hit = typeof p.find === "string" ? out.includes(p.find) : new RegExp(p.find.source, p.find.flags.replace("g", "")).test(out);
      if (!hit) throw new Error(`patch لم يطابق: ${path} (${p.why})`);
      // نص صريح: بلا توسيع لرموز $ ؛ تعبير نمطي: يُوسَّع $1 للمجموعات الملتقَطة (تجنّبوا $& و$' في النص البديل).
      out = typeof p.find === "string" ? out.replace(p.find, () => p.replace) : out.replace(p.find, p.replace);
    }
  }
  return out;
}

/** الجملة الوحيدة في الإعداد الأول (لا تتكرر في أي خطوة أخرى). */
export const ONBOARDING_CAPTION = "كل ما تضبطونه هنا يمكن تغييره لاحقاً من لوحة التحكم.";

const MEDIA_TAIL = `/** عنوان الصور العام (ImageKit): من IMAGEKIT_URL_ENDPOINT، أو null إن لم يُضبط. */
export function mediaBaseUrl(): string | null {
  const raw = (process.env.IMAGEKIT_URL_ENDPOINT || process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT || "").trim().replace(/\\/+$/, "");
  try {
    const u = new URL(raw);
    return u.protocol === "https:" ? u.origin + u.pathname.replace(/\\/+$/, "") : null;
  } catch {
    return null;
  }
}

/** هل المضيف مساحة صور المشروع (ImageKit)؟ الافتراضي ik.imagekit.io يكفي دون ضبط متغير في المتصفح. */
export function isMediaHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "ik.imagekit.io" || h.endsWith(".imagekit.io")) return true;
  const base = mediaBaseUrl();
  return Boolean(base && new URL(base).hostname === h);
}

/** لا مفاتيح R2 للصور في مشروعك (الصور على ImageKit). */
export function r2KeyFromUrl(_url: string): string | null {
  return null;
}
`;

const STORE_URL = `export function storeUrl(_subdomain: string, path = "") {
  const suffix = !path ? "" : path.startsWith("/") ? path : \`/\${path}\`;
  const base = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || (typeof window !== "undefined" ? window.location.origin : "")).replace(/\\/+$/, "");
  return \`\${base}\${suffix}\`;
}
`;

const READ_STORE = `async function readStore(sub: string): Promise<TenantStore | null> {
  try {
    const [row] = await db
      .select()
      .from(stores)
      .where(and(eq(stores.subdomain, sub), isNull(stores.deletedAt)))
      .limit(1);
    return row ?? null;
  } catch {
    // قاعدة غير مربوطة أو لم تُجهَّز بعد: صفحة /setup تشرح الحال.
    return null;
  }
}
`;

/** نطاق موقع العميل نفسه يُعدّ إحالة داخلية في التحليلات (بدل نطاق المنصة). */
const INTERNAL_REFERRER_CODE = `const OWN_HOST = (() => {
  try {
    return new URL(process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "").hostname.replace(/^www\\./, "").replace(/\\./g, "\\\\.");
  } catch {
    return "localhost";
  }
})();
const INTERNAL_REFERRER = \`^https?://([a-z0-9-]+\\\\.)*(\${OWN_HOST}|localhost)(:[0-9]+)?(/|$)\`;`;

export const PATCHES: Patch[] = [
  // ─── قاعدة البيانات: جداول المشروع وحدها ───
  { path: "src/db/schema/stores.ts", find: 'import { merchants, platformUsers } from "./platform";', replace: 'import { merchants } from "./platform";', why: "لا مستخدمو منصة" },
  { path: "src/db/schema/stores.ts", find: 'reviewedBy: uuid("reviewed_by").references(() => platformUsers.id),', replace: 'reviewedBy: uuid("reviewed_by"),', why: "عمود مراجعة بلا مفتاح أجنبي" },
  {
    path: "src/db/schema/catalog.ts",
    find: 'import type { IntakeOptionDef } from "./ai";',
    replace: 'type IntakeOptionDef = { name: string; kind: "color" | "size" | "custom"; values: { label: string; hex?: string; described?: string }[] };',
    why: "نوع خيارات المنتج بلا جداول الوكيل",
  },
  // ─── الصور: ImageKit بدل R2/UploadThing ───
  { path: "src/lib/media.ts", find: /const rootDomain = [\s\S]*$/, replace: MEDIA_TAIL, why: "مضيف الصور ImageKit" },
  {
    path: "src/server/repos/products-list.ts",
    find: "utfs\\\\.io|[a-z0-9-]+\\\\.ufs\\\\.sh",
    replace: "ik\\\\.imagekit\\\\.io|[a-z0-9-]+\\\\.imagekit\\\\.io",
    why: "الصور المستضافة = ImageKit",
  },
  {
    path: "src/app/api/upload/route.ts",
    find: 'return fail("رفع الملفات غير متاح مؤقتاً. حاولوا بعد قليل.", 503);',
    replace: 'return fail("رفع الصور غير مفعّل بعد: أضيفوا مفاتيح ImageKit من لوحة التحكم ← الربط والمفاتيح.", 503);',
    why: "رسالة صريحة لغياب ImageKit",
  },
  {
    path: "src/app/api/upload/route.ts",
    find: 'isVideo ? "تعذر حفظ الفيديو. حاولوا مرة أخرى."',
    replace: 'isVideo ? "تعذر حفظ الفيديو. تأكدوا من ربط حاوية الفيديو (MEDIA) في Cloudflare ثم حاولوا مرة أخرى."',
    why: "رسالة صريحة لغياب حاوية الفيديو",
  },
  // ─── رابط المتجر: موقع العميل نفسه ───
  { path: "src/lib/utils.ts", find: /export function storeUrl\(subdomain: string, path = ""\) \{[\s\S]*?\n\}\n/, replace: STORE_URL, why: "رابط المتجر = موقع العميل" },
  { path: "src/lib/utils.ts", find: 'if (store.customDomain && store.customDomainStatus === "active") {', replace: "if (false as boolean) {", why: "لا نطاق خاص منفصل: موقع العميل هو نطاقه" },
  // ─── المتجر الواحد: بلا إعداد = صفحة /setup ───
  { path: "src/lib/tenant.ts", find: /async function readStore\(sub: string\): Promise<TenantStore \| null> \{[\s\S]*?\n\}\n/, replace: READ_STORE, why: "قاعدة غير مجهزة = إعداد أول" },
  { path: "src/lib/tenant.ts", find: "  if (!store) notFound();\n  if (!opts.allowHidden", replace: '  if (!store) redirect("/setup");\n  if (!opts.allowHidden', why: "متجر غير موجود بعد = /setup" },
  { path: "src/lib/tenant.ts", find: 'import { notFound } from "next/navigation";', replace: 'import { notFound, redirect } from "next/navigation";', why: "redirect" },
  // ─── بوابة العميل وجداول الوكالة تخص المنصة وحدها ───
  { path: "src/app/(platform)/dashboard/page.tsx", dropLines: /import \{ ClientHome \} from "@\/components\/client\/ClientHome";/, why: "بوابة العميل للمنصة" },
  { path: "src/app/(platform)/dashboard/page.tsx", dropLines: /if \(!session\.store\) return <ClientHome /, why: "بوابة العميل للمنصة" },
  { path: "src/db/schema/commerce.ts", dropLines: /import \{ editRequests, storeRequests \} from "\.\/agency";/, why: "لا جداول وكالة" },
  { path: "src/db/schema/commerce.ts", find: /requestId: uuid\("request_id"\)\.references\(\(\) => storeRequests\.id, \{ onDelete: "cascade" \}\),/, replace: 'requestId: uuid("request_id"),', why: "لا جداول وكالة" },
  { path: "src/db/schema/commerce.ts", find: /editRequestId: uuid\("edit_request_id"\)\.references\(\(\) => editRequests\.id, \{ onDelete: "cascade" \}\),/, replace: 'editRequestId: uuid("edit_request_id"),', why: "لا جداول وكالة" },
  // ─── ما يخص المنصة وحدها ───
  { path: "src/components/dashboard/settings/SettingsPage.tsx", dropLines: /import \{ SubdomainSection \} from "\.\/SubdomainSection";/, why: "لا نطاق فرعي على المنصة" },
  { path: "src/components/dashboard/settings/SettingsPage.tsx", dropLines: /<SubdomainSection \/>/, why: "لا نطاق فرعي على المنصة" },
  // قائمة اللوحة: بلا صفحات الاشتراك والنطاق والفريق وطلبات الفريق (تخص المنصة وحدها).
  { path: "src/components/dashboard/nav.ts", dropLines: /href: "\/dashboard\/(store|domain|team|billing|requests)"/, why: "صفحات المنصة" },
  { path: "src/components/dashboard/nav.ts", find: 'title: "الإعدادات والاشتراك"', replace: 'title: "الإعدادات"', why: "لا اشتراك" },
  { path: "src/components/dashboard/nav.ts", find: "  Wand2,\n  type LucideIcon,", replace: "  Wand2,\n  Plug,\n  type LucideIcon,", why: "أيقونة الربط" },
  {
    path: "src/components/dashboard/nav.ts",
    find: /(\n\s*\{ label: "أسعار الشحن", href: "\/dashboard\/shipping"[^\n]*\},)/,
    replace: '$1\n      { label: "الربط والمفاتيح", href: "/dashboard/integrations", icon: Plug, hint: "حالة الخدمات المربوطة ومفتاح الميزات الذكية", keywords: ["integrations", "groq", "imagekit", "مفاتيح", "ربط"] },',
    why: "صفحة الربط والمفاتيح",
  },
  // ─── هوية العميل بدل هوية المنصة في النصوص التي يراها ───
  { path: "src/components/storefront/FrozenGate.tsx", find: 'href="https://colapia.com/dashboard/setup"', replace: 'href="/dashboard"', why: "رابط صاحب المتجر لموقعه" },
  { path: "src/components/onboarding/OnboardingApp.tsx", find: 'text-ink">Colapia</span>', replace: 'text-ink">إعداد المتجر</span>', why: "لا اسم المنصة في رأس الإعداد" },
  { path: "src/app/(platform)/dashboard/error.tsx", find: 'href="mailto:support@colapia.com"', replace: 'href="{{AGENCY_URL}}"', why: "الدعم عبر رابط الوكالة" },
  { path: "src/app/(platform)/dashboard/error.tsx", find: "تواصل مع فريق Colapia", replace: "طلب مساعدة من فريق التنفيذ", why: "نص الدعم" },
  { path: "src/app/error.tsx", find: 'href="mailto:support@colapia.com"', replace: 'href="{{AGENCY_URL}}"', why: "الدعم عبر رابط الوكالة" },
  { path: "src/blueprint/registry-meta.ts", find: "مكوّن صممه فريق Colapia لمتجرك وحده", replace: "مكوّن مخصص لمتجرك وحده", why: "نص عام" },
  { path: "src/server/repos/analytics.ts", find: /const INTERNAL_REFERRER = "[^"]*";/, replace: INTERNAL_REFERRER_CODE, why: "الإحالة الداخلية = موقع العميل" },
  // ─── البريد: من نطاق العميل واسم متجره، بلا تتبع منصة ولا قالب «المتجر جاهز» ───
  { path: "src/lib/email-templates/_layout.tsx", find: /brand\.poweredByColapia !== false/g, replace: "false", why: "لا علامة المنصة في البريد" },
  { path: "src/lib/email-templates/GenericEmail.tsx", find: "poweredByColapia: true,", replace: "poweredByColapia: false,", why: "لا علامة المنصة في البريد" },
  { path: "src/lib/email-templates/GenericEmail.tsx", find: "footerNote={`تم الإرسال تلقائياً من منصة Colapia.`}", replace: "footerNote={`تم الإرسال تلقائياً من ${storeName}.`}", why: "تذييل باسم المتجر" },
  { path: "src/lib/email-templates/NewOrderMerchantEmail.tsx", find: 'brand={"colapia" as any}', replace: "brand={{ storeName, poweredByColapia: false }}", why: "هوية المتجر" },
  { path: "src/lib/email-templates/NewOrderMerchantEmail.tsx", find: " على Colapia.`", replace: ".`", why: "تذييل بلا اسم المنصة" },
  { path: "src/lib/email.ts", find: 'import { systemEvents } from "@/db/schema";', replace: 'import { systemEvents } from "@/db/schema";\nimport { STORE } from "@/store.config";', why: "اسم المتجر" },
  { path: "src/lib/email.ts", find: 'storeName: opts.storeName ?? "Colapia",', replace: "storeName: opts.storeName ?? STORE.name,", why: "اسم المتجر" },
  { path: "src/lib/email.ts", find: "const shouldTrack = opts.tracking !== false && !opts.idempotencyKey;", replace: "const shouldTrack = false; // لا مسارات تتبع بريد في مشروعك", why: "لا تتبع بريد" },
  { path: "src/lib/email.ts", find: /export async function sendMerchantStoreReadyEmail[\s\S]*?\n\}\n/, replace: "", why: "بريد «متجرك جاهز» يخص المنصة" },
  { path: "src/lib/email-sender.ts", find: 'export const FALLBACK_DOMAIN = "colapia.com";', replace: 'export const FALLBACK_DOMAIN = "example.com";', why: "بلا نطاق المنصة" },
  { path: "src/lib/email-sender.ts", find: '|| cleanName(parsed.name) || "Colapia";', replace: '|| cleanName(parsed.name) || "المتجر";', why: "بلا اسم المنصة" },
  // ─── الإعداد الأول: النشر = تفعيل المتجر مباشرة (بلا تجربة ولا دفع) ───
  { path: "src/server/actions/setup.ts", dropLines: /import \{ startTrial \} from "@\/ai\/lifecycle\/deliver";/, why: "لا تجربة مجانية" },
  {
    path: "src/server/actions/setup.ts",
    find: "const t = await startTrial(s.storeId, `merchant:${s.merchantId}`);",
    replace:
      'const t = await db.update(stores).set({ status: "active", activatedAt: new Date(), updatedAt: new Date() }).where(and(eq(stores.id, s.storeId), eq(stores.status, "setup"))).returning({ id: stores.id }).then((r) => ({ ok: r.length > 0 }));',
    why: "النشر يفعّل المتجر",
  },
  // ─── جملة واحدة في الإعداد: كل ما يُضبط يمكن تغييره لاحقاً (بلا تكرار) ───
  {
    path: "src/components/onboarding/ui.tsx",
    find: '<p className="mt-1.5 max-w-prose text-[13px] leading-6 text-ink-3">{why}</p>',
    replace: `<p className="mt-1.5 max-w-prose text-[13px] leading-6 text-ink-3">{why}</p>\n      {index === 1 ? <p className="mt-2 max-w-prose text-[12.5px] font-bold leading-6 text-nova-2">${ONBOARDING_CAPTION}</p> : null}`,
    why: "جملة واحدة في أول خطوة",
  },
  { path: "src/components/onboarding/StepPublish.tsx", dropLines: /يمكنكم تعديل كل ما أعددتموه لاحقاً من لوحة التحكم\./, why: "تكرار الجملة" },
  { path: "src/components/onboarding/TemplatePicker.tsx", find: " يمكنكم تغيير أي شيء بعده.", replace: "", why: "تكرار الجملة" },
];
