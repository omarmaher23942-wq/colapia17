// الأسئلة الشائعة: أسئلة النواة، وتحتها طريق مباشر لمن لم يجد إجابته (واتساب المتجر إن وُجد).
import { waLink, type SectionProps } from "@/stores-kit";

export default function NovaFaq({ core, kit }: SectionProps<"faq">) {
  if (!core) return null;
  const wa = waLink(kit.bp.channels.whatsappNumber, "عندي سؤال عن طلب");
  return (
    <div data-nova-section="faq">
      {core}
      {wa ? (
        <p className="container-x -mt-6 pb-10 text-center text-sm">
          لم تجد إجابتك؟{" "}
          <a href={wa} target="_blank" rel="noopener" className="font-bold underline">
            اسألنا على واتساب
          </a>
        </p>
      ) : null}
    </div>
  );
}
