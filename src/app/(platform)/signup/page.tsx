// البناء الذاتي (التسجيل ثم استمارة الخطوات الخمس) أُوقف: Colapia تبني المتجر بفريقها، والبداية الوحيدة استمارة /start.
// الكود القديم يُحذف مع تنظيف المرحلة 8 (الوكيل ما زال يصدر روابط قديمة تصل هنا فتُحوَّل).
import { redirect } from "next/navigation";

export default function Page() {
  redirect("/login");
}
