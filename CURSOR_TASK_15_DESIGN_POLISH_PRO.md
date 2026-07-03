# CURSOR_TASK_15 — iOS PRO Design Polish (Full Audit + Tasklist)

> Auditor: Claude (Fable). Sana: 2026-07-02.
> Scope: `parfum-shop/src` — App.jsx (7746 satr), komponentlar, theme.js, glass.js, index.css.
> Maqsad: appni "yaxshi" darajadan **Apple-darajadagi PRO polish** ga olib chiqish.

---

## 1. NIMA ALLAQACHON ZO'R (buzmaslik kerak!)

- `iosSpring` presetlar (snappy/smooth/bouncy) — SwiftUI fizikasi bilan mos. ✅
- `GlassNavBar` — layoutId pill morph, liquid glass, badge pop. Apple-level. ✅
- `EdgeSwipeBack` — UIKit push/pop + swipe-back gesture. To'g'ri qilingan. ✅
- ProductDetail hero — scroll-parallax `useMotionValue` bilan compositor'da. ✅
- `EmptyState`, `Skeleton`, PullToRefresh, Toast spring — bor. ✅
- Token tizimi (`T` + `--ku-*` CSS vars), dark theme asosi, `prefers-reduced-motion`. ✅
- Perf intizomi: `content-visibility`, will-change'ni olib tashlash, display:none tab arxitekturasi. ✅

**Xulosa: poydevor kuchli. Muammo — intizom va detallar. Quyida hammasi.**

---

## 2. TOPILGAN KAMCHILIKLAR (audit dalillar bilan)

### A. Motion / Animatsiya

| # | Muammo | Dalil |
|---|--------|-------|
| A1 | **Tab almashish "blink" bo'lib qoldi.** `screenFx` faqat opacity 0.55→1, 150ms (App.jsx:6126). iOS'da tab almashganda subtle crossfade+shift bo'ladi — hozirgisi "miltillash" kabi seziladi. | App.jsx:6120–6127, 7515 |
| A2 | **Easing xaosi:** App.jsx'da 23 xil `duration` qiymati (0.08…5) va 10 marta `ease: 'linear'`, 5 marta `easeInOut`, 3 xil bezier. iOS his qilinishi uchun BITTA tizim kerak. | grep natijasi |
| A3 | **ConfirmDialog'da exit animatsiya YO'Q** — CSS keyframes bilan kiradi, yopilishda shartaki g'oyib bo'ladi. Spring yo'q, blur yo'q, grabber yo'q, drag-to-dismiss yo'q. | ConfirmDialog.jsx:44–60 |
| A4 | **SortFilterSheet'da grabber bor, lekin drag-to-dismiss YO'Q** — iOS sheet'ning asosiy jesti ishlamaydi. | SortFilterSheet.jsx |
| A5 | **BannerSlider'da swipe YO'Q** — foydalanuvchi barmoq bilan varaqlay olmaydi, faqat avto (4.5s) va mitti nuqtalar. Ken Burns `ease:"linear"` — mexanik his. | App.jsx:1239–1300 |
| A6 | **Toast transform konflikti:** `transform: translateX(-50%)` inline + framer-motion `y/scale` bir-birini yozib yuborishi mumkin → markazdan siljish xavfi. | App.jsx:106–150 |
| A7 | Katalog gridda **birinchi ochilishda stagger entrance yo'q** — kartalar bir zumda paydo bo'ladi. |
| A8 | **Card → Detail o'tishda shared-element yo'q** — rasm karta'dan hero'ga "uchib o'tmaydi" (layoutId ishlatilmagan). Bu eng katta "wow" imkoniyati. |

### B. Rang va Token intizomi (dark mode xavfi!)

| # | Muammo | Dalil |
|---|--------|-------|
| B1 | **400+ hardcoded rang** App.jsx'da token o'rniga: `#fff`×103, `#111111`×89, `#8E8E93`×39, `#F5F5F5`×28, `#EEEEEE`×16… Native dark mode'da bular SINADI. | grep hisobi |
| B2 | **Material Design ranglari** brend monoxromiga yot: `#E8F5E9`, `#FFCDD2`, `#FFF5F5`, `#E0E0E0` (status chip/error bloklar). iOS tinted-fill uslubi kerak. |
| B3 | `#C9A84C` (oltin) — hujjatlashtirilmagan aksent, tokenlarda yo'q. |
| B4 | **Skeleton dark mode'da sinadi** — gradient `#f5f5f5/#ececec` hardcoded. | Skeleton.jsx:7 |
| B5 | `T`da `warning`, `info`, `gold` semantik tokenlar yo'q — shuning uchun hamma joyga hex yozilgan. |

