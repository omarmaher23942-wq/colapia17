import { ImageResponse } from "next/og";

export const alt = "Colapia";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** صورة المشاركة لصفحات المنصة فقط (المتاجر لها صورها من الـ Blueprint). نص لاتيني فقط لأن خط ImageResponse الافتراضي لا يدعم العربية */
export default async function OpengraphImage() {
  // الشعار من الأصول المنشورة لا من القرص (Cloudflare Workers بلا ملفات المشروع)؛ تعذّره = الصورة بالاسم وحده.
  const data = await fetch(new URL("/logo.png", process.env.NEXT_PUBLIC_APP_URL ?? "https://colapia.com"), { signal: AbortSignal.timeout(5_000) })
    .then((r) => (r.ok ? r.arrayBuffer() : null))
    .catch(() => null);
  const src = data ? `data:image/png;base64,${Buffer.from(data).toString("base64")}` : null;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "radial-gradient(circle at 50% 40%, #1a2150 0%, #07091a 65%)",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {src ? <img src={src} alt="" style={{ width: 340, height: 340, objectFit: "contain" }} /> : null}
        <div style={{ marginTop: 32, fontSize: 64, fontWeight: 800, letterSpacing: 18, color: "#eaf0ff" }}>COLAPIA</div>
      </div>
    ),
    size
  );
}
