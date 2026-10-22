"""
Касса Kemal Usman — правила без базы и HTTP: что можно продать, сколько осталось, PIN, роли, чек.
Всё здесь проверяется тестами (tests/test_rules.py); app.py только читает базу и зовёт эти функции.

Отличия от «Кассы Smarket» (Smart Centr), с которой взята идея:
- количество с дробью: атир продают в мл (5, 2.5, 12.8); штучный товар — целым числом;
- два магазина (склады 1С): остаток, цена и деньги — по магазину, продавец может быть привязан к своему магазину;
- оплата: наличные или перевод (до двух частей: часть наличными, часть переводом).
Этап 2: продажа в долг (до даты или рассрочкой по месяцам), оплата долга, расход по статье и перевод между кассами
(владелец), деньги в кассах, прибыль и бонус продавца (процент от прибыли его продаж).
"""
from __future__ import annotations

import calendar
import hashlib
import hmac
import re
import secrets
from collections import defaultdict
from datetime import date, datetime, timedelta
from decimal import Decimal, InvalidOperation, ROUND_CEILING, ROUND_HALF_UP

ROLES = ("owner", "staff")
KINDS = ("sale", "payment", "expense", "transfer")
STAFF_KINDS = ("sale", "payment")
OWNER_KINDS = ("expense", "transfer")
DEBT_MAX_DAYS = 365
MONTHS_MAX = 12
STAFF_BONUS_PCT = Decimal(10)     # бонус продавца — % от прибыли его продаж (как в Smart Centr), меняет владелец
STAFF_BONUS_MAX = Decimal(50)
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
    return {"tabs": ["sale", "payment", "today", "stock", "staff"] if owner else ["sale", "payment", "today", "stock"], "allOps": owner}


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
    if raw.get("bonusPct") not in (None, ""):
        pct = money(raw.get("bonusPct"))
        if pct < 0 or pct > STAFF_BONUS_MAX:
            return {"ok": False, "error": f"бонус — от 0 до {STAFF_BONUS_MAX:g} %"}
        out["bonusPct"] = float(pct)
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


def check_sale(op: dict, user: dict, items: dict[str, dict], shops: list[str], taken: dict[str, dict[str, Decimal]],
               today: date | None = None) -> dict:
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
                      "qty": num(qty), "price": float(price), "sum": float(line_sum), "listPrice": float(list_price),
                      # себестоимость за единицу на момент продажи: прибыль не поплывёт, когда 1С пересчитает
                      "cost": float(money(item.get("cost") or 0))})
    short = shortages(lines, items, shop, taken)
    if short:
        return {"ok": False, "error": "Не хватает в магазине: " + "; ".join(short)}
    total = sum((money(l["sum"]) for l in lines), Decimal(0))
    if total <= 0 or total > MAX_SUM:
        return {"ok": False, "error": "сумма продажи не подходит"}
    buyer_raw = payload.get("buyer") if isinstance(payload.get("buyer"), dict) else {}
    buyer = {"name": _text(buyer_raw.get("name"), 100), "phone": phone_digits(buyer_raw.get("phone"))}
    if str(buyer_raw.get("phone") or "").strip() and not buyer["phone"]:
        return {"ok": False, "error": "номер покупателя: 9 цифр, например 555 123 456"}
    debt = None
    if isinstance(payload.get("debt"), dict) and payload.get("debt"):
        # В долг: покупатель с именем и телефоном обязателен — по нему 1С находит или заводит карточку, долг виден в «Оплате».
        if not buyer["name"] or not buyer["phone"]:
            return {"ok": False, "error": "в долг — напишите имя и телефон покупателя"}
        built = build_debt(total, payload["debt"], today or date.today())
        if not built["ok"]:
            return built
        debt = built["debt"]
        paid = {"ok": True, "payments": [{"method": debt["method"], "amount": debt["paid"]}] if debt["paid"] > 0 else []}
    else:
        paid = build_payments(payload.get("payments"), total)
        if not paid["ok"]:
            return paid
    clean = {"shop": shop, "lines": lines, "total": float(total), "payments": paid["payments"],
             "note": _text(payload.get("note"), NOTE_MAX)}
    if debt:
        clean["debt"] = debt
    if buyer["name"] or buyer["phone"]:
        clean["buyer"] = buyer
    return {"ok": True, "payload": clean}


# ── Долг ─────────────────────────────────────────────────────────────────────

def add_months(start: date, months: int) -> date:
    month = start.month - 1 + months
    year, month = start.year + month // 12, month % 12 + 1
    return date(year, month, min(start.day, calendar.monthrange(year, month)[1]))


