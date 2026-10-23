"""
1С Kemal Usman, этап 2: продажа в долг, оплата долга, расход по статье, перевод между кассами; долги, статьи и деньги
в кассах для телефона. Общие помощники и продажа — в onec_kemal.py.

Проверено на копии 22.10: реализация в долг (порядок расчётов «по накладным», этапы графика «кредит после отгрузки», у этапа
обязателен «Вариант отсчёта»), ПКО по ней — Заполнить даёт первый этап, сумму ставим сами; долг — остаток КОплатеОстаток
регистра «Расчёты с клиентами» по объекту расчётов (сама реализация). Долги из Billz (23.10) — первичные документы
«Реализация клиенту» из ввода остатков: Заполнить() строк не даёт, ПКО заполняем сами (проверено на копии 23.10); расход — РКО «Выплата по ведомости через кассу» со
статьёй в шапке; перевод — пара РКО/ПКО (проверка заполнения пишет «касса получатель недоступна», но документ проводится).
"""
from __future__ import annotations

from datetime import datetime, timedelta

from onec_kemal import LABEL, OneCError, _by_name, _date, _doc_entry, _query, _uuid, _write, find_docs


def debt_text(debt: dict) -> str:
    parts = debt.get("schedule") or []
    now = f", сейчас {debt['paid']:g}" if debt.get("paid") else ""
    if debt.get("months"):
        return f"рассрочка {debt['months']} мес. по {debt.get('monthly', 0):g}{now}"
    due = parts[-1]["date"] if parts else ""
    return f"в долг до {due[8:10]}.{due[5:7]}.{due[:4]}{now}"


def debt_stages(s, doc, debt: dict, sold_at: str, total: float) -> None:
    """Этапы графика оплаты реализации: заплаченное сейчас — в день продажи, остаток — по датам долга (кредит после отгрузки)."""
    stages = ([{"date": sold_at[:10], "sum": float(debt["paid"])}] if float(debt.get("paid") or 0) > 0 else []) + list(debt.get("schedule") or [])
    doc.ЭтапыГрафикаОплаты.Очистить()
    percent = 0.0
    for n, part in enumerate(stages):
        row = doc.ЭтапыГрафикаОплаты.Добавить()
        row.ВариантОплаты = s.Перечисления.ВариантыКонтроляОплатыКлиентом.КредитПослеОтгрузки
        row.ВариантОтсчета = s.Перечисления.ВариантыОтсчетаДатыПлатежа.ОтДатыОтгрузки
        row.ДатаПлатежа = _date(s, part["date"][:10] + "T12:00:00")
        row.СуммаПлатежа = part["sum"]
        row.СуммаВзаиморасчетов = part["sum"]
        if n < len(stages) - 1:
            row.ПроцентПлатежа = round(part["sum"] / total * 100, 2)
            percent += float(row.ПроцентПлатежа)
        else:
            row.ПроцентПлатежа = round(100 - percent, 2)


