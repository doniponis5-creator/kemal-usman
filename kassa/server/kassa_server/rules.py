"""
Касса Kemal Usman — правила без базы и HTTP: что можно продать, сколько осталось, PIN, роли, чек.
Всё здесь проверяется тестами (tests/test_rules.py); app.py только читает базу и зовёт эти функции.

Отличия от «Кассы Smarket» (Smart Centr), с которой взята идея:
- количество с дробью: атир продают в мл (5, 2.5, 12.8); штучный товар — целым числом;
- два магазина (склады 1С): остаток, цена и деньги — по магазину, продавец может быть привязан к своему магазину;
- оплата: наличные или перевод (до двух частей: часть наличными, часть переводом).
"""
from __future__ import annotations

import hashlib
import hmac
import re
import secrets
from collections import defaultdict
from datetime import datetime
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

ROLES = ("owner", "staff")
KINDS = ("sale",)                 # этап 1 — только продажа; долги, расходы, переводы — этап 2
STAFF_KINDS = ("sale",)
METHODS = {"cash": "Наличные", "transfer": "Перевод"}
MAX_PAYMENTS = 2

PIN_RE = re.compile(r"^\d{4,6}$")
UUID_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")
MAX_FAILED = 5           # подряд неверных PIN → пауза
LOCK_MINUTES = 15
SESSION_DAYS = 30
MAX_LINES = 50
MAX_QTY = Decimal("100000")       # 100 литров в мл — больше за раз не продают
MAX_SUM = Decimal("5000000")
USER_NAME_MAX = 60
NOTE_MAX = 300
# Единицы, которые продают с дробью. Остальные (шт, упаковка) — только целым числом.
FRACTION_UNITS = ("мл", "гр", "г", "л", "л (дм3)", "кг")
QTY_PLACES = Decimal("0.001")


def money(value) -> Decimal:
    """Сумма с телефона → Decimal с двумя знаками; что угодно странное → 0."""
    try:
        amount = Decimal(str(value if value is not None else 0))
    except (InvalidOperation, ValueError):
        return Decimal(0)
    if not amount.is_finite():
        return Decimal(0)
    return amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def quantity(value) -> Decimal:
    """Количество с телефона → Decimal с тремя знаками; «2,5» тоже понимаем. Странное → 0."""
    try:
        qty = Decimal(str(value if value is not None else 0).replace(",", ".").strip() or "0")
    except (InvalidOperation, ValueError):
        return Decimal(0)
    if not qty.is_finite():
        return Decimal(0)
    return qty.quantize(QTY_PLACES, rounding=ROUND_HALF_UP)


def fractional(unit: str) -> bool:
    return str(unit or "").strip().lower() in FRACTION_UNITS


def num(value) -> float | int:
    """Для JSON: 5.000 → 5, 2.500 → 2.5."""
    d = Decimal(str(value or 0))
    return int(d) if d == d.to_integral_value() else float(d.normalize())


# ── Остаток ──────────────────────────────────────────────────────────────────

def reserved_by_ops(ops: list[dict]) -> dict[str, dict[str, Decimal]]:
    """{магазин: {itemId: количество}} — продано с телефона (операции new), 1С об этом ещё не знает."""
    taken: dict[str, dict[str, Decimal]] = defaultdict(lambda: defaultdict(Decimal))
    for op in ops:
        if op.get("kind") != "sale":
            continue
        payload = op.get("payload") or {}
        shop = str(payload.get("shop") or "")
        for line in payload.get("lines") or []:
            key = str(line.get("itemId") or "")
            if key:
                taken[shop][key] += quantity(line.get("qty"))
    return {shop: dict(items) for shop, items in taken.items()}


def free_stock(stock, taken=0) -> Decimal:
    return max(quantity(stock) - quantity(taken), Decimal(0))


def shortages(lines: list[dict], items: dict[str, dict], shop: str, taken: dict[str, dict[str, Decimal]]) -> list[str]:
    """Чего не хватает в магазине на эту продажу: ['Chanel Chance (есть 3 мл)']. Пусто — всё есть."""
    wanted: dict[str, Decimal] = defaultdict(Decimal)
    for line in lines:
        wanted[str(line.get("itemId") or "")] += quantity(line.get("qty"))
    short = []
    shop_taken = taken.get(shop, {})
    for key, qty in wanted.items():
        item = items.get(key)
        if item is None:
            short.append("товара нет в списке 1С")
            continue
        free = free_stock((item.get("stock") or {}).get(shop, 0), shop_taken.get(key, 0))
        if free < qty:
            short.append(f"{item.get('name') or key} (есть {num(free)} {item.get('unit') or ''})".replace(" )", ")"))
    return short


