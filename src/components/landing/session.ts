// حالة الجلسة للهبوط: فحص وجود كوكي فقط بلا قاعدة بيانات، لتبقى الصفحة سريعة (الأمان الفعلي في middleware
// وفي صفحات /dashboard التي تتحقق من الجلسة). الكوكي موجود = «client» فيظهر زر لوحة التحكم بدل تسجيل الدخول.
import { cookies } from "next/headers";
import type { SessionState } from "./types";

export async function getSessionState(): Promise<SessionState> {
  const token = (await cookies()).get("clp_m")?.value;
  return token && token.length >= 20 ? "merchant" : "guest";
}
