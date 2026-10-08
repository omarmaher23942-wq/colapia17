/**
 * تنقية CSS المخصص: يمنع التحميل الخارجي وأي شيء غير تنسيق بصري، ويحصر كل المحددات داخل .storefront
 * (بما فيها المحددات داخل @media و @supports).
 * الحذف يتكرر حتى الثبات، فالتمويه بالتداخل مثل </sty</stylele لا ينجح.
 */
const MAX_CSS = 50_000;
const ALLOWED_URL = /^\s*['"]?(?:data:image\/|https:\/\/utfs\.io\/|https:\/\/[a-z0-9-]+\.ufs\.sh\/)/i;
const KEYFRAME_SEL = /^(?:from|to|\d+(?:\.\d+)?%)(?:\s*,\s*(?:from|to|\d+(?:\.\d+)?%))*$/i;
const ROOT_SEL = /^(?:html|body|:root)$/i;

function stripUntilStable(s: string, re: RegExp): string {
  let prev: string;
  do {
    prev = s;
    s = s.replace(re, "");
  } while (s !== prev);
  return s;
}

function scopeSelectors(css: string): string {
  return css.replace(/(^|[{}])(\s*)([^{}@]+?)\s*\{/g, (_m, pre: string, ws: string, sel: string) => {
    const s = sel.trim();
    if (!s || KEYFRAME_SEL.test(s)) return `${pre}${ws}${s}{`;
    const scoped = s
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => (ROOT_SEL.test(p) ? ".storefront" : p.startsWith(".storefront") ? p : `.storefront ${p}`))
      .join(", ");
    return `${pre}${ws}${scoped}{`;
  });
}

export function sanitizeCss(input: string): string {
  let css = String(input ?? "").slice(0, MAX_CSS);
  // لا وسوم، ولا CSS escapes (تُستخدم لتمويه url و expression)
  css = css.replace(/[<\\]/g, "");
  css = css.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\*|\*\//g, "");
  css = stripUntilStable(css, /@(?:import|charset|namespace)\b[^;{}]*;?/gi);
  css = stripUntilStable(css, /expression\s*\(|behavior\s*:|-moz-binding\s*:|javascript\s*:/gi);
  css = css.replace(/url\(\s*([^)]*)\)/gi, (m, inner: string) => (ALLOWED_URL.test(inner) ? m : "url()"));
  return scopeSelectors(css);
}
