// /api/uploadthing — رفع الصور على حساب UploadThing الخاص بالمنصة (المتجر أثناء التجربة).
// مشروع التاجر الخاص له نسخته من هذا المسار بمفتاحه هو (template/).
import { createRouteHandler } from "uploadthing/next";
import { fileRouter } from "./core";

export const { GET, POST } = createRouteHandler({ router: fileRouter });
