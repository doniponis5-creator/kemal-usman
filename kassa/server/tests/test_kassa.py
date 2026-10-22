"""Проверки кассы Kemal Usman: правила и весь путь «1С → телефон → 1С» на временной базе.
Запуск: cd kassa/server && python -m unittest discover -s tests"""
from __future__ import annotations

import json
import os
import tempfile
import unittest
import uuid
from decimal import Decimal
from pathlib import Path

TMP = tempfile.mkdtemp(prefix="kassa_test_")
os.environ["KASSA_DB"] = str(Path(TMP) / "kassa.db")
os.environ["KASSA_1C_SECRET"] = "test-secret"

from fastapi.testclient import TestClient  # noqa: E402

from kassa_server import rules  # noqa: E402
from kassa_server.app import app  # noqa: E402

SHOP_A, SHOP_B = "Kemal Usman Parfume", "Kemal Usman Parfume Osh"
OIL = "11111111-1111-1111-1111-111111111111"     # масло в мл
BOX = "22222222-2222-2222-2222-222222222222"     # флакон штучно
ITEMS = {
    OIL: {"id": OIL, "name": "Chanel Chance Maslo", "unit": "мл", "stock": {SHOP_A: 12.8, SHOP_B: 100}, "price": {SHOP_A: 160}},
    BOX: {"id": BOX, "name": "Grafin", "unit": "шт", "stock": {SHOP_B: 3}, "price": {SHOP_B: 500}},
}
OWNER = {"id": 1, "role": "owner", "shop": ""}


def sale(lines, shop=SHOP_A, payments=None, **extra):
    return {"id": str(uuid.uuid4()), "kind": "sale",
            "payload": {"shop": shop, "lines": lines, "payments": payments or [{"method": "cash"}], **extra}}


class Rules(unittest.TestCase):
    def test_fraction_ml(self):
        v = rules.check_sale(sale([{"itemId": OIL, "qty": "2,5", "price": 160}]), OWNER, ITEMS, [SHOP_A, SHOP_B], {})
        self.assertTrue(v["ok"], v)
        self.assertEqual(v["payload"]["lines"][0]["qty"], 2.5)
        self.assertEqual(v["payload"]["total"], 400.0)
        self.assertEqual(v["payload"]["payments"], [{"method": "cash", "amount": 400.0}])

    def test_pieces_must_be_whole(self):
        v = rules.check_sale(sale([{"itemId": BOX, "qty": 1.5, "price": 500}], SHOP_B), OWNER, ITEMS, [SHOP_A, SHOP_B], {})
        self.assertFalse(v["ok"])
        self.assertIn("целыми", v["error"])

    def test_stock_per_shop(self):
        # В первом магазине 12.8 мл: 13 нельзя, во втором 100 — можно.
        v = rules.check_sale(sale([{"itemId": OIL, "qty": 13, "price": 160}]), OWNER, ITEMS, [SHOP_A, SHOP_B], {})
        self.assertFalse(v["ok"])
        self.assertIn("есть 12.8 мл", v["error"])
        v = rules.check_sale(sale([{"itemId": OIL, "qty": 13, "price": 160}], SHOP_B), OWNER, ITEMS, [SHOP_A, SHOP_B], {})
        self.assertTrue(v["ok"], v)

    def test_taken_by_unposted(self):
        taken = rules.reserved_by_ops([{"kind": "sale", "payload": {"shop": SHOP_A, "lines": [{"itemId": OIL, "qty": 10}]}}])
        self.assertEqual(taken[SHOP_A][OIL], Decimal("10"))
        v = rules.check_sale(sale([{"itemId": OIL, "qty": 3, "price": 160}]), OWNER, ITEMS, [SHOP_A, SHOP_B], taken)
        self.assertFalse(v["ok"])

    def test_split_payment(self):
        lines = [{"itemId": OIL, "qty": 5, "price": 160}]
        ok = rules.check_sale(sale(lines, payments=[{"method": "cash", "amount": 300}, {"method": "transfer", "amount": 500}]),
                              OWNER, ITEMS, [SHOP_A, SHOP_B], {})
        self.assertTrue(ok["ok"], ok)
        bad = rules.check_sale(sale(lines, payments=[{"method": "cash", "amount": 300}, {"method": "transfer", "amount": 400}]),
                               OWNER, ITEMS, [SHOP_A, SHOP_B], {})
        self.assertFalse(bad["ok"])
        same = rules.check_sale(sale(lines, payments=[{"method": "cash", "amount": 400}, {"method": "cash", "amount": 400}]),
                                OWNER, ITEMS, [SHOP_A, SHOP_B], {})
        self.assertFalse(same["ok"])

    def test_staff_bound_to_shop(self):
        staff = {"id": 2, "role": "staff", "shop": SHOP_B}
        v = rules.check_sale(sale([{"itemId": OIL, "qty": 1, "price": 160}], SHOP_A), staff, ITEMS, [SHOP_A, SHOP_B], {})
        self.assertFalse(v["ok"])
        v = rules.check_sale(sale([{"itemId": OIL, "qty": 1, "price": 160}], ""), staff, ITEMS, [SHOP_A, SHOP_B], {})
        self.assertTrue(v["ok"], v)
        self.assertEqual(v["payload"]["shop"], SHOP_B)

    def test_buyer_phone(self):
        self.assertEqual(rules.phone_digits("0555 123 456"), "996555123456")
        self.assertEqual(rules.phone_digits("+996 (555) 12-34-56"), "996555123456")
        self.assertEqual(rules.phone_digits("123"), "")

    def test_totals(self):
        ops = [{"kind": "sale", "status": "done", "payload": {"shop": SHOP_A, "total": 800,
                                                               "payments": [{"method": "cash", "amount": 300}, {"method": "transfer", "amount": 500}]}},
               {"kind": "sale", "status": "cancelled", "payload": {"shop": SHOP_A, "total": 999, "payments": [{"method": "cash", "amount": 999}]}}]
        t = rules.day_totals(ops)
        self.assertEqual(t["total"], 800.0)
        self.assertEqual(t["shops"][0]["transfer"], 500.0)

    def test_receipt(self):
        text = rules.receipt_text({"payload": {"shop": SHOP_A, "total": 400, "payments": [{"method": "transfer", "amount": 400}],
                                               "lines": [{"name": "Oil", "qty": 2.5, "unit": "мл", "price": 160, "sum": 400}]},
                                   "user": "Ali", "createdAt": "2026-10-22T18:05:00"})
        self.assertIn("2.5 мл × 160 сом = 400 сом", text)
        self.assertIn("Оплата: Перевод", text)


