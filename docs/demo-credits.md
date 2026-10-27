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

<!-- owner-catalogue:start -->
### كتالوج مقدَّم من المالك (للعرض التجريبي فقط)

صور هذه المنتجات هي صور كتالوج لبائع تجزئة آخر، قدّمها المالك للاستخدام في هذا الديمو فقط. **حقوقها ملك بائعها الأصلي**، ولا يجوز استخدامها في أي متجر حقيقي ولا في أي مادة تجارية. يجب استبدالها بصور العميل نفسه أو بصور مرخّصة قبل أي استخدام تجاري، ثم حذفها من المستودع.

| المنتج | الملف | رابط المصدر |
|---|---|---|
| بلوفر مقلّم بياقة بولو | `striped-polo-collar-pullover-1.webp` | https://dfcdn.defacto.com.tr/1000/I6892AX_26WN_ER100_01_02.jpg |
| بلوفر مقلّم بياقة بولو | `striped-polo-collar-pullover-2.webp` | https://dfcdn.defacto.com.tr/1000/I6892AX_26WN_ER100_02_02.jpg |
| بلوفر مقلّم بياقة بولو | `striped-polo-collar-pullover-3.webp` | https://dfcdn.defacto.com.tr/1000/I6892AX_26WN_ER100_01_01.jpg |
| بلوفر مقلّم بياقة بولو | `striped-polo-collar-pullover-4.webp` | https://dfcdn.defacto.com.tr/1000/I6892AX_26WN_ER100_02_01.jpg |
| بلوفر مقلّم بلون عنابي | `burgundy-striped-crew-pullover-1.webp` | https://dfcdn.defacto.com.tr/1000/I6940AX_26WN_PR200_01_02.jpg |
| بلوفر مقلّم بلون عنابي | `burgundy-striped-crew-pullover-2.webp` | https://dfcdn.defacto.com.tr/1000/I6940AX_26WN_PR200_02_02.jpg |
| بلوفر مقلّم بلون عنابي | `burgundy-striped-crew-pullover-3.webp` | https://dfcdn.defacto.com.tr/1000/I6940AX_26WN_PR200_01_01.jpg |
| بلوفر مقلّم بلون عنابي | `burgundy-striped-crew-pullover-4.webp` | https://dfcdn.defacto.com.tr/1000/I6940AX_26WN_PR200_02_01.jpg |
| سويت شيرت سميك بياقة عالية | `thick-high-collar-sweatshirt-1.webp` | https://dfcdn.defacto.com.tr/1000/I0971AX_26AU_BG759_01_02.jpg |
| سويت شيرت سميك بياقة عالية | `thick-high-collar-sweatshirt-2.webp` | https://dfcdn.defacto.com.tr/1000/I0971AX_26AU_BG759_02_02.jpg |
| سويت شيرت سميك بياقة عالية | `thick-high-collar-sweatshirt-3.webp` | https://dfcdn.defacto.com.tr/1000/I0971AX_26AU_BG759_01_01.jpg |
| سويت شيرت سميك بياقة عالية | `thick-high-collar-sweatshirt-4.webp` | https://dfcdn.defacto.com.tr/1000/I0971AX_26AU_BG759_02_01.jpg |
| تنورة تريكو واسعة بحواف مدببة | `pointed-hem-knit-skirt-1.webp` | https://dfcdn.defacto.com.tr/1000/J0479AX_26WN_BN130_01_02.jpg |
| تنورة تريكو واسعة بحواف مدببة | `pointed-hem-knit-skirt-2.webp` | https://dfcdn.defacto.com.tr/1000/J0479AX_26WN_BN130_01_03.jpg |
| تنورة تريكو واسعة بحواف مدببة | `pointed-hem-knit-skirt-3.webp` | https://dfcdn.defacto.com.tr/1000/J0479AX_26WN_BN130_02_02.jpg |
| تنورة تريكو واسعة بحواف مدببة | `pointed-hem-knit-skirt-4.webp` | https://dfcdn.defacto.com.tr/1000/J0479AX_26WN_BN130_02_03.jpg |
| تنورة تريكو واسعة بحواف مدببة | `pointed-hem-knit-skirt-5.webp` | https://dfcdn.defacto.com.tr/1000/J0479AX_26WN_BN130_01_01.jpg |
| تنورة تريكو واسعة بحواف مدببة | `pointed-hem-knit-skirt-6.webp` | https://dfcdn.defacto.com.tr/1000/J0479AX_26WN_BN130_02_01.jpg |
| بنطلون واسع بقصة مستقيمة | `wide-straight-fleece-trousers-1.webp` | https://dfcdn.defacto.com.tr/1000/H7807AX_26AU_AR69_01_02.jpg |
| بنطلون واسع بقصة مستقيمة | `wide-straight-fleece-trousers-2.webp` | https://dfcdn.defacto.com.tr/1000/H7807AX_26AU_AR69_02_02.jpg |
| بنطلون واسع بقصة مستقيمة | `wide-straight-fleece-trousers-3.webp` | https://dfcdn.defacto.com.tr/1000/H7807AX_26AU_AR69_01_01.jpg |
| بنطلون واسع بقصة مستقيمة | `wide-straight-fleece-trousers-4.webp` | https://dfcdn.defacto.com.tr/1000/H7807AX_26AU_AR69_02_01.jpg |
| توب محبوك بياقة عالية وأكمام قصيرة | `mock-neck-short-sleeve-knit-top-1.webp` | https://dfcdn.defacto.com.tr/1000/D9758AX_26WN_BN267_01_02.jpg |
| توب محبوك بياقة عالية وأكمام قصيرة | `mock-neck-short-sleeve-knit-top-2.webp` | https://dfcdn.defacto.com.tr/1000/D9758AX_26WN_BN267_02_02.jpg |
| توب محبوك بياقة عالية وأكمام قصيرة | `mock-neck-short-sleeve-knit-top-3.webp` | https://dfcdn.defacto.com.tr/1000/D9758AX_26WN_BN267_01_01.jpg |
| توب محبوك بياقة عالية وأكمام قصيرة | `mock-neck-short-sleeve-knit-top-4.webp` | https://dfcdn.defacto.com.tr/1000/D9758AX_26WN_BN267_02_01.jpg |
| تونيك واسع بأكمام جرسية | `flared-sleeve-modest-tunic-1.webp` | https://dfcdn.defacto.com.tr/1000/J1594AX_26AU_BK81_01_01.jpg |
| تونيك واسع بأكمام جرسية | `flared-sleeve-modest-tunic-2.webp` | https://dfcdn.defacto.com.tr/1000/J1594AX_26AU_ER37_01_01.jpg |
| تونيك واسع بأكمام جرسية | `flared-sleeve-modest-tunic-3.webp` | https://dfcdn.defacto.com.tr/1000/J1594AX_26AU_BK81_02_01.jpg |
| تونيك واسع بأكمام جرسية | `flared-sleeve-modest-tunic-4.webp` | https://dfcdn.defacto.com.tr/1000/J1594AX_26AU_ER37_02_01.jpg |
| توب أبيض بأكمام طويلة وقصّة ضيقة | `white-slim-long-sleeve-top-1.webp` | https://dfcdn.defacto.com.tr/1000/I4450AX_26AU_ER105_01_01.jpg |
| توب أبيض بأكمام طويلة وقصّة ضيقة | `white-slim-long-sleeve-top-2.webp` | https://dfcdn.defacto.com.tr/1000/I4450AX_26AU_ER105_02_01.jpg |
| بلوزة بأكمام طويلة بتجميعة جانبية | `red-draped-side-long-sleeve-top-1.webp` | https://dfcdn.defacto.com.tr/1000/J1123AX_26WN_RD44_01_02.jpg |
| بلوزة بأكمام طويلة بتجميعة جانبية | `red-draped-side-long-sleeve-top-2.webp` | https://dfcdn.defacto.com.tr/1000/J1123AX_26WN_RD44_02_02.jpg |
| بلوزة بأكمام طويلة بتجميعة جانبية | `red-draped-side-long-sleeve-top-3.webp` | https://dfcdn.defacto.com.tr/1000/J1123AX_26WN_RD44_01_01.jpg |
| بلوزة بأكمام طويلة بتجميعة جانبية | `red-draped-side-long-sleeve-top-4.webp` | https://dfcdn.defacto.com.tr/1000/J1123AX_26WN_RD44_02_01.jpg |
| بلوزة دانتيل بياقة عالية وأكمام منفوخة | `lace-high-neck-puff-sleeve-top-1.webp` | https://dfcdn.defacto.com.tr/1000/I9650AX_26WN_ER138_01_01.jpg |
| بلوزة دانتيل بياقة عالية وأكمام منفوخة | `lace-high-neck-puff-sleeve-top-2.webp` | https://dfcdn.defacto.com.tr/1000/I9650AX_26WN_ER138_01_02.jpg |
| بلوزة دانتيل بياقة عالية وأكمام منفوخة | `lace-high-neck-puff-sleeve-top-3.webp` | https://dfcdn.defacto.com.tr/1000/I9650AX_26WN_ER138_02_01.jpg |
| بلوزة دانتيل بياقة عالية وأكمام منفوخة | `lace-high-neck-puff-sleeve-top-4.webp` | https://dfcdn.defacto.com.tr/1000/I9650AX_26WN_ER138_02_02.jpg |
| جاكيت فرو صناعي بطبعة منقّطة | `leopard-print-faux-fur-jacket-1.webp` | https://dfcdn.defacto.com.tr/1000/I2263AX_26WN_ER128_01_02.jpg |
| جاكيت فرو صناعي بطبعة منقّطة | `leopard-print-faux-fur-jacket-2.webp` | https://dfcdn.defacto.com.tr/1000/I2263AX_26WN_ER128_02_02.jpg |
| جاكيت فرو صناعي بطبعة منقّطة | `leopard-print-faux-fur-jacket-3.webp` | https://dfcdn.defacto.com.tr/1000/I2263AX_26WN_ER128_01_01.jpg |
| جاكيت فرو صناعي بطبعة منقّطة | `leopard-print-faux-fur-jacket-4.webp` | https://dfcdn.defacto.com.tr/1000/I2263AX_26WN_ER128_02_01.jpg |
| جاكيت أحمر بياقة متقاطعة | `red-crossover-collar-jacket-1.webp` | https://dfcdn.defacto.com.tr/1000/J0172AX_26WN_RD1_01_01.jpg |
| جاكيت أحمر بياقة متقاطعة | `red-crossover-collar-jacket-2.webp` | https://dfcdn.defacto.com.tr/1000/J0172AX_26WN_RD1_02_01.jpg |
| طقم بيجامة مقلّم قطعتين | `striped-two-piece-pyjama-set-1.webp` | https://dfcdn.defacto.com.tr/1000/G2395AX_26AU_PR461_01_01.jpg |
| طقم بيجامة مقلّم قطعتين | `striped-two-piece-pyjama-set-2.webp` | https://dfcdn.defacto.com.tr/1000/G2395AX_26AU_PR461_02_01.jpg |
| روب منزلي قطيفة بياقة شال وحزام | `plush-wrap-collar-robe-1.webp` | https://dfcdn.defacto.com.tr/1000/A3437AX_26AU_BR86_01_01.jpg |
| روب منزلي قطيفة بياقة شال وحزام | `plush-wrap-collar-robe-2.webp` | https://dfcdn.defacto.com.tr/1000/A3437AX_26AU_BR86_02_01.jpg |
| وشاح كتف تريكو بعقدة أمامية | `knit-shoulder-wrap-tie-1.webp` | https://dfcdn.defacto.com.tr/1000/I4750AX_26WN_RD2_01_01.jpg |
| وشاح كتف تريكو بعقدة أمامية | `knit-shoulder-wrap-tie-2.webp` | https://dfcdn.defacto.com.tr/1000/I4750AX_26WN_BN66_01_01.jpg |
| وشاح كتف تريكو بعقدة أمامية | `knit-shoulder-wrap-tie-3.webp` | https://dfcdn.defacto.com.tr/1000/I4750AX_26WN_RD2_02_01.jpg |
| وشاح كتف تريكو بعقدة أمامية | `knit-shoulder-wrap-tie-4.webp` | https://dfcdn.defacto.com.tr/1000/I4750AX_26WN_BN66_02_01.jpg |
| وشاح ناعم بأهداب بلون بيج فاتح | `soft-fringe-scarf-beige-1.webp` | https://dfcdn.defacto.com.tr/1000/F3423AX_26WN_ER2_01_01.jpg |
| وشاح ناعم بأهداب بلون بيج فاتح | `soft-fringe-scarf-beige-2.webp` | https://dfcdn.defacto.com.tr/1000/F3423AX_26WN_ER2_02_01.jpg |
| وشاح بني داكن بأهداب طويلة | `dark-brown-fringe-scarf-1.webp` | https://dfcdn.defacto.com.tr/1000/I2985AX_26WN_BN66_01_01.jpg |
| وشاح بني داكن بأهداب طويلة | `dark-brown-fringe-scarf-2.webp` | https://dfcdn.defacto.com.tr/1000/I2985AX_26WN_BN66_02_01.jpg |
| كاب شتوي رمادي بحافة سوداء | `winter-baseball-cap-grey-1.webp` | https://dfcdn.defacto.com.tr/1000/U9363AZ_26WN_GR2_01_01.jpg |
| كاب شتوي رمادي بحافة سوداء | `winter-baseball-cap-grey-2.webp` | https://dfcdn.defacto.com.tr/1000/U9363AZ_26WN_GR2_02_01.jpg |
| قبعة تريكو سوداء بحافة مطوية | `black-cuffed-knit-beanie-1.webp` | https://dfcdn.defacto.com.tr/1000/R7545AZ_26WN_BK27_01_01.jpg |
| قبعة تريكو سوداء بحافة مطوية | `black-cuffed-knit-beanie-2.webp` | https://dfcdn.defacto.com.tr/1000/R7545AZ_26WN_BK27_02_01.jpg |
| تيشيرت أسود بطبعة رقم 98 | `black-98-print-tee-1.webp` | https://dfcdn.defacto.com.tr/1000/I9592AX_26AU_BK81_01_01.jpg |
| تيشيرت أسود بطبعة رقم 98 | `black-98-print-tee-2.webp` | https://dfcdn.defacto.com.tr/1000/I9592AX_26AU_BK81_02_01.jpg |
| توب دانتيل أسود بياقة عالية | `black-lace-mandarin-top-1.webp` | https://dfcdn.defacto.com.tr/1000/I9565AX_26AU_BK81_01_01.jpg |
| توب دانتيل أسود بياقة عالية | `black-lace-mandarin-top-2.webp` | https://dfcdn.defacto.com.tr/1000/I9565AX_26AU_BK81_01_02.jpg |
| توب دانتيل أسود بياقة عالية | `black-lace-mandarin-top-3.webp` | https://dfcdn.defacto.com.tr/1000/I9565AX_26AU_BK81_02_02.jpg |
| تيشيرت أزرق بعبارة مطبوعة | `blue-slogan-long-sleeve-tee-1.webp` | https://dfcdn.defacto.com.tr/1000/I9583AX_26AU_BE89_01_01.jpg |
| تيشيرت أزرق بعبارة مطبوعة | `blue-slogan-long-sleeve-tee-2.webp` | https://dfcdn.defacto.com.tr/1000/I9583AX_26AU_BE89_01_02.jpg |
| تيشيرت أزرق بعبارة مطبوعة | `blue-slogan-long-sleeve-tee-3.webp` | https://dfcdn.defacto.com.tr/1000/I9583AX_26AU_BE89_02_02.jpg |

