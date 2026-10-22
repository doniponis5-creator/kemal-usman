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


if __name__ == "__main__":
    unittest.main()
