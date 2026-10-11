// نسخة مشروع التاجر المستقل: بلا تخصيصات متاجر الوكالة (stores/ لا يُنسخ إلى مشروع متجر واحد).
// تسليم الكود لمتجر بعينه يولّد هذا الملف بمجلد ذلك المتجر وحده.
import type { StoreEntry } from "./types";

export const STORE_REGISTRY: Record<string, StoreEntry> = {};
