// reveal-error.ts — لا خطأ صامت في أي استمارة.
// بعد أي تحقق فاشل نستدعي revealFirstError: ننتظر رسم الأخطاء، ثم نمرّر الشاشة إلى أول حقل خاطئ
// (بترتيب ظهوره في الصفحة)، ونضع المؤشر فيه، ونهزّه هزة خفيفة حتى تراه العين فوراً، على أي شاشة.
// يعتمد على علامتين يضعهما كل حقل: aria-invalid="true" على المدخل، وdata-invalid="true" على رسالة الخطأ.

const SELECTOR = '[aria-invalid="true"], [data-invalid="true"]';
const FOCUSABLE = "input:not([type=hidden]), select, textarea, button, [tabindex]:not([tabindex='-1'])";

export function revealFirstError(root?: ParentNode | null, attempt = 0): void {
  if (typeof window === "undefined") return;
  // إطاران: الأول لتطبيق setState (فتح بطاقة أو تغيير خطوة)، والثاني لرسم الرسائل.
  // ومؤقت احتياطي: المتصفح يوقف requestAnimationFrame في التبويبات والنوافذ غير الظاهرة.
  afterPaint(() => {
    const scope = root ?? document;
    const el = scope.querySelector<HTMLElement>(SELECTOR);
    if (!el) {
      // قد تُرسم المحطة بحركة دخول؛ نعيد المحاولة قليلاً قبل الاستسلام.
      if (attempt < 6) setTimeout(() => revealFirstError(root, attempt + 1), 80);
      return;
    }
    // المدخل نفسه إن كان هو الخاطئ، وإلا أقرب مدخل في نفس الحقل.
    const field = el.closest<HTMLElement>("[data-field], .space-y-2, li, section") ?? el;
    const target = el.matches(FOCUSABLE) ? el : field.querySelector<HTMLElement>(`${FOCUSABLE}[aria-invalid="true"]`) ?? field.querySelector<HTMLElement>(FOCUSABLE);
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    field.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
    target?.focus({ preventScroll: true });
    if (!reduce && typeof field.animate === "function") {
      field.animate(
        [{ transform: "translateX(0)" }, { transform: "translateX(-6px)" }, { transform: "translateX(6px)" }, { transform: "translateX(-3px)" }, { transform: "translateX(0)" }],
        { duration: 360, easing: "ease-out" }
      );
    }
  });
}

function afterPaint(fn: () => void) {
  let done = false;
  const run = () => {
    if (done) return;
    done = true;
    fn();
  };
  requestAnimationFrame(() => requestAnimationFrame(run));
  setTimeout(run, 120);
}
