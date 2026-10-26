/** ألوان صفحات الحجز (/golden وما تحتها): داكنة افتراضياً وتتبع تفضيل الجهاز للفاتح. متغيرات محصورة في .gld. */
export const GLD_CSS = `
.gld{--g-bg:#07091a;--g-fg:#eaf0ff;--g-card:#0b0f2a;--g-line:rgba(255,255,255,.12);--g-muted:#a9b3dc;--g-accent:#6f86ff;--g-on-accent:#07091a;--g-ok:#34d399;--g-warn:#fbbf24;--g-bad:#fb7185;--g-input:#07091a;background:var(--g-bg);color:var(--g-fg)}
@media (prefers-color-scheme: light){.gld{--g-bg:#f6f7fb;--g-fg:#10142e;--g-card:#ffffff;--g-line:rgba(16,20,46,.14);--g-muted:#4a5278;--g-accent:#3b52e0;--g-on-accent:#ffffff;--g-ok:#047857;--g-warn:#a16207;--g-bad:#be123c;--g-input:#ffffff}}
`;
