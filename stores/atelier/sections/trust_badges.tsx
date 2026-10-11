// شارات الثقة: نفس شارات النواة (المبنية على حقائق المتجر)، بإطار يناسب الورشة.
import type { SectionProps } from "@/stores-kit";

export default function AtelierTrust({ core }: SectionProps<"trust_badges">) {
  if (!core) return null;
  return <div className="atelier-trust" data-atelier-section="trust_badges">{core}</div>;
}