class Flow(unittest.TestCase):
    """1С присылает товары → владелец задаёт PIN → продажа → 1С забирает и проводит → отмена."""

    @classmethod
    def setUpClass(cls):
        cls.c = TestClient(app)
        cls.c.__enter__()

    @classmethod
    def tearDownClass(cls):
        cls.c.__exit__(None, None, None)

    def signed(self, path, data):
        body = json.dumps(data).encode()
        return self.c.post(path, content=body, headers={"X-Signature": rules.sign("test-secret", body), "Content-Type": "application/json"})

    def test_flow(self):
        c = self.c
        shops = [{"name": SHOP_A, "cashDesk": "Касса " + SHOP_A, "transferDesk": "Перевод " + SHOP_A},
                 {"name": SHOP_B, "cashDesk": "Касса " + SHOP_B, "transferDesk": "Перевод " + SHOP_B}]
        r = self.signed("/api/1c/sync", {"shops": shops, "items": [
            {"id": OIL, "code": "ЦБ-1", "name": "Chanel Chance Maslo", "unit": "мл", "stock": {SHOP_A: 12.8, SHOP_B: 100}, "price": {SHOP_A: 160}},
            {"id": BOX, "code": "ЦБ-2", "name": "Grafin", "unit": "шт", "stock": {SHOP_B: 3}, "price": {SHOP_B: 500}}]})
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(r.json()["changed"], 2)
        self.assertEqual(self.signed("/api/1c/sync", {"shops": shops, "items": [
            {"id": OIL, "code": "ЦБ-1", "name": "Chanel Chance Maslo", "unit": "мл", "stock": {SHOP_A: 12.8, SHOP_B: 100}, "price": {SHOP_A: 160}},
            {"id": BOX, "code": "ЦБ-2", "name": "Grafin", "unit": "шт", "stock": {SHOP_B: 3}, "price": {SHOP_B: 500}}]}).json()["changed"], 0)
        bad = c.post("/api/1c/sync", content=b"{}", headers={"X-Signature": "x"})
        self.assertEqual(bad.status_code, 401)

        self.assertEqual(c.post("/kassa/login", json={"pin": "1234"}).status_code, 401)
        self.assertEqual(self.signed("/api/1c/owner-pin", {"pin": "2468"}).status_code, 200)
        r = c.post("/kassa/login", json={"pin": "2468"})
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(r.json()["user"]["role"], "owner")

        # Сотрудник второго магазина.
        r = c.post("/kassa/api/users", json={"name": "Айгерим", "pin": "1357", "shop": SHOP_B})
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(c.post("/kassa/api/users", json={"name": "Дубль", "pin": "1357"}).status_code, 409)

        st = c.get("/kassa/api/state").json()
        self.assertEqual(st["shops"], [SHOP_A, SHOP_B])
        items = c.get("/kassa/api/items").json()
        self.assertEqual(len(items["items"]), 2)
        self.assertTrue(c.get("/kassa/api/items", params={"v": items["v"]}).json()["same"])

        op = sale([{"itemId": OIL, "qty": 2.5, "price": 160}], payments=[{"method": "transfer"}])
        r = c.post("/kassa/api/ops", json=op)
        self.assertEqual(r.status_code, 200, r.text)
        self.assertTrue(c.post("/kassa/api/ops", json=op).json()["repeated"])
        too_much = sale([{"itemId": OIL, "qty": 11, "price": 160}])
        self.assertEqual(c.post("/kassa/api/ops", json=too_much).status_code, 409)    # 12.8 − 2.5 = 10.3
        self.assertEqual(c.get("/kassa/api/items").json()["taken"][SHOP_A][OIL], 2.5)

        w = c.get("/api/1c/wait", params={"sec": 0}, headers={"X-Api-Key": "test-secret"}).json()
        self.assertEqual([o["id"] for o in w["ops"]], [op["id"]])
        self.assertEqual(w["ops"][0]["payload"]["payments"][0]["amount"], 400.0)
        self.assertEqual(c.get("/api/1c/wait", params={"sec": 0}, headers={"X-Api-Key": "bad"}).status_code, 401)
        r = self.signed(f"/api/1c/ops/{op['id']}/done", {"docs": [{"type": "Реализация", "number": "ЦБ-00000001"}]})
        self.assertEqual(r.json()["status"], "done")

        st = c.get("/kassa/api/state").json()
        self.assertEqual(st["totals"]["total"], 400.0)
        self.assertEqual(st["ops"][0]["docs"][0]["number"], "ЦБ-00000001")
        self.assertIn("Перевод", c.get(f"/kassa/api/receipt/{op['id']}").text)

        # Отмена проведённой → ждёт 1С → 1С распровела.
        self.assertEqual(c.post(f"/kassa/api/ops/{op['id']}/cancel").json()["status"], "cancelling")
        w = c.get("/api/1c/wait", params={"sec": 0}, headers={"X-Api-Key": "test-secret"}).json()
        self.assertEqual(w["cancels"], [op["id"]])
        self.assertEqual(self.signed(f"/api/1c/ops/{op['id']}/cancelled", {"docs": 2}).json()["status"], "cancelled")
        self.assertEqual(c.get("/kassa/api/state").json()["totals"]["total"], 0)

        # Сотрудник: только свой магазин, чужие продажи не видит.
        c.post("/kassa/logout")
        self.assertEqual(c.post("/kassa/login", json={"pin": "1357"}).json()["user"]["role"], "staff")
        self.assertEqual(c.post("/kassa/api/ops", json=sale([{"itemId": OIL, "qty": 1, "price": 160}], SHOP_A)).status_code, 409)
        r = c.post("/kassa/api/ops", json=sale([{"itemId": BOX, "qty": 2, "price": 500}], SHOP_B))
        self.assertEqual(r.status_code, 200, r.text)
        st = c.get("/kassa/api/state").json()
        self.assertEqual(len(st["ops"]), 1)
        self.assertEqual(c.get("/kassa/api/users").status_code, 403)
        # Ошибка 1С → повтор только владельцем.
        failed_id = r.json()["op"]["id"]
        self.signed(f"/api/1c/ops/{failed_id}/failed", {"reason": "Не хватает на складе"})
        self.assertEqual(c.post(f"/kassa/api/ops/{failed_id}/retry").status_code, 403)
        # Отмена непроведённой — сразу; 1С успела провести → 409, 1С распроводит сама.
        r = c.post("/kassa/api/ops", json=sale([{"itemId": BOX, "qty": 1, "price": 500}], SHOP_B))
        late = r.json()["op"]["id"]
        self.assertEqual(c.post(f"/kassa/api/ops/{late}/cancel").json()["status"], "cancelled")
        self.assertEqual(self.signed(f"/api/1c/ops/{late}/done", {"docs": []}).status_code, 409)