# ── PIN и сессии ─────────────────────────────────────────────────────────────

def valid_pin(pin) -> bool:
    return isinstance(pin, str) and bool(PIN_RE.fullmatch(pin))


def hash_pin(pin: str, salt: str | None = None) -> str:
    """'pbkdf2$<соль>$<hex>' — соль случайная, 120 000 итераций."""
    salt = salt or secrets.token_hex(8)
    digest = hashlib.pbkdf2_hmac("sha256", pin.encode("utf-8"), salt.encode("utf-8"), 120_000).hex()
    return f"pbkdf2${salt}${digest}"


def verify_pin(pin: str, stored: str) -> bool:
    try:
        _, salt, _ = str(stored).split("$", 2)
    except ValueError:
        return False
    return hmac.compare_digest(hash_pin(pin, salt), stored)


def pin_taken(pin: str, others: list[str]) -> bool:
    """Вход — только по PIN, без имени: два одинаковых PIN не различить."""
    return any(verify_pin(pin, stored) for stored in others)


def new_token() -> str:
    return secrets.token_urlsafe(32)


def locked_for(failed: int) -> int:
    """Минут блокировки после очередной неверной попытки; 0 — ещё можно пробовать."""
    return LOCK_MINUTES if failed >= MAX_FAILED else 0


def sign(secret: str, body: bytes) -> str:
    return hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()


# ── Роли ─────────────────────────────────────────────────────────────────────

def visible_to(role: str) -> dict:
    owner = role == "owner"
    return {"tabs": ["sale", "today", "stock", "staff"] if owner else ["sale", "today", "stock"], "allOps": owner}


def shop_for(user: dict, wanted: str, shops: list[str]) -> tuple[str | None, str]:
    """В каком магазине продаёт человек. Сотрудник с магазином — только в своём; владелец и сотрудник без магазина — в любом."""
    if not shops:
        return None, "1С ещё не прислала список магазинов"
    own = str(user.get("shop") or "")
    if user.get("role") != "owner" and own:
        if wanted and wanted != own:
            return None, f"вы продаёте только в магазине «{own}»"
        return (own, "") if own in shops else (None, f"магазина «{own}» нет в 1С")
    if wanted not in shops:
        return None, "выберите магазин"
    return wanted, ""


# ── Сотрудники ───────────────────────────────────────────────────────────────

def clean_user(raw: dict, shops: list[str], new: bool = True) -> dict:
    """Форма сотрудника: имя, PIN (у нового — обязателен), магазин (пусто — любой), включён."""
    out: dict = {"ok": True}
    name = re.sub(r"\s+", " ", str(raw.get("name") or "")).strip()[:USER_NAME_MAX]
    if new and not name:
        return {"ok": False, "error": "Напишите имя"}
    out["name"] = name
    pin = str(raw.get("pin") or "")
    if new and not pin:
        return {"ok": False, "error": "Придумайте PIN — от 4 до 6 цифр"}
    if pin and not valid_pin(pin):
        return {"ok": False, "error": "PIN — от 4 до 6 цифр"}
    out["pin"] = pin
    if "shop" in raw:
        shop = str(raw.get("shop") or "")
        if shop and shop not in shops:
            return {"ok": False, "error": "такого магазина нет"}
        out["shop"] = shop
    if "active" in raw:
        out["active"] = bool(raw.get("active"))
    return out


# ── Продажа ──────────────────────────────────────────────────────────────────

def _text(value, limit: int) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()[:limit]


def phone_digits(raw) -> str:
    """Номер покупателя → 996XXXXXXXXX или ''. 0555 123 456, 555123456, +996 555 123 456 — всё одно."""
    digits = re.sub(r"\D", "", str(raw or ""))
    if len(digits) == 9:
        digits = "996" + digits
    elif len(digits) == 10 and digits.startswith("0"):
        digits = "996" + digits[1:]
    return digits if len(digits) == 12 and digits.startswith("996") else ""


