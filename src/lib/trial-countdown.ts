// trial-countdown.ts — تقسيم الوقت المتبقي لعدّاد التجربة ونطقه بالعربية لقارئ الشاشة (منطق خالص مختبَر).

export type CountdownParts = { totalMs: number; days: number; hours: number; minutes: number; seconds: number; spoken: string };

const unit = (n: number, one: string, two: string, few: string, many: string) => (n === 1 ? one : n === 2 ? two : n >= 3 && n <= 10 ? `${n} ${few}` : `${n} ${many}`);

export function countdownParts(ms: number): CountdownParts {
  const totalMs = Math.max(0, Math.floor(ms));
  const s = Math.floor(totalMs / 1000);
  const days = Math.floor(s / 86_400);
  const hours = Math.floor((s % 86_400) / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const parts = [
    days ? unit(days, "يوم", "يومان", "أيام", "يوماً") : "",
    hours ? unit(hours, "ساعة", "ساعتان", "ساعات", "ساعة") : "",
    minutes ? unit(minutes, "دقيقة", "دقيقتان", "دقائق", "دقيقة") : "",
    !days && !hours && seconds ? unit(seconds, "ثانية", "ثانيتان", "ثوانٍ", "ثانية") : "",
  ].filter(Boolean);
  return { totalMs, days, hours, minutes, seconds, spoken: parts.length ? `متبقٍ ${parts.join(" و")}` : "انتهى الوقت" };
}
