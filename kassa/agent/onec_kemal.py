"""
1С Kemal Usman через COM: что программа кассы читает из 1С и какие документы создаёт.

Только база Kemal Usman (путь проверяется при подключении); базу Smart Centr эта программа не открывает.

Продажа с телефона → в 1С (одной транзакцией: не провелось — в базе ничего не остаётся):
  «Реализация товаров и услуг» — партнёр «Клиент розничная», соглашение «Розница <магазин>», склад магазина,
      дата — время продажи на телефоне, строки в мл или шт, цена — как на телефоне;
  «Приходный кассовый ордер» по реализации — касса «Касса <магазин>» (наличные) или «Перевод <магазин>» (перевод);
      оплата двумя частями — два ПКО (метки «КАССА:<id>» и «КАССА:<id>/2»).
  Метка «КАССА:<id>» в комментарии: повтор не создаёт дубль, отмена находит документы.
Отмена проведённой с телефона: документы распроводятся и помечаются на удаление (видно, что было и что отменено).

Ловушки УТ 11.5 через COM (проверено 22.10 на копии): у реализации обязательны СпособДоставки = Самовывоз,
ПорядокРасчетов из соглашения и СкидкиРассчитаны = Истина; псевдоним «В» в запросе — зарезервированное слово;
дата в COM уходит со сдвигом часового пояса — дату документа строим запросом ДАТАВРЕМЯ(...).
"""
from __future__ import annotations

import hashlib
import json
from datetime import datetime

LABEL = "КАССА:"
RETAIL_PARTNER = "Клиент розничная"
DOC_TYPES = ("ПриходныйКассовыйОрдер", "РасходныйКассовыйОрдер", "РеализацияТоваровУслуг")   # отмена — сначала деньги, потом товар


class OneCError(Exception):
    """Понятная человеку причина: уходит на телефон владельцу."""


def connect(base: str, user: str, password: str):
    import win32com.client

    if "kemal usman" not in base.lower() or "смарт центр" in base.lower():
        raise OneCError(f"это не база Kemal Usman: {base}")
    auth = f'Usr="{user}";' + (f'Pwd="{password}";' if password else "")
    s = win32com.client.Dispatch("V83.COMConnector").Connect(f'File="{base}";{auth}')
    where = str(s.СтрокаСоединенияИнформационнойБазы())
    if "kemal usman" not in where.lower():
        raise OneCError(f"подключилась не та база: {where}")
    return s


# ── помощники ────────────────────────────────────────────────────────────────

def _messages(s) -> str:
    m = s.ПолучитьСообщенияПользователю(True)
    return "; ".join(str(m.Получить(i).Текст) for i in range(m.Количество()))


def _query(s, text: str, **params):
    q = s.NewObject("Запрос", text)
    for key, value in params.items():
        q.УстановитьПараметр(key, value)
    return q.Выполнить()


def _uuid(s, ref) -> str:
    return str(s.String(ref.УникальныйИдентификатор())).lower()


def _date(s, local_iso: str):
    """Время Бишкека 'YYYY-MM-DDTHH:MM:SS' → дата 1С без сдвига часового пояса COM."""
    d = datetime.fromisoformat(local_iso[:19])
    sel = _query(s, f"ВЫБРАТЬ ДАТАВРЕМЯ({d.year}, {d.month}, {d.day}, {d.hour}, {d.minute}, {d.second}) КАК Д").Выбрать()
    sel.Следующий()
    return sel.Д


def _by_name(manager, name: str, what: str):
    ref = manager.НайтиПоНаименованию(name, True)
    if ref.Пустая():
        raise OneCError(f"в 1С нет: {what} «{name}»")
    return ref


def _retail_partner(s):
    """«Клиент розничная » в базе с пробелом на конце — ищем без него."""
    sel = _query(s, "ВЫБРАТЬ ПЕРВЫЕ 1 П.Ссылка КАК Ссылка ИЗ Справочник.Партнеры КАК П "
                    "ГДЕ П.Наименование ПОДОБНО &Имя И НЕ П.ПометкаУдаления", Имя=RETAIL_PARTNER + "%").Выбрать()
    if not sel.Следующий():
        raise OneCError(f"в 1С нет партнёра «{RETAIL_PARTNER}»")
    partner = sel.Ссылка
    sel = _query(s, "ВЫБРАТЬ ПЕРВЫЕ 1 К.Ссылка КАК Ссылка ИЗ Справочник.Контрагенты КАК К "
                    "ГДЕ К.Партнер = &П И НЕ К.ПометкаУдаления", П=partner).Выбрать()
    if not sel.Следующий():
        raise OneCError(f"у партнёра «{RETAIL_PARTNER}» нет контрагента")
    return partner, sel.Ссылка


