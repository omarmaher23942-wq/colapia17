// constants.ts — قيم الحالات والمراحل لطلبات المتاجر. ملف خالص بلا أي اعتماد (يستورده مخطط القاعدة والمتصفح معاً).
export const REQUEST_STATUSES = ["draft", "submitted", "spam", "withdrawn", "converted"] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

/** مراحل يراها العميل (يحركها الفريق من لوحة المالك). */
export const REQUEST_STAGES = ["received", "design", "build", "review", "delivery"] as const;
export type RequestStage = (typeof REQUEST_STAGES)[number];

export const REQUEST_SOURCES = ["web", "messenger", "instagram", "agent"] as const;
export type RequestSource = (typeof REQUEST_SOURCES)[number];

export const REQUEST_ASSET_KINDS = ["image", "logo", "voice"] as const;
export type RequestAssetKind = (typeof REQUEST_ASSET_KINDS)[number];

export const TRANSCRIPT_STATUSES = ["none", "pending", "done", "failed"] as const;
export type TranscriptStatus = (typeof TRANSCRIPT_STATUSES)[number];

export const REQUEST_EVENT_TYPES = ["submitted", "stage", "note", "edited", "spam", "restored", "email", "link", "production", "assign", "qa", "slug", "provision", "delivered"] as const;
export type RequestEventType = (typeof REQUEST_EVENT_TYPES)[number];

/** حالات الإنتاج الداخلية (يراها الفريق فقط؛ القواعد في src/agency/production.ts). */
export const PRODUCTION_STATES = ["new", "assigned", "building", "review", "ready", "delivered"] as const;
export type ProductionStateValue = (typeof PRODUCTION_STATES)[number];