def _day(value) -> date | None:
    try:
        return date.fromisoformat(str(value)[:10])
    except (TypeError, ValueError):
        return None


def build_debt(total: Decimal, raw: dict, today: date) -> dict:
    """
    {paid, method, dueDate} — остаток одним платежом до даты; {paid, method, months} — рассрочка: остаток поровну по месяцам
    (вверх до 10 сом, последний платёж — сколько осталось), первый платёж через месяц. paid — заплатил сейчас (может быть 0).
    Возвращает {'ok', 'debt': {paid, method, schedule: [{date, sum}], months?, dueDate?}}.
    """
    paid = money(raw.get("paid"))
    method = str(raw.get("method") or "cash")
    if method not in METHODS:
        return {"ok": False, "error": "оплата сейчас — наличные или перевод"}
    if paid < 0 or paid >= total:
        return {"ok": False, "error": "сейчас заплатил — меньше суммы продажи (иначе это не долг)"}
    left = total - paid
    months = int(money(raw.get("months"))) if raw.get("months") not in (None, "", 0, "0") else 0
    schedule = []
    out = {"paid": float(paid), "method": method}
    if months:
        if months < 1 or months > MONTHS_MAX:
            return {"ok": False, "error": f"рассрочка — от 1 до {MONTHS_MAX} месяцев"}
        monthly = (left / months / 10).quantize(Decimal(1), rounding=ROUND_CEILING) * 10
        rest = left
        for n in range(1, months + 1):
            part = min(monthly, rest) if n < months else rest
            if part <= 0:
                break
            schedule.append({"date": add_months(today, n).isoformat(), "sum": float(part)})
            rest -= part
        out.update({"months": len(schedule), "monthly": float(monthly)})
    else:
        due = _day(raw.get("dueDate"))
        if due is None or due < today or due > today + timedelta(days=DEBT_MAX_DAYS):
            return {"ok": False, "error": "в долг — выберите дату, до какого числа (не позже чем через год)"}
        schedule.append({"date": due.isoformat(), "sum": float(left)})
        out["dueDate"] = due.isoformat()
    out["schedule"] = schedule
    out["left"] = float(left)
    return {"ok": True, "debt": out}


def paid_by_ops(ops: list[dict]) -> dict[str, Decimal]:
    """{debtId: сумма} — платежи с телефона (new), 1С их ещё не провела."""
    paid: dict[str, Decimal] = defaultdict(Decimal)
    for op in ops:
        if op.get("kind") == "payment":
            payload = op.get("payload") or {}
            paid[str(payload.get("debtId") or "")] += money(payload.get("amount"))
    return dict(paid)


def debt_left(left, paid=0) -> Decimal:
    return max(money(left) - money(paid), Decimal(0))


def unpaid_schedule(schedule: list[dict], left) -> list[dict]:
    """Части графика, которые ещё не оплачены: оплата закрывает части по порядку, с самой ранней."""
    total = sum((money(p.get("sum")) for p in schedule), Decimal(0))
    covered = max(total - money(left), Decimal(0))
    out = []
    for part in sorted(schedule, key=lambda p: str(p.get("date"))):
        amount = money(part.get("sum"))
        if covered >= amount:
            covered -= amount
            continue
        out.append({"date": str(part.get("date"))[:10], "sum": float(amount - covered)})
        covered = Decimal(0)
    return out


def check_payment(op_id: str, payload: dict, user: dict, debts: dict[str, dict], paid: dict[str, Decimal], shops: list[str]) -> dict:
    debt = debts.get(str(payload.get("debtId") or "").lower())
    if debt is None:
        return {"ok": False, "error": "долг не найден — обновите список"}
    amount = money(payload.get("amount"))
    left = debt_left(debt.get("left"), paid.get(debt["id"], 0))
    if amount <= 0:
        return {"ok": False, "error": "укажите сумму"}
    if amount > left:
        return {"ok": False, "error": f"по этому долгу осталось {_som(left)}"}
    method = str(payload.get("method") or "")
    if method not in METHODS:
        return {"ok": False, "error": "оплата — наличные или перевод"}
    shop, why = shop_for(user, str(payload.get("shop") or ""), shops)
    if not shop:
        return {"ok": False, "error": why}
    return {"ok": True, "payload": {"debtId": debt["id"], "doc": debt.get("doc") or "", "clientName": debt.get("clientName") or "",
                                    "amount": float(amount), "method": method, "shop": shop, "leftAfter": float(left - amount),
                                    "note": _text(payload.get("note"), NOTE_MAX)}}