class Stage2Rules(unittest.TestCase):
    def test_debt_until_date(self):
        from datetime import date
        v = rules.check_sale(sale([{"itemId": OIL, "qty": 10, "price": 160}], SHOP_B, buyer={"name": "Айбек", "phone": "555123456"},
                                  debt={"paid": 600, "method": "cash", "dueDate": "2026-11-01"}), OWNER, ITEMS, [SHOP_A, SHOP_B], {}, date(2026, 10, 22))
        self.assertTrue(v["ok"], v)
        self.assertEqual(v["payload"]["payments"], [{"method": "cash", "amount": 600.0}])
        self.assertEqual(v["payload"]["debt"]["schedule"], [{"date": "2026-11-01", "sum": 1000.0}])

    def test_debt_needs_buyer(self):
        v = rules.check_sale(sale([{"itemId": OIL, "qty": 1, "price": 160}], debt={"dueDate": "2026-11-01"}), OWNER, ITEMS, [SHOP_A, SHOP_B], {})
        self.assertFalse(v["ok"])
        self.assertIn("имя и телефон", v["error"])

    def test_installment_months(self):
        from datetime import date
        built = rules.build_debt(Decimal("1000"), {"paid": 0, "months": 3}, date(2026, 1, 31))
        self.assertTrue(built["ok"], built)
        self.assertEqual([p["sum"] for p in built["debt"]["schedule"]], [340.0, 340.0, 320.0])
        self.assertEqual([p["date"] for p in built["debt"]["schedule"]], ["2026-02-28", "2026-03-31", "2026-04-30"])

    def test_unpaid_schedule(self):
        parts = [{"date": "2026-11-01", "sum": 340}, {"date": "2026-12-01", "sum": 340}, {"date": "2027-01-01", "sum": 320}]
        self.assertEqual(rules.unpaid_schedule(parts, 500), [{"date": "2026-12-01", "sum": 180.0}, {"date": "2027-01-01", "sum": 320.0}])

    def test_desks_and_profit(self):
        shops = {SHOP_A: {"cashDesk": "Касса A", "transferDesk": "Перевод A"}}
        ops = [{"kind": "sale", "payload": {"shop": SHOP_A, "payments": [{"method": "transfer", "amount": 400}]}},
               {"kind": "expense", "payload": {"desk": "Касса A", "amount": 50}},
               {"kind": "transfer", "payload": {"fromDesk": "Касса A", "toDesk": "Перевод A", "amount": 30}}]
        rows = {r["desk"]: r["amount"] for r in rules.desk_balances([{"name": "Касса A", "amount": 1000}], ops, shops)}
        self.assertEqual(rows, {"Касса A": 920.0, "Перевод A": 430.0})
        from datetime import date
        sold = [{"kind": "sale", "status": "done", "userId": 2, "createdAt": "2026-10-22T12:00:00",
                 "payload": {"total": 500, "lines": [{"qty": 5, "sum": 500, "cost": 40}]}}]
        self.assertEqual(rules.gross_profit(sold, date(2026, 10, 22))["today"]["profit"], 300.0)
        rating = rules.staff_rating(sold, [{"id": 2, "name": "Айгерим", "role": "staff", "bonusPct": 10}], date(2026, 10, 22))
        self.assertEqual(rating["month"][0]["bonus"], 30.0)