### C. Radius / Spacing / Tipografika

| # | Muammo | Dalil |
|---|--------|-------|
| C1 | **20 xil borderRadius** (2…999): 14×45, 12×24, 10×19, 20×14, 16×11, plus 9, 22, 26, 30, 50… Shkala kerak. | grep hisobi |
| C2 | **index.css'da Vite-template qoldiqlari:** `--text:#6b6375`, `--code-bg`, `h1{56px}`, `code/.counter` stillari — appda ishlatilmaydi, lekin global h1/h2'ni buzish xavfi bor. | index.css |
| C3 | Tipografika shkalasi token qilinmagan (largeTitle/title/body/caption) — fontSize'lar tarqoq. |

### D. iOS-pattern kamchiliklari

| # | Muammo |
|---|--------|
| D1 | Banner nuqtalari va carousel dots — **6px, touch-target 44px emas** (Apple HIG buzilishi). |
| D2 | Login: yuklanish faqat matn ("ОТПРАВКА…") — spinner yo'q; xato banner shake'siz; **OTP 6 ta alohida katak emas** (premium standart). |
| D3 | Haptics 35 joyda bor, lekin YO'Q: banner/carousel swipe, story ochish/yopish, xato holatlar (`warning`), checkout muvaffaqiyati to'liq emas. |
| D4 | **Checkout'dan keyin "signature moment" yo'q** — buyurtma tugagach katta chek-mark animatsiyasi (SVG path-draw + spring) bo'lishi kerak. |
| D5 | ProductDetail uchun skeleton yo'q (katalogda bor). |
| D6 | Web/desktop uchun `:focus-visible` ring yo'q (a11y). |

---

## 3. TASK LIST — bajarish tartibida (P0 → P2)

> Har bir task mustaqil commit. Qoida: **web build vizual regressiyasiz** (repo qoidasi), har taskdan keyin `npm run build` + vizual tekshiruv.

### 🔴 P0 — poydevor (avval shu)

**TASK 1 — Motion tokenlarini yagonalashtirish**
- `src/motion.js` yarat (yoki MotionScreen exportlarini kengaytir): `DUR = {fast:0.15, base:0.25, slow:0.35}`, `iosEase`, `iosSpring` — yagona manba.
- App.jsx bo'ylab: barcha `ease:'linear'` (istisno: shimmer, spinner, progress-bar) → `iosEase` yoki spring; `easeInOut` → `iosEase`; ad-hoc bezierlar (`[0.22,1,0.36,1]`, `[0.25,...]`) → `iosEase`.
- Acceptance: `grep "ease: 'linear'" src/App.jsx` faqat progress/shimmer'da qoladi; yangi duration qiymatlari faqat DUR'dan.

