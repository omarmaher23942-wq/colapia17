// order-notify.ts — إشعارات المتصفح للطلبات الجديدة (Notification API) بتفضيل محفوظ على الجهاز.
// حدود صريحة: تصل ولوحة التحكم مفتوحة في أي تبويب (حتى لو خلفية)، ولا تصل والمتصفح مغلق أو التبويب مغلق،
// ولا تعمل على المتصفحات التي تحجب الإشعارات (مثل بعض متصفحات الموبايل). الإذن يطلبه المتصفح بضغطة من المستخدم فقط.
const KEY = "clp_notif_on";

export type NotifyState = "unsupported" | "denied" | "off" | "on" | "default";

export function notifyState(): NotifyState {
  if (typeof window === "undefined" || typeof Notification === "undefined") return "unsupported";
  if (Notification.permission === "denied") return "denied";
  try {
    if (Notification.permission === "granted") return localStorage.getItem(KEY) === "0" ? "off" : "on";
  } catch {
    /* التخزين غير متاح */
  }
  return Notification.permission === "granted" ? "on" : "default";
}

/** يطلب الإذن (من ضغطة مستخدم) ويفعّل التفضيل. */
export async function enableNotify(): Promise<NotifyState> {
  if (typeof Notification === "undefined") return "unsupported";
  const p = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
  try {
    localStorage.setItem(KEY, p === "granted" ? "1" : "0");
  } catch {
    /* ignore */
  }
  return notifyState();
}

export function disableNotify(): NotifyState {
  try {
    localStorage.setItem(KEY, "0");
  } catch {
    /* ignore */
  }
  return notifyState();
}

/** يعرض إشعاراً إن كان مفعّلاً. `force` لزر التجربة. */
export function showOrderNotification(title: string, body: string, opts?: { force?: boolean; href?: string }): void {
  if (notifyState() !== "on") return;
  if (!opts?.force && typeof document !== "undefined" && !document.hidden) return; // التبويب ظاهر: يكفيه الصوت والتنبيه داخل اللوحة
  try {
    const n = new Notification(title, { body, tag: "clp-order", dir: "rtl", lang: "ar" });
    n.onclick = () => {
      window.focus();
      if (opts?.href) window.location.assign(opts.href);
      n.close();
    };
  } catch {
    /* بعض المتصفحات تمنع الإنشاء المباشر */
  }
}
