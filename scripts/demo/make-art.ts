// make-art.ts — يولّد الصور البديلة (رسوم توضيحية هادئة) لمنتجات الديمو التي ليس لها صورة فوتوغرافية بعد.
// كل منتج في scripts/demo/data/fashion.json يحمل الحقل `art: { shape, tone }` متى كانت صورته بديلة؛ تُرسم له
// public/demo/fashion/<slug>-1.webp (900×1200). لاستبدال أي منها بصورة حقيقية: ضعوا ملفاً بالاسم نفسه (WebP، نسبة 3:4)
// وأزيلوا حقل `art` من المنتج في الملف. لا نص داخل الصور ولا ادعاء: هي رسم توضيحي للقطعة فقط.
//
// الاستخدام: npx tsx scripts/demo/make-art.ts
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

type Shape = "dress" | "maxi" | "shirtdress" | "abaya" | "abayaopen" | "blouse" | "shirt" | "knit" | "cardigan" | "trousers" | "skirt" | "set" | "scarf";
type Art = { shape: Shape; tone: string };
type Item = { slug: string; art?: Art };

const W = 900;
const H = 1200;

// ─── ألوان ──────────────────────────────────────────────────────────────

const hex = (c: string): [number, number, number] => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
const toHex = (r: number, g: number, b: number) => `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("")}`;
/** مزج لونين (t من 0 إلى 1 نحو الثاني). */
const mix = (a: string, b: string, t: number) => {
  const [x, y] = [hex(a), hex(b)];
  return toHex(x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t);
};
const luma = (c: string) => {
  const [r, g, b] = hex(c);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
};

// ─── الأشكال: مسارات SVG لقطعة معلّقة في وسط اللوحة (x=450) ─────────────────

const SHAPES: Record<Shape, { body: string; detail?: string }> = {
  dress: {
    body: "M392 300 Q450 372 508 300 L556 312 L566 470 L542 520 L650 960 Q450 1020 250 960 L358 520 L334 470 L344 312 Z",
    detail: "M358 520 Q450 548 542 520",
  },
  maxi: {
    body: "M392 300 Q450 372 508 300 L558 316 L600 560 L560 600 L690 1090 Q450 1150 210 1090 L340 600 L300 560 L342 316 Z",
    detail: "M340 600 Q450 628 560 600",
  },
  shirtdress: {
    body: "M380 292 L450 340 L520 292 L572 312 L592 470 L560 520 L640 940 Q450 990 260 940 L340 520 L308 470 L328 312 Z",
    detail: "M450 340 L450 960 M340 520 Q450 548 560 520",
  },
  abaya: {
    body: "M394 296 Q450 340 506 296 L566 318 L740 820 L668 850 L596 520 L616 1120 L284 1120 L304 520 L232 850 L160 820 L334 318 Z",
    detail: "M450 340 L450 1120",
  },
  abayaopen: {
    body: "M394 296 Q450 340 506 296 L566 318 L740 820 L668 850 L596 520 L616 1120 L284 1120 L304 520 L232 850 L160 820 L334 318 Z",
    detail: "M432 338 L404 1120 M468 338 L496 1120",
  },
  blouse: {
    body: "M390 300 Q450 352 510 300 L586 330 L676 560 L612 590 L574 480 L580 760 L320 760 L326 480 L288 590 L224 560 L314 330 Z",
    detail: "M390 300 Q450 352 510 300",
  },
  shirt: {
    body: "M380 296 L450 344 L520 296 L592 326 L688 600 L624 628 L580 520 L588 880 L312 880 L320 520 L276 628 L212 600 L308 326 Z",
    detail: "M450 344 L450 880 M380 296 L420 372 M520 296 L480 372",
  },
  knit: {
    body: "M394 300 Q450 360 506 300 L580 322 L664 600 L602 626 L576 520 L584 800 L316 800 L324 520 L298 626 L236 600 L320 322 Z",
    detail: "M326 560 L574 560 M322 620 L578 620 M320 680 L580 680 M318 740 L582 740",
  },
  cardigan: {
    body: "M388 298 L450 372 L512 298 L586 326 L672 610 L608 638 L580 530 L588 840 L312 840 L320 530 L292 638 L228 610 L314 326 Z",
    detail: "M450 372 L450 840 M450 440 L462 440 M450 520 L462 520 M450 600 L462 600 M450 680 L462 680",
  },
  trousers: {
    body: "M350 300 L550 300 L566 420 L640 1110 L506 1110 L450 520 L394 1110 L260 1110 L334 420 Z",
    detail: "M350 340 L550 340 M450 340 L450 520",
  },
  skirt: {
    body: "M360 300 L540 300 L548 380 L680 1010 Q450 1060 220 1010 L352 380 Z",
    detail: "M395 380 L300 1030 M450 380 L450 1045 M505 380 L600 1030 M345 380 L235 1010 M555 380 L665 1010",
  },
  set: {
    body: "M394 270 Q450 320 506 270 L572 292 L636 470 L586 492 L562 410 L566 580 L334 580 L338 410 L314 492 L264 470 L328 292 Z M352 610 L548 610 L560 700 L616 1130 L504 1130 L450 790 L396 1130 L284 1130 L340 700 Z",
    detail: "M352 640 L548 640",
  },
  scarf: {
    body: "M450 250 L690 560 Q705 600 680 640 L470 930 Q450 950 430 930 L220 640 Q195 600 210 560 Z",
    detail: "M450 250 L450 950 M300 410 L600 770 M600 410 L300 770",
  },
};

