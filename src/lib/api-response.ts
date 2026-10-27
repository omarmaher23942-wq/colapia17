// api-response.ts — شكل موحد لأخطاء مسارات الـ API الجديدة: رسالة عربية ورمز ثابت ومعرّف الطلب للدعم.
export type ApiErrorBody = { ok: false; code: string; error: string; reqId?: string };

export function apiError(code: string, error: string, status: number, reqId?: string, headers?: HeadersInit): Response {
  const body: ApiErrorBody = { ok: false, code, error, ...(reqId ? { reqId } : {}) };
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

export const API_ERRORS = {
  unauthorized: (reqId?: string) => apiError("unauthorized", "غير مصرح.", 401, reqId),
  forbidden: (reqId?: string) => apiError("forbidden", "لا تملكون صلاحية هذا الإجراء.", 403, reqId),
  badRequest: (msg = "طلب غير صالح.", reqId?: string) => apiError("bad_request", msg, 400, reqId),
  tooMany: (reqId?: string) => apiError("rate_limited", "محاولات كثيرة. حاولوا لاحقاً.", 429, reqId, { "Retry-After": "60" }),
  server: (reqId?: string) => apiError("server_error", "تعذر إكمال الطلب الآن.", 500, reqId),
};