def find_docs(s, op_id: str) -> list:
    """Документы операции по метке «КАССА:<id>» (и «/2»), не помеченные на удаление."""
    found = []
    for doc_type in DOC_TYPES:
        sel = _query(s, f"ВЫБРАТЬ Д.Ссылка КАК Ссылка ИЗ Документ.{doc_type} КАК Д "
                        "ГДЕ (Д.Комментарий ПОДОБНО &М1 ИЛИ Д.Комментарий ПОДОБНО &М2) И НЕ Д.ПометкаУдаления "
                        "УПОРЯДОЧИТЬ ПО Д.Дата, Д.Номер",
                     М1=f"{LABEL}{op_id} |%", М2=f"{LABEL}{op_id}/2 |%").Выбрать()
        while sel.Следующий():
            found.append((doc_type, sel.Ссылка))
    return found


def _doc_entry(doc_type: str, ref) -> dict:
    names = {"РеализацияТоваровУслуг": "Реализация", "ПриходныйКассовыйОрдер": "ПКО", "РасходныйКассовыйОрдер": "РКО"}
    return {"type": names.get(doc_type, doc_type), "number": str(ref.Номер).strip()}


# ── 1С → телефон: товары ─────────────────────────────────────────────────────

def snapshot(s, shops: list[str]) -> list[dict]:
    """Все товары с остатком или ценой хотя бы в одном магазине: остаток и цена по магазинам, единица."""
    warehouses = [_by_name(s.Справочники.Склады, shop, "склад") for shop in shops]
    joins, cols = [], []
    params = {}
    for i, wh in enumerate(warehouses):
        params[f"С{i}"] = wh
        params[f"Ц{i}"] = wh.РозничныйВидЦены
        joins.append(f"""ЛЕВОЕ СОЕДИНЕНИЕ (ВЫБРАТЬ О.Номенклатура КАК Номенклатура, СУММА(О.ВНаличииОстаток) КАК Остаток
            ИЗ РегистрНакопления.ТоварыНаСкладах.Остатки(, Склад = &С{i}) КАК О СГРУППИРОВАТЬ ПО О.Номенклатура) КАК Ост{i}
            ПО Ост{i}.Номенклатура = Н.Ссылка
          ЛЕВОЕ СОЕДИНЕНИЕ (ВЫБРАТЬ Ц.Номенклатура КАК Номенклатура, МАКСИМУМ(Ц.Цена) КАК Цена
            ИЗ РегистрСведений.ЦеныНоменклатуры25.СрезПоследних(, ВидЦены = &Ц{i}) КАК Ц СГРУППИРОВАТЬ ПО Ц.Номенклатура) КАК Цен{i}
            ПО Цен{i}.Номенклатура = Н.Ссылка""")
        cols.append(f"ЕСТЬNULL(Ост{i}.Остаток, 0) КАК Остаток{i}, ЕСТЬNULL(Цен{i}.Цена, 0) КАК Цена{i}")
    # Себестоимость за единицу — остаток регистра «Себестоимость товаров» (стоимость / количество, все склады).
    joins.append("""ЛЕВОЕ СОЕДИНЕНИЕ (ВЫБРАТЬ С.АналитикаУчетаНоменклатуры.Номенклатура КАК Номенклатура,
            СУММА(С.КоличествоОстаток) КАК Кол, СУММА(С.СтоимостьОстаток) КАК Стоим
            ИЗ РегистрНакопления.СебестоимостьТоваров.Остатки КАК С СГРУППИРОВАТЬ ПО С.АналитикаУчетаНоменклатуры.Номенклатура) КАК Себ
            ПО Себ.Номенклатура = Н.Ссылка""")
    text = ("ВЫБРАТЬ Н.Ссылка КАК Ссылка, Н.Код КАК Код, Н.Наименование КАК Имя, Н.Артикул КАК Артикул, "
            "ЕСТЬNULL(Н.Родитель.Наименование, \"\") КАК Группа, ЕСТЬNULL(Н.ЕдиницаИзмерения.Наименование, \"\") КАК Ед, "
            "ЕСТЬNULL(Себ.Кол, 0) КАК СебКол, ЕСТЬNULL(Себ.Стоим, 0) КАК СебСтоим, "
            + ", ".join(cols) + " ИЗ Справочник.Номенклатура КАК Н " + " ".join(joins)
            + " ГДЕ НЕ Н.ЭтоГруппа И НЕ Н.ПометкаУдаления")
    sel = _query(s, text, **params).Выбрать()
    items = []
    while sel.Следующий():
        stock = {shop: float(getattr(sel, f"Остаток{i}")) for i, shop in enumerate(shops) if float(getattr(sel, f"Остаток{i}"))}
        price = {shop: float(getattr(sel, f"Цена{i}")) for i, shop in enumerate(shops) if float(getattr(sel, f"Цена{i}"))}
        if not stock and not price:
            continue
        items.append({"id": _uuid(s, sel.Ссылка), "code": str(sel.Код).strip(), "name": str(sel.Имя).strip(),
                      "article": str(sel.Артикул or "").strip(), "group": str(sel.Группа or "").strip(),
                      "unit": str(sel.Ед or "").strip(), "stock": stock, "price": price,
                      "cost": round(float(sel.СебСтоим) / float(sel.СебКол), 2) if float(sel.СебКол) > 0 else 0})
    items.sort(key=lambda x: x["id"])
    return items


