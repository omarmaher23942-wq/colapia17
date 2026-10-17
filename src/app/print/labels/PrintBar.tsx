"use client";

// شريط الطباعة فوق الملصقات (لا يظهر في الورقة المطبوعة).
export function PrintBar() {
  return (
    <div className="bar">
      <button type="button" onClick={() => window.print()}>
        طباعة الملصقات
      </button>
      <button type="button" onClick={() => window.close()}>
        إغلاق
      </button>
    </div>
  );
}
