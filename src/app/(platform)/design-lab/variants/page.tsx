// معمل: محرر المقاسات والألوان بلا قاعدة بيانات (تطوير فقط).
import { notFound } from "next/navigation";
import { VariantsLab } from "./VariantsLab";

export default function Page() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <VariantsLab />;
}
