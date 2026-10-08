"use server";

import { unstable_rethrow } from "next/navigation";
import { getMerchantSession } from "@/server/auth";
import { getConversionFunnelV2, getGeoHeatmap, getHourlyPeaks } from "@/server/repos/analytics-v2";

export async function exportFullAnalyticsReportAction(days: number) {
  try {
    const s = await getMerchantSession();
    if (!s || !s.storeId) throw new Error("غير مصرح");

    const [funnel, geo, hourly] = await Promise.all([
      getConversionFunnelV2(s.storeId, days),
      getGeoHeatmap(s.storeId, days),
      getHourlyPeaks(s.storeId, days),
    ]);

    // بناء CSV مبسط
    let csv = "\uFEFF"; // BOM for Arabic Excel
    csv += `تقرير أداء المتجر - آخر ${days} يوماً\n\n`;
    
    csv += "قمع التحويل\n";
    csv += "المرحلة,العدد\n";
    csv += `زيارات المتجر,${funnel.visits}\n`;
    csv += `مشاهدات المنتجات,${funnel.productViews}\n`;
    csv += `إضافة للسلة,${funnel.atc}\n`;
    csv += `بدء الدفع,${funnel.checkoutStarted}\n`;
    csv += `طلبات مؤكدة,${funnel.confirmed}\n`;
    csv += `طلبات مسلمة,${funnel.delivered}\n\n`;

    csv += "المبيعات حسب المحافظة\n";
    csv += "المحافظة,الطلبات,الإيرادات (ج.م)\n";
    geo.forEach(g => {
      csv += `${g.governorate},${g.ordersCount},${g.revenue / 100}\n`;
    });

    return { ok: true, data: csv };
  } catch (e) {
    unstable_rethrow(e);
    return { ok: false, error: "فشل التصدير" };
  }
}