class Stage2Flow(Flow):
    def test_flow(self):   # путь этапа 1 уже проверен в Flow — здесь только этап 2
        pass

    def test_stage2(self):
        c = self.c
        shops = [{"name": SHOP_A, "cashDesk": "Касса " + SHOP_A, "transferDesk": "Перевод " + SHOP_A}]
        debt_id = "33333333-3333-3333-3333-333333333333"
        art = "44444444-4444-4444-4444-444444444444"
        r = self.signed("/api/1c/sync", {"shops": shops, "items": [
            {"id": OIL, "name": "Chanel Chance Maslo", "unit": "мл", "stock": {SHOP_A: 50}, "price": {SHOP_A: 160}, "cost": 40}],
            "debts": [{"id": debt_id, "doc": "ЦБ-9", "date": "2026-10-20", "clientName": "Айбек", "phones": "+996555123456",
                       "total": 1000, "left": 900, "schedule": [{"date": "2026-11-20", "sum": 900}]}],
            "articles": [{"id": art, "name": "04 Аренда", "uses": 3}], "cash": [{"name": "Касса " + SHOP_A, "amount": 5000}]})
        self.assertEqual(r.json()["debts"], 1, r.text)
        self.signed("/api/1c/owner-pin", {"pin": "8642"})
        self.assertEqual(c.post("/kassa/login", json={"pin": "8642"}).status_code, 200)
        self.assertEqual(c.get("/kassa/api/debts").json()["debts"][0]["left"], 900)
        too = {"id": str(uuid.uuid4()), "kind": "payment", "payload": {"debtId": debt_id, "amount": 1000, "method": "cash", "shop": SHOP_A}}
        self.assertEqual(c.post("/kassa/api/ops", json=too).status_code, 409)
        pay = {"id": str(uuid.uuid4()), "kind": "payment", "payload": {"debtId": debt_id, "amount": 400, "method": "transfer", "shop": SHOP_A}}
        self.assertEqual(c.post("/kassa/api/ops", json=pay).status_code, 200)
        self.assertEqual(c.get("/kassa/api/debts").json()["debts"][0]["left"], 500)
        exp = {"id": str(uuid.uuid4()), "kind": "expense", "payload": {"desk": "Касса " + SHOP_A, "articleId": art, "amount": 700}}
        self.assertEqual(c.post("/kassa/api/ops", json=exp).status_code, 200)
        tr = {"id": str(uuid.uuid4()), "kind": "transfer", "payload": {"fromDesk": "Касса " + SHOP_A, "toDesk": "Перевод " + SHOP_A, "amount": 300}}
        self.assertEqual(c.post("/kassa/api/ops", json=tr).status_code, 200)
        st = c.get("/kassa/api/state").json()
        desks = {d["desk"]: d["amount"] for d in st["desks"]}
        self.assertEqual(desks["Касса " + SHOP_A], 4000.0)          # 5000 − 700 − 300
        self.assertEqual(desks["Перевод " + SHOP_A], 700.0)         # +400 оплата долга переводом +300 перевод
        sold = sale([{"itemId": OIL, "qty": 5, "price": 160}], SHOP_A)
        self.assertEqual(c.post("/kassa/api/ops", json=sold).status_code, 200)
        self.assertEqual(c.get("/kassa/api/state").json()["profit"]["today"]["profit"], 600.0)   # 800 − 5 × 40
        w = c.get("/api/1c/wait", params={"sec": 0}, headers={"X-Api-Key": "test-secret"}).json()
        self.assertEqual({o["kind"] for o in w["ops"]} >= {"payment", "expense", "transfer", "sale"}, True)


