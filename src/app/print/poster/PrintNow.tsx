"use client";

// شريط الطباعة فوق الملصق (لا يظهر في الورقة المطبوعة).
export function PrintNow() {
  return (
    <div className="bar">
      <button type="button" onClick={() => window.print()}>
        اطبع الملصق
      </button>
      <button type="button" onClick={() => window.close()}>
        إغلاق
      </button>
    </div>
  );
}