// ─── المشهد ─────────────────────────────────────────────────────────────

function sceneSvg(art: Art): string {
  const tone = art.tone;
  const dark = luma(tone) < 0.35;
  // خلفية دافئة هادئة تتبع لون القطعة (لا تطابقه): عاجي مائل لدرجته، والقطع الفاتحة على خلفية أدفأ وأغمق قليلاً.
  const bgTop = mix("#f7f2ea", tone, dark ? 0.1 : 0.16);
  const bgBottom = mix("#e7dccb", tone, dark ? 0.2 : 0.3);
  const base = tone;
  const light = mix(tone, "#ffffff", 0.22);
  const shade = mix(tone, "#000000", 0.28);
  const line = mix(tone, dark ? "#ffffff" : "#000000", dark ? 0.28 : 0.2);
  const hanger = mix("#8a7a66", bgBottom, 0.2);
  const { body, detail } = SHAPES[art.shape];
  const hangs = art.shape !== "scarf";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${bgTop}"/><stop offset="1" stop-color="${bgBottom}"/></linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.38" r="0.6"><stop offset="0" stop-color="#ffffff" stop-opacity="0.55"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></radialGradient>
    <linearGradient id="fab" x1="0" y1="0" x2="1" y2="0.2"><stop offset="0" stop-color="${light}"/><stop offset="0.45" stop-color="${base}"/><stop offset="1" stop-color="${shade}"/></linearGradient>
    <pattern id="weave" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><rect width="6" height="6" fill="none"/><line x1="0" y1="0" x2="0" y2="6" stroke="#000" stroke-opacity="0.045" stroke-width="2"/></pattern>
    <filter id="soft" x="-20%" y="-20%" width="140%" height="150%"><feGaussianBlur stdDeviation="22"/></filter>
    <clipPath id="g"><path d="${body}"/></clipPath>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
  <ellipse cx="450" cy="1128" rx="250" ry="26" fill="#000" fill-opacity="0.16" filter="url(#soft)"/>
  ${
    hangs
      ? `<g fill="none" stroke="${hanger}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"><path d="M450 214 Q450 188 472 184 Q494 180 494 158 Q494 130 450 130"/><path d="M450 214 L330 292 L570 292 Z" stroke-width="6"/></g>`
      : ""
  }
  <g>
    <path d="${body}" fill="#000" fill-opacity="0.2" transform="translate(14 18)" filter="url(#soft)"/>
    <path d="${body}" fill="url(#fab)"/>
    <path d="${body}" fill="url(#weave)"/>
    <g clip-path="url(#g)"><path d="M0 0 H${W} V${H} H0 Z" fill="none"/><ellipse cx="400" cy="560" rx="150" ry="520" fill="#fff" fill-opacity="${dark ? 0.07 : 0.14}" transform="rotate(8 400 560)"/></g>
    <path d="${body}" fill="none" stroke="${line}" stroke-opacity="0.55" stroke-width="3" stroke-linejoin="round"/>
    ${detail ? `<path d="${detail}" fill="none" stroke="${line}" stroke-opacity="0.6" stroke-width="3" stroke-linecap="round"/>` : ""}
  </g>
</svg>`;
}

async function main() {
  const root = process.cwd();
  const items = JSON.parse(readFileSync(join(root, "scripts/demo/data/fashion.json"), "utf8")) as Item[];
  const out = join(root, "public/demo/fashion");
  mkdirSync(out, { recursive: true });
  let n = 0;
  for (const p of items) {
    if (!p.art) continue;
    let q = 80;
    let buf = await sharp(Buffer.from(sceneSvg(p.art))).webp({ quality: q }).toBuffer();
    while (buf.length > 110_000 && q > 40) {
      q -= 8;
      buf = await sharp(Buffer.from(sceneSvg(p.art))).webp({ quality: q }).toBuffer();
    }
    writeFileSync(join(out, `${p.slug}-1.webp`), buf);
    n++;
  }
  console.log(`✓ ${n} صورة بديلة في public/demo/fashion`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
