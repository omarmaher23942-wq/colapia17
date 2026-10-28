// رسم صفحات المنصة العامة على الخادم فعلاً (بلا متصفح): عنوان رئيسي واحد، روابط البدء الصحيحة، وبلا أسعار ولا عبارات ممنوعة.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
  default: ({ src, alt, width, height }: { src: string; alt: string; width: number; height: number }) => <img src={src} alt={alt} width={width} height={height} />,
}));
vi.mock("@/components/InstallPrompt", () => ({ InstallPrompt: () => null }));
vi.mock("@/components/brand/ColapiaLogo", () => ({ ColapiaLogo: () => <span>Colapia</span> }));

const O = "https://colapia.com";

async function pages() {
  const { Landing } = await import("@/components/landing/Landing");
  const { AboutPage, WorkPage } = await import("@/components/landing/InfoPages");
  return {
    home: renderToStaticMarkup(<Landing session="guest" origin={O} />),
    homeClient: renderToStaticMarkup(<Landing session="merchant" origin={O} />),
    about: renderToStaticMarkup(<AboutPage session="guest" />),
    work: renderToStaticMarkup(<WorkPage session="guest" origin={O} />),
  };
}

describe("صفحات المنصة العامة", () => {
  it("عنوان رئيسي واحد في كل صفحة", async () => {
    const p = await pages();
    for (const html of [p.home, p.about, p.work]) expect((html.match(/<h1[\s>]/g) ?? []).length).toBe(1);
  });

  it("زر البدء إلى محادثة إنستجرام، ولوحة التحكم تتبع الجلسة", async () => {
    const p = await pages();
    expect(p.home).toContain('href="https://ig.me/m/colapia"');
    expect(p.home).toContain("تسجيل الدخول");
    expect(p.home).toContain("/login?redirect=/dashboard");
    expect(p.homeClient).toContain('href="/dashboard"');
    expect(p.homeClient).toContain("لوحة التحكم");
  });

  it("أقسام الرئيسية: خدمات وكيف نعمل وأعمال ولماذا وأسئلة، و8 أسئلة", async () => {
    const { home } = await pages();
    for (const id of ["services", "process", "work", "why", "faq"]) expect(home).toContain(`id="${id}"`);
    expect((home.match(/<details/g) ?? []).length).toBe(8);
  });

  it("الأعمال: لقطة Qima بأبعاد ثابتة ورابطها، وبطاقة متجر العرض برابط النطاق الفرعي", async () => {
    const { work } = await pages();
    expect(work).toContain('src="/landing/work-qima.webp"');
    expect(work).toContain('width="1200"');
    expect(work).toContain('href="https://qima-ten.vercel.app"');
    expect(work).toContain('href="https://demo.colapia.com"');
  });

  it("لا تظهر وعود المعاينة والبوابة القديمة، ويظل الديمو مميزاً عن عمل العميل", async () => {
    const p = await pages();
    for (const html of Object.values(p)) {
      const text = html.replace(/<[^>]+>/g, " ");
      for (const claim of ["تعاينون مشروعكم مجاناً", "لوحة العميل", "تتابعوا حالة المشروع", "طلبات التعديل من لوحة العميل", "ج.م", "جنيه"]) {
        expect(text, claim).not.toContain(claim);
      }
    }
    expect(p.home).toContain("ديمو توضيحي · ليس مشروع عميل");
    expect(p.home).toContain("لا اشتراك شهري إلزامي ولا استضافة مفروضة من Colapia");
  });

  it("لا مخاطبة بصيغة جنس واحد ولا عامية في الصفحات المرسومة", async () => {
    const p = await pages();
    const text = Object.values(p).join(" ").replace(/<[^>]+>/g, " ");
    for (const w of ["عايز", "عايزة", "دوّري", "جرّبي", "اختاري", "العميلة", "معاك"]) expect(text, w).not.toContain(w);
  });
});