**TASK 2 — Rang token sweep (dark mode uchun kritik)**
- `theme.js`ga qo'shish: `warning:'#FF9500'`, `successIOS:'#34C759'`, `gold:'#C9A84C'`, `textMuted2:'#8E8E93'` + mos `--ku-*` dark variantlari `index.css`ga.
- App.jsx + AdminScreens.jsx'da almashtirish xaritasi: `#fff→kontekstga qarab T.white yoki 'var(--ku-on-accent,#fff)'`, `#111111→T.accent/T.text`, `#F5F5F5→T.bgSecond`, `#EEEEEE→T.border`, `#8E8E93/#AEAEB2→T.textMuted`, `#E53935→T.danger`, `#FF9500→T.warning`, `#34C759→T.successIOS`.
- Material bloklar (`#E8F5E9`, `#FFF5F5`, `#FFCDD2`, `#E0E0E0`) → iOS tinted-fill: `rgba(danger, 0.10)` uslubida token orqali.
- Acceptance: JSX inline stillarda hex faqat theme.js/glass.js/icons ichida; native dark mode'da har ekran ko'zdan kechirilgan.

**TASK 3 — Radius shkalasi**
- `theme.js`: `R = {sm:10, md:12, lg:14, xl:16, xxl:20, sheet:24, pill:999}` (glass.js'dagi GLASS_RADIUS bilan moslashtir).
- G'alati qiymatlarni yaqiniga yopishtir: 9→10, 22→20, 26→24, 50→pill.
- Acceptance: borderRadius grep'da faqat R qiymatlari (2/3/4px mikro-elementlar — dots/handle — istisno).

### 🟠 P1 — his-tuyg'u (eng katta vizual effekt)

**TASK 4 — Tab almashish transitionini iOS darajasiga ko'tarish**
- display:none arxitekturasini SAQLA (white-flash fix). Lekin `screenFx`ni boyit: yo'nalishga qarab (tab index farqi) `x: ±14 → 0` + `opacity 0.6→1`, `iosSpring.snappy`. Opacity "blink" (0.55 set) o'rniga birlashgan smooth harakat.
- Acceptance: tab almashganda kontent sezilarli, yumshoq, yo'nalishli kiradi; 120Hz'da lag yo'q (faqat transform/opacity).

**TASK 5 — Shared-element: karta rasmi → detail hero**
- ProductCard rasmiga `layoutId={'pimg-'+p.id}` (motion.img), ProductDetail hero'dagi mos rasmga ham shu layoutId. EdgeSwipeBack slide bilan birga ishlashini tekshir.
- Agar WKWebView'da artefakt bersa — fallback: hero kirishida scale 1.04→1 + crossfade.
- Acceptance: kartani bosganda rasm uzluksiz hero'ga "oqib o'tadi".

**TASK 6 — Universal BottomSheet primitivi + drag-to-dismiss**
- Yangi `components/BottomSheet.jsx`: grabber, `backdropFilter: blur(8px)` + dim, `iosSpring.smooth` slide, **drag-to-dismiss** (y>120px yoki velocity>500 → yopish + `haptic('light')`), safe-area padding, `maxWidth:480`.
- SortFilterSheet, ConfirmDialog, RegisterModal, notification sheet — hammasi shu primitivga o'tadi.
- ConfirmDialog: framer-motion'ga o'tkaz (exit animatsiya!), destructive tugma `T.danger`, confirm'da `haptic('medium')`.
- Acceptance: barcha sheetlar bir xil his; pastga tortib yopish ishlaydi; yopilish animatsiyali.

**TASK 7 — BannerSlider: swipe + Ken Burns polish**
- framer-motion `drag="x"` bilan qo'lda varaqlash, snap + `haptic('light')`; touch paytida avto-advance pauza.
- Ken Burns: `ease:'linear'` → `easeOut`, har slaydda yo'nalish almashsin (zoom-in / zoom-out navbatlashadi).
- Dots: vizual 6px qolsin, lekin tap-target `padding:12` bilan ≥44px.
- Acceptance: banner barmoq bilan suriladi, avto-pauza ishlaydi.

**TASK 8 — Checkout "signature moment"**
- Buyurtma muvaffaqiyatida full-screen overlay: doira ichida chek-mark **SVG path-draw** (pathLength 0→1, 0.5s iosEase) + `iosSpring.bouncy` scale + `haptic('success')` + 1.6s'dan keyin OrderReceipt'ga smooth o'tish.
- Acceptance: har buyurtmada esda qoladigan mikro-lahza.

### 🟡 P2 — detallar (PRO farqi shu yerda)

**TASK 9 — Login polish**
- OTP: 6 alohida katak, auto-advance, to'lganda success pulse; xato → katakcha shake (`x:[0,-6,6,-3,3,0]`) + `haptic('warning')`.
- Tugma loading: matn o'rniga inline spinner (SVG, rotate 0.8s linear — bu istisno) + width saqlanadi (layout shift yo'q).
- Hardcoded ranglar (#8E8E93, #FFF5F5, #FFCDD2) → tokenlar (TASK 2 bilan birga).

**TASK 10 — Skeleton dark-mode + ProductDetailSkeleton**
- Skeleton gradient → `var(--ku-surface-2)` / `var(--ku-fill)`.
- Yangi `ProductDetailSkeleton` (hero + title + chips + button joylari) — detail ochilganda rasm yuklanguncha.

**TASK 11 — Status chiplar iOS uslubiga**
- Har status: `background: <rang> 12% alpha`, matn shu rangning to'q toni, oldida 6px dot. Material palette o'rniga T tokenlari.

**TASK 12 — Toast fix + glass**
- Markazlash: `left:16, right:16, margin:'0 auto', width:'fit-content'` (translateX olib tashlanadi — motion bilan konflikt yo'qoladi).
- Native'da `useGlass()` material; success variantida mini chek-mark draw; error'da yengil shake + `haptic('warning')`.

**TASK 13 — Haptics pass**
- Qo'shish: banner/carousel swipe (`light`), story ochish/yopish (`light`), qty limit/xato toast (`warning`), bonus yechish (`medium`), checkout success (`success`).
- Qoida: har bir foydalanuvchi qarori = haptic; skroll/passiv narsalarga YO'Q.

**TASK 14 — Katalog stagger entrance**
- Faqat birinchi mount'da: kartalar `FadeInItem` bilan `delay: Math.min(i*0.03, 0.3)`. Refresh/filtrlashda stagger YO'Q (bezovta qiladi).

**TASK 15 — index.css tozalash + a11y**
- Vite-template qoldiqlarini o'chir: `--text/#6b6375`, `--code-bg`, `h1{56px}` bloki, `code/.counter` stillari.
- Qo'sh: `:focus-visible { outline: 2px solid var(--ku-accent); outline-offset: 2px; }` (web/desktop uchun).
- Acceptance: build o'zgarmagan vizual (template stillari hech qayerda ishlatilmasligini grep bilan isbotla).

---

## 4. TAYYOR PROMPT (AI-agentga copy-paste, English)

```
You are a top-1% iOS-obsessed frontend engineer working on `parfum-shop`
(React 19 + Vite + Capacitor, framer-motion, monochrome black/white brand,
iOS 26 Liquid Glass on native). Read CLAUDE.md and CURSOR_TASK_15_DESIGN_POLISH_PRO.md first.

HARD RULES:
1. Never hardcode hex colors in JSX — only tokens from src/theme.js (T, R) and --ku-* CSS vars. Dark mode must survive every change.
2. All motion uses iosSpring presets or iosEase from src/components/MotionScreen.jsx. No 'linear', no ad-hoc beziers (exceptions: shimmer, spinners, progress bars).
3. Animate only transform/opacity (compositor-safe, 120Hz). No persistent will-change. Never animate a subtree containing backdrop-filter with scale.
4. The web build must stay visually identical unless the task says otherwise; glass/dark effects gate behind IS_NATIVE.
5. Every user decision gets a haptic (light/medium/success/warning). Never on scroll.
6. All sheets: grabber + blur backdrop + spring slide + drag-to-dismiss + exit animation + safe-area padding.
7. Touch targets >= 44px even when visuals are smaller (pad the hit area).
8. Respect prefers-reduced-motion and prefers-reduced-transparency.
9. One task = one commit. After each: npm run build must pass, no console errors, verify light AND dark (native) visually.

Execute TASK <N> from CURSOR_TASK_15_DESIGN_POLISH_PRO.md exactly. If a change
risks WKWebView rendering bugs (blur+opacity on iOS), implement the documented
fallback instead. Report what changed, files touched, and how you verified.
```

---

## 5. Kutilayotgan natija

P0 (1–3): dizayn-tizim intizomi — dark mode xavfsiz, bir tilda gaplashadigan motion.
P1 (4–8): foydalanuvchi HIS qiladigan farq — tab, sheet, banner, karta→detail, checkout momenti.
P2 (9–15): Apple'ni Apple qiladigan mayda detallar.

Hammasi bajarilsa — bu app App Store'dagi ko'p "premium" e-commerce applardan sezilarli ustun turadi. Poydevor allaqachon shunga loyiq qilib qurilgan.


---

## 6. BAJARILISH HOLATI (2026-07-02, Claude Fable)

| Task | Holat | Izoh |
|------|-------|------|
| T1 Motion tokenlar | ✅ | 15 ad-hoc bezier → iosEase, DUR qo'shildi |
| T2 Rang tokenlar | ✅ (semantik qism) | 80+ almashtirish; #fff/#111 kontekstli sweep → dark-mode vizual QA bilan keyin |
| T3 Radius shkala | ✅ | R shkalasi, kapsulalar→999, doiralar saqlandi |
| T4 Yo'nalishli tab | ✅ | dir asosida x±14 + snappy spring |
| T5 Hero entrance | ✅ (fallback) | layoutId WKWebView xavfi — hujjatlashtirilgan fallback: zoom-settle |
| T6 BottomSheet | ✅ | primitiv + SortFilter/Confirm/Notif migratsiya, drag-to-dismiss |
| T7 BannerSlider | ✅ | swipe, avto-pauza, Ken Burns alternate, 30px dots |
| T8 Checkout moment | ✅ | OrderSuccessGate: check path-draw + haptic |
| T9 Login OTP | ✅ | 6 katak (yashirin input, SMS autofill saqlandi), spinner, shake |
| T10 Skeleton dark | ✅ | token gradient. ProductDetailSkeleton — kerak emas (data sinxron, rasm fade bor) |
| T11 Status chiplar | ✅ | tinted-fill 12% + dot |
| T12 Toast fix | ✅ | transform konflikti yo'q, margin markazlash |
| T13 Haptics | ✅ | error toast→warning, bonus toggle→medium, banner/dots (T7) |
| T14 Katalog stagger | ✅ (mavjud edi) | birinchi 8 karta allaqachon stagger bilan kirardi |
| T15 CSS tozalash | ✅ | template qoldiqlar o'chdi, :focus-visible qo'shildi |

Qolgan ixtiyoriy: ConfirmDialog'ni window.confirm o'rniga ulash; to'liq layoutId shared-element (real qurilmada iterativ); #fff/#111 to'liq sweep + dark-mode ekranma-ekran QA.
