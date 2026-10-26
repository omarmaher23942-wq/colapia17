import "server-only";
// facts.ts — حقائق الوكيل الحية في دور واحد: نص الأسعار، المقاعد الحقيقية، روابط الأدلة، وملاحظة المالك للمشاريع الأخرى. المحوّل الوحيد
// بين الوكيل ومسار الأسعار (server/pricing.ts): أي تغيير في شكله يُعالج هنا وحده. القراءة دفاعية فلا يتعطل الوكيل بغياب حقل.
import { goldenStatus, PRICING_FLAG } from "@/server/pricing";
import { getFlag } from "@/lib/flags";
import { env } from "@/lib/env";
import { demoUrl } from "@/agent/settings";
import { QIMA_URL } from "@/agent/config";
import { agentFactsText, offerFrom, type GoldenLike, type Offer } from "@/agent/offer";
import { OTHER_SERVICE_NO_NOTE, otherServicesNoteFrom } from "@/agent/other-service";
import { allowedPriceNumbers, type ReplyCtx } from "./guard";

export type AgentFacts = {
  vars: { pricingFacts: string; demoUrl: string; qimaUrl: string; otherNote: string };
  offer: Offer;
  replyCtx: ReplyCtx;
};

const hostOf = (url: string) => {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
};

export async function agentFacts(): Promise<AgentFacts> {
  const [golden, demo, pricingFlag] = await Promise.all([goldenStatus(), demoUrl(), getFlag<Record<string, unknown>>(PRICING_FLAG).catch(() => null)]);
  const offer = offerFrom(golden as GoldenLike);
  const facts = agentFactsText(offer);
  const note = otherServicesNoteFrom(pricingFlag?.config);
  return {
    vars: { pricingFacts: facts, demoUrl: demo, qimaUrl: QIMA_URL, otherNote: note || OTHER_SERVICE_NO_NOTE },
    offer,
    replyCtx: {
      // ما يُسمح للرد بذكره: نطاقاتنا والأدلة (المتجر التجريبي وQima) فقط، وأسعار الحقائق وفروقها الطبيعية فقط.
      allowedHosts: [hostOf(demo), hostOf(QIMA_URL), env.ROOT_DOMAIN, "colapia.com", "ig.me"],
      allowedPrices: allowedPriceNumbers(facts, note),
      facts: `${facts}\n${note}`,
      seatsLeft: offer.seatsLeft,
      seatsTotal: offer.seatsTotal,
    },
  };
}
