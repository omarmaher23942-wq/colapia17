# اعتمادات متجر الديمو

متجر `demo` متجر أحذية واحد، وكل صوره (وفيديوهات الواجهة الجاهزة التي يختارها التجار من الإعداد) مصدرها [Pexels](https://www.pexels.com) وتخضع لـ [رخصة Pexels](https://www.pexels.com/license/): استخدام مجاني بما فيه التجاري، دون اشتراط نسب. نذكر المصادر هنا للشفافية وللتتبع. المنتجات والتقييمات والأسئلة في الديمو للعرض فقط، والصور لا تعني أن المنتج يُباع فعلاً.

تُولَّد هذه القائمة من `scripts/demo/data/*.json` (الحقل `pexelsIds`). عند تغيير صورة حدّثوا الملف المناسب ثم هذه القائمة.

الفحص الآلي: `npx tsx scripts/demo/verify-demo.ts` (ويشغّله اختبار `tests/unit/demo-seed.test.ts` وسكربت الزرع قبل أي كتابة) يرفض أي صورة أو فيديو يستخدمه المتجر وليس موجوداً في `public/` أو غير مذكور في هذا الملف.

## فيديوهات الواجهة

| الملف | المصدر |
|---|---|
| `public/demo/media/hero-fashion.mp4` (ومعها webm وصور الغلاف) | [Pexels 6459996](https://www.pexels.com/video/close-up-view-of-clothes-in-hanger-hanging-on-a-clothes-rack-6459996/) |
| `public/demo/media/hero-electronics.mp4` (ومعها webm وصور الغلاف) | [Pexels 8004701](https://www.pexels.com/video/video-of-wireless-headset-on-a-stand-8004701/) |

## صور تحريرية

| الملف | الاستخدام | المصدر |
|---|---|---|
| `public/demo/editorial/hero-side.webp` | hero-side | [Pexels 23531829](https://www.pexels.com/photo/23531829/) |
| `public/demo/editorial/lookbook-1.webp` | lookbook-1 | [Pexels 8070398](https://www.pexels.com/photo/8070398/) |
| `public/demo/editorial/lookbook-2.webp` | lookbook-2 | [Pexels 9823810](https://www.pexels.com/photo/9823810/) |
| `public/demo/editorial/lookbook-3.webp` | lookbook-3 | [Pexels 9571461](https://www.pexels.com/photo/9571461/) |

## صور المنتجات

### أحذية

| المنتج | الملفات | المصدر |
|---|---|---|
| سنيكرز جلد أبيض بنعل مرتفع | `white-leather-platform-sneakers-1.webp` | [27204251](https://www.pexels.com/photo/27204251/) |
| سنيكرز جلد أسود محبّب بمقدمة لامعة | `black-grained-leather-sneakers-1.webp` `black-grained-leather-sneakers-2.webp` | [27503497](https://www.pexels.com/photo/27503497/)، [27503498](https://www.pexels.com/photo/27503498/) |
| سنيكرز جلد كحلي محبّب منخفض | `navy-leather-low-top-sneakers-1.webp` | [20755674](https://www.pexels.com/photo/20755674/) |
| حذاء كعب عالٍ جلد أسود بمقدمة مدببة | `black-leather-stiletto-pumps-1.webp` `black-leather-stiletto-pumps-2.webp` `black-leather-stiletto-pumps-3.webp` | [27204295](https://www.pexels.com/photo/27204295/)، [27204296](https://www.pexels.com/photo/27204296/)، [27204280](https://www.pexels.com/photo/27204280/) |
| حذاء سلينج باك جلد كونياك بكعب عريض | `cognac-leather-slingback-heels-1.webp` `cognac-leather-slingback-heels-3.webp` | [36589770](https://www.pexels.com/photo/36589770/)، [36589774](https://www.pexels.com/photo/36589774/) |
| لوفر جلد كونياك بنعل فاتح | `cognac-leather-penny-loafers-1.webp` | [25381178](https://www.pexels.com/photo/25381178/) |
| موكاسين جلد بني فاتح | `tan-leather-moccasins-1.webp` | [27204305](https://www.pexels.com/photo/27204305/) |
| بوت تشيلسي سويدي بلون الجمل | `tan-suede-chelsea-boots-1.webp` | [38277608](https://www.pexels.com/photo/38277608/) |
| بوت كاحل جلد بني بحافة سويدي | `brown-leather-heeled-ankle-boots-1.webp` | [27256471](https://www.pexels.com/photo/27256471/) |
| صندل جلد أسود بحزام كاحل | `black-leather-strap-sandals-1.webp` `black-leather-strap-sandals-2.webp` | [26965812](https://www.pexels.com/photo/26965812/)، [26965809](https://www.pexels.com/photo/26965809/) |
