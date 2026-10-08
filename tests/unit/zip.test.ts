import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { buildZip, crc32 } from "@/lib/zip";

describe("zip writer", () => {
  it("computes the standard CRC-32", () => {
    expect(crc32(Buffer.from("123456789"))).toBe(0xcbf43926);
  });

  it("produces an archive a standard reader can open", async () => {
    const big = "متجر ".repeat(2000);
    const buf = buildZip([
      { path: "README-AR.md", data: "# متجري\nأهلاً" },
      { path: "src/app/page.tsx", data: big },
      { path: "public/x.bin", data: new Uint8Array([0, 1, 2, 255]) },
    ]);
    const zip = await JSZip.loadAsync(buf);
    expect(Object.keys(zip.files).sort()).toEqual(["README-AR.md", "public/x.bin", "src/app/page.tsx"]);
    expect(await zip.file("README-AR.md")!.async("string")).toBe("# متجري\nأهلاً");
    expect(await zip.file("src/app/page.tsx")!.async("string")).toBe(big);
    expect(Array.from(await zip.file("public/x.bin")!.async("uint8array"))).toEqual([0, 1, 2, 255]);
  });
});
