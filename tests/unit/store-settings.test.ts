import { describe, expect, it } from "vitest";
import { cleanFacebook, cleanInstagram, cleanInstapay, draftFrom, validateSettings, type SettingsDraft } from "@/lib/store-settings";

const base: SettingsDraft = {
  cod: true,
  vodafone: { enabled: false, number: "", holder: "" },
  instapay: { enabled: false, target: "", holder: "" },
  requireTransferProof: true,
  transferInstructions: "",
  whatsapp: "",
  phone: "",
  email: "",
  instagram: "",
  facebook: "",
  acceptingOrders: true,
  vacationMessage: "",
};

describe("إعدادات المتجر", () => {
  it("لا يُحفظ متجر بلا أي وسيلة دفع", () => {
    const r = validateSettings({ ...base, cod: false });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.payments).toMatch(/وسيلة دفع/);
  });

  it("فودافون كاش مفعّل يتطلب رقماً صحيحاً، ويطبّع الصيغ الشائعة", () => {
    const empty = validateSettings({ ...base, vodafone: { enabled: true, number: "", holder: "" } });
    expect(empty.ok).toBe(false);
    const bad = validateSettings({ ...base, vodafone: { enabled: true, number: "0123", holder: "" } });
    expect(bad.ok).toBe(false);
    const ok = validateSettings({ ...base, vodafone: { enabled: true, number: "+20 ١٠١ ٢٣٤ ٥٦٧٨", holder: " أحمد م. " } });
    expect(ok.ok && ok.data.payments.vodafoneCash).toEqual({ enabled: true, number: "01012345678", holderName: "أحمد م." });
  });

  it("إنستاباي برقم أو عنوان name@instapay", () => {
    expect(cleanInstapay("Nova.Store@InstaPay")).toEqual({ address: "nova.store@instapay" });
    expect(cleanInstapay("01112345678")).toEqual({ number: "01112345678" });
    expect(cleanInstapay("nova@gmail.com")).toBeNull();
    const r = validateSettings({ ...base, instapay: { enabled: true, target: "nova@instapay", holder: "" } });
    expect(r.ok && r.data.payments.instapay.address).toBe("nova@instapay");
  });

  it("قنوات التواصل تُنظَّف: @ والروابط والأرقام", () => {
    expect(cleanInstagram("@Nova.Style")).toBe("nova.style");
    expect(cleanInstagram("https://www.instagram.com/nova.style/?hl=ar")).toBe("nova.style");
    expect(cleanInstagram("نوفا")).toBeNull();
    expect(cleanFacebook("facebook.com/novastyle")).toBe("https://facebook.com/novastyle");
    expect(cleanFacebook("https://evil.com/facebook.com")).toBeNull();
    const r = validateSettings({ ...base, whatsapp: "010 1234 5678", email: " Hello@Nova.COM ", instagram: "@nova", facebook: "" });
    expect(r.ok && r.data.channels).toEqual({ whatsappNumber: "01012345678", phone: undefined, email: "hello@nova.com", instagramUsername: "nova", facebookUrl: undefined });
  });

  it("رقم واتساب غير مصري يُرفض بحقله", () => {
    const r = validateSettings({ ...base, whatsapp: "12345" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors)).toEqual(["whatsapp"]);
  });

  it("المسودة من المحفوظ ثم التحقق تعيد نفس القيم", () => {
    const d = draftFrom(
      {
        payments: { cod: { enabled: true }, vodafoneCash: { enabled: true, number: "01012345678", holderName: "سارة" }, instapay: { enabled: false, address: "s@instapay" }, requireTransferProof: false, transferInstructions: "اكتب رقم الطلب" },
        channels: { whatsappNumber: "01112345678", instagramUsername: "nova" },
      },
      { acceptingOrders: false, vacationMessage: "إجازة العيد" }
    );
    expect(d.instapay.target).toBe("s@instapay");
    const r = validateSettings(d);
    expect(r.ok && r.data.ops).toEqual({ acceptingOrders: false, vacationMessage: "إجازة العيد" });
  });
});