def fingerprint(items: list[dict]) -> str:
    return hashlib.sha256(json.dumps(items, ensure_ascii=False, sort_keys=True).encode("utf-8")).hexdigest()


# ── настройка: кассы «Перевод <магазин>» ─────────────────────────────────────

def ensure_desks(s, shops: list[dict], create: bool) -> list[str]:
    """Есть ли кассы магазинов; create — завести недостающие копией «Касса <магазин>». Возвращает, что сделано/чего нет."""
    notes = []
    for shop in shops:
        cash = s.Справочники.Кассы.НайтиПоНаименованию(shop["cashDesk"], True)
        if cash.Пустая():
            notes.append(f"нет кассы «{shop['cashDesk']}» — заведите её в 1С")
            continue
        transfer = s.Справочники.Кассы.НайтиПоНаименованию(shop["transferDesk"], True)
        if not transfer.Пустая():
            notes.append(f"касса «{shop['transferDesk']}» есть")
        elif create:
            copy = cash.Скопировать()
            copy.Наименование = shop["transferDesk"]
            copy.Записать()
            notes.append(f"заведена касса «{shop['transferDesk']}»")
        else:
            notes.append(f"нет кассы «{shop['transferDesk']}» — заведёт: python kassa_agent.py setup --apply")
    return notes


# ── телефон → 1С: продажа ────────────────────────────────────────────────────

def _shortage(s, warehouse, lines: list[dict]) -> str:
    sel = _query(s, "ВЫБРАТЬ О.Номенклатура КАК Н, СУММА(О.ВНаличииОстаток) КАК К "
                    "ИЗ РегистрНакопления.ТоварыНаСкладах.Остатки(, Склад = &С И Номенклатура В (&Список)) КАК О "
                    "СГРУППИРОВАТЬ ПО О.Номенклатура", С=warehouse, Список=_ref_list(s, [l["_ref"] for l in lines])).Выбрать()
    have = {}
    while sel.Следующий():
        have[_uuid(s, sel.Н)] = float(sel.К)
    wanted: dict[str, float] = {}
    for line in lines:
        wanted[line["itemId"]] = wanted.get(line["itemId"], 0) + float(line["qty"])
    short = [f"{l['name']} (в 1С {have.get(l['itemId'], 0):g} {l.get('unit') or ''})".replace(" )", ")")
             for l in {x["itemId"]: x for x in lines}.values() if have.get(l["itemId"], 0) + 1e-9 < wanted[l["itemId"]]]
    return "; ".join(short)


def _ref_list(s, refs: list):
    arr = s.NewObject("Массив")
    for ref in refs:
        arr.Добавить(ref)
    return arr


def _manager(s, name: str):
    """Пользователь 1С с именем продавца — в «Менеджер» реализации (бонус продавца на этапе 2). Нет — пусто."""
    ref = s.Справочники.Пользователи.НайтиПоНаименованию(name, True) if name else None
    return None if ref is None or ref.Пустая() else ref


