// Static app data & defaults — extracted from App.jsx (P2.1).

export const PAYMENT_METHODS = [
  { id: "cash", label: "Наличные / Нак. акча", color: "#111111" },
];

export const BG_PRESETS = [
  "linear-gradient(135deg,#111111,#000000)",
  "linear-gradient(135deg,#3B82F6,#1D4ED8)",
  "linear-gradient(135deg,#F59E0B,#D97706)",
  "linear-gradient(135deg,#EF4444,#B91C1C)",
  "linear-gradient(135deg,#8B5CF6,#6D28D9)",
  "linear-gradient(135deg,#EC4899,#BE185D)",
  "linear-gradient(135deg,#06B6D4,#0E7490)",
  "linear-gradient(135deg,#111111,#111111)",
];

export const DEFAULT_SETTINGS = {
  shopName: "Kemal Usman", whatsappPhone: "996551120009",
  contactPhone1: "+996551120009", contactPhone2: "+996557100505",
  // adminPassword removed — admin auth now goes through PocketBase
  // (`pb.admins.authWithPassword`). Manage credentials at /_/ on the PB host.
  bonusPercent: 5, useBonusPercent: 30,
  welcomeBonus: 150, welcomeBonusEnabled: true,
  referralBonus: 100, referralFriendBonus: 50,
  deliveryCost: 300, minOrderForFreeDelivery: 1000,
  loginBg: null,
  // Login screen branding
  loginBrandName: 'Kemal Usman',
  loginBrandTagline: 'Parfum',
  // Desktop hero
  heroSubtitle: 'Bishkek · Parfum na razliv',
  heroTagline: 'Оригинальные ароматы · Лучшие бренды',
  heroButtonText: 'ВЫБРАТЬ АРОМАТ',
  // Footer
  footerCompanyLinks: 'О нас\nДоставка и оплата\nВозврат товара\nКонтакты\nУсловия',
  footerHelpLinks: 'Как сделать заказ\nОтследить заказ\nFAQ',
  copyrightText: '© 2021–2026 Kemal Usman',
  // Social links
  instagramUrl: '',
  tiktokUrl: '',
  youtubeUrl: '',
};

// FALLBACK_IMAGES — disabled: Fragrantica CDN blocks hotlinking (ERR_CONNECTION_RESET)
// Images are now hosted directly on PocketBase via pb-download-images.js
export const FALLBACK_IMAGES = {};