def buyer_partner(s, buyer: dict):
    """Покупатель в долг: партнёр с тем же телефоном (последние 9 цифр), иначе с тем же именем, иначе новый (частное лицо)."""
    phone = "".join(ch for ch in str(buyer.get("phone") or "") if ch.isdigit())
    name = str(buyer.get("name") or "").strip()
    if not phone or not name:
        raise OneCError("в долг без имени и телефона покупателя")
    by_phone = by_name = None
    sel = _query(s, "ВЫБРАТЬ П.Ссылка КАК Ссылка, П.Телефон КАК Тел, П.Наименование КАК Имя ИЗ Справочник.Партнеры КАК П "
                    "ГДЕ НЕ П.ПометкаУдаления И П.Клиент").Выбрать()
    while sel.Следующий():
        digits = "".join(ch for ch in str(sel.Тел or "") if ch.isdigit())
        if digits and digits[-9:] == phone[-9:]:
            by_phone = sel.Ссылка
            break
        if by_name is None and str(sel.Имя).strip().lower() == name.lower():
            by_name = sel.Ссылка
    partner = by_phone or by_name
    if partner is None:
        obj = s.Справочники.Партнеры.СоздатьЭлемент()
        obj.Наименование = name
        obj.НаименованиеПолное = name
        obj.Клиент = True
        obj.ЮрФизЛицо = s.Перечисления.КомпанияЧастноеЛицо.ЧастноеЛицо
        obj.Телефон = "+" + phone
        obj.Комментарий = "заведён кассой с телефона"
        obj.Записать()
        partner = obj.Ссылка
    elif not str(partner.Телефон or "").strip():
        obj = partner.ПолучитьОбъект()
        obj.Телефон = "+" + phone
        obj.Записать()
    sel = _query(s, "ВЫБРАТЬ ПЕРВЫЕ 1 К.Ссылка КАК Ссылка ИЗ Справочник.Контрагенты КАК К ГДЕ К.Партнер = &П И НЕ К.ПометкаУдаления",
                 П=partner).Выбрать()
    if sel.Следующий():
        return partner, sel.Ссылка
    obj = s.Справочники.Контрагенты.СоздатьЭлемент()
    obj.Наименование = str(partner.Наименование)
    obj.НаименованиеПолное = str(partner.Наименование)
    obj.Партнер = partner
    obj.ЮрФизЛицо = s.Перечисления.ЮрФизЛицо.ФизЛицо
    obj.Записать()
    return partner, obj.Ссылка


def _org(s, shops: dict[str, dict]):
    first = next(iter(shops.values()))
    return _by_name(s.Справочники.СоглашенияСКлиентами, "Розница " + first["name"], "соглашение").Организация


def _already(s, op_id: str) -> list[dict] | None:
    """Документы операции уже проведены (повтор после сбоя связи) — их номера, второй раз не создаём."""
    existing = find_docs(s, op_id)
    if existing and all(ref.Проведен for _t, ref in existing):
        return [_doc_entry(t, ref) for t, ref in existing]
    return None


def _when(s, op: dict):
    return _date(s, op.get("createdAt") or datetime.now().isoformat())


def _in_tx(s, work):
    s.НачатьТранзакцию()
    try:
        result = work()
    except Exception:
        s.ОтменитьТранзакцию()
        raise
    s.ЗафиксироватьТранзакцию()
    return result


def post_payment(s, op: dict, shops: dict[str, dict]) -> list[dict]:
    """Оплата долга: ПКО по реализации (основание платежа — сама реализация) или по долгу из Billz (первичный документ),
    касса магазина: наличные или перевод."""
    done = _already(s, op["id"])
    if done:
        return done
    payload = op.get("payload") or {}
    uid = s.NewObject("УникальныйИдентификатор", payload["debtId"])
    base = s.Документы.РеализацияТоваровУслуг.ПолучитьСсылку(uid)
    billz = base.ПолучитьОбъект() is None
    if billz:
        base = s.Документы.ПервичныйДокумент.ПолучитьСсылку(uid)
    if base.ПолучитьОбъект() is None or base.ПометкаУдаления:
        raise OneCError(f"продажи {payload.get('doc') or ''} больше нет в 1С")
    shop = shops.get(payload.get("shop") or "") or {}
    desk = _by_name(s.Справочники.Кассы, shop.get("cashDesk" if payload.get("method") == "cash" else "transferDesk") or "", "касса")
    amount = float(payload["amount"])

    def work():
        pko = s.Документы.ПриходныйКассовыйОрдер.СоздатьДокумент()
        if billz:
            _fill_by_primary(s, pko, base, desk)
        else:
            pko.Заполнить(base)
        pko.Дата = _when(s, op)
        pko.Касса = desk
        pko.СуммаДокумента = amount
        while pko.РасшифровкаПлатежа.Количество() > 1:
            pko.РасшифровкаПлатежа.Удалить(pko.РасшифровкаПлатежа.Количество() - 1)
        if pko.РасшифровкаПлатежа.Количество() == 0:
            raise OneCError(f"по продаже {payload.get('doc') or ''} 1С не видит долга")
        row = pko.РасшифровкаПлатежа.Получить(0)
        row.Сумма = amount
        row.СуммаВзаиморасчетов = amount
        how = "наличные" if payload.get("method") == "cash" else "перевод"
        pko.Комментарий = f"{LABEL}{op['id']} | оплата долга, {how} | {op.get('user') or ''}"
        _write(s, pko, "ПКО")
        return [_doc_entry("ПриходныйКассовыйОрдер", pko.Ссылка)]

    return _in_tx(s, work)


