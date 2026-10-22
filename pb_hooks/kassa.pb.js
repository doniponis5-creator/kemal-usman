/// <reference path="../pb_data/types.d.ts" />
/* global routerAdd, __hooks, require */
// Касса Kemal Usman на телефоне (папка kassa/) ↔ сайт. Вся логика — в _lib/kassa_club.js
// (функции из *.pb.js не видны внутри routerAdd). Ключ — KASSA_CLUB_KEY или pb_data/kassa_credentials.json.
// /club  — бонусы клуба покупателя (баланс, списать, вернуть, начислить, снять);
// /stock — наличие вариантов товаров на сайте по остатку 1С (меняется только «в наличии»).
routerAdd('POST', '/api/custom/kassa/club', function (c) {
  return require(__hooks + '/_lib/kassa_club.js').handle(c);
});

routerAdd('POST', '/api/custom/kassa/stock', function (c) {
  return require(__hooks + '/_lib/kassa_club.js').handleStock(c);
});
