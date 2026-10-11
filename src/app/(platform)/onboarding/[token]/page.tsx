// البناء الذاتي (التسجيل ثم استمارة الخطوات الخمس) أُوقف: Colapia تبني المتجر بفريقها، والبداية الوحيدة استمارة /start.
// حُذف الكود القديم (المرحلة 8)؛ يبقى هذا التحويل لروابط قديمة أُرسلت قبل التحويل.
import { redirect } from "next/navigation";

export default function Page() {
  redirect("/start");
}
