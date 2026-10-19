// أداة لمرة واحدة: تولّد أيقونات التطبيق من شعار المنصة. التشغيل: node scripts/assets/make-pwa-icons.mjs
import sharp from "sharp";
const SRC = "public/logo.png";
const BG = { r: 7, g: 9, b: 26, alpha: 1 };
const CLEAR = { r: 0, g: 0, b: 0, alpha: 0 };
const resize = (n) => sharp(SRC).resize(n, n, { fit: "contain", background: CLEAR });
await resize(192).png({ compressionLevel: 9 }).toFile("public/icons/icon-192.png");
await resize(512).png({ compressionLevel: 9 }).toFile("public/icons/icon-512.png");
await resize(180).flatten({ background: BG }).png({ compressionLevel: 9 }).toFile("public/icons/apple-icon.png");
// maskable: الشعار داخل المنطقة الآمنة (٦٦٪ من الضلع) فوق لون الهوية.
const inner = await sharp(SRC).resize(338, 338, { fit: "contain", background: CLEAR }).png().toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 4, background: BG } })
  .composite([{ input: inner, gravity: "center" }])
  .png({ compressionLevel: 9 })
  .toFile("public/icons/icon-maskable-512.png");