def build_payments(raw, total: Decimal) -> dict:
    """[{method, amount}] — наличные и/или перевод, сумма частей = итог продажи. Одна часть без суммы — вся сумма."""
    if not isinstance(raw, list) or not raw:
        return {"ok": False, "error": "выберите оплату: наличные или перевод"}
    if len(raw) > MAX_PAYMENTS:
        return {"ok": False, "error": "оплата — не больше двух частей"}
    parts = []
    for item in raw:
        method = str((item or {}).get("method") or "") if isinstance(item, dict) else ""
        if method not in METHODS:
            return {"ok": False, "error": "оплата — наличные или перевод"}
        parts.append({"method": method, "amount": money(item.get("amount"))})
    if len(parts) == 1:
        parts[0]["amount"] = total
    elif parts[0]["method"] == parts[1]["method"]:
        return {"ok": False, "error": "две части оплаты — наличные и перевод"}
    if any(p["amount"] <= 0 for p in parts):
        return {"ok": False, "error": "у каждой части оплаты должна быть сумма"}
    if sum(p["amount"] for p in parts) != total:
        return {"ok": False, "error": f"части оплаты дают {_som(sum(p['amount'] for p in parts))}, а продажа — {_som(total)}"}
    return {"ok": True, "payments": [{"method": p["method"], "amount": float(p["amount"])} for p in parts]}


def check_sale(op: dict, user: dict, items: dict[str, dict], shops: list[str], taken: dict[str, dict[str, Decimal]]) -> dict:
    """
    Продажа с телефона до записи. {'ok': True, 'payload': …} — нормализованная продажа; {'ok': False, 'error': …} — почему нет.
    items — {id: {id, code, name, unit, stock: {магазин: кол-во}, price: {магазин: цена}}} из 1С;
    taken — что уже продано с телефона и ещё не проведено (reserved_by_ops).
    """
    op_id = str(op.get("id") or "").lower()
    if not UUID_RE.fullmatch(op_id):
        return {"ok": False, "error": "нет идентификатора операции"}
    if str(op.get("kind") or "") not in KINDS:
        return {"ok": False, "error": "неизвестная операция"}
    payload = op.get("payload") if isinstance(op.get("payload"), dict) else {}
    shop, why = shop_for(user, str(payload.get("shop") or ""), shops)
    if not shop:
        return {"ok": False, "error": why}
    raw_lines = payload.get("lines") or []
    if not isinstance(raw_lines, list) or not raw_lines:
        return {"ok": False, "error": "в продаже нет товаров"}
    if len(raw_lines) > MAX_LINES:
        return {"ok": False, "error": f"не больше {MAX_LINES} строк"}
    lines = []
    for raw in raw_lines:
        raw = raw if isinstance(raw, dict) else {}
        item = items.get(str(raw.get("itemId") or "").lower())
        if item is None:
            return {"ok": False, "error": "товар не найден в списке 1С"}
        unit = str(item.get("unit") or "")
        qty = quantity(raw.get("qty"))
        if qty <= 0 or qty > MAX_QTY:
            return {"ok": False, "error": f"укажите количество «{item['name']}»"}
        if not fractional(unit) and qty != qty.to_integral_value():
            return {"ok": False, "error": f"«{item['name']}» продаётся целыми ({unit or 'шт'})"}
        price = money(raw.get("price"))
        if price <= 0 or price > MAX_SUM:
            return {"ok": False, "error": f"укажите цену «{item['name']}»"}
        line_sum = money(price * qty)
        list_price = money((item.get("price") or {}).get(shop, 0))
        lines.append({"itemId": item["id"], "code": item.get("code") or "", "name": item["name"], "unit": unit,
                      "qty": num(qty), "price": float(price), "sum": float(line_sum), "listPrice": float(list_price)})
    short = shortages(lines, items, shop, taken)
    if short:
        return {"ok": False, "error": "Не хватает в магазине: " + "; ".join(short)}
    total = sum((money(l["sum"]) for l in lines), Decimal(0))
    if total <= 0 or total > MAX_SUM:
        return {"ok": False, "error": "сумма продажи не подходит"}
    paid = build_payments(payload.get("payments"), total)
    if not paid["ok"]:
        return paid
    buyer_raw = payload.get("buyer") if isinstance(payload.get("buyer"), dict) else {}
    buyer = {"name": _text(buyer_raw.get("name"), 100), "phone": phone_digits(buyer_raw.get("phone"))}
    if str(buyer_raw.get("phone") or "").strip() and not buyer["phone"]:
        return {"ok": False, "error": "номер покупателя: 9 цифр, например 555 123 456"}
    clean = {"shop": shop, "lines": lines, "total": float(total), "payments": paid["payments"],
             "note": _text(payload.get("note"), NOTE_MAX)}
    if buyer["name"] or buyer["phone"]:
        clean["buyer"] = buyer
    return {"ok": True, "payload": clean}


# ── Сегодня ──────────────────────────────────────────────────────────────────