def post_sale(s, op: dict, shops: dict[str, dict]) -> list[dict]:
    """Провести продажу. Возвращает номера документов [{type, number}]; ошибка — OneCError с причиной."""
    op_id = op["id"]
    payload = op.get("payload") or {}
    existing = find_docs(s, op_id)
    if any(t == "РеализацияТоваровУслуг" and ref.Проведен for t, ref in existing):
        return [_doc_entry(t, ref) for t, ref in existing]       # уже проведена (повтор после сбоя связи)
    shop = shops.get(payload.get("shop") or "")
    if not shop:
        raise OneCError(f"магазин «{payload.get('shop')}» не настроен в программе кассы")
    warehouse = _by_name(s.Справочники.Склады, shop["name"], "склад")
    agreement = _by_name(s.Справочники.СоглашенияСКлиентами, "Розница " + shop["name"], "соглашение")
    price_type = warehouse.РозничныйВидЦены
    org = agreement.Организация
    currency = agreement.Валюта if not agreement.Валюта.Пустая() else _by_name(s.Справочники.Валюты, "KGS", "валюта")
    debt = payload.get("debt") or None
    if debt:
        # В долг — на карточку покупателя (найти по телефону или имени, иначе завести); иначе «Клиент розничная».
        from onec_kemal_stage2 import buyer_partner, debt_stages, debt_text
        partner, contractor = buyer_partner(s, payload.get("buyer") or {})
    else:
        partner, contractor = _retail_partner(s)
    no_vat = _by_name(s.Справочники.СтавкиНДС, "Без НДС", "ставка НДС")
    lines = []
    for line in payload.get("lines") or []:
        ref = s.Справочники.Номенклатура.ПолучитьСсылку(s.NewObject("УникальныйИдентификатор", line["itemId"]))
        if ref.ПолучитьОбъект() is None:
            raise OneCError(f"товара «{line.get('name')}» больше нет в 1С")
        lines.append({**line, "_ref": ref})
    short = _shortage(s, warehouse, lines)
    if short:
        raise OneCError("Не хватает в 1С: " + short)

    when = _date(s, op.get("createdAt") or datetime.now().isoformat())
    seller = op.get("user") or ""
    note = " | ".join(x for x in (f"продавец: {seller}" if seller else "", (payload.get("buyer") or {}).get("name") or "",
                                  ("+" + payload["buyer"]["phone"]) if (payload.get("buyer") or {}).get("phone") else "",
                                  payload.get("note") or "",
                                  ("договор: " + payload["contractUrl"]) if payload.get("contractUrl") else "") if x)
    desks = {"cash": shop["cashDesk"], "transfer": shop["transferDesk"]}
    payments = payload.get("payments") or []
    docs = []
    s.НачатьТранзакцию()
    try:
        doc = s.Документы.РеализацияТоваровУслуг.СоздатьДокумент()
        doc.Дата = when
        doc.ХозяйственнаяОперация = s.Перечисления.ХозяйственныеОперации.РеализацияКлиенту
        doc.Организация = org
        doc.Партнер = partner
        doc.Контрагент = contractor
        doc.Соглашение = agreement
        doc.Склад = warehouse
        doc.Валюта = currency
        doc.ВалютаВзаиморасчетов = currency
        doc.ЦенаВключаетНДС = False
        doc.СпособДоставки = s.Перечисления.СпособыДоставки.Самовывоз
        doc.ПорядокРасчетов = s.Перечисления.ПорядокРасчетов.ПоНакладным if debt else agreement.ПорядокРасчетов
        doc.НалогообложениеНДС = s.Перечисления.ТипыНалогообложенияНДС.ПродажаНеОблагаетсяНДС
        manager = _manager(s, seller)
        if manager is not None:
            doc.Менеджер = manager
        bonus = float(payload.get("bonus") or 0)
        doc.Комментарий = f"{LABEL}{op_id} | " + (note or "касса с телефона") + (f" | бонусами клуба {bonus:g}" if bonus else "")
        shares = bonus_shares([float(l["sum"]) for l in lines], bonus)
        for line, share in zip(lines, shares):
            row = doc.Товары.Добавить()
            row.Номенклатура = line["_ref"]
            row.Количество = line["qty"]
            row.КоличествоУпаковок = line["qty"]
            if abs(float(line.get("listPrice") or 0) - float(line["price"])) < 0.005:
                row.ВидЦены = price_type          # цена прайса; другая цена — ручная, без вида цен
            row.Цена = line["price"]
            # Бонусы клуба (этап 3) — ручная скидка строки, как «Списать бонус» в 1С Smart Centr: сумма строки меньше на долю бонуса.
            if share:
                row.СуммаРучнойСкидки = share
                row.ПроцентРучнойСкидки = round(share / float(line["sum"]) * 100, 2)
            row.Сумма = round(float(line["sum"]) - share, 2)
            row.СуммаСНДС = round(float(line["sum"]) - share, 2)
            row.СтавкаНДС = no_vat
            row.Склад = warehouse
        doc.СкидкиРассчитаны = True
        if debt:
            debt_stages(s, doc, debt, op.get("createdAt") or datetime.now().isoformat(), float(payload["total"]))
            doc.Комментарий = doc.Комментарий + " | " + debt_text(debt)
        _write(s, doc, "реализация")
        docs.append(("РеализацияТоваровУслуг", doc.Ссылка))
        for index, part in enumerate(payments):
            desk = _by_name(s.Справочники.Кассы, desks.get(part.get("method"), ""), "касса")
            pko = s.Документы.ПриходныйКассовыйОрдер.СоздатьДокумент()
            pko.Заполнить(doc.Ссылка)
            pko.Дата = when
            pko.Касса = desk
            amount = float(part["amount"])
            if len(payments) > 1 or debt:
                pko.СуммаДокумента = amount
                for i in range(pko.РасшифровкаПлатежа.Количество()):
                    row = pko.РасшифровкаПлатежа.Получить(i)
                    row.Сумма = amount
                    row.СуммаВзаиморасчетов = amount
            if abs(float(pko.СуммаДокумента) - amount) > 0.005:
                raise OneCError(f"ПКО вышел на {float(pko.СуммаДокумента):g} вместо {amount:g}")
            suffix = "" if index == 0 else "/2"
            pko.Комментарий = f"{LABEL}{op_id}{suffix} | " + ("наличные" if part.get("method") == "cash" else "перевод") + (f" | {note}" if note else "")
            _write(s, pko, "ПКО")
            docs.append(("ПриходныйКассовыйОрдер", pko.Ссылка))
    except Exception:
        s.ОтменитьТранзакцию()
        raise
    s.ЗафиксироватьТранзакцию()
    return [_doc_entry(t, ref) for t, ref in docs]