export const INITIAL_PRODUCTS = [
  {
    id: 1, name: "Sauvage", brand: "Dior", category: "Мужские",
    img: null,
    desc: "🔝 Верхние: бергамот, перец Сычуань\n💎 Средние: герань, лаванда, элеми\n🌿 Базовые: амброксан, кедр, лабданум\n\n📋 Тип: EDP · Стойкость: 8-10 ч · Шлейф: сильный\n\nСвежий, дерзкий аромат для уверенного мужчины. Бергамот из Калабрии раскрывается мощным амброксаном — дикий и благородный, как звёздная ночь в пустыне.",
    variants: [{ id: 1, label: "5 мл", price: 350, type: "ml", inStock: true }, { id: 2, label: "10 мл", price: 600, type: "ml", inStock: true }, { id: 3, label: "20 мл", price: 1100, type: "ml", inStock: true }, { id: 301, label: "Упаковка 50 мл", price: 2100, type: "pkg", inStock: true }],
  },
  {
    id: 2, name: "Miss Dior", brand: "Dior", category: "Женские",
    img: null,
    desc: "🔝 Верхние: мандарин, ландыш, пион\n💎 Средние: роза, ирис, жасмин\n🌿 Базовые: пачули, мускус, бобы тонка\n\n📋 Тип: EDP · Стойкость: 6-8 ч · Шлейф: умеренный\n\nНежный цветочный аромат — воплощение женственности и изящества. Роза и пион сплетаются с тёплым пачули, создавая образ искренней любви.",
    variants: [{ id: 4, label: "5 мл", price: 380, type: "ml", inStock: true }, { id: 5, label: "10 мл", price: 650, type: "ml", inStock: true }, { id: 6, label: "20 мл", price: 1200, type: "ml", inStock: true }, { id: 302, label: "Упаковка 50 мл", price: 2300, type: "pkg", inStock: true }],
  },
  {
    id: 3, name: "Bleu de Chanel", brand: "Chanel", category: "Мужские",
    img: null,
    desc: "🔝 Верхние: грейпфрут, лимон, мята\n💎 Средние: жасмин, имбирь, нутмег\n🌿 Базовые: ладан, кедр, сандал\n\n📋 Тип: EDP · Стойкость: 8-12 ч · Шлейф: сильный\n\nДревесно-ароматический шедевр Chanel. Элегантный и уверенный — цитрусовая свежесть плавно переходит в тёплый сандал и ладан. Безвременная классика.",
    variants: [{ id: 7, label: "5 мл", price: 420, type: "ml", inStock: true }, { id: 8, label: "10 мл", price: 750, type: "ml", inStock: true }, { id: 9, label: "20 мл", price: 1350, type: "ml", inStock: true }, { id: 303, label: "Упаковка 50 мл", price: 2600, type: "pkg", inStock: true }],
  },
  {
    id: 4, name: "N°5", brand: "Chanel", category: "Женские",
    img: null,
    desc: "🔝 Верхние: альдегиды, нероли, иланг-иланг\n💎 Средние: роза, жасмин, ландыш\n🌿 Базовые: сандал, ветивер, ваниль\n\n📋 Тип: Parfum · Стойкость: 10-14 ч · Шлейф: сильный\n\nЛегендарный аромат с 1921 года — символ абсолютной роскоши. Цветочно-альдегидная композиция, которую узнают с первой ноты. Вне времени и трендов.",
    variants: [{ id: 10, label: "5 мл", price: 450, type: "ml", inStock: true }, { id: 11, label: "10 мл", price: 800, type: "ml", inStock: true }, { id: 12, label: "20 мл", price: 1450, type: "ml", inStock: true }, { id: 304, label: "Упаковка 50 мл", price: 2800, type: "pkg", inStock: true }],
  },
  {
    id: 5, name: "Black Opium", brand: "YSL", category: "Женские",
    img: null,
    desc: "🔝 Верхние: груша, розовый перец\n💎 Средние: кофе, жасмин, флёрдоранж\n🌿 Базовые: ваниль, пачули, кедр\n\n📋 Тип: EDP · Стойкость: 8-10 ч · Шлейф: сильный\n\nСоблазнительный кофейно-ванильный аромат для смелых женщин. Зёрна кофе и жасмин создают энергичный контраст, а ваниль добавляет чувственную глубину.",
    variants: [{ id: 13, label: "5 мл", price: 360, type: "ml", inStock: true }, { id: 14, label: "10 мл", price: 620, type: "ml", inStock: true }, { id: 15, label: "20 мл", price: 1150, type: "ml", inStock: true }, { id: 305, label: "Упаковка 50 мл", price: 2200, type: "pkg", inStock: true }],
  },
  {
    id: 6, name: "Y Eau de Parfum", brand: "YSL", category: "Мужские",
    img: null,
    desc: "🔝 Верхние: яблоко, имбирь, бергамот\n💎 Средние: шалфей, можжевельник, герань\n🌿 Базовые: амброксан, кедр, бобы тонка\n\n📋 Тип: EDP · Стойкость: 8-10 ч · Шлейф: умеренный\n\nСовременный мужской аромат — свежее яблоко и имбирь встречаются с тёплым амброксаном. Уверенный, динамичный, идеальный на каждый день.",
    variants: [{ id: 16, label: "5 мл", price: 390, type: "ml", inStock: true }, { id: 17, label: "10 мл", price: 680, type: "ml", inStock: true }, { id: 18, label: "20 мл", price: 1250, type: "ml", inStock: true }, { id: 306, label: "Упаковка 60 мл", price: 2400, type: "pkg", inStock: true }],
  },
  {
    id: 7, name: "Eros", brand: "Versace", category: "Мужские",
    img: null,
    desc: "🔝 Верхние: мята, зелёное яблоко, лимон\n💎 Средние: бобы тонка, герань, амброксан\n🌿 Базовые: ваниль, ветивер, дубовый мох\n\n📋 Тип: EDT · Стойкость: 6-8 ч · Шлейф: сильный\n\nСтрастный аромат, вдохновлённый греческим богом любви. Свежая мята и яблоко разгораются в тёплую ваниль — мощный, притягательный, незабываемый.",
    variants: [{ id: 19, label: "5 мл", price: 320, type: "ml", inStock: true }, { id: 20, label: "10 мл", price: 560, type: "ml", inStock: true }, { id: 21, label: "20 мл", price: 1000, type: "ml", inStock: true }, { id: 307, label: "Упаковка 50 мл", price: 1950, type: "pkg", inStock: true }],
  },
  {
    id: 8, name: "Bright Crystal", brand: "Versace", category: "Женские",
    img: null,
    desc: "🔝 Верхние: гранат, юзу, ледяной аккорд\n💎 Средние: магнолия, пион, лотос\n🌿 Базовые: мускус, красное дерево, амбра\n\n📋 Тип: EDT · Стойкость: 4-6 ч · Шлейф: лёгкий\n\nНежный, прозрачный как хрусталь цветочный аромат. Магнолия и пион создают воздушную лёгкость, а мускус добавляет чувственный шлейф.",
    variants: [{ id: 22, label: "5 мл", price: 300, type: "ml", inStock: true }, { id: 23, label: "10 мл", price: 520, type: "ml", inStock: true }, { id: 24, label: "20 мл", price: 950, type: "ml", inStock: true }, { id: 308, label: "Упаковка 50 мл", price: 1850, type: "pkg", inStock: true }],
  },
  {
    id: 9, name: "Acqua di Giò", brand: "Armani", category: "Мужские",
    img: null,
    desc: "🔝 Верхние: бергамот, нероли, зелёный мандарин\n💎 Средние: жасмин, морские ноты, персик\n🌿 Базовые: кедр, мускус, амбра\n\n📋 Тип: EDT · Стойкость: 6-8 ч · Шлейф: умеренный\n\nСвежий морской аромат, вдохновлённый островом Пантеллерия. Бергамот и морской бриз создают ощущение средиземноморского лета круглый год.",
    variants: [{ id: 25, label: "5 мл", price: 340, type: "ml", inStock: true }, { id: 26, label: "10 мл", price: 590, type: "ml", inStock: true }, { id: 27, label: "20 мл", price: 1080, type: "ml", inStock: true }, { id: 309, label: "Упаковка 50 мл", price: 2050, type: "pkg", inStock: true }],
  },
  {
    id: 10, name: "Sì", brand: "Armani", category: "Женские",
    img: null,
    desc: "🔝 Верхние: чёрная смородина, мандарин\n💎 Средние: нероли, роза, фрезия\n🌿 Базовые: ваниль, пачули, амброксан\n\n📋 Тип: EDP · Стойкость: 8-10 ч · Шлейф: умеренный\n\nЧувственный женственный аромат — чёрная смородина встречается с нежной розой и тёплой ванилью. Современная элегантность в каждой капле.",
    variants: [{ id: 28, label: "5 мл", price: 370, type: "ml", inStock: true }, { id: 29, label: "10 мл", price: 640, type: "ml", inStock: true }, { id: 30, label: "20 мл", price: 1180, type: "ml", inStock: true }, { id: 310, label: "Упаковка 50 мл", price: 2250, type: "pkg", inStock: true }],
  },
  {
    id: 11, name: "Light Blue", brand: "Dolce&Gabbana", category: "Унисекс",
    img: null,
    desc: "🔝 Верхние: сицилийский лимон, яблоко Гренни Смит\n💎 Средние: бамбук, жасмин, белая роза\n🌿 Базовые: кедр, мускус, амбра\n\n📋 Тип: EDT · Стойкость: 4-6 ч · Шлейф: лёгкий\n\nЛёгкий средиземноморский аромат — сицилийский лимон и зелёное яблоко дарят ощущение летнего побережья. Идеален для жаркого дня.",
    variants: [{ id: 31, label: "5 мл", price: 280, type: "ml", inStock: true }, { id: 32, label: "10 мл", price: 490, type: "ml", inStock: true }, { id: 33, label: "20 мл", price: 900, type: "ml", inStock: true }, { id: 311, label: "Упаковка 50 мл", price: 1750, type: "pkg", inStock: true }],
  },
  {
    id: 12, name: "The One", brand: "Dolce&Gabbana", category: "Мужские",
    img: null,
    desc: "🔝 Верхние: грейпфрут, кориандр, базилик\n💎 Средние: имбирь, кардамон, флёрдоранж\n🌿 Базовые: табак, амбра, кедр\n\n📋 Тип: EDP · Стойкость: 8-10 ч · Шлейф: сильный\n\nВосточный пряный аромат для харизматичного мужчины. Тёплый табак и кардамон обволакивают роскошной амброй — идеален для вечера.",
    variants: [{ id: 34, label: "5 мл", price: 350, type: "ml", inStock: true }, { id: 35, label: "10 мл", price: 600, type: "ml", inStock: true }, { id: 36, label: "20 мл", price: 1100, type: "ml", inStock: true }, { id: 312, label: "Упаковка 50 мл", price: 2100, type: "pkg", inStock: true }],
  },
  {
    id: 13, name: "Boss Bottled", brand: "Hugo Boss", category: "Мужские",
    img: null,
    desc: "🔝 Верхние: яблоко, цитрусы, слива\n💎 Средние: герань, корица, гвоздика\n🌿 Базовые: сандал, кедр, ветивер\n\n📋 Тип: EDT · Стойкость: 6-8 ч · Шлейф: умеренный\n\nКлассический мужской аромат для делового стиля. Яблоко и корица создают тёплое вступление, а сандал с кедром — уверенный финиш.",
    variants: [{ id: 37, label: "5 мл", price: 290, type: "ml", inStock: true }, { id: 38, label: "10 мл", price: 500, type: "ml", inStock: true }, { id: 39, label: "20 мл", price: 920, type: "ml", inStock: true }, { id: 313, label: "Упаковка 50 мл", price: 1780, type: "pkg", inStock: true }],
  },
  {
    id: 14, name: "Hugo Man", brand: "Hugo Boss", category: "Мужские",
    img: null,
    desc: "🔝 Верхние: зелёное яблоко, мята, лаванда\n💎 Средние: шалфей, герань, гвоздика\n🌿 Базовые: кедр, сандал, мускус\n\n📋 Тип: EDT · Стойкость: 4-6 ч · Шлейф: лёгкий\n\nДерзкий свежий аромат для свободного духа. Зелёное яблоко и мята заряжают энергией, кедр добавляет мужественности.",
    variants: [{ id: 40, label: "5 мл", price: 260, type: "ml", inStock: true }, { id: 41, label: "10 мл", price: 450, type: "ml", inStock: true }, { id: 42, label: "20 мл", price: 830, type: "ml", inStock: true }, { id: 314, label: "Упаковка 40 мл", price: 1600, type: "pkg", inStock: true }],
  },
  {
    id: 15, name: "CK One", brand: "Calvin Klein", category: "Унисекс",
    img: null,
    desc: "🔝 Верхние: бергамот, кардамон, ананас\n💎 Средние: жасмин, фиалка, зелёный чай\n🌿 Базовые: мускус, амбра, кедр\n\n📋 Тип: EDT · Стойкость: 4-6 ч · Шлейф: лёгкий\n\nКультовый унисекс аромат с 1994 года. Зелёный чай и бергамот создают ощущение чистоты и свободы. Подходит всем, всегда.",
    variants: [{ id: 43, label: "5 мл", price: 240, type: "ml", inStock: true }, { id: 44, label: "10 мл", price: 420, type: "ml", inStock: true }, { id: 45, label: "20 мл", price: 780, type: "ml", inStock: true }, { id: 315, label: "Упаковка 100 мл", price: 2000, type: "pkg", inStock: true }],
  },
  {
    id: 16, name: "Euphoria", brand: "Calvin Klein", category: "Женские",
    img: null,
    desc: "🔝 Верхние: гранат, хурма, зелёные ноты\n💎 Средние: чёрная орхидея, лотос, жасмин\n🌿 Базовые: красное дерево, мускус, амбра, крем\n\n📋 Тип: EDP · Стойкость: 6-8 ч · Шлейф: умеренный\n\nТаинственный восточный аромат, в котором экзотический гранат встречается с чёрной орхидеей. Чувственный, глубокий и обволакивающий — как шёлковое платье в полумраке.",
    variants: [{ id: 46, label: "5 мл", price: 310, type: "ml", inStock: true }, { id: 47, label: "10 мл", price: 540, type: "ml", inStock: true }, { id: 48, label: "20 мл", price: 980, type: "ml", inStock: true }, { id: 316, label: "Упаковка 50 мл", price: 1900, type: "pkg", inStock: true }],
  },
  {
    id: 17, name: "My Burberry", brand: "Burberry", category: "Женские",
    img: null,
    desc: "🔝 Верхние: сладкий горошек, бергамот, груша\n💎 Средние: герань, фрезия, роза\n🌿 Базовые: пачули, дождевые капли, мускус\n\n📋 Тип: EDP · Стойкость: 5-7 ч · Шлейф: умеренный\n\nЦветочный аромат, вдохновлённый лондонским садом после тёплого дождя. Нежные лепестки розы и фрезии оседают на тёплой земле — элегантно, спокойно и невероятно женственно.",
    variants: [{ id: 49, label: "5 мл", price: 350, type: "ml", inStock: true }, { id: 50, label: "10 мл", price: 600, type: "ml", inStock: true }, { id: 51, label: "20 мл", price: 1100, type: "ml", inStock: true }, { id: 317, label: "Упаковка 50 мл", price: 2100, type: "pkg", inStock: true }],
  },
  {
    id: 18, name: "1 Million", brand: "Paco Rabanne", category: "Мужские",
    img: null,
    desc: "🔝 Верхние: грейпфрут, мята, кровавый апельсин\n💎 Средние: корица, роза, абсолют корицы\n🌿 Базовые: кожа, амбра, пачули, белое дерево\n\n📋 Тип: EDT · Стойкость: 6-8 ч · Шлейф: сильный\n\nДерзкий аромат роскоши и успеха в золотом слитке. Свежая мята обрушивается пряной корицей, а тёплая кожа в базе добавляет харизму — аромат мужчины, который привык побеждать.",
    variants: [{ id: 52, label: "5 мл", price: 330, type: "ml", inStock: true }, { id: 53, label: "10 мл", price: 580, type: "ml", inStock: true }, { id: 54, label: "20 мл", price: 1060, type: "ml", inStock: true }, { id: 318, label: "Упаковка 50 мл", price: 2050, type: "pkg", inStock: true }],
  },
  {
    id: 19, name: "Lady Million", brand: "Paco Rabanne", category: "Женские",
    img: null,
    desc: "🔝 Верхние: малина, нероли, горький апельсин\n💎 Средние: жасмин, гардения, апельсиновый цвет\n🌿 Базовые: мёд, пачули, амбра\n\n📋 Тип: EDP · Стойкость: 7-9 ч · Шлейф: сильный\n\nРоскошный аромат для женщины, которая знает себе цену. Искрящаяся малина переходит в роскошный букет жасмина и гардении, а мёд в базе добавляет сладкое послевкусие победы.",
    variants: [{ id: 55, label: "5 мл", price: 360, type: "ml", inStock: true }, { id: 56, label: "10 мл", price: 620, type: "ml", inStock: true }, { id: 57, label: "20 мл", price: 1150, type: "ml", inStock: true }, { id: 319, label: "Упаковка 50 мл", price: 2200, type: "pkg", inStock: true }],
  },
  {
    id: 20, name: "Black Orchid", brand: "Tom Ford", category: "Унисекс",
    img: null,
    desc: "🔝 Верхние: трюфель, бергамот, чёрная смородина\n💎 Средние: чёрная орхидея, лотос, фрукты\n🌿 Базовые: пачули, ваниль, сандал, ладан, ветивер\n\n📋 Тип: EDP · Стойкость: 10-12 ч · Шлейф: сильный\n\nТёмная роскошь в чистом виде — первый аромат Тома Форда в собственном имени. Чёрный трюфель и орхидея создают гипнотическую глубину, а сандал с ладаном оставляют незабываемый шлейф.",
    variants: [{ id: 58, label: "5 мл", price: 700, type: "ml", inStock: true }, { id: 59, label: "10 мл", price: 1300, type: "ml", inStock: true }, { id: 60, label: "20 мл", price: 2400, type: "ml", inStock: true }, { id: 320, label: "Упаковка 50 мл", price: 5500, type: "pkg", inStock: true }],
  },
  {
    id: 21, name: "Oud Wood", brand: "Tom Ford", category: "Унисекс",
    img: null,
    desc: "🔝 Верхние: розовый перец, кардамон\n💎 Средние: уд, сандал, ветивер\n🌿 Базовые: бобы тонка, амбра, мускус\n\n📋 Тип: EDP · Стойкость: 10-14 ч · Шлейф: сильный\n\nРедкий удовый аромат, отшлифованный до совершенства. Розовый перец и кардамон открывают дорогу благородному уду, а тёплый сандал и тонка в базе превращают его в бархатный шедевр.",
    variants: [{ id: 61, label: "5 мл", price: 800, type: "ml", inStock: true }, { id: 62, label: "10 мл", price: 1500, type: "ml", inStock: true }, { id: 63, label: "20 мл", price: 2800, type: "ml", inStock: true }, { id: 321, label: "Упаковка 50 мл", price: 6200, type: "pkg", inStock: true }],
  },
  {
    id: 22, name: "Guilty", brand: "Gucci", category: "Унисекс",
    img: null,
    desc: "🔝 Верхние: лаванда, лимон, розовый перец\n💎 Средние: апельсиновый цвет, герань\n🌿 Базовые: кедр, пачули, амбра\n\n📋 Тип: EDT · Стойкость: 6-8 ч · Шлейф: умеренный\n\nАромат-бунтарь для тех, кто пишет свои правила. Провокационная лаванда с розовым перцем бросает вызов, а пачули с амброй в базе придают чувственную глубину без извинений.",
    variants: [{ id: 64, label: "5 мл", price: 380, type: "ml", inStock: true }, { id: 65, label: "10 мл", price: 660, type: "ml", inStock: true }, { id: 66, label: "20 мл", price: 1200, type: "ml", inStock: true }, { id: 322, label: "Упаковка 50 мл", price: 2300, type: "pkg", inStock: true }],
  },
  {
    id: 23, name: "Bloom", brand: "Gucci", category: "Женские",
    img: null,
    desc: "🔝 Верхние: ранункулюс, туберозый лист\n💎 Средние: тубероза, жасмин самбак\n🌿 Базовые: мускус, сандал\n\n📋 Тип: EDP · Стойкость: 7-9 ч · Шлейф: сильный\n\nБелый сад, расцветающий на коже. Алессандро Микеле создал аромат из цветов, которые в природе не растут вместе — буйная тубероза и жасмин самбак сплетаются в богатый, чувственный букет.",
    variants: [{ id: 67, label: "5 мл", price: 400, type: "ml", inStock: true }, { id: 68, label: "10 мл", price: 700, type: "ml", inStock: true }, { id: 69, label: "20 мл", price: 1280, type: "ml", inStock: true }, { id: 323, label: "Упаковка 50 мл", price: 2450, type: "pkg", inStock: true }],
  },
  {
    id: 24, name: "L'Interdit", brand: "Givenchy", category: "Женские",
    img: null,
    desc: "🔝 Верхние: груша, бергамот\n💎 Средние: тубероза, жасмин, апельсиновый цвет\n🌿 Базовые: ветивер, пачули, мускус, амбра\n\n📋 Тип: EDP · Стойкость: 8-10 ч · Шлейф: сильный\n\nЗапретный плод в мире парфюмерии. Нежные белые цветы скрывают тёмное сердце из ветивера и пачули — контраст света и тени, невинности и соблазна. Аромат, от которого невозможно отвернуться.",
    variants: [{ id: 70, label: "5 мл", price: 360, type: "ml", inStock: true }, { id: 71, label: "10 мл", price: 620, type: "ml", inStock: true }, { id: 72, label: "20 мл", price: 1150, type: "ml", inStock: true }, { id: 324, label: "Упаковка 50 мл", price: 2200, type: "pkg", inStock: true }],
  },
  {
    id: 25, name: "Gentleman", brand: "Givenchy", category: "Мужские",
    img: null,
    desc: "🔝 Верхние: груша, бергамот, кардамон\n💎 Средние: ирис, лаванда\n🌿 Базовые: пачули, ваниль, кожа\n\n📋 Тип: EDP · Стойкость: 8-10 ч · Шлейф: умеренный\n\nСовременный джентльмен без галстука. Ирис и лаванда создают аристократичную элегантность, а тёплая кожа и ваниль в базе раскрывают характер и глубину. Утончённость без усилий.",
    variants: [{ id: 73, label: "5 мл", price: 370, type: "ml", inStock: true }, { id: 74, label: "10 мл", price: 640, type: "ml", inStock: true }, { id: 75, label: "20 мл", price: 1180, type: "ml", inStock: true }, { id: 325, label: "Упаковка 60 мл", price: 2250, type: "pkg", inStock: true }],
  },
  {
    id: 26, name: "La Vie Est Belle", brand: "Lancôme", category: "Женские",
    img: null,
    desc: "🔝 Верхние: чёрная смородина, груша\n💎 Средние: ирис, жасмин, апельсиновый цвет\n🌿 Базовые: пралине, ваниль, пачули, бобы тонка\n\n📋 Тип: EDP · Стойкость: 8-10 ч · Шлейф: сильный\n\n«Жизнь прекрасна» — и этот аромат напоминает об этом каждый день. Сладкое пралине с ирисом создают гурманскую гармонию, а тёплая ваниль в базе дарит ощущение уюта и счастья.",
    variants: [{ id: 76, label: "5 мл", price: 350, type: "ml", inStock: true }, { id: 77, label: "10 мл", price: 600, type: "ml", inStock: true }, { id: 78, label: "20 мл", price: 1100, type: "ml", inStock: true }, { id: 326, label: "Упаковка 50 мл", price: 2100, type: "pkg", inStock: true }],
  },
  {
    id: 27, name: "Cool Water", brand: "Davidoff", category: "Мужские",
    img: null,
    desc: "🔝 Верхние: мята, лаванда, кориандр, розмарин\n💎 Средние: жасмин, герань, нероли, сандал\n🌿 Базовые: кедр, мускус, амбра, табак\n\n📋 Тип: EDT · Стойкость: 4-6 ч · Шлейф: лёгкий\n\nКультовый морской аромат с 1988 года, определивший целую эпоху свежей мужской парфюмерии. Мята и лаванда дышат океанским бризом — чистый, спортивный и вечно актуальный.",
    variants: [{ id: 79, label: "5 мл", price: 220, type: "ml", inStock: true }, { id: 80, label: "10 мл", price: 380, type: "ml", inStock: true }, { id: 81, label: "20 мл", price: 700, type: "ml", inStock: true }, { id: 327, label: "Упаковка 75 мл", price: 1650, type: "pkg", inStock: true }],
  },
  {
    id: 28, name: "Angel", brand: "Mugler", category: "Женские",
    img: null,
    desc: "🔝 Верхние: бергамот, гелиотроп, мёд\n💎 Средние: карамель, ежевика, красные ягоды\n🌿 Базовые: пачули, шоколад, ваниль, мускус\n\n📋 Тип: EDP · Стойкость: 8-12 ч · Шлейф: сильный\n\nПервый «съедобный» аромат в истории, перевернувший правила парфюмерии в 1992 году. Шоколад и карамель окутаны тёмным пачули — дерзкий, сладкий и невозможно узнаваемый.",
    variants: [{ id: 82, label: "5 мл", price: 340, type: "ml", inStock: true }, { id: 83, label: "10 мл", price: 590, type: "ml", inStock: true }, { id: 84, label: "20 мл", price: 1080, type: "ml", inStock: true }, { id: 328, label: "Упаковка 50 мл", price: 2050, type: "pkg", inStock: true }],
  },
  {
    id: 29, name: "Aventus", brand: "Creed", category: "Мужские",
    img: null,
    desc: "🔝 Верхние: ананас, бергамот, чёрная смородина, яблоко\n💎 Средние: берёза, жасмин, роза, пачули\n🌿 Базовые: мускус, амбра, ваниль, дубовый мох\n\n📋 Тип: EDP · Стойкость: 10-14 ч · Шлейф: сильный\n\nЛегендарный аромат успеха и лидерства. Ананас и берёза создают культовый фруктово-дымный аккорд, узнаваемый с первого вдоха. Для мужчины, который вдохновляет и ведёт за собой.",
    variants: [{ id: 85, label: "5 мл", price: 950, type: "ml", inStock: true }, { id: 86, label: "10 мл", price: 1800, type: "ml", inStock: true }, { id: 87, label: "20 мл", price: 3400, type: "ml", inStock: true }, { id: 329, label: "Упаковка 50 мл", price: 8500, type: "pkg", inStock: true }],
  },
  {
    id: 30, name: "Baccarat Rouge 540", brand: "Maison Francis Kurkdjian", category: "Унисекс",
    img: null,
    desc: "🔝 Верхние: шафран, жасмин\n💎 Средние: амброксан, кедр\n🌿 Базовые: смола ели, мускус, кашемировое дерево\n\n📋 Тип: EDP · Стойкость: 12-16 ч · Шлейф: сильный\n\nКультовый аромат нового времени, покоривший мир минималистичной роскошью. Шафран и амброксан создают сияющий кристаллический аккорд — невесомый, но невозможно забыть. Для тех, кто ценит совершенство.",
    variants: [{ id: 88, label: "5 мл", price: 1200, type: "ml", inStock: true }, { id: 89, label: "10 мл", price: 2200, type: "ml", inStock: true }, { id: 90, label: "20 мл", price: 4200, type: "ml", inStock: true }, { id: 330, label: "Упаковка 70 мл", price: 12000, type: "pkg", inStock: true }],
  },
];

export const DEFAULT_BANNERS = [
  { id: 1, active: true, bg: "linear-gradient(135deg, #111111 0%, #000000 100%)", img: "/banner1.jpeg", title: "Kemal Usman", subtitle: "Бишкек · Парфюм на разлив", accent: "#fff" },
  { id: 2, active: true, bg: "linear-gradient(135deg, #111111 0%, #000000 100%)", img: "/banner2.jpeg", title: "Kemal Usman", subtitle: "Бишкек · Парфюм на разлив", accent: "#fff" },
  { id: 3, active: true, bg: "linear-gradient(135deg, #111111 0%, #000000 100%)", img: "/banner3.jpeg", title: "Kemal Usman", subtitle: "Бишкек · Парфюм на разлив", accent: "#fff" },
];