def _fill_by_primary(s, pko, doc, desk) -> None:
    """ПКО по долгу из Billz. Заполнить() по первичному документу строк не даёт — шапка и строка как у ПКО по реализации,
    объект расчётов — тот, на котором висит долг. Нет долга — строки нет (post_payment скажет «1С не видит долга»)."""
    sel = _query(s, "ВЫБРАТЬ ПЕРВЫЕ 1 Р.ОбъектРасчетов КАК Объект ИЗ РегистрНакопления.РасчетыСКлиентами.Остатки КАК Р "
                    "ГДЕ Р.ОбъектРасчетов.Объект = &Д И Р.КОплатеОстаток > 0", Д=doc).Выбрать()
    pko.ХозяйственнаяОперация = s.Перечисления.ХозяйственныеОперации.ПоступлениеОплатыОтКлиента
    pko.Организация = doc.Организация
    pko.Валюта = desk.ВалютаДенежныхСредств
    pko.Контрагент = doc.Контрагент
    pko.Партнер = doc.Партнер
    pko.ПринятоОт = str(doc.Партнер.Наименование).strip()
    pko.ДокументОснование = doc
    if not sel.Следующий():
        return
    row = pko.РасшифровкаПлатежа.Добавить()
    row.Партнер = doc.Партнер
    row.Организация = doc.Организация
    row.ОснованиеПлатежа = doc
    row.ОбъектРасчетов = sel.Объект
    row.СтатьяДвиженияДенежныхСредств = s.Справочники.СтатьиДвиженияДенежныхСредств.ПоступлениеОплатыОтКлиента
    row.ВалютаВзаиморасчетов = doc.ВалютаВзаиморасчетов
    row.КурсЧислительВзаиморасчетов = 1
    row.КурсЗнаменательВзаиморасчетов = 1


def _cash_order(s, doc_name: str, operation, desk, amount: float, when, org):
    doc = getattr(s.Документы, doc_name).СоздатьДокумент()
    doc.Дата = when
    doc.ХозяйственнаяОперация = operation
    doc.Организация = org
    doc.Касса = desk
    doc.Валюта = desk.ВалютаДенежныхСредств
    doc.СуммаДокумента = amount
    return doc


def _note(op: dict, text: str) -> str:
    payload = op.get("payload") or {}
    return f"{LABEL}{op['id']} | {text} | {op.get('user') or ''}" + (f" | {payload['note']}" if payload.get("note") else "")


def post_expense(s, op: dict, shops: dict[str, dict]) -> list[dict]:
    """Расход по статье: РКО «Выплата по ведомости через кассу» со статьёй ДДС в шапке — так расходы пишут руками."""
    done = _already(s, op["id"])
    if done:
        return done
    payload = op.get("payload") or {}
    desk = _by_name(s.Справочники.Кассы, payload["desk"], "касса")
    article = s.Справочники.СтатьиДвиженияДенежныхСредств.ПолучитьСсылку(s.NewObject("УникальныйИдентификатор", payload["articleId"]))
    if article.ПолучитьОбъект() is None:
        raise OneCError(f"статьи «{payload.get('article')}» больше нет в 1С")

    def work():
        doc = _cash_order(s, "РасходныйКассовыйОрдер", s.Перечисления.ХозяйственныеОперации.ВыплатаЗарплатыЧерезКассу, desk,
                          float(payload["amount"]), _when(s, op), _org(s, shops))
        doc.СтатьяДвиженияДенежныхСредств = article
        doc.Комментарий = _note(op, f"расход: {payload.get('article')}")
        _write(s, doc, "РКО")
        return [_doc_entry("РасходныйКассовыйОрдер", doc.Ссылка)]

    return _in_tx(s, work)