class Stage3Flow(Flow):
    """Бонусы клуба (PocketBase подменён) и чек в WhatsApp (пробный режим — ключей Green API нет)."""

    def test_flow(self):
        pass

    def test_stage3(self):
        from kassa_server import notify
        calls = []
        balance = {"v": 500}

        def fake_club(action, **data):
            calls.append((action, data.get("opId"), data.get("amount") or data.get("total")))
            if action == "balance":
                return {"ok": True, "found": True, "balance": balance["v"], "maxPct": 30, "earnPct": 5}
            if action == "spend":
                if data["amount"] > balance["v"]:
                    return {"ok": False, "error": "not_enough"}
                balance["v"] -= data["amount"]
                return {"ok": True, "amount": -data["amount"]}
            if action == "earn":
                return {"ok": True, "amount": int(data["total"] * 5 / 100)}
            return {"ok": True}

        old = (notify.club, notify.club_on)
        notify.club, notify.club_on = fake_club, (lambda: True)
        os.environ["KASSA_CLUB_URL"], os.environ["KASSA_CLUB_KEY"] = "http://club.test", "k"
        try:
            c = self.c
            shops = [{"name": SHOP_A, "cashDesk": "Касса " + SHOP_A, "transferDesk": "Перевод " + SHOP_A}]
            self.signed("/api/1c/sync", {"shops": shops, "items": [
                {"id": OIL, "name": "Chanel Chance Maslo", "unit": "мл", "stock": {SHOP_A: 50}, "price": {SHOP_A: 160}, "cost": 40}]})
            self.signed("/api/1c/owner-pin", {"pin": "9753"})
            self.assertEqual(c.post("/kassa/login", json={"pin": "9753"}).status_code, 200)
            b = c.get("/kassa/api/bonus", params={"phone": "555 123 456"}).json()
            self.assertEqual((b["found"], b["balance"], b["maxPct"]), (True, 500, 30))
            buyer = {"name": "Айжан", "phone": "555123456"}
            # 10 мл × 160 = 1600: предел 30 % = 480; 490 — отказ, 400 — можно, оплата 1200.
            too = sale([{"itemId": OIL, "qty": 10, "price": 160}], payments=[{"method": "cash"}], buyer=buyer, bonus=490)
            r = c.post("/kassa/api/ops", json=too)
            self.assertEqual(r.status_code, 409, r.text)
            self.assertIn("480", r.json()["error"])
            ok = sale([{"itemId": OIL, "qty": 10, "price": 160}], payments=[{"method": "cash"}], buyer=buyer, bonus=400)
            r = c.post("/kassa/api/ops", json=ok)
            self.assertEqual(r.status_code, 200, r.text)
            self.assertEqual(r.json()["op"]["payload"]["payments"], [{"method": "cash", "amount": 1200.0}])
            self.assertEqual(balance["v"], 100)
            self.signed(f"/api/1c/ops/{ok['id']}/done", {"docs": []})
            receipt = c.get(f"/kassa/api/receipt/{ok['id']}").text
            self.assertIn("Бонусами клуба: 400 сом", receipt)
            self.assertIn("Начислено бонусов клуба: 60 сом", receipt)        # 5 % от 1200
            w = c.post(f"/kassa/api/ops/{ok['id']}/whatsapp", json={})
            self.assertEqual(w.json(), {"ok": True, "phone": "996555123456", "dry": True})
            # Отмена непроведённой продажи с бонусами → бонусы назад.
            again = sale([{"itemId": OIL, "qty": 1, "price": 160}], payments=[{"method": "cash"}], buyer=buyer, bonus=40)
            c.post("/kassa/api/ops", json=again)
            c.post(f"/kassa/api/ops/{again['id']}/cancel")
            self.assertIn(("refund", again["id"], None), calls)
            # Продажа в долг — чек в WhatsApp уходит сам.
            debt = sale([{"itemId": OIL, "qty": 2, "price": 160}], payments=[], buyer=buyer, debt={"paid": 0, "dueDate": "2099-01-01"})
            debt["payload"]["debt"]["dueDate"] = (date_today() + __import__("datetime").timedelta(days=10)).isoformat()
            r = c.post("/kassa/api/ops", json=debt)
            self.assertEqual(r.status_code, 200, r.text)
            self.assertTrue(r.json()["op"]["payload"].get("waSentAt"))
            # Онлайн договор: ссылка в продаже, страница без входа, «Согласен» записывает время.
            url = r.json()["op"]["payload"]["contractUrl"]
            path = "/kassa/c/" + url.rsplit("/", 1)[1]
            anon = TestClient(app)
            page = anon.get(path)
            self.assertEqual(page.status_code, 200)
            self.assertIn("Айжан", page.text)
            self.assertIn("Согласен с условиями", page.text)
            self.assertEqual(anon.post(path + "/accept").json(), {"ok": True})
            self.assertIn("согласился с условиями", anon.get(path).text)
            self.assertEqual(anon.get("/kassa/c/" + "x" * 24).status_code, 404)
            self.assertIn("Договор", c.get(f"/kassa/api/receipt/{debt['id']}").text)
        finally:
            notify.club, notify.club_on = old
            os.environ.pop("KASSA_CLUB_URL", None)
            os.environ.pop("KASSA_CLUB_KEY", None)


