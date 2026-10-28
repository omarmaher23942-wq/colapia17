#!/usr/bin/env node
// يولّد شرائح منشورات V6 (HTML) من البيانات أدناه، ثم: node marketing/render.mjs marketing/posts-v6/pN --raw
// وبعدها node marketing/posts-v6/finalize.mjs لنسخ S_1.png… إلى out/. كل نص هنا صادق: لا أرقام مبيعات مخترعة ولا أسماء أدوات.
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const ck = '<i class="ic ic-check"></i>';
const xx = '<i class="ic ic-x"></i>';

const wrap = (n, total, inner, cls = "") => `<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=1080"><title>${n}</title>
<link rel="stylesheet" href="../../shared/brand.css"></head>
<body><div class="slide ${cls}">
<div class="top"><div class="brand"><img src="../../shared/mark.png" alt=""><b>Colapia</b></div><span class="count">${String(n).padStart(2, "0")} / ${String(total).padStart(2, "0")}</span></div>
<div class="main">${inner}</div>
<div class="foot"><span class="swipe">${n < total ? 'اسحبوا <i class="ic ic-left"></i>' : "&nbsp;"}</span><span class="url">colapia.com</span></div>
</div></body></html>`;

const eyebrow = (t) => `<span class="eyebrow">${t}</span>`;
const browser = (url, img, extra = "") => `<div class="browser" style="max-height:640px;overflow:hidden;${extra}"><div class="bar"><i class="dot"></i><i class="dot"></i><i class="dot"></i><span class="url">${url}</span></div><img src="${img}" alt=""></div>`;
const phone = (img, extra = "") => `<div class="phone" style="${extra}"><img src="${img}" alt=""></div>`;
const chips = (arr, cls = "blue") => `<div class="row gap-s" style="flex-wrap:wrap">${arr.map((c) => `<span class="chip ${cls}">${c}</span>`).join("")}</div>`;
const li = (icon, tone, text) => `<div class="card ${tone}" style="padding:30px 38px"><div class="row"><span class="${tone === "bad" ? "rose" : "mint"}" style="font-size:54px;display:flex">${icon}</span><div class="grow body" style="font-size:44px;color:#eaf0ff;font-weight:700">${text}</div></div></div>`;
const cta = (big, small, btn) => `<div style="margin-top:auto;display:flex;flex-direction:column;gap:30px">${big}<p class="body">${small}</p><span class="cta">${btn}</span></div>`;