الملفات التي تُحذف عند إزالتها: كل `public/demo/fashion/<slug>-N.webp` للأرقام المذكورة أعلاه (الأسماء `striped-polo-collar-pullover`، `burgundy-striped-crew-pullover`، `thick-high-collar-sweatshirt`، `pointed-hem-knit-skirt`، `wide-straight-fleece-trousers`، `mock-neck-short-sleeve-knit-top`، `flared-sleeve-modest-tunic`، `white-slim-long-sleeve-top`، `red-draped-side-long-sleeve-top`، `lace-high-neck-puff-sleeve-top`، `leopard-print-faux-fur-jacket`، `red-crossover-collar-jacket`، `striped-two-piece-pyjama-set`، `plush-wrap-collar-robe`، `knit-shoulder-wrap-tie`، `soft-fringe-scarf-beige`، `dark-brown-fringe-scarf`، `winter-baseball-cap-grey`، `black-cuffed-knit-beanie`)، ثم إزالة المنتجات نفسها من `scripts/demo/data/fashion.json` وتشغيل `npx tsx scripts/demo/export-store-files.ts`. الأوامر: `git rm public/demo/fashion/{striped-polo-collar-pullover-*.webp,burgundy-striped-crew-pullover-*.webp,thick-high-collar-sweatshirt-*.webp,pointed-hem-knit-skirt-*.webp,wide-straight-fleece-trousers-*.webp,mock-neck-short-sleeve-knit-top-*.webp,flared-sleeve-modest-tunic-*.webp,white-slim-long-sleeve-top-*.webp,red-draped-side-long-sleeve-top-*.webp,lace-high-neck-puff-sleeve-top-*.webp,leopard-print-faux-fur-jacket-*.webp,red-crossover-collar-jacket-*.webp,striped-two-piece-pyjama-set-*.webp,plush-wrap-collar-robe-*.webp,knit-shoulder-wrap-tie-*.webp,soft-fringe-scarf-beige-*.webp,dark-brown-fringe-scarf-*.webp,winter-baseball-cap-grey-*.webp,black-cuffed-knit-beanie-*.webp}`.
<!-- owner-catalogue:end -->