class SiteSync(Flow):
    """Сайт ↔ 1С, только наличие: связь товаров, галочки «в наличии», отправка только изменений (сайт подменён)."""

    def test_flow(self):
        pass

    def test_rules(self):
        from kassa_server import site
        product = {"variants": [{"id": 1, "label": "5 мл", "type": "ml", "inStock": False}, {"id": 2, "label": "20 мл", "type": "ml", "inStock": True},
                                {"id": 3, "label": "Упаковка 50 мл", "type": "pkg", "inStock": True}, {"id": 4, "label": "Полный", "type": "full", "inStock": True}]}
        items = {OIL: {"id": OIL, "stock": {SHOP_A: 12.8, SHOP_B: 3}}, BOX: {"id": BOX, "stock": {}}}
        got = site.availability(product, {"itemId": OIL}, items, [SHOP_A, SHOP_B], {})
        self.assertEqual(got, [{"id": 1, "inStock": True}, {"id": 2, "inStock": False}])            # 15.8 мл: 5 есть, 20 нет; pkg не трогаем
        got = site.availability(product, {"itemId": OIL, "pkgItemId": BOX}, items, [SHOP_A], {SHOP_A: {OIL: Decimal("10")}})
        self.assertEqual(got, [{"id": 1, "inStock": False}, {"id": 2, "inStock": False}, {"id": 3, "inStock": False}])   # 2.8 мл свободно
        self.assertEqual(site.variant_ml({"label": "Упаковка 100 мл"}), Decimal("100"))
        self.assertGreaterEqual(site.similarity("MFK Baccarat Rouge 540", "Baccarat rouge 540 (maslo)"), 0.6)

    def test_api(self):
        from kassa_server import notify
        pushed = []
        catalog = [{"id": "p1", "name": "Chance", "brand": "Chanel", "variants": [{"id": 1, "label": "5 мл", "type": "ml", "inStock": False},
                                                                              {"id": 2, "label": "100 мл", "type": "ml", "inStock": True}]},
                   {"id": "p2", "name": "Неизвестный", "brand": "X", "variants": [{"id": 1, "label": "5 мл", "type": "ml", "inStock": True}]}]
        old = (notify.site_catalog, notify.site_stock, notify.club_on)
        notify.site_catalog = lambda: catalog
        notify.site_stock = lambda updates: (pushed.append(updates), {"ok": True, "products": len(updates), "variants": sum(len(u["variants"]) for u in updates)})[1]
        notify.club_on = lambda: True
        try:
            c = self.c
            shops = [{"name": SHOP_A, "cashDesk": "Касса " + SHOP_A, "transferDesk": "Перевод " + SHOP_A}]
            self.signed("/api/1c/sync", {"shops": shops, "items": [
                {"id": OIL, "name": "Chanel Chance Maslo", "unit": "мл", "stock": {SHOP_A: 50}, "price": {SHOP_A: 160}}]})
            self.signed("/api/1c/owner-pin", {"pin": "1470"})
            self.assertEqual(c.post("/kassa/login", json={"pin": "1470"}).status_code, 200)
            self.assertEqual(c.post("/kassa/api/site/refresh").json()["products"], 2)
            links = c.get("/kassa/api/site/links").json()
            p1 = next(p for p in links["products"] if p["id"] == "p1")
            self.assertEqual(p1["suggest"][0]["id"], OIL)
            self.assertEqual(c.post("/kassa/api/site/links", json={"productId": "p1", "status": "linked", "itemId": OIL}).json(), {"ok": True})
            self.assertEqual(c.post("/kassa/api/site/links", json={"productId": "p2", "status": "none"}).json(), {"ok": True})
            r = c.post("/kassa/api/site/push").json()
            self.assertEqual((r["products"], r["variants"]), (1, 2))                       # 50 мл: 5 мл — есть, 100 мл — нет
            self.assertEqual(pushed[-1], [{"productId": "p1", "variants": [{"id": 1, "inStock": True}, {"id": 2, "inStock": False}]}])
            self.assertEqual(c.post("/kassa/api/site/push").json()["products"], 0)          # без изменений — ничего не шлём
            self.assertEqual(len(pushed), 1)
            staff_free = c.get("/kassa/api/site/links").json()["products"]
            self.assertEqual(next(p for p in staff_free if p["id"] == "p1")["item"]["free"], 50)
        finally:
            notify.site_catalog, notify.site_stock, notify.club_on = old


def date_today():
    from datetime import datetime, timedelta, timezone
    return (datetime.now(timezone.utc) + timedelta(hours=6)).date()


if __name__ == "__main__":
    unittest.main()