# ── Касса владельца: расход и перевод ────────────────────────────────────────

def check_expense(payload: dict, desks: list[str], articles: dict[str, dict]) -> dict:
    desk = str(payload.get("desk") or "")
    if desk not in desks:
        return {"ok": False, "error": "выберите кассу"}
    article = articles.get(str(payload.get("articleId") or "").lower())
    if article is None:
        return {"ok": False, "error": "выберите статью расхода"}
    amount = money(payload.get("amount"))
    if amount <= 0 or amount > MAX_SUM:
        return {"ok": False, "error": "укажите сумму"}
    return {"ok": True, "payload": {"desk": desk, "articleId": article["id"], "article": article["name"], "amount": float(amount),
                                    "note": _text(payload.get("note"), NOTE_MAX)}}


def check_transfer(payload: dict, desks: list[str]) -> dict:
    src, dst = str(payload.get("fromDesk") or ""), str(payload.get("toDesk") or "")
    if src not in desks or dst not in desks:
        return {"ok": False, "error": "выберите обе кассы"}
    if src == dst:
        return {"ok": False, "error": "перевод в ту же кассу"}
    amount = money(payload.get("amount"))
    if amount <= 0 or amount > MAX_SUM:
        return {"ok": False, "error": "укажите сумму"}
    return {"ok": True, "payload": {"fromDesk": src, "toDesk": dst, "amount": float(amount), "note": _text(payload.get("note"), NOTE_MAX)}}


def check_op(op: dict, user: dict, ctx: dict) -> dict:
    """Любая операция с телефона. ctx: items, shops, taken, debts, paid, desks, articles, today."""
    op_id = str(op.get("id") or "").lower()
    kind = str(op.get("kind") or "")
    if not UUID_RE.fullmatch(op_id):
        return {"ok": False, "error": "нет идентификатора операции"}
    if kind not in KINDS:
        return {"ok": False, "error": "неизвестная операция"}
    if user.get("role") != "owner" and kind not in STAFF_KINDS:
        return {"ok": False, "error": "это может только владелец"}
    payload = op.get("payload") if isinstance(op.get("payload"), dict) else {}
    if kind == "sale":
        return check_sale(op, user, ctx.get("items") or {}, ctx.get("shops") or [], ctx.get("taken") or {}, ctx.get("today"))
    if kind == "payment":
        return check_payment(op_id, payload, user, ctx.get("debts") or {}, ctx.get("paid") or {}, ctx.get("shops") or [])
    if kind == "expense":
        return check_expense(payload, ctx.get("desks") or [], ctx.get("articles") or {})
    return check_transfer(payload, ctx.get("desks") or [])


def op_desk_moves(op: dict, shops: dict[str, dict]) -> list[tuple[str, Decimal]]:
    """Сколько операция добавила (+) или забрала (−) из каждой кассы 1С. shops — {магазин: {cashDesk, transferDesk}}."""
    payload, kind = op.get("payload") or {}, op.get("kind")
    shop = shops.get(str(payload.get("shop") or "")) or {}
    desk_of = {"cash": shop.get("cashDesk") or "", "transfer": shop.get("transferDesk") or ""}
    if kind == "sale":
        return [(desk_of.get(p.get("method"), ""), money(p.get("amount"))) for p in payload.get("payments") or []]
    if kind == "payment":
        return [(desk_of.get(payload.get("method"), ""), money(payload.get("amount")))]
    if kind == "expense":
        return [(str(payload.get("desk") or ""), -money(payload.get("amount")))]
    if kind == "transfer":
        amount = money(payload.get("amount"))
        return [(str(payload.get("fromDesk") or ""), -amount), (str(payload.get("toDesk") or ""), amount)]
    return []


def desk_balances(balances: list[dict], new_ops: list[dict], shops: dict[str, dict]) -> list[dict]:
    """Деньги в кассах: остаток 1С + операции с телефона, которые 1С ещё не провела."""
    out: dict[str, Decimal] = {b["name"]: money(b.get("amount")) for b in balances}
    pending: dict[str, Decimal] = defaultdict(Decimal)
    for op in new_ops:
        for desk, amount in op_desk_moves(op, shops):
            if desk:
                pending[desk] += amount
    for desk in pending:
        out.setdefault(desk, Decimal(0))
    rows = [{"desk": d, "amount": float(a + pending.get(d, 0)), "amount1c": float(a), "pending": float(pending.get(d, 0))}
            for d, a in out.items()]
    rows.sort(key=lambda r: -r["amount"])
    return rows