def post_transfer(s, op: dict, shops: dict[str, dict]) -> list[dict]:
    """Перевод между кассами: РКО «Выдача ДС в другую кассу» + ПКО «Поступление ДС из другой кассы» с одной меткой."""
    done = _already(s, op["id"])
    if done:
        return done
    payload = op.get("payload") or {}
    src = _by_name(s.Справочники.Кассы, payload["fromDesk"], "касса")
    dst = _by_name(s.Справочники.Кассы, payload["toDesk"], "касса")
    amount = float(payload["amount"])

    def work():
        when, org = _when(s, op), _org(s, shops)
        text = _note(op, f"перевод {payload['fromDesk']} -> {payload['toDesk']}")
        out = _cash_order(s, "РасходныйКассовыйОрдер", s.Перечисления.ХозяйственныеОперации.ВыдачаДенежныхСредствВДругуюКассу,
                          src, amount, when, org)
        out.КассаПолучатель = dst
        out.Выдать = payload["toDesk"]
        out.Основание = "Перемещение между кассами"
        out.Комментарий = text
        _write(s, out, "РКО", check=False)
        inc = _cash_order(s, "ПриходныйКассовыйОрдер", s.Перечисления.ХозяйственныеОперации.ПоступлениеДенежныхСредствИзДругойКассы,
                          dst, amount, when, org)
        inc.КассаОтправитель = src
        inc.ПринятоОт = payload["fromDesk"]
        inc.Основание = "Перемещение между кассами"
        inc.Комментарий = text
        _write(s, inc, "ПКО", check=False)
        return [_doc_entry("РасходныйКассовыйОрдер", out.Ссылка), _doc_entry("ПриходныйКассовыйОрдер", inc.Ссылка)]

    return _in_tx(s, work)


def _iso(s, value) -> str:
    text = str(s.String(value))         # «22.10.2026 17:00:00»
    return f"{text[6:10]}-{text[3:5]}-{text[:2]}"


def _billz_debts(s) -> list[dict]:
    """Долги покупателей из Billz: первичные документы из ввода остатков (комментарий «Долг из Billz Billz <номер>»).
    Срок — дата платежа строки ввода остатков, магазин — из её комментария «Долги покупателей из Billz, <магазин>»."""
    out = []
    sel = _query(s, "ВЫБРАТЬ Р.Док КАК Док, Р.Долг КАК Долг, ЕСТЬNULL(Т.ДатаПлатежа, ДАТАВРЕМЯ(1, 1, 1)) КАК Срок, "
                    "ЕСТЬNULL(Т.Ссылка.Комментарий, \"\") КАК Ввод "
                    "ИЗ (ВЫБРАТЬ Р.ОбъектРасчетов.Объект КАК Док, СУММА(Р.КОплатеОстаток) КАК Долг "
                    "    ИЗ РегистрНакопления.РасчетыСКлиентами.Остатки КАК Р "
                    "    ГДЕ Р.ОбъектРасчетов.Объект ССЫЛКА Документ.ПервичныйДокумент "
                    "    СГРУППИРОВАТЬ ПО Р.ОбъектРасчетов.Объект ИМЕЮЩИЕ СУММА(Р.КОплатеОстаток) > 0) КАК Р "
                    "ЛЕВОЕ СОЕДИНЕНИЕ Документ.ВводОстатковВзаиморасчетов.РасчетыСПартнерами КАК Т "
                    "ПО Т.ДокументРасчетов = Р.Док И Т.Ссылка.Проведен").Выбрать()
    seen = set()
    while sel.Следующий():
        doc = sel.Док
        debt_id = _uuid(s, doc)
        if debt_id in seen:
            continue
        seen.add(debt_id)
        note, entry = str(doc.Комментарий or "").strip(), str(sel.Ввод or "")
        due = _iso(s, sel.Срок)
        out.append({"id": debt_id, "doc": note.removeprefix("Долг из Billz ") if note.startswith("Долг из Billz ") else str(doc.Номер).strip(),
                    "date": _iso(s, doc.Дата), "clientId": _uuid(s, doc.Партнер), "clientName": str(doc.Партнер.Наименование).strip(),
                    "phones": str(doc.Партнер.Телефон or "").strip(),
                    "shop": entry.rsplit(", ", 1)[-1].strip() if "из Billz, " in entry else "",
                    "total": float(doc.СуммаДокумента), "left": float(sel.Долг),
                    "schedule": [{"date": due, "sum": float(sel.Долг)}] if due > "0001-01-01" else []})
    return out


