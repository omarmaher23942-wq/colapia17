# اعتمادات متجر الديمو

متجر `demo` (ريحانة للأزياء) متجر أزياء نسائية واحد. صوره الفوتوغرافية (ومعها فيديوهات الواجهة الجاهزة التي يختارها التجار من الإعداد) مصدرها [Pexels](https://www.pexels.com) وتخضع لـ [رخصة Pexels](https://www.pexels.com/license/): استخدام مجاني بما فيه التجاري، دون اشتراط نسب. نذكر المصادر هنا للشفافية وللتتبع. المنتجات والتقييمات والأسئلة في الديمو للعرض فقط، والصور لا تعني أن المنتج يُباع فعلاً. الصور المحمّلة ضُغطت إلى WebP (حتى 1600px، أقل من 120KB).

الفحص الآلي: `npx tsx scripts/demo/verify-demo.ts` (ويشغّله اختبار `tests/unit/demo-seed.test.ts` وسكربت الزرع قبل أي كتابة) يرفض أي صورة أو فيديو يستخدمه المتجر وليس موجوداً في `public/` أو غير مذكور في هذا الملف.

## فيديوهات الواجهة (للتجار، لا يستخدمها الديمو)

| الملف | المصدر |
|---|---|
| `public/demo/media/hero-fashion.mp4` (ومعها webm وصور الغلاف) | [Pexels 6459996](https://www.pexels.com/video/close-up-view-of-clothes-in-hanger-hanging-on-a-clothes-rack-6459996/) |
| `public/demo/media/hero-electronics.mp4` (ومعها webm وصور الغلاف) | [Pexels 8004701](https://www.pexels.com/video/video-of-wireless-headset-on-a-stand-8004701/) |

## صور تحريرية

| الملف | الاستخدام | المصدر |
|---|---|---|
| `public/demo/editorial/hero-side.webp` | بليزر جمل: طقم البليزر والبنطلون وإطلالة اللوكبوك | [Pexels 23531829](https://www.pexels.com/photo/23531829/) |
| `public/demo/editorial/lookbook-1.webp` | طقم الخاكي | [Pexels 8070398](https://www.pexels.com/photo/8070398/) |
| `public/demo/editorial/lookbook-2.webp` | الترنش وصورة الواجهة الثانية | [Pexels 9823810](https://www.pexels.com/photo/9823810/) |
| `public/demo/editorial/lookbook-3.webp` | معطف الجمل وصورة الواجهة الرئيسية | [Pexels 9571461](https://www.pexels.com/photo/9571461/) |
| `public/demo/editorial/rail-dresses.webp` | غلاف قسم الفساتين وقسم «عن المتجر» | [Pexels 19733576](https://www.pexels.com/photo/19733576/) |
| `public/demo/editorial/rail-boutique.webp` | لافتة التخفيضات | [Pexels 10689371](https://www.pexels.com/photo/10689371/) |

## صور المنتجات

### صور فوتوغرافية (إكسسوارات)

| المنتج | الملف | المصدر |
|---|---|---|
| حقيبة يد جلد بمقبضين | `green-leather-tote-1.webp` | [Pexels 22432991](https://www.pexels.com/photo/22432991/) |
| حلق دائري بلون السلحفاة | `tortoise-hoop-earrings-1.webp` | [Pexels 2986445](https://www.pexels.com/photo/2986445/) |

القطع الأربع المصوّرة على عارضات (معطف الجمل، الترنش، طقم البليزر، طقم الخاكي) تستخدم الصور التحريرية أعلاه.

### أحذية

| المنتج | الملفات | المصدر |
|---|---|---|
| حذاء كعب عالٍ جلد أسود بمقدمة مدببة | `black-leather-stiletto-pumps-1.webp` `black-leather-stiletto-pumps-2.webp` `black-leather-stiletto-pumps-3.webp` | [27204295](https://www.pexels.com/photo/27204295/)، [27204296](https://www.pexels.com/photo/27204296/)، [27204280](https://www.pexels.com/photo/27204280/) |
| حذاء سلينج باك جلد كونياك بكعب عريض | `cognac-leather-slingback-heels-1.webp` `cognac-leather-slingback-heels-3.webp` | [36589770](https://www.pexels.com/photo/36589770/)، [36589774](https://www.pexels.com/photo/36589774/) |
| صندل جلد أسود بحزام كاحل | `black-leather-strap-sandals-1.webp` `black-leather-strap-sandals-2.webp` | [26965812](https://www.pexels.com/photo/26965812/)، [26965809](https://www.pexels.com/photo/26965809/) |

### رسوم توضيحية بديلة (مولَّدة بالكود، بلا مصدر خارجي)

رسمها `scripts/demo/make-art.ts` من حقل `art` في `scripts/demo/data/fashion.json`. الاستبدال بصورة حقيقية: ضعوا ملفاً بالاسم نفسه (WebP، 900×1200) وأزيلوا حقل `art` من المنتج.

| المنتج | الملف |
|---|---|
| فستان ساتان ميدي بياقة V | `satin-midi-dress-1.webp` |
| فستان سهرة مخمل بأكمام طويلة | `velvet-evening-dress-1.webp` |
| فستان كتان بحزام | `linen-belted-dress-1.webp` |
| فستان ماكسي شيفون بطبعة زهور | `chiffon-floral-maxi-1.webp` |
| فستان قميص بخصر مرن | `belted-shirt-dress-1.webp` |
| عباية كريب سوداء بأكمام واسعة | `black-crepe-abaya-1.webp` |
| عباية مفتوحة كتان | `linen-open-abaya-1.webp` |
| عباية بتطريز عند الأكمام | `embroidered-sleeve-abaya-1.webp` |
| إسدال صلاة قطن بقطعتين | `cotton-prayer-set-1.webp` |
| بلوزة ساتان بأكمام منفوخة | `puff-sleeve-satin-blouse-1.webp` |
| قميص كتان أوفر سايز | `oversize-linen-shirt-1.webp` |
| توب محبوك بقصّة ضيقة | `ribbed-knit-top-1.webp` |
| كارديجان صوف بأزرار | `button-wool-cardigan-1.webp` |
| بنطلون قماش واسع بخصر عالٍ | `wide-leg-trousers-1.webp` |
| جينز مستقيم بخصر عالٍ | `high-waist-straight-jeans-1.webp` |
| تنورة بليسيه ميدي | `pleated-midi-skirt-1.webp` |
| بنطلون كتان بخصر مرن | `linen-drawstring-trousers-1.webp` |
| طقم محبوك: كارديجان وتنورة | `knit-cardigan-skirt-set-1.webp` |
| طقم منزلي قطن ناعم | `soft-cotton-lounge-set-1.webp` |
| وشاح حرير بطبعة هندسية | `geometric-silk-scarf-1.webp` |