# ── Прибыль и бонус продавца ─────────────────────────────────────────────────

PERIODS = (("today", 1), ("week", 7), ("month", 30))


def sale_profit(payload: dict) -> dict:
    """Выручка и прибыль продажи по себестоимости на момент продажи (строка cost); строки без себестоимости не считаем в прибыль."""
    revenue = money(payload.get("total"))
    cost, no_cost = Decimal(0), 0
    for line in payload.get("lines") or []:
        unit_cost = money(line.get("cost"))
        if unit_cost <= 0:
            no_cost += 1
            revenue -= money(line.get("sum"))
            continue
        cost += money(unit_cost * quantity(line.get("qty")))
    return {"revenue": money(payload.get("total")), "profit": revenue - cost, "noCost": no_cost}


def _op_day(op: dict) -> date | None:
    return _day(op.get("createdAt"))


def gross_profit(ops: list[dict], today: date) -> dict:
    """Владельцу: выручка и прибыль за сегодня / 7 / 30 дней (только продажи, кроме отменённых)."""
    out = {}
    for key, days in PERIODS:
        start = today - timedelta(days=days - 1)
        revenue, profit, sales, no_cost = Decimal(0), Decimal(0), 0, 0
        for op in ops:
            day = _op_day(op)
            if op.get("kind") != "sale" or op.get("status") in ("cancelled", "cancelling") or day is None or day < start or day > today:
                continue
            p = sale_profit(op.get("payload") or {})
            revenue += p["revenue"]
            profit += p["profit"]
            sales += 1
            no_cost += p["noCost"]
        out[key] = {"revenue": float(revenue), "profit": float(profit), "sales": sales, "noCost": no_cost}
    return out


def capital(items: list[dict], taken: dict[str, dict[str, Decimal]], desks: list[dict], debts_left) -> dict:
    """«Общий капитал» владельца: товар по себестоимости (остаток 1С минус непроведённые продажи) + деньги в кассах + долги покупателей."""
    goods, no_cost = Decimal(0), 0
    for item in items:
        qty = sum((free_stock(q, taken.get(shop, {}).get(item["id"], 0)) for shop, q in (item.get("stock") or {}).items()), Decimal(0))
        if qty <= 0:
            continue
        if money(item.get("cost")) <= 0:
            no_cost += 1
            continue
        goods += money(qty * money(item.get("cost")))
    cash = sum((money(d.get("amount")) for d in desks), Decimal(0))
    debts = money(debts_left)
    return {"goods": float(goods), "cash": float(cash), "debts": float(debts), "total": float(goods + cash + debts), "noCost": no_cost}


def staff_rating(ops: list[dict], users: list[dict], today: date) -> dict:
    """Рейтинг продавцов: сегодня и с начала месяца — продажи, выручка, прибыль, бонус = процент от прибыли."""
    ranges = {"today": (today, today), "month": (today.replace(day=1), today)}
    out = {}
    for key, (start, end) in ranges.items():
        rows = {u["id"]: {"userId": u["id"], "name": u["name"], "pct": float(u.get("bonusPct") or 0), "sales": 0,
                          "revenue": Decimal(0), "profit": Decimal(0)} for u in users if u.get("role") != "owner"}
        for op in ops:
            day = _op_day(op)
            row = rows.get(op.get("userId"))
            if row is None or op.get("kind") != "sale" or op.get("status") in ("cancelled", "cancelling") or day is None or not start <= day <= end:
                continue
            p = sale_profit(op.get("payload") or {})
            row["sales"] += 1
            row["revenue"] += p["revenue"]
            row["profit"] += p["profit"]
        result = []
        for row in rows.values():
            bonus = money(max(row["profit"], Decimal(0)) * Decimal(str(row["pct"])) / 100)
            result.append({**row, "revenue": float(row["revenue"]), "profit": float(row["profit"]), "bonus": float(bonus)})
        result.sort(key=lambda r: (-r["profit"], -r["revenue"]))
        out[key] = result
    return out


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
            "price": {shop: float(money(prices.get(shop))) for shop in shops if money(prices.get(shop)) > 0},
            "cost": float(max(money(raw.get("cost")), Decimal(0)))}


