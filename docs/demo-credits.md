# اعتمادات متجر الديمو

كل الصور والفيديوهات في متجر `demo` مصدرها [Pexels](https://www.pexels.com) وتخضع لـ [رخصة Pexels](https://www.pexels.com/license/): استخدام مجاني بما فيه التجاري، دون اشتراط نسب. نذكر المصادر هنا للشفافية وللتتبع. المنتجات والتقييمات والأسئلة في الديمو للعرض فقط، والصور لا تعني أن المنتج يُباع فعلاً.

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
| `public/demo/editorial/hero-fashion.webp` | hero-fashion | [Pexels 7671163](https://www.pexels.com/photo/7671163/) |
| `public/demo/editorial/hero-side.webp` | hero-side | [Pexels 23531829](https://www.pexels.com/photo/23531829/) |
| `public/demo/editorial/banner-new.webp` | banner-new | [Pexels 9256867](https://www.pexels.com/photo/9256867/) |
| `public/demo/editorial/banner-sale.webp` | banner-sale | [Pexels 10689371](https://www.pexels.com/photo/10689371/) |
| `public/demo/editorial/banner-accessories.webp` | banner-accessories | [Pexels 2986445](https://www.pexels.com/photo/2986445/) |
| `public/demo/editorial/lookbook-1.webp` | lookbook-1 | [Pexels 8070398](https://www.pexels.com/photo/8070398/) |
| `public/demo/editorial/lookbook-2.webp` | lookbook-2 | [Pexels 9823810](https://www.pexels.com/photo/9823810/) |
| `public/demo/editorial/lookbook-3.webp` | lookbook-3 | [Pexels 9571461](https://www.pexels.com/photo/9571461/) |
| `public/demo/editorial/about.webp` | about | [Pexels 6461104](https://www.pexels.com/photo/6461104/) |
| `public/demo/editorial/cat-tshirts.webp` | cat-tshirts | [Pexels 18186105](https://www.pexels.com/photo/18186105/) |
| `public/demo/editorial/cat-shirts.webp` | cat-shirts | [Pexels 17315934](https://www.pexels.com/photo/17315934/) |
| `public/demo/editorial/cat-hoodies.webp` | cat-hoodies | [Pexels 6995861](https://www.pexels.com/photo/6995861/) |
| `public/demo/editorial/cat-jackets.webp` | cat-jackets | [Pexels 7679685](https://www.pexels.com/photo/7679685/) |
| `public/demo/editorial/cat-pants.webp` | cat-pants | [Pexels 4210850](https://www.pexels.com/photo/4210850/) |
| `public/demo/editorial/cat-dresses.webp` | cat-dresses | [Pexels 19733576](https://www.pexels.com/photo/19733576/) |
| `public/demo/editorial/cat-shoes.webp` | cat-shoes | [Pexels 15059774](https://www.pexels.com/photo/15059774/) |
| `public/demo/editorial/cat-bags.webp` | cat-bags | [Pexels 22432991](https://www.pexels.com/photo/22432991/) |
| `public/demo/editorial/cat-accessories.webp` | cat-accessories | [Pexels 1493113](https://www.pexels.com/photo/1493113/) |
| `public/demo/editorial/hero-electronics.webp` | hero-electronics | [Pexels 5208870](https://www.pexels.com/photo/5208870/) |

## صور المنتجات

### تيشيرتات

| المنتج | الملفات | المصدر |
|---|---|---|
| تيشيرت أبيض كلاسيكي | `classic-white-crew-tee-1.webp` | [12039633](https://www.pexels.com/photo/12039633/) |
| تيشيرت أبيض ثقيل بقصة مربعة | `heavyweight-boxy-white-tee-1.webp` | [18257675](https://www.pexels.com/photo/18257675/) |
| تيشيرت أسود أساسي | `essential-black-tee-1.webp` `essential-black-tee-2.webp` `essential-black-tee-3.webp` | [8532616](https://www.pexels.com/photo/8532616/)، [8532638](https://www.pexels.com/photo/8532638/)، [8532611](https://www.pexels.com/photo/8532611/) |
| تيشيرت أوفرسايز أسود | `oversized-black-tee-1.webp` `oversized-black-tee-2.webp` | [9558588](https://www.pexels.com/photo/9558588/)، [9558567](https://www.pexels.com/photo/9558567/) |
| تيشيرت رملي بحافة دائرية | `sand-curved-hem-tee-1.webp` | [11671275](https://www.pexels.com/photo/11671275/) |
| تيشيرت زيتي داكن | `olive-cotton-tee-1.webp` | [35136158](https://www.pexels.com/photo/35136158/) |
| تيشيرت قطن ناعم | `soft-cotton-mint-tee-1.webp` `soft-cotton-mint-tee-2.webp` | [34156905](https://www.pexels.com/photo/34156905/)، [34156907](https://www.pexels.com/photo/34156907/) |
| بولو بيكيه بفتحة أزرار طويلة | `pique-polo-shirt-1.webp` `pique-polo-shirt-2.webp` | [17984122](https://www.pexels.com/photo/17984122/)، [17984123](https://www.pexels.com/photo/17984123/) |
| بولو أحمر بياقة مخططة | `tipped-red-polo-1.webp` | [11751211](https://www.pexels.com/photo/11751211/) |

### قمصان

| المنتج | الملفات | المصدر |
|---|---|---|
| قميص كتان طبيعي بياقة ماندرين | `natural-linen-band-collar-shirt-1.webp` | [22441291](https://www.pexels.com/photo/22441291/) |
| قميص كتان أبيض بأزرار معقودة | `white-linen-frog-button-shirt-1.webp` | [22441292](https://www.pexels.com/photo/22441292/) |
| قميص كتان كحلي بلا ياقة | `navy-linen-short-sleeve-shirt-1.webp` `navy-linen-short-sleeve-shirt-2.webp` | [22441317](https://www.pexels.com/photo/22441317/)، [22441315](https://www.pexels.com/photo/22441315/) |
| قميص قطن أخضر مريمي بياقة مزرّرة | `sage-button-down-shirt-1.webp` `sage-button-down-shirt-2.webp` | [9594940](https://www.pexels.com/photo/9594940/)، [9594952](https://www.pexels.com/photo/9594952/) |
| قميص عاجي بخطوط حمراء | `red-stripe-cotton-linen-shirt-1.webp` `red-stripe-cotton-linen-shirt-2.webp` | [12955555](https://www.pexels.com/photo/12955555/)، [7444126](https://www.pexels.com/photo/7444126/) |
| قميص دنيم أزرق بياقة مزرّرة | `indigo-denim-shirt-1.webp` `indigo-denim-shirt-2.webp` | [4287126](https://www.pexels.com/photo/4287126/)، [4287127](https://www.pexels.com/photo/4287127/) |
| أوفرشيرت كوردروي عاجي | `ivory-corduroy-overshirt-1.webp` `ivory-corduroy-overshirt-2.webp` `ivory-corduroy-overshirt-3.webp` | [7764018](https://www.pexels.com/photo/7764018/)، [7764011](https://www.pexels.com/photo/7764011/)، [7764008](https://www.pexels.com/photo/7764008/) |
| قميص كامب رملي بياقة مفتوحة | `sand-camp-collar-shirt-1.webp` `sand-camp-collar-shirt-2.webp` | [17251241](https://www.pexels.com/photo/17251241/)، [17251247](https://www.pexels.com/photo/17251247/) |

### هوديز وكنزات

| المنتج | الملفات | المصدر |
|---|---|---|
| هودي أسود كلاسيكي | `black-pullover-hoodie-1.webp` `black-pullover-hoodie-2.webp` `black-pullover-hoodie-3.webp` | [6311629](https://www.pexels.com/photo/6311629/)، [6311506](https://www.pexels.com/photo/6311506/)، [6311502](https://www.pexels.com/photo/6311502/) |
| هودي رمادي ملانج أوفرسايز | `heather-grey-oversized-hoodie-1.webp` `heather-grey-oversized-hoodie-2.webp` `heather-grey-oversized-hoodie-3.webp` | [6311613](https://www.pexels.com/photo/6311613/)، [6311614](https://www.pexels.com/photo/6311614/)، [6311663](https://www.pexels.com/photo/6311663/) |
| هودي لافندر | `lavender-hoodie-1.webp` `lavender-hoodie-2.webp` | [6311597](https://www.pexels.com/photo/6311597/)، [6311662](https://www.pexels.com/photo/6311662/) |
| هودي أوف وايت | `ivory-fleece-hoodie-1.webp` `ivory-fleece-hoodie-2.webp` `ivory-fleece-hoodie-3.webp` | [6311503](https://www.pexels.com/photo/6311503/)، [6311678](https://www.pexels.com/photo/6311678/)، [6311505](https://www.pexels.com/photo/6311505/) |
| هودي موكا بقصة قصيرة | `mocha-cropped-hoodie-1.webp` | [6786666](https://www.pexels.com/photo/6786666/) |
| سويت شيرت رملي أوفرسايز | `sand-oversized-crewneck-1.webp` | [9558698](https://www.pexels.com/photo/9558698/) |
| بلوفر تريكو بيج فاتح برقبة V | `oatmeal-v-neck-sweater-1.webp` | [6311654](https://www.pexels.com/photo/6311654/) |
| بلوفر تريكو كاميل برقبة عالية | `camel-roll-neck-sweater-1.webp` `camel-roll-neck-sweater-2.webp` `camel-roll-neck-sweater-3.webp` | [6995895](https://www.pexels.com/photo/6995895/)، [6995886](https://www.pexels.com/photo/6995886/)، [6995899](https://www.pexels.com/photo/6995899/) |

### جاكيتات ومعاطف

| المنتج | الملفات | المصدر |
|---|---|---|
| جاكيت أفياتور سويد بياقة شيربا | `tan-shearling-aviator-jacket-1.webp` `tan-shearling-aviator-jacket-2.webp` `tan-shearling-aviator-jacket-3.webp` | [7576453](https://www.pexels.com/photo/7576453/)، [7576455](https://www.pexels.com/photo/7576455/)، [7576450](https://www.pexels.com/photo/7576450/) |
| جاكيت جلد طبيعي أسود بياقة واقفة | `black-leather-racer-jacket-1.webp` | [6044143](https://www.pexels.com/photo/6044143/) |
| معطف ترنش جبردين بحزام | `camel-belted-trench-coat-1.webp` | [5424917](https://www.pexels.com/photo/5424917/) |
| جاكيت منفوخ كريمي بياقة عالية | `cream-puffer-jacket-1.webp` `cream-puffer-jacket-2.webp` | [6626747](https://www.pexels.com/photo/6626747/)، [6626749](https://www.pexels.com/photo/6626749/) |
| جاكيت جينز أسود ببطانة شيربا | `black-sherpa-denim-jacket-1.webp` `black-sherpa-denim-jacket-2.webp` | [17015387](https://www.pexels.com/photo/17015387/)، [17015371](https://www.pexels.com/photo/17015371/) |
| جاكيت جينز ترَكر نيلي | `indigo-denim-trucker-jacket-1.webp` `indigo-denim-trucker-jacket-2.webp` | [20755887](https://www.pexels.com/photo/20755887/)، [20755907](https://www.pexels.com/photo/20755907/) |
| جاكيت بومبر نايلون أحمر | `red-nylon-bomber-jacket-1.webp` | [16069733](https://www.pexels.com/photo/16069733/) |
| جاكيت سهرة أبيض بياقة شال | `white-shawl-lapel-dinner-jacket-1.webp` | [39483049](https://www.pexels.com/photo/39483049/) |

### بناطيل

| المنتج | الملفات | المصدر |
|---|---|---|
| جينز أزرق كلاسيكي بخمسة جيوب | `classic-indigo-jeans-1.webp` `classic-indigo-jeans-2.webp` `classic-indigo-jeans-3.webp` | [10133282](https://www.pexels.com/photo/10133282/)، [10133278](https://www.pexels.com/photo/10133278/)، [10133280](https://www.pexels.com/photo/10133280/) |
| بنطلون دنيم واسع برباط خصر | `tie-waist-wide-leg-denim-1.webp` `tie-waist-wide-leg-denim-2.webp` | [39457729](https://www.pexels.com/photo/39457729/)، [39457728](https://www.pexels.com/photo/39457728/) |
| بنطلون تشينو قطني بلون حجري | `stone-cotton-chinos-1.webp` `stone-cotton-chinos-2.webp` | [9464625](https://www.pexels.com/photo/9464625/)، [9464630](https://www.pexels.com/photo/9464630/) |
| بنطلون قطني زيتي بقصة مستدقة | `olive-tapered-trousers-1.webp` | [4066289](https://www.pexels.com/photo/4066289/) |
| بنطلون كارجو كاكي بحزام قماش | `sand-cargo-joggers-1.webp` `sand-cargo-joggers-2.webp` | [6503007](https://www.pexels.com/photo/6503007/)، [6503006](https://www.pexels.com/photo/6503006/) |
| بنطلون قطني أسود بساق واسعة | `black-wide-leg-lounge-pants-1.webp` `black-wide-leg-lounge-pants-2.webp` `black-wide-leg-lounge-pants-3.webp` | [33055598](https://www.pexels.com/photo/33055598/)، [33055599](https://www.pexels.com/photo/33055599/)، [33055597](https://www.pexels.com/photo/33055597/) |
| بنطلون أصفر بكسرات أمامية وطول كروب | `yellow-pleated-cropped-trousers-1.webp` | [39457559](https://www.pexels.com/photo/39457559/) |
| بنطلون كريب بيج بساق واسعة | `beige-crepe-wide-leg-trousers-1.webp` | [39457741](https://www.pexels.com/photo/39457741/) |
| جوغر قطني برباط | `cotton-jersey-joggers-1.webp` `cotton-jersey-joggers-2.webp` `cotton-jersey-joggers-3.webp` | [39457735](https://www.pexels.com/photo/39457735/)، [39457734](https://www.pexels.com/photo/39457734/)، [39457738](https://www.pexels.com/photo/39457738/) |

### فساتين وعبايات

| المنتج | الملفات | المصدر |
|---|---|---|
| عباية شيفون سوداء بتطريز خرز | `black-embroidered-chiffon-abaya-1.webp` `black-embroidered-chiffon-abaya-2.webp` `black-embroidered-chiffon-abaya-3.webp` | [13838842](https://www.pexels.com/photo/13838842/)، [13838843](https://www.pexels.com/photo/13838843/)، [13838839](https://www.pexels.com/photo/13838839/) |
| فستان ميدي موكا بنقشة حلقات | `brown-geometric-print-midi-dress-1.webp` `brown-geometric-print-midi-dress-2.webp` `brown-geometric-print-midi-dress-3.webp` | [29945212](https://www.pexels.com/photo/29945212/)، [29945213](https://www.pexels.com/photo/29945213/)، [29945215](https://www.pexels.com/photo/29945215/) |
| عباية ساتان برقوقية بكسرات أمامية | `plum-satin-abaya-1.webp` `plum-satin-abaya-2.webp` `plum-satin-abaya-3.webp` | [34957206](https://www.pexels.com/photo/34957206/)، [34957209](https://www.pexels.com/photo/34957209/)، [34957207](https://www.pexels.com/photo/34957207/) |
| عباية روز مطفي بأكمام فراشة مطرّزة | `dusty-rose-embroidered-abaya-1.webp` `dusty-rose-embroidered-abaya-2.webp` | [37155277](https://www.pexels.com/photo/37155277/)، [37155276](https://www.pexels.com/photo/37155276/) |
| فستان ماكسي مشجر بأكمام منفوخة | `floral-puff-sleeve-maxi-dress-1.webp` `floral-puff-sleeve-maxi-dress-2.webp` | [27081782](https://www.pexels.com/photo/27081782/)، [27081783](https://www.pexels.com/photo/27081783/) |
| فستان ماكسي أخضر بطبقات ودانتيل | `green-tiered-maxi-dress-1.webp` | [17153107](https://www.pexels.com/photo/17153107/) |
| فستان سهرة تول أحمر كرزي بصدر مطرّز | `crimson-tulle-evening-gown-1.webp` `crimson-tulle-evening-gown-2.webp` | [15751041](https://www.pexels.com/photo/15751041/)، [15751040](https://www.pexels.com/photo/15751040/) |
| فستان شاش كريمي بأكمام طويلة | `cream-tiered-long-sleeve-dress-1.webp` | [20331933](https://www.pexels.com/photo/20331933/) |
| فستان قميص ساتان أسود | `black-satin-shirt-dress-1.webp` `black-satin-shirt-dress-2.webp` `black-satin-shirt-dress-3.webp` | [20364751](https://www.pexels.com/photo/20364751/)، [20364749](https://www.pexels.com/photo/20364749/)، [20364750](https://www.pexels.com/photo/20364750/) |

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

### حقائب

| المنتج | الملفات | المصدر |
|---|---|---|
| حقيبة يد جلد بمقبض علوي – تركوازي داكن | `teal-leather-top-handle-satchel-1.webp` `teal-leather-top-handle-satchel-2.webp` `teal-leather-top-handle-satchel-3.webp` | [4830925](https://www.pexels.com/photo/4830925/)، [4830924](https://www.pexels.com/photo/4830924/)، [4830923](https://www.pexels.com/photo/4830923/) |
| حقيبة توت جلد بني داكن بمقابض بيج | `dark-brown-leather-tote-1.webp` `dark-brown-leather-tote-2.webp` `dark-brown-leather-tote-3.webp` | [27174573](https://www.pexels.com/photo/27174573/)، [27174545](https://www.pexels.com/photo/27174545/)، [27174543](https://www.pexels.com/photo/27174543/) |
| حقيبة كروس جلد محبّب أسود بسحّاب | `black-pebbled-leather-crossbody-1.webp` | [27174548](https://www.pexels.com/photo/27174548/) |
| حقيبة ميني برتقالية بمقبض علوي | `orange-mini-top-handle-bag-1.webp` `orange-mini-top-handle-bag-2.webp` | [8801036](https://www.pexels.com/photo/8801036/)، [8801038](https://www.pexels.com/photo/8801038/) |
| حقيبة هلالية بلون الكونياك بملمس منقوش | `cognac-crescent-shoulder-bag-1.webp` | [6211599](https://www.pexels.com/photo/6211599/) |
| حقيبة ظهر بغطاء علوي – زيتي ورمادي داكن | `olive-flap-backpack-1.webp` `olive-flap-backpack-2.webp` | [18510447](https://www.pexels.com/photo/18510447/)، [18510444](https://www.pexels.com/photo/18510444/) |
| حافظة بطاقات جلد طبيعي بلون العسل | `tan-leather-card-holder-1.webp` | [27467367](https://www.pexels.com/photo/27467367/) |
| حقيبة كتف حمراء بنقشة التمساح | `red-croc-embossed-shoulder-bag-1.webp` | [27174544](https://www.pexels.com/photo/27174544/) |

### إكسسوارات

| المنتج | الملفات | المصدر |
|---|---|---|
| ساعة كرونوغراف سوداء بلمسات نحاسية | `black-copper-chronograph-watch-1.webp` `black-copper-chronograph-watch-2.webp` | [10414974](https://www.pexels.com/photo/10414974/)، [10436602](https://www.pexels.com/photo/10436602/) |
| ساعة ستانلس ستيل بميناء كحلي | `navy-dial-steel-watch-1.webp` | [39081167](https://www.pexels.com/photo/39081167/) |
| نظارة شمسية بإطار تورتواز وعدسات بنية | `tortoiseshell-round-sunglasses-1.webp` `tortoiseshell-round-sunglasses-3.webp` | [29538715](https://www.pexels.com/photo/29538715/)، [29538708](https://www.pexels.com/photo/29538708/) |
| نظارة شمسية مستطيلة سوداء | `black-rectangular-sunglasses-1.webp` | [8360292](https://www.pexels.com/photo/8360292/) |
| حزام جلد بني بإبزيم ذهبي | `brown-leather-belt-gold-buckle-1.webp` `brown-leather-belt-gold-buckle-2.webp` | [35322147](https://www.pexels.com/photo/35322147/)، [35322156](https://www.pexels.com/photo/35322156/) |
| إيشارب حرير أصفر بنقشة مرسومة | `yellow-printed-silk-scarf-1.webp` `yellow-printed-silk-scarf-2.webp` | [36455711](https://www.pexels.com/photo/36455711/)، [36455718](https://www.pexels.com/photo/36455718/) |
| إيشارب حرير بنقشة برتقالية وزرقاء | `orange-blue-printed-silk-scarf-1.webp` `orange-blue-printed-silk-scarf-2.webp` | [36455708](https://www.pexels.com/photo/36455708/)، [36455706](https://www.pexels.com/photo/36455706/) |
| كاب قطن مغسول بلون كاكي | `khaki-washed-cotton-cap-1.webp` | [7562957](https://www.pexels.com/photo/7562957/) |
| طقم أقراط وخواتم بلون ذهبي | `gold-tone-earrings-rings-set-1.webp` | [9430468](https://www.pexels.com/photo/9430468/) |
| عطر بزجاجة مربعة وغطاء عنابي | `amber-glass-eau-de-parfum-1.webp` | [4735929](https://www.pexels.com/photo/4735929/) |
