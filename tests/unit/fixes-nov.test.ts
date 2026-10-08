import { describe, expect, it } from "vitest";
import { readSecret } from "../../template/src/lib/secret-input";
import { groundedText, storeFacts } from "@/blueprint/facts";
import { defaultBlueprint } from "@/blueprint/defaults";
import { blueprintSchema } from "@/blueprint/schema";

const UT = Buffer.from(JSON.stringify({ apiKey: "sk_live_" + "a".repeat(40), appId: "abc123", regions: ["sea1"] })).toString("base64");

describe("pasted provider keys", () => {
  it("reads the UploadThing token whatever way it was copied", () => {
    for (const raw of [
      UT,
      `UPLOADTHING_TOKEN='${UT}'`,
      `UPLOADTHING_TOKEN="${UT}"`,
      `export UPLOADTHING_TOKEN=${UT}`,
      `  UPLOADTHING_TOKEN = ‘${UT}’ \n`,
      `UPLOADTHING_SECRET=sk_live_x\nUPLOADTHING_TOKEN='${UT}'\nOTHER=1`,
      `“${UT}”`,
    ]) {
      expect(readSecret("uploadthing", raw)).toBe(UT);
    }
  });
  it("reads Groq and Resend keys from env lines or bearer headers", () => {
    const g = "gsk_" + "A1b2".repeat(10);
    expect(readSecret("groq", `GROQ_API_KEY=${g}`)).toBe(g);
    expect(readSecret("groq", `Bearer ${g}`)).toBe(g);
    expect(readSecret("groq", ` "${g}" `)).toBe(g);
    expect(readSecret("resend", "RESEND_API_KEY=re_abc_1234567890")).toBe("re_abc_1234567890");
  });
});

describe("truthful free text", () => {
  const bp = blueprintSchema.parse(defaultBlueprint({ name: "ميادة فاشون" } as never));
  it("drops a false nationwide clause and keeps the rest of the sentence", () => {
    const facts = storeFacts({ ...bp, payments: { ...bp.payments, cod: { ...bp.payments.cod, enabled: true } } }, { activeGovernorates: 5 });
    expect(groundedText("تسوق من ميادة فاشون أونلاين بالدفع عند الاستلام وشحن لكل محافظات مصر.", facts)).toBe(
      "تسوق من ميادة فاشون أونلاين بالدفع عند الاستلام."
    );
  });
  it("keeps true claims and plain sentences untouched", () => {
    const facts = storeFacts(bp, { activeGovernorates: 27 });
    const t = "أزياء مختارة بعناية. شحن لكل محافظات مصر.";
    expect(groundedText(t, facts)).toBe(t);
  });
  it("removes a whole sentence that is only a false claim", () => {
    const facts = storeFacts({ ...bp, shipping: { ...bp.shipping, inspectionAllowed: false } }, { activeGovernorates: 3 });
    expect(groundedText("قطع مريحة للصيف. معاينة قبل الدفع.", facts)).toBe("قطع مريحة للصيف.");
  });
});
