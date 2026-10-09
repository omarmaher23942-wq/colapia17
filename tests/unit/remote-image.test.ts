import { describe, expect, it } from "vitest";
import { fetchRemoteImage, isPrivateAddress, sniffImage } from "@/server/remote-image";
import { isHostedImage } from "@/lib/media-hosts";

describe("isPrivateAddress (حماية SSRF)", () => {
  it.each(["127.0.0.1", "10.2.3.4", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1", "::ffff:169.254.169.254"])(
    "%s خاص",
    (ip) => expect(isPrivateAddress(ip)).toBe(true)
  );
  it.each(["8.8.8.8", "172.32.0.1", "104.16.0.1", "2606:4700::1111"])("%s عام", (ip) => expect(isPrivateAddress(ip)).toBe(false));
  it("ما ليس عنواناً يُعامل كخاص", () => expect(isPrivateAddress("not-an-ip")).toBe(true));
});

describe("sniffImage", () => {
  const b = (...x: number[]) => new Uint8Array([...x, ...new Array(16).fill(0)]);
  const s = (str: string) => [...str].map((c) => c.charCodeAt(0));
  it("يعرف الأنواع من بايتات الملف", () => {
    expect(sniffImage(b(0xff, 0xd8, 0xff, 0xe0))?.type).toBe("image/jpeg");
    expect(sniffImage(b(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))?.type).toBe("image/png");
    expect(sniffImage(b(...s("RIFF"), 0, 0, 0, 0, ...s("WEBP")))?.type).toBe("image/webp");
    expect(sniffImage(b(...s("GIF89a")))?.type).toBe("image/gif");
    expect(sniffImage(b(0, 0, 0, 0x1c, ...s("ftypavif")))?.type).toBe("image/avif");
  });
  it("يرفض SVG وHTML وما لا يُعرف", () => {
    expect(sniffImage(b(...s("<svg xmlns")))).toBeNull();
    expect(sniffImage(b(...s("<!doctype html>")))).toBeNull();
    expect(sniffImage(new Uint8Array())).toBeNull();
  });
});

describe("fetchRemoteImage: يرفض قبل أي اتصال", () => {
  it.each([
    ["http://example.com/a.jpg", "invalid_url"],
    ["https://user:pass@example.com/a.jpg", "invalid_url"],
    ["ليس رابطاً", "invalid_url"],
    ["https://127.0.0.1/a.jpg", "blocked_host"],
    ["https://169.254.169.254/latest/meta-data", "blocked_host"],
    ["https://[::1]/a.png", "blocked_host"],
    ["https://localhost/a.png", "blocked_host"],
    ["https://printer.local/a.png", "blocked_host"],
  ])("%s ← %s", async (url, error) => {
    expect(await fetchRemoteImage(url)).toEqual({ ok: false, error });
  });
});

describe("isHostedImage", () => {
  it("صور مساحة الرفع تُعرض كما هي، وغيرها يُنقل", () => {
    expect(isHostedImage("https://utfs.io/f/abc")).toBe(true);
    expect(isHostedImage("https://x1y2.ufs.sh/f/abc")).toBe(true);
    expect(isHostedImage("https://example.com/a.jpg")).toBe(false);
    expect(isHostedImage("https://evil.com/utfs.io/a.jpg")).toBe(false);
    expect(isHostedImage("https://ufs.sh.evil.com/a.jpg")).toBe(false);
  });
});
