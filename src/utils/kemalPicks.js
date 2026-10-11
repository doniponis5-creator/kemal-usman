// «Выбор Кемаля» — фото-баннеры в ленте. Настраивается в админке:
// Настройки → «Выбор Кемаля» (api.loadKemalPicks / api.saveKemalPicks).
// Пока владелец ничего не сохранил — три фото из public/kemal и аромат сам.
// Один «выбор»: img — фото; productId — аромат ("" — сайт выберет сам);
// posX/posY — какую часть фото показывать, % (лицо не должно обрезаться);
// split — крупный портрет: фото слева, текст справа на панели цвета panel
// (иначе текст закрывает лицо); active — показывать на сайте.
export const KU_PICKS_DEFAULT = [
  { id: "ku1", img: "/kemal/ku-car.webp", productId: "", posX: 62, posY: 16, split: false, panel: "#140A0B", active: true },
  { id: "ku2", img: "/kemal/ku-studio.webp", productId: "", posX: 40, posY: 20, split: false, panel: "#140A0B", active: true },
  { id: "ku3", img: "/kemal/ku-red.webp", productId: "", posX: 50, posY: 30, split: true, panel: "#140A0B", active: true },
];

// «Выбор» → то, что рисует PhotoBanner.
export const kemalPickPhoto = (k) => ({ src: k.img, pos: `${k.posX ?? 50}% ${k.posY ?? 25}%`, split: !!k.split, panel: k.panel || "#140A0B" });

export const newKemalPickId = () => `k${Date.now().toString(36)}`;