def clean_debt(raw: dict) -> dict | None:
    """Долг из 1С: реализация с неоплаченным остатком (КОплатеОстаток) и её покупатель."""
    debt_id = str(raw.get("id") or "").lower()
    left = money(raw.get("left"))
    if not UUID_RE.fullmatch(debt_id) or left <= 0:
        return None
    schedule = [{"date": str(p.get("date"))[:10], "sum": float(money(p.get("sum")))}
                for p in (raw.get("schedule") if isinstance(raw.get("schedule"), list) else []) if isinstance(p, dict) and _day(p.get("date"))]
    return {"id": debt_id, "doc": _text(raw.get("doc"), 30), "date": str(raw.get("date") or "")[:10],
            "clientId": str(raw.get("clientId") or "").lower()[:36], "clientName": _text(raw.get("clientName"), 150),
            "phones": _text(raw.get("phones"), 200), "shop": _text(raw.get("shop"), 150),
            "total": float(money(raw.get("total"))), "left": float(left), "schedule": schedule}


def clean_entry(raw: dict) -> dict | None:
    """Статья расходов из 1С: {id, name, uses} (uses — сколько раз за полгода: частые сверху)."""
    entry_id = str(raw.get("id") or "").lower()
    name = _text(raw.get("name"), 150)
    if not UUID_RE.fullmatch(entry_id) or not name:
        return None
    return {"id": entry_id, "name": name, "uses": int(money(raw.get("uses")))}


def clean_balance(raw: dict) -> dict | None:
    """Деньги в кассе 1С: {name, amount} в сомах."""
    name = _text(raw.get("name"), 150)
    return {"name": name, "amount": float(money(raw.get("amount")))} if name else None


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
    payload, kind = op.get("payload") or {}, op.get("kind") or "sale"
    title = {"sale": "чек", "payment": "оплата долга", "expense": "расход", "transfer": "перевод между кассами"}.get(kind, "операция")
    lines = [f"*{shop_title}* — {title}", _when(op.get("createdAt"))]
    if payload.get("shop"):
        lines.append(f"Магазин: {payload['shop']}")
    lines.append("")
    if kind == "sale":
        for line in payload.get("lines") or []:
            lines.append(f"• {line.get('name')} — {num(line.get('qty'))} {line.get('unit') or ''} × {_som(line.get('price'))} = {_som(line.get('sum'))}"
                         .replace("  ×", " ×"))
        lines.append(f"*Итого: {_som(payload.get('total'))}*")
        parts = payload.get("payments") or []
        debt = payload.get("debt") or {}
        if debt:
            if parts:
                lines.append(f"Оплачено сейчас: {_som(debt.get('paid'))} ({METHODS.get(debt.get('method'), '')})")
            if debt.get("months"):
                lines.append(f"Рассрочка {debt['months']} мес.:")
            else:
                lines.append("В долг:")
            lines += [f"  до {_when(p.get('date') + 'T00:00')[:10]} — {_som(p.get('sum'))}" for p in debt.get("schedule") or []]
        elif len(parts) > 1:
            lines.append("Оплата: " + "; ".join(f"{METHODS.get(p.get('method'), '')} — {_som(p.get('amount'))}" for p in parts))
        elif parts:
            lines.append("Оплата: " + METHODS.get(parts[0].get("method"), ""))
        buyer = payload.get("buyer") or {}
        if buyer.get("name") or buyer.get("phone"):
            lines.append("Покупатель: " + " ".join(x for x in (buyer.get("name"), "+" + buyer["phone"] if buyer.get("phone") else "") if x))
    elif kind == "payment":
        lines.append(f"Оплата по продаже {payload.get('doc') or ''}: *{_som(payload.get('amount'))}* ({METHODS.get(payload.get('method'), '')})")
        if payload.get("clientName"):
            lines.append(f"Покупатель: {payload['clientName']}")
        lines.append(f"Осталось по этой продаже: {_som(payload.get('leftAfter'))}")
    elif kind == "expense":
        lines += [f"Расход: *{_som(payload.get('amount'))}*", f"Статья: {payload.get('article') or ''}", f"Из кассы: {payload.get('desk') or ''}"]
    elif kind == "transfer":
        lines += [f"Перевод: *{_som(payload.get('amount'))}*", f"Из: {payload.get('fromDesk') or ''}", f"В: {payload.get('toDesk') or ''}"]
    if payload.get("note") and kind != "sale":
        lines.append(f"Заметка: {payload['note']}")
    lines += ["", (f"Продавец: {op.get('user') or ''}" if kind in ("sale", "payment") else f"Записал: {op.get('user') or ''}").rstrip()]
    if kind in ("sale", "payment"):
        lines.append("Спасибо за покупку!")
    if op.get("status") == "cancelled":
        lines.append("ОТМЕНЕНО")
    return "\n".join(lines)
