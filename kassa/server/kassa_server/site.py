"""
Сайт kemalusman.kg ↔ 1С Kemal: только наличие (владелец 22.10 выбрал вариант 2 — «faqat 1C qoldig'i saytda ko'rinsin»).

Товар сайта (PocketBase products) связывается с товаром 1С: владелец подтверждает подсказку или выбирает сам (экран «Сайт ↔ 1С»
в кассе). Дальше после каждого обмена с 1С касса пересчитывает галочку «в наличии» у вариантов связанных товаров:
  «5 мл», «10 мл» … (type ml) — в наличии, если свободный остаток в мл ≥ объёма варианта;
  «Упаковка 50 мл» (type pkg) — если у связи указан отдельный штучный товар 1С (флакон) и он есть; иначе не трогаем;
  остальные варианты («Полный» и т. п.) и несвязанные товары — не трогаем.
Цены, названия, фото на сайте касса не меняет. Пишет на сайт обработчик pb_hooks/kassa.pb.js (действие «stock»).
"""
from __future__ import annotations

import re
from decimal import Decimal
from functools import lru_cache

from . import rules

STOP = {"maslo", "масло", "spray", "parfum", "edp", "edt", "man", "men", "women", "pour", "homme", "femme", "the", "de", "le",
        "la", "eau", "perfume", "мл", "ml", "шт"}
SUGGEST_MIN = Decimal("0.6")     # подсказка «скорее всего это он» — от 0.6 (проверено на каталоге 22.10: ~160 из 782)
ML_RE = re.compile(r"(\d+(?:[.,]\d+)?)\s*(?:мл|ml)", re.IGNORECASE)


@lru_cache(maxsize=8192)
def tokens(text: str) -> frozenset[str]:
    """Слова названия без «maslo», «edp» и т. п. Запоминаем: 800 товаров сайта × 640 товаров 1С — иначе экран думает секунды."""
    text = str(text or "").lower().replace("ё", "е")
    return frozenset(t for t in re.findall(r"[a-zа-я0-9]+", text) if t not in STOP and len(t) > 1)


def similarity(a: str, b: str) -> float:
    A, B = tokens(a), tokens(b)
    return len(A & B) / len(A | B) if A and B else 0.0


def full_name(product: dict) -> str:
    return " ".join(x for x in (str(product.get("brand") or "").strip(), str(product.get("name") or "").strip()) if x)


def suggest(product: dict, items: list[dict], limit: int = 5) -> list[dict]:
    """Похожие товары 1С для товара сайта, лучшие сверху: [{id, name, unit, score}]."""
    name = full_name(product)
    scored = sorted(((similarity(name, i["name"]), i) for i in items), key=lambda p: -p[0])
    return [{"id": i["id"], "name": i["name"], "unit": i.get("unit") or "", "score": round(s, 2)} for s, i in scored[:limit] if s > 0]


def variant_ml(variant: dict) -> Decimal | None:
    """«5 мл» → 5, «Упаковка 50 мл» → 50; без мл в названии — None."""
    m = ML_RE.search(str(variant.get("label") or ""))
    return rules.quantity(m.group(1)) if m else None


def free_total(item: dict | None, shops: list[str], taken: dict) -> Decimal:
    """Свободный остаток товара 1С по выбранным магазинам (минус проданное с телефона и ещё не проведённое)."""
    if not item:
        return Decimal(0)
    stock = item.get("stock") or {}
    return sum((rules.free_stock(stock.get(shop, 0), taken.get(shop, {}).get(item["id"], 0)) for shop in shops), Decimal(0))


def availability(product: dict, link: dict, items: dict[str, dict], shops: list[str], taken: dict) -> list[dict]:
    """Новые варианты товара сайта: тот же список, у кого-то меняется только inStock. Возвращает [{id, inStock}] для всех,
    кого касса берёт на себя (ml — всегда при связи, pkg — только если указан штучный товар)."""
    ml_item = items.get(link.get("itemId") or "")
    pkg_item = items.get(link.get("pkgItemId") or "")
    ml_free = free_total(ml_item, shops, taken)
    pkg_free = free_total(pkg_item, shops, taken)
    out = []
    for v in product.get("variants") or []:
        if not isinstance(v, dict) or v.get("id") is None:
            continue
        kind = str(v.get("type") or "")
        if kind == "ml" and ml_item:
            need = variant_ml(v)
            if need is None or need <= 0:
                continue
            out.append({"id": v["id"], "inStock": ml_free >= need})
        elif kind == "pkg" and pkg_item:
            out.append({"id": v["id"], "inStock": pkg_free >= 1})
    return out


def changes(products: dict[str, dict], links: dict[str, dict], items: dict[str, dict], shops: list[str], taken: dict) -> list[dict]:
    """Что поменять на сайте: [{productId, variants: [{id, inStock}]}] — только товары, у которых галочка реально другая."""
    out = []
    for product_id, link in links.items():
        product = products.get(product_id)
        if not product or link.get("status") != "linked":
            continue
        current = {v.get("id"): bool(v.get("inStock")) for v in product.get("variants") or [] if isinstance(v, dict)}
        wanted = availability(product, link, items, shops, taken)
        diff = [w for w in wanted if current.get(w["id"]) != w["inStock"]]
        if diff:
            out.append({"productId": product_id, "variants": diff})
    return out