def bonus_shares(sums: list[float], bonus: float) -> list[float]:
    """Бонус по строкам пропорционально суммам (до тийина), остаток округления — в последнюю строку."""
    total = sum(sums)
    if bonus <= 0 or total <= 0:
        return [0.0] * len(sums)
    shares = [round(bonus * s / total, 2) for s in sums]
    shares[-1] = round(bonus - sum(shares[:-1]), 2)
    return shares


def post_op(s, op: dict, shops: dict[str, dict]) -> list[dict]:
    """Любая операция с телефона → документы 1С."""
    if op.get("kind") == "sale":
        return post_sale(s, op, shops)
    import onec_kemal_stage2 as stage2
    poster = {"payment": stage2.post_payment, "expense": stage2.post_expense, "transfer": stage2.post_transfer}.get(op.get("kind"))
    if poster is None:
        raise OneCError(f"операция «{op.get('kind')}» в 1С не проводится")
    return poster(s, op, shops)


def _write(s, doc, what: str, check: bool = True) -> None:
    if check and not doc.ПроверитьЗаполнение():
        raise OneCError(f"{what}: {_messages(s) or 'не заполнено'}")
    try:
        doc.Записать(s.РежимЗаписиДокумента.Проведение)
    except Exception as error:   # noqa: BLE001 — человеку нужна причина 1С, а не текст исключения COM
        raise OneCError(f"{what} не провелась: {_messages(s) or _com_text(error)}") from error


def _com_text(error: Exception) -> str:
    args = getattr(error, "args", ())
    try:
        return str(args[2][2])
    except (IndexError, TypeError):
        return str(error)[:300]


def cancel_sale(s, op_id: str) -> int:
    """Отмена с телефона: распровести документы операции и пометить на удаление. Возвращает, сколько документов."""
    count = 0
    s.НачатьТранзакцию()
    try:
        for _doc_type, ref in find_docs(s, op_id):
            obj = ref.ПолучитьОбъект()
            if obj.Проведен:
                obj.Записать(s.РежимЗаписиДокумента.ОтменаПроведения)
            obj.УстановитьПометкуУдаления(True)
            count += 1
    except Exception:
        s.ОтменитьТранзакцию()
        raise
    s.ЗафиксироватьТранзакцию()
    return count