def extras(s) -> dict:
    """Для телефона, кроме товаров: долги покупателей (продажи кассы и долги из Billz), статьи расходов (частые сверху),
    деньги в кассах."""
    debts = []
    sel = _query(s, "ВЫБРАТЬ Р.ОбъектРасчетов.Объект КАК Док, СУММА(Р.КОплатеОстаток) КАК Долг "
                    "ИЗ РегистрНакопления.РасчетыСКлиентами.Остатки КАК Р "
                    "ГДЕ Р.ОбъектРасчетов.Объект ССЫЛКА Документ.РеализацияТоваровУслуг "
                    "СГРУППИРОВАТЬ ПО Р.ОбъектРасчетов.Объект ИМЕЮЩИЕ СУММА(Р.КОплатеОстаток) > 0").Выбрать()
    while sel.Следующий():
        doc = sel.Док
        stages = doc.ЭтапыГрафикаОплаты
        debts.append({"id": _uuid(s, doc), "doc": str(doc.Номер).strip(), "date": _iso(s, doc.Дата),
                      "clientId": _uuid(s, doc.Партнер), "clientName": str(doc.Партнер.Наименование).strip(),
                      "phones": str(doc.Партнер.Телефон or "").strip(), "shop": str(doc.Склад.Наименование).strip(),
                      "total": float(doc.СуммаДокумента), "left": float(sel.Долг),
                      "schedule": [{"date": _iso(s, stages.Получить(i).ДатаПлатежа), "sum": float(stages.Получить(i).СуммаПлатежа)}
                                   for i in range(stages.Количество())]})
    debts += _billz_debts(s)
    articles = []
    sel = _query(s, "ВЫБРАТЬ С.Ссылка КАК Ссылка, С.Наименование КАК Имя, КОЛИЧЕСТВО(Р.Ссылка) КАК Раз "
                    "ИЗ Справочник.СтатьиДвиженияДенежныхСредств КАК С "
                    "ЛЕВОЕ СОЕДИНЕНИЕ Документ.РасходныйКассовыйОрдер КАК Р ПО Р.СтатьяДвиженияДенежныхСредств = С.Ссылка "
                    "И Р.Проведен И Р.Дата > &Начало "
                    "ГДЕ НЕ С.ПометкаУдаления И НЕ С.ЭтоГруппа СГРУППИРОВАТЬ ПО С.Ссылка, С.Наименование",
                 Начало=_date(s, (datetime.now() - timedelta(days=180)).isoformat())).Выбрать()
    while sel.Следующий():
        articles.append({"id": _uuid(s, sel.Ссылка), "name": str(sel.Имя).strip(), "uses": int(sel.Раз)})
    cash = []
    sel = _query(s, "ВЫБРАТЬ Д.Касса.Наименование КАК Имя, СУММА(Д.СуммаОстаток) КАК Сумма "
                    "ИЗ РегистрНакопления.ДенежныеСредстваНаличные.Остатки КАК Д СГРУППИРОВАТЬ ПО Д.Касса.Наименование").Выбрать()
    while sel.Следующий():
        if abs(float(sel.Сумма)) > 0.005:
            cash.append({"name": str(sel.Имя).strip(), "amount": float(sel.Сумма)})
    return {"debts": debts, "articles": articles, "cash": cash}
