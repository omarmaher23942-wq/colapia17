import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const alt = "Colapia";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** صورة المشاركة لصفحات المنصة فقط (المتاجر لها صورها من الـ Blueprint). نص لاتيني فقط لأن خط ImageResponse الافتراضي لا يدعم العربية */
export default async function OpengraphImage() {
  const data = await readFile(join(process.cwd(), "public", "logo.png"));
  const src = `data:image/png;base64,${data.toString("base64")}`;
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
        <img src={src} alt="" style={{ width: 340, height: 340, objectFit: "contain" }} />
        <div style={{ marginTop: 32, fontSize: 64, fontWeight: 800, letterSpacing: 18, color: "#eaf0ff" }}>COLAPIA</div>
      </div>
    ),
    size
  );
}