def day_totals(ops: list[dict]) -> dict:
    """Итоги дня: по магазинам и видам оплаты. Отменённые не считаем; проведённые и ждущие 1С — считаем."""
    shops: dict[str, dict] = {}
    for op in ops:
        if op.get("kind") != "sale" or op.get("status") in ("cancelled", "cancelling"):
            continue
        payload = op.get("payload") or {}
        row = shops.setdefault(str(payload.get("shop") or ""), {"sales": 0, "total": Decimal(0), "cash": Decimal(0), "transfer": Decimal(0)})
        row["sales"] += 1
        row["total"] += money(payload.get("total"))
        for part in payload.get("payments") or []:
            if part.get("method") in METHODS:
                row[part["method"]] += money(part.get("amount"))
    out = [{"shop": shop, "sales": r["sales"], "total": float(r["total"]), "cash": float(r["cash"]), "transfer": float(r["transfer"])}
           for shop, r in sorted(shops.items())]
    return {"shops": out, "total": float(sum((Decimal(str(r["total"])) for r in out), Decimal(0))),
            "sales": sum(r["sales"] for r in out)}


# ── Из 1С ────────────────────────────────────────────────────────────────────

def clean_item(raw: dict, shops: list[str]) -> dict | None:
    """Товар из дельты 1С: остаток и цена — только по известным магазинам."""
    item_id = str(raw.get("id") or "").lower()
    name = _text(raw.get("name"), 300)
    if not UUID_RE.fullmatch(item_id) or not name:
        return None

    def by_shop(value) -> dict:
        value = value if isinstance(value, dict) else {}
        return {shop: num(max(quantity(value.get(shop)), Decimal(0))) for shop in shops if value.get(shop) not in (None, "", 0)}

    prices = raw.get("price") if isinstance(raw.get("price"), dict) else {}
    return {"id": item_id, "code": _text(raw.get("code"), 20), "name": name, "article": _text(raw.get("article"), 100),
            "group": _text(raw.get("group"), 150), "unit": _text(raw.get("unit"), 20),
            "stock": by_shop(raw.get("stock")),
            "price": {shop: float(money(prices.get(shop))) for shop in shops if money(prices.get(shop)) > 0}}


def clean_shops(raw) -> list[dict]:
    """[{name, cashDesk, transferDesk}] — магазины (склады 1С) и их кассы: наличные и перевод."""
    out = []
    for entry in raw if isinstance(raw, list) else []:
        if not isinstance(entry, dict):
            continue
        name = _text(entry.get("name"), 150)
        if name and name not in [s["name"] for s in out]:
            out.append({"name": name, "cashDesk": _text(entry.get("cashDesk"), 150),
                        "transferDesk": _text(entry.get("transferDesk"), 150)})
    return out


# ── Чек ──────────────────────────────────────────────────────────────────────

def _som(value) -> str:
    amount = money(value)
    text = f"{amount:,.2f}".replace(",", " ").replace(".00", "")
    return text.replace(".", ",") + " сом"


def _when(created_at: str | None) -> str:
    try:
        return datetime.fromisoformat(str(created_at)).strftime("%d.%m.%Y %H:%M")
    except (TypeError, ValueError):
        return ""


def receipt_text(op: dict, shop_title: str = "Kemal Usman Parfume") -> str:
    """Чек текстом: страница печати и (этап 3) WhatsApp. Без таблиц — WhatsApp не держит колонки."""
    payload = op.get("payload") or {}
    lines = [f"*{shop_title}* — чек", _when(op.get("createdAt")), f"Магазин: {payload.get('shop') or ''}", ""]
    for line in payload.get("lines") or []:
        lines.append(f"• {line.get('name')} — {num(line.get('qty'))} {line.get('unit') or ''} × {_som(line.get('price'))} = {_som(line.get('sum'))}"
                     .replace("  ×", " ×"))
    lines.append(f"*Итого: {_som(payload.get('total'))}*")
    parts = payload.get("payments") or []
    if len(parts) > 1:
        lines.append("Оплата: " + "; ".join(f"{METHODS.get(p.get('method'), '')} — {_som(p.get('amount'))}" for p in parts))
    elif parts:
        lines.append("Оплата: " + METHODS.get(parts[0].get("method"), ""))
    buyer = payload.get("buyer") or {}
    if buyer.get("name") or buyer.get("phone"):
        lines.append("Покупатель: " + " ".join(x for x in (buyer.get("name"), "+" + buyer["phone"] if buyer.get("phone") else "") if x))
    lines += ["", f"Продавец: {op.get('user') or ''}".rstrip(), "Спасибо за покупку!"]
    if op.get("status") == "cancelled":
        lines.append("ОТМЕНЕНО")
    return "\n".join(lines)