const posts = {
  p1: [
    (n, t) => wrap(n, t, `${eyebrow("لأصحاب البراندات")}<h1 class="hero">مشكلتكم مش <span class="grad">قلة الزباين.</span></h1><p class="lead">المشكلة إن الزباين اللي عندكم فعلاً بيضيعوا في الدايركت.</p><div class="chat" style="margin-top:auto"><div class="bub them">بكام؟</div><div class="bub them">متوفر مقاس L؟</div><div class="bub me">لحظة أشوف حضرتك…<small>بعد ساعة</small></div></div>`),
    (n, t) => wrap(n, t, `${eyebrow("اللي بيحصل كل يوم")}<h2 class="h2">كل رسالة منهم زبون بيسأل… <span class="rose">والرد بياخد وقت.</span></h2><div class="chat"><div class="bub them">ابعتوا الصور تاني</div><div class="bub them">هو لسه موجود؟</div><div class="bub them">والتوصيل لأسوان بكام؟</div><div class="bub them">طيب أحجز إزاي؟</div></div><p class="body" style="margin-top:auto">أربع أسئلة من نفس الزبون، وكل سؤال فرصة إنه يزهق ويمشي.</p>`),
    (n, t) => wrap(n, t, `${eyebrow("بيضيع من غير ما تحسوا")}<h2 class="h2">٣ حاجات بتتسرّب في الشات</h2>${li(xx, "bad", "طلب جه بالليل واتنسى للصبح")}${li(xx, "bad", "مقاس اتقال في رسالة ضاعت وسط خمسين")}${li(xx, "bad", "زبون مستني الرد فراح لغيركم")}<p class="small" style="margin-top:auto">ولا واحدة فيهم بتظهر في أي تقرير، فبتفتكروا إن الدنيا ماشية.</p>`),
    (n, t) => wrap(n, t, `${eyebrow("الفكرة اللي بتقلب الصورة")}<h2 class="hero" style="font-size:96px">اللي بيضيع مش <span class="rose">مبيعات محتملة.</span><br>ده <span class="grad">زبون جاهز يشتري.</span></h2><p class="lead">اللي كتب «بكام؟» و«متوفر؟» كان قرر خلاص. محتاج بس مكان يلاقي فيه الإجابة لوحده.</p>`, "center"),
    (n, t) => wrap(n, t, `${eyebrow("الحل")}<h2 class="h2">مش رد أسرع. <span class="grad">زبون ما يحتاجش يسأل.</span></h2>${li(ck, "hl", "المقاس واللون والمخزون قدام عينه")}${li(ck, "hl", "السعر والشحن واضحين قبل الطلب")}${li(ck, "hl", "طلب برقم يوصلكم مرتب")}<p class="small" style="margin-top:auto">والدايركت يفضل للي عايز كلام حقيقي مع براندكم.</p>`),
    (n, t) => wrap(n, t, `${eyebrow("شكله إزاي؟")}<h2 class="h3">متجر كامل بهوية البراند</h2><div class="row" style="justify-content:center;gap:36px;align-items:flex-start;margin-top:8px">${phone("../shots/demo-home-mobile.png", "width:330px")}${phone("../shots/demo-product-mobile.png", "width:330px;margin-top:50px")}</div>`),
    (n, t) => wrap(n, t, `${eyebrow("لو حسّيتوا إن ده بيحصل عندكم")}${cta('<h2 class="hero" style="font-size:104px">ابعتوا لنا<br><span class="grad">كلمة «متجر»</span></h2>', "على صفحتنا هنا، ويتواصل معاكم حد من الفريق.", "ابعتوا «متجر»")}`),
  ],
  p2: [
    (n, t) => wrap(n, t, `${eyebrow("متجر ملابس كامل · نموذج حي")}<h1 class="hero" style="font-size:96px">ده مش مجرد <span class="grad">تصميم.</span><br>ده متجر شغال.</h1><p class="lead">افتحوه من الموبايل، اختاروا مقاس، وضيفوا للسلة… زي أي زبون.</p>${browser("demo.colapia.com", "../shots/demo-home-desktop.png", "margin-top:auto")}`),
    (n, t) => wrap(n, t, `${eyebrow("الصفحة الرئيسية")}<h2 class="h2">هوية واضحة من أول ثانية</h2>${browser("demo.colapia.com", "../shots/demo-home-desktop-2.png")}<p class="body">أقسام بأغلفتها، ووصل حديثاً، وعروض… مرتبة بحيث الزبون يوصل لقطعته بسرعة.</p>`),
    (n, t) => wrap(n, t, `${eyebrow("صفحة المنتج")}<h2 class="h2">المقاس واللون قبل الطلب</h2>${browser("demo.colapia.com/p/…", "../shots/demo-product-desktop.png")}<p class="body">يختار، يشوف المتاح، ويطلب. بدون «ابعتوا الصور تاني».</p>`),
    (n, t) => wrap(n, t, `${eyebrow("على الموبايل")}<h2 class="h3">لأن أغلب زباينكم بيشتروا من الموبايل</h2><div class="row" style="justify-content:center;gap:36px;align-items:flex-start">${phone("../shots/demo-all-mobile.png", "width:330px")}${phone("../shots/demo-home-mobile-2.png", "width:330px;margin-top:50px")}</div>`),
    (n, t) => wrap(n, t, `${eyebrow("داخل المتجر")}<h2 class="h2">كل اللي محتاجينه لإدارة الطلبات</h2>${chips(["مقاسات وألوان ومخزون", "طلب برقم", "تتبع الطلب", "لوحة تحكم بالعربي", "تأكيد الطلب برابط", "كود خصم"])}${li(ck, "hl", "تشوفوا الطلبات وحالتها في مكان واحد")}${li(ck, "hl", "تعدّلوا المنتجات والأسعار بنفسكم")}${li(ck, "hl", "تشتغل من الموبايل والكمبيوتر")}`),
    (n, t) => wrap(n, t, `${eyebrow("جربوه بنفسكم")}<h2 class="hero" style="font-size:100px">اطلبوا منه <span class="grad">كأنكم زبون</span></h2><p class="lead">افتحوا الرابط، شوفوا الشكل والسرعة، واحكموا بأنفسكم.</p><div class="card hl" style="text-align:center;margin-top:12px"><span class="h3" style="direction:ltr;display:block">demo.colapia.com</span></div><p class="small" style="margin-top:auto">متجر عرض لتجربة المستوى، وليس متجراً لبيع منتجات حقيقية.</p>`),
    (n, t) => wrap(n, t, `${eyebrow("متجركم بنفس المستوى")}${cta('<h2 class="hero" style="font-size:104px">عايزين<br><span class="grad">نفس الشكل لبراندكم؟</span></h2>', "ابعتوا لنا رسالة على الصفحة ونرد عليكم.", "ابعتوا «متجر»")}`),
  ],
  p3: [
    (n, t) => wrap(n, t, `${eyebrow("من أعمالنا")}<h1 class="hero">عميل راضي <span class="grad">لدرجة إنه زادنا مكافأة.</span></h1><p class="lead">حكاية موقع Qima… من الفكرة للتسليم.</p>${browser("qima-ten.vercel.app", "../../qima-post/shots/d-hero-ar.png", "margin-top:auto")}`),
    (n, t) => wrap(n, t, `${eyebrow("مين هم؟")}<h2 class="h2">Qima: وكالة إنتاج محتوى مرئي</h2><p class="body">مونتاج فيديو، وتصميم صور مصغّرة، وتوجيه نصوص. كانوا محتاجين موقع يعرض شغلهم بمستواه، ويستقبل طلبات المشاريع.</p>${chips(["مونتاج فيديو", "صور مصغّرة", "توجيه نصوص"])}${browser("qima-ten.vercel.app", "../../qima-post/shots/d-services-ar.png", "margin-top:auto")}`),
    (n, t) => wrap(n, t, `${eyebrow("اللي بنيناه")}<h2 class="h2">موقع بلغتين وهوية خاصة</h2>${li(ck, "hl", "عربي وإنجليزي بنفس الجودة")}${li(ck, "hl", "تصميم داكن بهوية الوكالة")}${li(ck, "hl", "زر طلب مشروع وصفحة تواصل واضحة")}${li(ck, "hl", "يشتغل على الموبايل والكمبيوتر")}`),
    (n, t) => wrap(n, t, `${eyebrow("طريقة عملهم")}<h2 class="h2">كل خطوة معروضة بوضوح</h2>${browser("qima-ten.vercel.app", "../../qima-post/shots/d-process-ar.png")}<p class="body">العميل يفهم الخطوات قبل ما يكلمهم، فبيوصلهم أصحاب مشاريع جادين.</p>`),
    (n, t) => wrap(n, t, `${eyebrow("على الموبايل")}<h2 class="h3">نفس القوة على الشاشة الصغيرة</h2><div class="row" style="justify-content:center;gap:36px;align-items:flex-start">${phone("../../qima-post/shots/m-hero-ar.png", "width:330px")}${phone("../../qima-post/shots/m-services-ar.png", "width:330px;margin-top:50px")}</div>`),
    (n, t) => wrap(n, t, `${eyebrow("النتيجة")}<h2 class="hero" style="font-size:96px">رضا العميل<br><span class="grad">أهم شهادة عندنا.</span></h2><p class="lead">عبّر عن رضاه الكبير عن النتيجة، وقدّم مكافأة إضافية تقديراً للشغل. وبنفتخر بيها أكتر من أي رقم.</p>`, "center"),
    (n, t) => wrap(n, t, `${eyebrow("شغل بنفس المستوى")}${cta('<h2 class="hero" style="font-size:100px">فكرتكم<br><span class="grad">تستاهل نفس الاهتمام.</span></h2>', "موقع، متجر، نظام حجز، لوحة تحكم… احكوا لنا على الصفحة.", "احكوا لنا فكرتكم")}`),
  ],
  p4: [
    (n, t) => wrap(n, t, `${eyebrow("نصيحة غريبة من وكالة")}<h1 class="hero">ما تشتروش متجر <span class="grad">مننا</span> لو…</h1><p class="lead">خمس حالات بنقول فيها لأصحاب البراندات: استنوا، أو دوروا على حل تاني.</p>`, "center"),
    (n, t) => wrap(n, t, `${eyebrow("الحالة 1")}<h2 class="h2">لو بتبيعوا قطع قليلة جداً وبتردوا على كل زبون في دقايق</h2><p class="body">الدايركت لسه كفاية ليكم. وقت المتجر هييجي لما تحسوا إن الرسائل بتسبقكم.</p>`, "center"),
    (n, t) => wrap(n, t, `${eyebrow("الحالة 2")}<h2 class="h2">لو بتدوروا على <span class="rose">أرخص سعر</span> وبس</h2><p class="body">في حلول جاهزة أرخص وبتؤدي الغرض. إحنا بنبني متجراً مخصصاً بكود يخصكم، وده له قيمة لو بتفكروا في براند لسنين.</p>`, "center"),
    (n, t) => wrap(n, t, `${eyebrow("الحالة 3")}<h2 class="h2">لو مش هتتابعوا الطلبات اللي هتوصلكم</h2><p class="body">المتجر بيجيب طلبات أكتر وأنظم. لو مفيش حد هيتابعها ويشحنها، هتتحول لعبء بدل فرصة.</p>`, "center"),
    (n, t) => wrap(n, t, `${eyebrow("الحالة 4")}<h2 class="h2">لو شايفين إن <span class="rose">ملكية الكود</span> مش فارقة</h2><p class="body">لو مش مهم تكون الأرض بتاعتكم، منصة مؤجرة هتخدمكم تمام. إحنا بنسلّم الكود في حساباتكم عشان ما تبقوش رهن حد.</p>`, "center"),
    (n, t) => wrap(n, t, `${eyebrow("الحالة 5")}<h2 class="h2">لو مستنيين <span class="rose">الكمال</span> قبل ما تبدأوا</h2><p class="body">المتجر بيتحسّن مع الوقت. اللي بيبدأ بنسخة محترمة النهاردة بيسبق اللي مستني النسخة المثالية.</p>`, "center"),
    (n, t) => wrap(n, t, `${eyebrow("ولو لسه بتقرأوا…")}${cta('<h2 class="hero" style="font-size:92px">يبقى غالباً <span class="grad">اللي بنبنيه يناسبكم.</span></h2>', "لو بتخسروا زباين في الدايركت وعايزين براندكم يظهر بمستواه، ابعتوا لنا رسالة.", "ابعتوا «متجر»")}`),
  ],
  p5: [
    (n, t) => wrap(n, t, `${eyebrow("سؤال واحد")}<h1 class="hero">لو وقفتوا الاشتراك بكرة… <span class="grad">متجركم يفضل شغال؟</span></h1>`, "center"),
    (n, t) => wrap(n, t, `${eyebrow("فكرة")}<h2 class="h2">في ناس بتبني براندها على <span class="rose">أرض مش بتاعتها.</span></h2><p class="lead">الإيجار مريح في الأول… بس مع الوقت الحسبة بتفرق، وقرارات مكانك مش دايماً في إيدك.</p>`, "center"),
    (n, t) => wrap(n, t, `${eyebrow("اسألوا نفسكم")}<h2 class="h2">٣ أسئلة بسيطة</h2>${li("؟", "", "الكود بتاعي ولا بتاع حد تاني؟")}${li("؟", "", "بيانات زباييني وطلباتي في إيدي؟")}${li("؟", "", "أقدر أنقل متجري بكرة من غير ما أبدأ من الصفر؟")}`),
    (n, t) => wrap(n, t, `${eyebrow("عندنا")}<h2 class="h2">الإجابة «أيوه» للتلاتة</h2>${li(ck, "hl", "الكود في حساباتكم، ملككم بالكامل")}${li(ck, "hl", "المتجر والبيانات على حساباتكم أنتم")}${li(ck, "hl", "بلا اشتراك شهري من Colapia")}<p class="small" style="margin-top:auto">قد تحتاجوا دفع نطاق (دومين) فقط، وأحياناً لا.</p>`),
    (n, t) => wrap(n, t, `${eyebrow("ومش هنسيبكم")}<h2 class="hero" style="font-size:96px">بنكون معاكم <span class="grad">لحد ما يشتغل على حساباتكم.</span></h2><p class="lead">مش نسلّم ملفات ونختفي. بنوصّلكم للحظة إن كل حاجة شغالة باسمكم.</p>`, "center"),
    (n, t) => wrap(n, t, `${eyebrow("متجر يخصكم فعلاً")}${cta('<h2 class="hero" style="font-size:100px">ابنوا على<br><span class="grad">أرض بتاعتكم.</span></h2>', "ابعتوا لنا رسالة على الصفحة ونحكي لكم التفاصيل.", "ابعتوا «متجر»")}`),
  ],
  p6: [
    (n, t) => wrap(n, t, `${eyebrow("عرض الإطلاق")}<h1 class="hero">السعر ده مش خصم.<br><span class="grad">ده استثمار مننا فيكم.</span></h1><p class="lead">أي نظام أو موقع أو متجر لمشروعكم بـ <b class="amber">999 جنيه</b> فقط، لأول 5 عملاء.</p>`, "center"),
    (n, t) => wrap(n, t, `${eyebrow("ليه بالسعر ده؟")}<h2 class="h2">عايزين نوثّق شغل قوي لعملاء حقيقيين</h2><p class="body">أول مشروع اتنفذ بالفعل (Qima). وعايزين أمثلة جديدة بنفس المستوى نعرضها، فبنفتح 5 أماكن بسعر الإطلاق لأي خدمة قبل ما نرجع للسعر الأساسي.</p>`, "center"),
    (n, t) => wrap(n, t, `${eyebrow("اللي هتستلموه")}<h2 class="h2">مشروع كامل باسمكم</h2>${li(ck, "hl", "تصميم مخصص لهويتكم")}${li(ck, "hl", "لوحة تحكم تناسب نوع نظامكم")}${li(ck, "hl", "الكود ملككم، بلا اشتراك شهري من عندنا")}${li(ck, "hl", "مرافقة لحد ما يشتغل على حساباتكم")}`),
    (n, t) => wrap(n, t, `${eyebrow("بشفافية")}<h2 class="h2">إيه المقابل؟</h2><p class="body">رأيكم الصريح بعد التسليم، وإمكانية نعرض المشروع كمثال بموافقتكم على النسخة النهائية فقط. مفيش أي التزام تاني.</p>${chips(["لا عمولة على مبيعاتكم", "لا اشتراك شهري منا", "موافقتكم قبل أي نشر"], "mint")}`),
    (n, t) => wrap(n, t, `${eyebrow("الأماكن محدودة فعلاً")}<h2 class="hero" style="font-size:100px">أول <span class="grad">5 عملاء</span> فقط</h2><p class="lead">لما تكتمل الأماكن بنرجع للسعر الأساسي. مفيش تمديد.</p>`, "center"),
    (n, t) => wrap(n, t, `${eyebrow("لو الفكرة تهمكم")}${cta('<h2 class="hero" style="font-size:104px">ابعتوا لنا<br><span class="grad">كلمة «تفاصيل»</span></h2>', "ويتواصل معاكم حد من الفريق. ولو مش مناسب، مفيش أي مشكلة.", "ابعتوا «تفاصيل»")}`),
  ],
};

for (const [dir, slides] of Object.entries(posts)) {
  const out = path.join(here, dir);
  mkdirSync(out, { recursive: true });
  slides.forEach((fn, i) => writeFileSync(path.join(out, `slide-${String(i + 1).padStart(2, "0")}.html`), fn(i + 1, slides.length)));
  console.log(dir, slides.length);
}
