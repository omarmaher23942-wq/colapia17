// /start — رابط قديم للاستمارة (حُذفت في V4). يحوَّل كل من يصل إليه، بما فيه /start?offer=golden، إلى صفحة الحجز.
import { permanentRedirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function StartRedirect() {
  permanentRedirect("/golden");
}
