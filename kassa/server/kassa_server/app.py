"""
Касса Kemal Usman — продажи с телефона (как «Касса Smarket» у Smart Centr, но отдельно: свой сервер, своя база, свой ключ 1С).

Три стороны:
  программа 1С на ПК магазина (kassa/agent) → сюда: товары, остатки, цены, магазины; забирает продажи и проводит их в 1С;
  телефон ↔ сюда: страница /kassa/, вход по PIN, продажа, «Сегодня», «Остаток», «Сотрудники».

Для программы 1С (подпись X-Signature = HMAC-SHA256 тела секретом KASSA_1C_SECRET; у GET — X-Api-Key: секрет):
  POST /api/1c/sync                 {shops: [{name, cashDesk, transferDesk}], items: [...], full: true} — полная замена списка
  POST /api/1c/owner-pin            {pin, name} — PIN владельца (вводит владелец на ПК: python kassa_agent.py owner-pin)
  GET  /api/1c/wait?sec=20          ждёт до sec секунд: {ops: [новые продажи], cancels: [id отмен проведённых]}
  GET  /api/1c/ops?days=3           все операции за N дней (проверка)
  POST /api/1c/ops/{id}/done        {docs: [{type, number}]}   проведено
  POST /api/1c/ops/{id}/failed      {reason}                   не провелось — владелец видит причину и «Повторить»
  POST /api/1c/ops/{id}/cancelled   {docs: N}                  отмена с телефона распроведена в 1С
Для телефона (кука kassa_session, путь /kassa):
  GET  /kassa/                      страница;  manifest.webmanifest, icon.svg, icon-180.png, icon-512.png
  POST /kassa/login {pin} · POST /kassa/logout
  GET  /kassa/api/state             кто вошёл, магазины, связь с 1С, операции за сегодня, итоги дня
  GET  /kassa/api/items?v=          товары со свободным остатком по магазинам (минус непроведённые продажи)
  POST /kassa/api/ops               {id, kind: 'sale', payload: {shop, lines[{itemId, qty, price}], payments[{method, amount}], buyer?, note?}}
  POST /kassa/api/ops/{id}/cancel   своя — сотрудник, любая — владелец
  POST /kassa/api/ops/{id}/retry    владелец: ошибочную провести ещё раз
  GET  /kassa/api/receipt/{id}      чек страницей (печать)
  GET|POST /kassa/api/users         владелец: сотрудники {id?, name?, pin?, shop?, active?}
"""
from __future__ import annotations

import asyncio
import hmac
import json
import logging
import os
import sqlite3
import time
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path

from fastapi import Depends, FastAPI, Header, HTTPException, Request, Response
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse

from . import db, notify, rules, site

logger = logging.getLogger("kassa")
HERE = Path(__file__).resolve().parent
BISHKEK = timedelta(hours=6)
COOKIE = "kassa_session"
COOKIE_PATH = "/kassa"
OWNER_NAME = "Владелец"
SHOP_TITLE = os.environ.get("KASSA_SHOP_TITLE", "Kemal Usman Parfume")
SELLER = os.environ.get("KASSA_SELLER", "Kemal Usman Parfume")          # продавец в онлайн договоре
PUBLIC_URL = os.environ.get("KASSA_PUBLIC_URL", "https://kassa.kemalusman.kg").rstrip("/")
WAIT_MAX_SEC = 50
MAX_BATCH = 5000

@asynccontextmanager
async def lifespan(_app):
    db.init()
    if not _secret():
        logger.warning("KASSA_1C_SECRET не задан — программа 1С не сможет подключиться")
    yield


app = FastAPI(title="Касса Kemal Usman", docs_url=None, redoc_url=None, openapi_url=None, lifespan=lifespan)


def get_db():
    conn = db.connect()
    try:
        yield conn
    finally:
        conn.close()


# ── время ────────────────────────────────────────────────────────────────────

def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _utc_iso(value: datetime | None = None) -> str:
    return (value or utcnow()).isoformat(timespec="seconds")


def local_iso(utc_text: str | None) -> str | None:
    """UTC из базы → бишкекское время для телефона и 1С."""
    if not utc_text:
        return None
    try:
        return (datetime.fromisoformat(utc_text) + BISHKEK).isoformat(timespec="seconds")
    except ValueError:
        return None


def day_start_utc() -> str:
    """Начало сегодняшнего дня по Бишкеку — в UTC, для «Сегодня»."""
    local = utcnow() + BISHKEK
    return _utc_iso(local.replace(hour=0, minute=0, second=0, microsecond=0) - BISHKEK)


# ── подпись программы 1С ─────────────────────────────────────────────────────

def _secret() -> str:
    return os.environ.get("KASSA_1C_SECRET", "")


async def verified_body(request: Request) -> dict:
    secret = _secret()
    if not secret:
        raise HTTPException(503, "секрет 1С не настроен")
    body = await request.body()
    if not hmac.compare_digest(request.headers.get("X-Signature", ""), rules.sign(secret, body)):
        raise HTTPException(401, "подпись неверна")
    return _json(body)


def verify_key(x_api_key: str = Header(default="")) -> None:
    secret = _secret()
    if not secret or not hmac.compare_digest(x_api_key, secret):
        raise HTTPException(401, "ключ неверен")


def _json(body: bytes) -> dict:
    try:
        data = json.loads(body.decode("utf-8") or "{}")
    except (ValueError, UnicodeDecodeError):
        raise HTTPException(422, "ожидается JSON")
    if not isinstance(data, dict):
        raise HTTPException(422, "ожидается объект JSON")
    return data


# ── общее чтение ─────────────────────────────────────────────────────────────

def _shops(conn: sqlite3.Connection) -> list[dict]:
    return [{"name": r["name"], "cashDesk": r["cash_desk"], "transferDesk": r["transfer_desk"]}
            for r in conn.execute("SELECT name, cash_desk, transfer_desk FROM shops ORDER BY sort, name")]


def _op_row(r: sqlite3.Row) -> dict:
    return {"id": r["id"], "kind": r["kind"], "payload": db.loads(r["payload"], {}), "userId": r["user_id"],
            "user": r["user_name"] or "", "shop": r["shop"], "status": r["status"], "docs": db.loads(r["docs"], []),
            "error": r["error"] or "", "createdAt": local_iso(r["created_at"]), "doneAt": local_iso(r["done_at"])}


def _new_ops(conn: sqlite3.Connection) -> list[dict]:
    return [_op_row(r) for r in conn.execute("SELECT * FROM ops WHERE status = 'new' ORDER BY created_at")]


def _sync_info(conn: sqlite3.Connection) -> dict:
    """Когда 1С была на связи — секунды «назад»: телефон сам покажет время."""
    now = utcnow()

    def age(kind: str | None) -> int | None:
        row = conn.execute("SELECT MAX(created_at) FROM sync_log" + (" WHERE kind = ?" if kind else ""),
                           (kind,) if kind else ()).fetchone()
        return int((now - datetime.fromisoformat(row[0])).total_seconds()) if row and row[0] else None

    return {"syncAgeSec": age("sync"), "seenAgeSec": age(None)}


def _note_seen(conn: sqlite3.Connection, kind: str, items: int = 0) -> None:
    # «На связи» пишем не чаще раза в минуту: программа 1С спрашивает /wait каждые 20 секунд.
    if kind == "wait":
        last = conn.execute("SELECT MAX(created_at) FROM sync_log WHERE kind = 'wait'").fetchone()[0]
        if last and (utcnow() - datetime.fromisoformat(last)).total_seconds() < 60:
            return
    conn.execute("INSERT INTO sync_log (kind, items, created_at) VALUES (?, ?, ?)", (kind, items, _utc_iso()))
    conn.execute("DELETE FROM sync_log WHERE created_at < ?", (_utc_iso(utcnow() - timedelta(days=30)),))


# ── программа 1С → сервер ────────────────────────────────────────────────────

@app.post("/api/1c/sync")
async def sync_from_1c(request: Request, conn: sqlite3.Connection = Depends(get_db)):
    data = await verified_body(request)
    shops = rules.clean_shops(data.get("shops"))
    if not shops:
        raise HTTPException(422, "нет списка магазинов")
    names = [s["name"] for s in shops]
    raw_items = data.get("items") if isinstance(data.get("items"), list) else []
    items = [i for i in (rules.clean_item(x, names) if isinstance(x, dict) else None for x in raw_items[:MAX_BATCH]) if i]
    if raw_items and not items:
        raise HTTPException(422, "ни одного товара не принято")
    now = _utc_iso()
    with db.tx(conn):
        conn.execute("DELETE FROM shops")
        for sort, shop in enumerate(shops):
            conn.execute("INSERT INTO shops (name, cash_desk, transfer_desk, sort) VALUES (?, ?, ?, ?)",
                         (shop["name"], shop["cashDesk"], shop["transferDesk"], sort))
        before = {r["id"]: (r["code"], r["name"], r["article"], r["grp"], r["unit"], r["stock"], r["price"])
                  for r in conn.execute("SELECT id, code, name, article, grp, unit, stock, price FROM items")}
        changed = 0
        for item in items:
            row = (item["code"], item["name"], item["article"], item["group"], item["unit"],
                   db.dumps(item["stock"]), db.dumps(item["price"]))
            if before.pop(item["id"], None) == row:
                if item["cost"] > 0:     # себестоимость телефону не видна — список ради неё заново не качаем
                    conn.execute("UPDATE items SET cost = ? WHERE id = ?", (item["cost"], item["id"]))
                continue      # не менялся — updated_at не трогаем: телефон не качает список заново
            # Себестоимость 0 (товар кончился, в 1С нечего делить) — оставляем прежнюю.
            conn.execute("INSERT INTO items (id, code, name, article, grp, unit, stock, price, cost, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?) "
                         "ON CONFLICT (id) DO UPDATE SET code = excluded.code, name = excluded.name, article = excluded.article, "
                         "grp = excluded.grp, unit = excluded.unit, stock = excluded.stock, price = excluded.price, "
                         "cost = CASE WHEN excluded.cost > 0 THEN excluded.cost ELSE items.cost END, "
                         "updated_at = excluded.updated_at", (item["id"], *row, item["cost"], now))
            changed += 1
        if data.get("full", True) and before:
            conn.executemany("DELETE FROM items WHERE id = ?", [(k,) for k in before])
        accepted = {}
        if isinstance(data.get("debts"), list):        # долги — всегда целиком: пустой список = долгов нет
            debts = [d for d in (rules.clean_debt(x) if isinstance(x, dict) else None for x in data["debts"][:MAX_BATCH]) if d]
            conn.execute("DELETE FROM debts")
            for d in debts:
                conn.execute("INSERT INTO debts (id, doc, date, client_id, client_name, phones, shop, total, left_sum, schedule, updated_at) "
                             "VALUES (?,?,?,?,?,?,?,?,?,?,?)", (d["id"], d["doc"], d["date"], d["clientId"], d["clientName"], d["phones"],
                                                                d["shop"], d["total"], d["left"], db.dumps(d["schedule"]), now))
            accepted["debts"] = len(debts)
        articles = [a for a in (rules.clean_entry(x) if isinstance(x, dict) else None for x in (data.get("articles") or [])[:MAX_BATCH]) if a]
        if articles:                                   # пустой список статей не затирает — скорее сбой в 1С
            conn.execute("DELETE FROM articles")
            conn.executemany("INSERT INTO articles (id, name, uses) VALUES (?, ?, ?)", [(a["id"], a["name"], a["uses"]) for a in articles])
            accepted["articles"] = len(articles)
        if isinstance(data.get("cash"), list):         # деньги в кассах — целиком
            cash = [b for b in (rules.clean_balance(x) if isinstance(x, dict) else None for x in data["cash"]) if b]
            conn.execute("DELETE FROM balances")
            conn.executemany("INSERT OR REPLACE INTO balances (name, amount) VALUES (?, ?)", [(b["name"], b["amount"]) for b in cash])
            accepted["cash"] = len(cash)
        _note_seen(conn, "sync", len(items))
    asyncio.create_task(site_push_background())       # наличие на сайт — в фоне, программе 1С ждать не нужно
    return {"ok": True, "items": len(items), "changed": changed, "removed": len(before) if data.get("full", True) else 0,
            "rejected": len(raw_items) - len(items), **accepted}


@app.post("/api/1c/owner-pin")
async def owner_pin(request: Request, conn: sqlite3.Connection = Depends(get_db)):
    data = await verified_body(request)
    pin = str(data.get("pin") or "")
    if not rules.valid_pin(pin):
        raise HTTPException(422, "PIN — от 4 до 6 цифр")
    name = rules._text(data.get("name"), rules.USER_NAME_MAX) or OWNER_NAME
    with db.tx(conn):
        others = [r[0] for r in conn.execute("SELECT pin_hash FROM users WHERE role <> 'owner'")]
        if rules.pin_taken(pin, others):
            raise HTTPException(409, "такой PIN уже у сотрудника — возьмите другой")
        row = conn.execute("SELECT id FROM users WHERE role = 'owner' ORDER BY id LIMIT 1").fetchone()
        if row:
            conn.execute("UPDATE users SET pin_hash = ?, name = ?, active = 1 WHERE id = ?", (rules.hash_pin(pin), name, row[0]))
            conn.execute("DELETE FROM sessions WHERE user_id = ?", (row[0],))   # PIN сменили — старые входы не действуют
        else:
            conn.execute("INSERT INTO users (name, role, pin_hash, created_at) VALUES (?, 'owner', ?, ?)",
                         (name, rules.hash_pin(pin), _utc_iso()))
    return {"ok": True}


def _for_1c(op: dict) -> dict:
    return {k: op[k] for k in ("id", "kind", "payload", "user", "shop", "status", "createdAt", "docs", "error")}


@app.get("/api/1c/wait")
def wait_ops(sec: int = 20, _=Depends(verify_key)):
    """Долгий опрос: отвечаем, как только на телефоне появилась продажа или отмена проведённой. Новое соединение на
    каждую проверку — базу не держим все 20 секунд."""
    deadline = time.monotonic() + max(0, min(int(sec or 0), WAIT_MAX_SEC))
    while True:
        conn = db.connect()
        try:
            rows = [_op_row(r) for r in conn.execute(
                "SELECT * FROM ops WHERE status IN ('new', 'cancelling') ORDER BY created_at LIMIT 100")]
            if rows or time.monotonic() >= deadline:
                with db.tx(conn):
                    _note_seen(conn, "wait")
                return {"ops": [_for_1c(o) for o in rows if o["status"] == "new"],
                        "cancels": [o["id"] for o in rows if o["status"] == "cancelling"]}
        finally:
            conn.close()
        time.sleep(1)


@app.get("/api/1c/ops")
def ops_recent(days: int = 3, _=Depends(verify_key), conn: sqlite3.Connection = Depends(get_db)):
    since = _utc_iso(utcnow() - timedelta(days=max(1, min(int(days or 3), 31))))
    ops = [_for_1c(_op_row(r)) for r in conn.execute(
        "SELECT * FROM ops WHERE created_at >= ? OR status = 'new' ORDER BY created_at DESC LIMIT 500", (since,))]
    return {"ops": ops, "count": len(ops)}


@app.post("/api/1c/ops/{op_id}/{result}")
async def op_result(op_id: str, result: str, request: Request, conn: sqlite3.Connection = Depends(get_db)):
    if result not in ("done", "failed", "cancelled"):
        raise HTTPException(404, "done, failed или cancelled")
    data = await verified_body(request)
    op_id = op_id.lower()
    with db.tx(conn):
        row = conn.execute("SELECT status FROM ops WHERE id = ?", (op_id,)).fetchone()
        if not row:
            raise HTTPException(404, "операция не найдена")
        status = row[0]
        if result == "cancelled":
            if status != "cancelling":
                return {"ok": True, "status": status}
            conn.execute("UPDATE ops SET status = 'cancelled', done_at = ? WHERE id = ?", (_utc_iso(), op_id))
    if result == "cancelled":
        await _club_undo(conn, op_id, unearn=True)    # проведённую отменили: списанные бонусы — назад, начисленные — снять
        return {"ok": True, "status": "cancelled"}
    with db.tx(conn):
        status = conn.execute("SELECT status FROM ops WHERE id = ?", (op_id,)).fetchone()[0]
        if status == "cancelled" and result == "done":
            # Телефон отменил, пока 1С проводила: 1С получает отказ и сама распроводит документы.
            return JSONResponse({"ok": False, "error": "продажу отменили с телефона — распроведите документы"}, status_code=409)
        if status in ("cancelled", "cancelling"):
            return {"ok": True, "status": status}      # отмену проведённой 1С заберёт следующим опросом
        docs = data.get("docs") if result == "done" and isinstance(data.get("docs"), list) else None
        conn.execute("UPDATE ops SET status = ?, docs = ?, error = ?, done_at = ? WHERE id = ?",
                     (result, db.dumps(docs) if docs is not None else None,
                      None if result == "done" else (str(data.get("reason") or "")[:900] or "ошибка 1С"), _utc_iso(), op_id))
    if result == "done":
        await _club_earn(conn, op_id)
    return {"ok": True, "status": result}


# ── телефон: страница и вход ─────────────────────────────────────────────────

@app.get("/", include_in_schema=False)
def root():
    return RedirectResponse("/kassa/")


@app.get("/kassa", include_in_schema=False)
def kassa_no_slash():
    return RedirectResponse("/kassa/")


@app.get("/kassa/", response_class=HTMLResponse)
def page():
    return HTMLResponse((HERE / "page.html").read_text(encoding="utf-8"), headers={"Cache-Control": "no-store"})


@app.get("/kassa/manifest.webmanifest")
def manifest():
    return JSONResponse({
        "name": "Касса Kemal Usman", "short_name": "Касса", "start_url": "./", "scope": "./", "display": "standalone",
        "background_color": "#ffffff", "theme_color": "#eaf500", "lang": "ru",
        "icons": [{"src": "icon-512.png", "sizes": "512x512", "type": "image/png"},
                  {"src": "icon-180.png", "sizes": "180x180", "type": "image/png"},
                  {"src": "icon.svg", "sizes": "any", "type": "image/svg+xml"}],
    }, media_type="application/manifest+json")


@app.get("/kassa/{name}")
def static_file(name: str):
    types = {"icon.svg": "image/svg+xml", "icon-180.png": "image/png", "icon-512.png": "image/png"}
    if name not in types or not (HERE / "static" / name).exists():
        raise HTTPException(404)
    return Response((HERE / "static" / name).read_bytes(), media_type=types[name], headers={"Cache-Control": "public, max-age=86400"})


_FAILED: dict[str, list] = {}   # неверные PIN по адресу: 5 подряд — пауза 15 минут


def _client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for", "")
    return fwd.split(",")[0].strip() if fwd else (request.client.host if request.client else "?")


def _locked(ip: str) -> int:
    _, until = _FAILED.get(ip, [0, 0.0])
    return int(until - time.time()) if until > time.time() else 0


def _note_failure(ip: str) -> None:
    count, _ = _FAILED.get(ip, [0, 0.0])
    count += 1
    minutes = rules.locked_for(count)
    _FAILED[ip] = [0 if minutes else count, time.time() + minutes * 60 if minutes else 0.0]


@app.post("/kassa/login")
async def login(request: Request, conn: sqlite3.Connection = Depends(get_db)):
    data = _json(await request.body())
    ip = _client_ip(request)
    wait = _locked(ip)
    if wait > 0:
        raise HTTPException(429, f"Слишком много попыток. Подождите {max(wait // 60, 1)} мин.")
    pin = str(data.get("pin") or "")
    if not rules.valid_pin(pin):
        raise HTTPException(422, "PIN — от 4 до 6 цифр")
    rows = conn.execute("SELECT id, name, role, pin_hash FROM users WHERE active = 1 ORDER BY id").fetchall()
    user = next((r for r in rows if rules.verify_pin(pin, r["pin_hash"])), None)
    if user is None:
        _note_failure(ip)
        if not rows:
            raise HTTPException(401, "Касса ещё не настроена: владелец задаёт PIN на компьютере магазина")
        raise HTTPException(401, "PIN не подходит")
    _FAILED.pop(ip, None)
    token = rules.new_token()
    with db.tx(conn):
        conn.execute("INSERT INTO sessions (token, user_id, device, created_at, last_seen) VALUES (?, ?, ?, ?, ?)",
                     (token, user["id"], str(request.headers.get("user-agent", ""))[:200], _utc_iso(), _utc_iso()))
        conn.execute("DELETE FROM sessions WHERE created_at < ?", (_utc_iso(utcnow() - timedelta(days=rules.SESSION_DAYS)),))
    response = JSONResponse({"ok": True, "user": {"name": user["name"], "role": user["role"]}})
    response.set_cookie(COOKIE, token, max_age=rules.SESSION_DAYS * 86400, httponly=True, samesite="lax",
                        secure=request.url.scheme == "https" or request.headers.get("x-forwarded-proto") == "https", path=COOKIE_PATH)
    return response


def current_user(request: Request, conn: sqlite3.Connection = Depends(get_db)) -> dict:
    token = request.cookies.get(COOKIE, "")
    row = conn.execute(
        "SELECT u.id, u.name, u.role, u.shop FROM sessions s JOIN users u ON u.id = s.user_id "
        "WHERE s.token = ? AND u.active = 1 AND s.created_at > ?",
        (token, _utc_iso(utcnow() - timedelta(days=rules.SESSION_DAYS)))).fetchone() if token else None
    if not row:
        raise HTTPException(401, "войдите по PIN")
    conn.execute("UPDATE sessions SET last_seen = ? WHERE token = ?", (_utc_iso(), token))
    return {"id": row["id"], "name": row["name"], "role": row["role"], "shop": row["shop"] or "", "token": token}


def owner_user(user: dict = Depends(current_user)) -> dict:
    if user["role"] != "owner":
        raise HTTPException(403, "только владелец")
    return user


@app.post("/kassa/logout")
def logout(request: Request, conn: sqlite3.Connection = Depends(get_db)):
    token = request.cookies.get(COOKIE, "")
    if token:
        conn.execute("DELETE FROM sessions WHERE token = ?", (token,))
    response = JSONResponse({"ok": True})
    response.delete_cookie(COOKIE, path=COOKIE_PATH)
    return response


# ── телефон: данные ──────────────────────────────────────────────────────────

def _public(op: dict, user: dict) -> dict:
    return {**{k: op[k] for k in ("id", "kind", "payload", "user", "shop", "status", "docs", "error", "createdAt")},
            "mine": op["userId"] == user["id"]}


@app.get("/kassa/api/state")
def state(user: dict = Depends(current_user), conn: sqlite3.Connection = Depends(get_db)):
    rows = [_op_row(r) for r in conn.execute(
        "SELECT * FROM ops WHERE created_at >= ? OR status IN ('new', 'failed', 'cancelling') ORDER BY created_at DESC LIMIT 300",
        (day_start_utc(),))]
    owner = user["role"] == "owner"
    mine = [o for o in rows if owner or o["userId"] == user["id"]]
    today = (utcnow() + BISHKEK).date().isoformat()
    today_ops = [o for o in mine if str(o["createdAt"] or "").startswith(today)]
    extra = {}
    month_ops = _sales_since(conn, 31)
    users = _users(conn)
    rating = rules.staff_rating(month_ops, users, (utcnow() + BISHKEK).date())
    if owner:
        # Касса владельца: деньги в кассах (1С + непроведённые операции), статьи расходов, прибыль, рейтинг продавцов.
        shops = {s["name"]: s for s in _shops(conn)}
        balances = [{"name": r["name"], "amount": r["amount"]} for r in conn.execute("SELECT name, amount FROM balances")]
        extra = {"desks": rules.desk_balances(balances + [{"name": d, "amount": 0} for s in shops.values()
                                                             for d in (s["cashDesk"], s["transferDesk"]) if d and d not in [b["name"] for b in balances]],
                                              _new_ops(conn), shops),
                 "articles": [{"id": r["id"], "name": r["name"]} for r in conn.execute("SELECT id, name FROM articles ORDER BY uses DESC, name")],
                 "profit": rules.gross_profit(month_ops, (utcnow() + BISHKEK).date()), "rating": rating}
        new_ops = _new_ops(conn)
        paid = rules.paid_by_ops(new_ops)
        debts_left = sum((rules.debt_left(r["left_sum"], paid.get(r["id"], 0)) for r in conn.execute("SELECT id, left_sum FROM debts")), Decimal(0))
        goods = [{"id": r["id"], "cost": r["cost"], "stock": db.loads(r["stock"], {})} for r in conn.execute("SELECT id, cost, stock FROM items")]
        extra["capital"] = rules.capital(goods, rules.reserved_by_ops(new_ops), extra["desks"], debts_left)
    else:
        extra = {"myRating": {k: next((r for r in rows_ if r["userId"] == user["id"]), None) for k, rows_ in rating.items()}}
    return {"user": {"name": user["name"], "role": user["role"], "shop": user["shop"]}, **rules.visible_to(user["role"]),
            "shops": [s["name"] for s in _shops(conn)], "sync": _sync_info(conn),
            "pending": conn.execute("SELECT COUNT(*) FROM ops WHERE status = 'new'").fetchone()[0],
            "items": conn.execute("SELECT COUNT(*) FROM items").fetchone()[0],
            "debts": conn.execute("SELECT COUNT(*) FROM debts").fetchone()[0],
            "ops": [_public(o, user) for o in mine], "totals": rules.day_totals(today_ops),
            "now": (utcnow() + BISHKEK).isoformat(timespec="seconds"), **extra}


def _sales_since(conn: sqlite3.Connection, days: int) -> list[dict]:
    """Продажи за N дней — для прибыли и рейтинга."""
    since = _utc_iso(utcnow() + BISHKEK - timedelta(days=days) - BISHKEK)
    return [_op_row(r) for r in conn.execute("SELECT * FROM ops WHERE kind = 'sale' AND created_at >= ?", (since,))]


@app.get("/kassa/api/debts")
def debts(user: dict = Depends(current_user), conn: sqlite3.Connection = Depends(get_db)):
    """Долги покупателей из 1С минус оплаты с телефона, которые 1С ещё не провела."""
    paid = rules.paid_by_ops(_new_ops(conn))
    out = []
    for r in conn.execute("SELECT * FROM debts ORDER BY client_name COLLATE NOCASE, date"):
        left = rules.debt_left(r["left_sum"], paid.get(r["id"], 0))
        out.append({"id": r["id"], "doc": r["doc"], "date": r["date"], "clientId": r["client_id"], "clientName": r["client_name"],
                    "phones": r["phones"], "shop": r["shop"], "total": r["total"], "left": float(left), "left1c": r["left_sum"],
                    "schedule": rules.unpaid_schedule(db.loads(r["schedule"], []), left)})
    return {"debts": [d for d in out if d["left"] > 0], "sync": _sync_info(conn)}


def _version(conn: sqlite3.Connection) -> str:
    count, last = conn.execute("SELECT COUNT(*), MAX(updated_at) FROM items").fetchone()
    return f"{count}.{last or ''}"


@app.get("/kassa/api/items")
def items(v: str = "", user: dict = Depends(current_user), conn: sqlite3.Connection = Depends(get_db)):
    """Товары. taken — продано с телефона, а 1С ещё не провела: телефон сам вычитает из stock1c.
    v совпал с версией — {same: true}: список у телефона свежий, качать нечего."""
    taken = {shop: {k: rules.num(q) for k, q in per.items()} for shop, per in rules.reserved_by_ops(_new_ops(conn)).items()}
    version = _version(conn)
    if v and v == version:
        return {"same": True, "v": version, "taken": taken, "sync": _sync_info(conn)}
    result = [{"id": r["id"], "code": r["code"], "name": r["name"], "article": r["article"], "group": r["grp"], "unit": r["unit"],
               "fraction": rules.fractional(r["unit"]), "stock1c": db.loads(r["stock"], {}), "price": db.loads(r["price"], {})}
              for r in conn.execute("SELECT * FROM items ORDER BY name COLLATE NOCASE")]
    return {"items": result, "v": version, "taken": taken, "sync": _sync_info(conn)}


def _items_map(conn: sqlite3.Connection, ids: list[str]) -> dict[str, dict]:
    out = {}
    for item_id in ids[:rules.MAX_LINES]:
        r = conn.execute("SELECT * FROM items WHERE id = ?", (item_id,)).fetchone()
        if r:
            out[r["id"]] = {"id": r["id"], "code": r["code"], "name": r["name"], "unit": r["unit"], "cost": r["cost"],
                            "stock": db.loads(r["stock"], {}), "price": db.loads(r["price"], {})}
    return out


@app.post("/kassa/api/ops")
async def create_op(request: Request, user: dict = Depends(current_user), conn: sqlite3.Connection = Depends(get_db)):
    data = _json(await request.body())
    op_id = str(data.get("id") or "").lower()
    existing = conn.execute("SELECT * FROM ops WHERE id = ?", (op_id,)).fetchone()
    if existing:
        # Телефон отправил ещё раз (сеть моргнула) — та же операция, без дубля.
        return {"ok": True, "repeated": True, "op": _public(_op_row(existing), user)}
    payload = data.get("payload") if isinstance(data.get("payload"), dict) else {}
    kind = str(data.get("kind") or "")
    bonus = kind == "sale" and rules.money(payload.get("bonus")) > 0
    club = None
    if bonus:   # бонусы клуба: баланс и предел — из PocketBase сайта
        club = await asyncio.to_thread(notify.club, "balance", phone=rules.phone_digits((payload.get("buyer") or {}).get("phone")))
        club = club if club.get("ok") else None
    verdict = _check(conn, op_id, kind, payload, user, club, insert=not bonus)
    if verdict["ok"] and bonus:
        # Списываем в клубе до записи продажи (повтор того же id второй раз не спишет); не записалась — возвращаем.
        spent = await asyncio.to_thread(notify.club, "spend", phone=verdict["payload"]["buyer"]["phone"], opId=op_id,
                                        amount=verdict["payload"]["bonus"], who=user["name"])
        if not spent.get("ok"):
            why = "бонусов не хватает" if spent.get("error") == "not_enough" else "клуб бонусов не ответил — продайте без бонусов"
            return JSONResponse({"ok": False, "error": why}, status_code=409)
        verdict = _check(conn, op_id, kind, payload, user, club, insert=True)
        if not verdict["ok"]:
            await asyncio.to_thread(notify.club, "refund", phone=payload["buyer"]["phone"], opId=op_id)
    if not verdict["ok"]:
        return JSONResponse({"ok": False, "error": verdict["error"]}, status_code=409)
    op = _op_row(conn.execute("SELECT * FROM ops WHERE id = ?", (op_id,)).fetchone())
    # Долг и оплата долга — покупателю сразу чек в WhatsApp (сколько осталось и до какого числа); сбой операцию не трогает.
    if (kind == "sale" and op["payload"].get("debt")) or kind == "payment":
        phone = _op_phone(conn, op)
        if phone:
            try:
                await _send_receipt(conn, op, phone)
            except Exception as error:  # noqa: BLE001
                logger.warning("чек в WhatsApp %s: %s", op_id, error)
    return {"ok": True, "op": _public(op, user)}


def _check(conn: sqlite3.Connection, op_id: str, kind: str, payload: dict, user: dict, club: dict | None, insert: bool) -> dict:
    """Проверка операции и (insert) запись — одной транзакцией: два телефона не продадут последний флакон дважды."""
    ids = [str(l.get("itemId") or "").lower() for l in (payload.get("lines") or []) if isinstance(l, dict)]
    with db.tx(conn):
        if conn.execute("SELECT 1 FROM ops WHERE id = ?", (op_id,)).fetchone():
            return {"ok": True, "payload": payload}
        new_ops = _new_ops(conn)
        shops = _shops(conn)
        ctx = {"items": _items_map(conn, ids), "shops": [s["name"] for s in shops], "taken": rules.reserved_by_ops(new_ops),
               "paid": rules.paid_by_ops(new_ops), "today": (utcnow() + BISHKEK).date(), "club": club,
               "desks": sorted({r[0] for r in conn.execute("SELECT name FROM balances")}
                               | {d for s in shops for d in (s["cashDesk"], s["transferDesk"]) if d}),
               "articles": {r["id"]: {"id": r["id"], "name": r["name"]} for r in conn.execute("SELECT id, name FROM articles")}}
        debt_id = str(payload.get("debtId") or "").lower()
        row = conn.execute("SELECT id, doc, client_name, left_sum FROM debts WHERE id = ?", (debt_id,)).fetchone() if debt_id else None
        ctx["debts"] = {row["id"]: {"id": row["id"], "doc": row["doc"], "clientName": row["client_name"], "left": row["left_sum"]}} if row else {}
        verdict = rules.check_op({"id": op_id, "kind": kind, "payload": payload}, user, ctx)
        if verdict["ok"] and insert:
            clean = verdict["payload"]
            if kind == "sale" and clean.get("debt"):
                # Онлайн договор (этап 3): ссылка покупателю в чеке WhatsApp, он открывает и нажимает «Согласен».
                clean["contractToken"] = rules.new_token()[:24]
                clean["contractUrl"] = PUBLIC_URL + "/kassa/c/" + clean["contractToken"]
            conn.execute("INSERT INTO ops (id, kind, payload, user_id, user_name, shop, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                         (op_id, kind, db.dumps(clean), user["id"], user["name"], clean.get("shop") or "", _utc_iso()))
    return verdict


def _op_for(conn: sqlite3.Connection, op_id: str, user: dict) -> dict:
    row = conn.execute("SELECT * FROM ops WHERE id = ?", (op_id.lower(),)).fetchone()
    if not row:
        raise HTTPException(404, "операция не найдена")
    op = _op_row(row)
    if user["role"] != "owner" and op["userId"] != user["id"]:
        raise HTTPException(403, "чужая операция")
    return op


@app.post("/kassa/api/ops/{op_id}/cancel")
async def op_cancel(op_id: str, user: dict = Depends(current_user), conn: sqlite3.Connection = Depends(get_db)):
    answer = _cancel(op_id, user, conn)
    if isinstance(answer, dict) and answer.get("status") == "cancelled":
        await _club_undo(conn, op_id.lower(), unearn=False)     # не проведена — вернуть списанные бонусы
    return answer


def _cancel(op_id: str, user: dict, conn: sqlite3.Connection):
    """Не проведена (new) — отмена сразу: остаток освобождается сам. Проведена или с ошибкой — cancelling: программа 1С
    распроводит документы, помечает на удаление и ответит /cancelled."""
    with db.tx(conn):
        op = _op_for(conn, op_id, user)
        who = user["name"]
        if op["status"] == "new":
            conn.execute("UPDATE ops SET status = 'cancelled', error = ?, done_at = ? WHERE id = ?", ("отменил: " + who, _utc_iso(), op["id"]))
            return {"ok": True, "status": "cancelled"}
        if op["status"] in ("done", "failed"):
            conn.execute("UPDATE ops SET status = 'cancelling', error = ? WHERE id = ?", ("отменил: " + who, op["id"]))
            return {"ok": True, "status": "cancelling", "waiting1c": True}
    return JSONResponse({"ok": False, "error": "Отмена уже ждёт 1С" if op["status"] == "cancelling" else "Продажа уже отменена"},
                        status_code=409)


@app.post("/kassa/api/ops/{op_id}/retry")
def op_retry(op_id: str, user: dict = Depends(owner_user), conn: sqlite3.Connection = Depends(get_db)):
    """Владелец: продажа не провелась в 1С (не хватило товара, 1С была занята) — провести ещё раз."""
    with db.tx(conn):
        op = _op_for(conn, op_id, user)
        if op["status"] != "failed":
            return JSONResponse({"ok": False, "error": "повторить можно только продажу с ошибкой"}, status_code=409)
        conn.execute("UPDATE ops SET status = 'new', error = NULL, done_at = NULL WHERE id = ?", (op["id"],))
    return {"ok": True, "status": "new"}


RECEIPT_HTML = """<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title><style>
body{{margin:0;padding:16px;font:14px/1.45 Manrope,"Segoe UI",sans-serif;color:#263244;background:#fff}}
pre{{white-space:pre-wrap;font:inherit;margin:0 0 16px;max-width:360px}}
button{{font:600 15px inherit;height:46px;padding:0 20px;border:0;border-radius:12px;background:#eaf500;color:#263244;margin-right:8px}}
.o{{background:#fff;color:#263244;border:1px solid #c4cdd8}}
@media print{{button{{display:none}}body{{padding:0}}}}
</style></head><body><pre>{text}</pre><button onclick="window.print()">Печать</button><button class="o" onclick="history.length > 1 ? history.back() : window.close()">Назад</button></body></html>"""


@app.get("/kassa/api/receipt/{op_id}", response_class=HTMLResponse)
def receipt(op_id: str, user: dict = Depends(current_user), conn: sqlite3.Connection = Depends(get_db)):
    op = _op_for(conn, op_id, user)
    text = rules.receipt_text(op, SHOP_TITLE).replace("*", "")
    safe = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    return HTMLResponse(RECEIPT_HTML.format(title="Чек " + op["id"][:8], text=safe), headers={"Cache-Control": "no-store"})


# ── сотрудники (владелец) ────────────────────────────────────────────────────

def _users(conn: sqlite3.Connection) -> list[dict]:
    rows = conn.execute(
        "SELECT u.id, u.name, u.role, u.active, u.shop, u.bonus_pct, u.created_at, MAX(s.last_seen) AS seen FROM users u "
        "LEFT JOIN sessions s ON s.user_id = u.id GROUP BY u.id ORDER BY u.role = 'owner' DESC, u.active DESC, u.name").fetchall()
    return [{"id": r["id"], "name": r["name"], "role": r["role"], "active": bool(r["active"]), "shop": r["shop"] or "",
             "bonusPct": r["bonus_pct"], "lastSeen": local_iso(r["seen"])} for r in rows]


@app.get("/kassa/api/users")
def users_list(user: dict = Depends(owner_user), conn: sqlite3.Connection = Depends(get_db)):
    return {"users": _users(conn), "shops": [s["name"] for s in _shops(conn)]}


@app.post("/kassa/api/users")
async def users_save(request: Request, user: dict = Depends(owner_user), conn: sqlite3.Connection = Depends(get_db)):
    """Новый сотрудник {name, pin, shop} или правка {id, name?, pin?, shop?, active?}. PIN владельца — только с ПК магазина."""
    data = _json(await request.body())
    user_id = int(data.get("id") or 0)
    form = rules.clean_user(data, [s["name"] for s in _shops(conn)], new=not user_id)
    if not form["ok"]:
        return JSONResponse({"ok": False, "error": form["error"]}, status_code=422)
    with db.tx(conn):
        if form["pin"]:
            others = [r[0] for r in conn.execute("SELECT pin_hash FROM users WHERE id <> ?", (user_id,))]
            if rules.pin_taken(form["pin"], others):
                return JSONResponse({"ok": False, "error": "Такой PIN уже у другого — придумайте другой"}, status_code=409)
        if not user_id:
            conn.execute("INSERT INTO users (name, role, pin_hash, shop, bonus_pct, created_at) VALUES (?, 'staff', ?, ?, ?, ?)",
                         (form["name"], rules.hash_pin(form["pin"]), form.get("shop", ""), form.get("bonusPct", float(rules.STAFF_BONUS_PCT)),
                          _utc_iso()))
        else:
            row = conn.execute("SELECT role FROM users WHERE id = ?", (user_id,)).fetchone()
            if not row:
                raise HTTPException(404, "сотрудник не найден")
            if row[0] == "owner" and (form["pin"] or form.get("active") is False or form.get("shop")):
                return JSONResponse({"ok": False, "error": "PIN владельца задаётся на компьютере магазина; выключить владельца нельзя"},
                                    status_code=409)
            if form["name"]:
                conn.execute("UPDATE users SET name = ? WHERE id = ?", (form["name"], user_id))
            if "shop" in form:
                conn.execute("UPDATE users SET shop = ? WHERE id = ?", (form["shop"], user_id))
            if "bonusPct" in form and row[0] != "owner":
                conn.execute("UPDATE users SET bonus_pct = ? WHERE id = ?", (form["bonusPct"], user_id))
            if form["pin"]:
                conn.execute("UPDATE users SET pin_hash = ? WHERE id = ?", (rules.hash_pin(form["pin"]), user_id))
                conn.execute("DELETE FROM sessions WHERE user_id = ?", (user_id,))
            if "active" in form:
                conn.execute("UPDATE users SET active = ? WHERE id = ?", (1 if form["active"] else 0, user_id))
                if not form["active"]:
                    conn.execute("DELETE FROM sessions WHERE user_id = ?", (user_id,))   # выключили — телефон тут же выходит
    return {"ok": True, "users": _users(conn)}


@app.get("/health")
def health(conn: sqlite3.Connection = Depends(get_db)):
    conn.execute("SELECT 1").fetchone()
    return {"ok": True}


# ── этап 3: бонусы клуба и WhatsApp ──────────────────────────────────────────

def _patch(conn: sqlite3.Connection, op_id: str, patch: dict) -> dict:
    """Дописать поля в payload операции (что ушло в WhatsApp, сколько бонусов начислено)."""
    with db.tx(conn):
        row = conn.execute("SELECT payload FROM ops WHERE id = ?", (op_id,)).fetchone()
        payload = {**db.loads(row[0] if row else None, {}), **patch}
        conn.execute("UPDATE ops SET payload = ? WHERE id = ?", (db.dumps(payload), op_id))
    return payload


async def _club_earn(conn: sqlite3.Connection, op_id: str) -> None:
    """Продажа проведена в 1С и у неё есть телефон покупателя — начислить бонус клуба с оплаченной суммы (повтор не начислит дважды)."""
    row = conn.execute("SELECT kind, payload FROM ops WHERE id = ?", (op_id,)).fetchone()
    payload = db.loads(row["payload"], {}) if row else {}
    phone = (payload.get("buyer") or {}).get("phone")
    if not row or row["kind"] != "sale" or not phone or payload.get("bonusEarned") is not None or not notify.club_on():
        return
    answer = await asyncio.to_thread(notify.club, "earn", phone=phone, opId=op_id,
                                     total=float(rules.money(payload.get("total")) - rules.money(payload.get("bonus"))))
    if answer.get("ok"):
        _patch(conn, op_id, {"bonusEarned": abs(float(answer.get("amount") or 0))})
    elif answer.get("error") != "no_client":
        logger.warning("бонус за продажу %s не начислен: %s", op_id, answer.get("error"))


async def _club_undo(conn: sqlite3.Connection, op_id: str, unearn: bool) -> None:
    row = conn.execute("SELECT kind, payload FROM ops WHERE id = ?", (op_id,)).fetchone()
    payload = db.loads(row["payload"], {}) if row else {}
    phone = (payload.get("buyer") or {}).get("phone")
    if not row or row["kind"] != "sale" or not phone or not notify.club_on():
        return
    if payload.get("bonus"):
        await asyncio.to_thread(notify.club, "refund", phone=phone, opId=op_id)
    if unearn and payload.get("bonusEarned"):
        await asyncio.to_thread(notify.club, "unearn", phone=phone, opId=op_id)


def _op_phone(conn: sqlite3.Connection, op: dict) -> str:
    """Телефон для чека: покупатель продажи или карточка долга (оплата)."""
    payload = op.get("payload") or {}
    phone = (payload.get("buyer") or {}).get("phone") or ""
    if not phone and op.get("kind") == "payment":
        row = conn.execute("SELECT phones FROM debts WHERE id = ?", (payload.get("debtId") or "",)).fetchone()
        phone = rules.phone_digits((row[0] if row else "").split("/")[0])
    return phone


async def _send_receipt(conn: sqlite3.Connection, op: dict, phone: str) -> dict:
    answer = await asyncio.to_thread(notify.whatsapp, phone, rules.receipt_text(op, SHOP_TITLE))
    if answer.get("ok"):
        op["payload"] = _patch(conn, op["id"], {"waPhone": phone, "waSentAt": (utcnow() + BISHKEK).isoformat(timespec="seconds"),
                                                "waDry": bool(answer.get("dry"))})
    return answer


@app.get("/kassa/api/bonus")
async def bonus_balance(phone: str = "", user: dict = Depends(current_user)):
    """Бонусы клуба покупателя по телефону: {on, found, balance, maxPct, earnPct, name}."""
    digits = rules.phone_digits(phone)
    if not notify.club_on():
        return {"on": False}
    if not digits:
        return {"on": True, "found": False}
    answer = await asyncio.to_thread(notify.club, "balance", phone=digits)
    if not answer.get("ok"):
        return {"on": True, "found": False, "error": "клуб не ответил"}
    return {"on": True, "found": bool(answer.get("found")), "balance": answer.get("balance", 0), "maxPct": answer.get("maxPct", 0),
            "earnPct": answer.get("earnPct", 0), "name": answer.get("name") or ""}


@app.post("/kassa/api/ops/{op_id}/whatsapp")
async def op_whatsapp(op_id: str, request: Request, user: dict = Depends(current_user), conn: sqlite3.Connection = Depends(get_db)):
    """Чек в WhatsApp покупателю: номер из продажи / долга или введённый {phone}."""
    data = _json(await request.body())
    op = _op_for(conn, op_id, user)
    phone = rules.phone_digits(data.get("phone")) or _op_phone(conn, op)
    if not phone:
        return JSONResponse({"ok": False, "needPhone": True, "error": "Нет номера покупателя — введите телефон"}, status_code=422)
    answer = await _send_receipt(conn, op, phone)
    if not answer.get("ok"):
        return JSONResponse({"ok": False, "error": answer.get("error") or "WhatsApp не принял сообщение"}, status_code=502)
    return {"ok": True, "phone": phone, "dry": bool(answer.get("dry"))}


# ── онлайн договор (этап 3): страница по ссылке, без входа ───────────────────

def _contract_op(conn: sqlite3.Connection, token: str) -> dict:
    if not token or len(token) < 16:
        raise HTTPException(404)
    row = conn.execute("SELECT * FROM ops WHERE kind = 'sale' AND json_extract(payload, '$.contractToken') = ?", (token,)).fetchone()
    if not row:
        raise HTTPException(404, "договор не найден")
    return _op_row(row)


def _h(value) -> str:
    return str(value if value is not None else "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")


@app.get("/kassa/c/{token}", response_class=HTMLResponse)
def contract_page(token: str, conn: sqlite3.Connection = Depends(get_db)):
    op = _contract_op(conn, token)
    p = op["payload"]
    debt, buyer = p.get("debt") or {}, p.get("buyer") or {}
    som = rules._som
    lines = "".join(f"<tr><td>{_h(l.get('name'))}<br><small>{_h(rules.num(l.get('qty')))} {_h(l.get('unit'))} × {_h(som(l.get('price')))}</small></td>"
                    f"<td>{_h(som(l.get('sum')))}</td></tr>" for l in p.get("lines") or [])
    paid = f"<tr><td>Оплачено при покупке</td><td>{_h(som(debt.get('paid')))}</td></tr>" if debt.get("paid") else ""
    schedule = "".join(f"<tr><td>до {_h(rules._when(x.get('date') + 'T00:00')[:10])}</td><td>{_h(som(x.get('sum')))}</td></tr>"
                       for x in debt.get("schedule") or [])
    if p.get("contractAcceptedAt"):
        state = f'<div class="ok">Покупатель согласился с условиями {_h(rules._when(p["contractAcceptedAt"]))}.</div>'
    elif op["status"] in ("cancelled", "cancelling"):
        state = '<div class="err">Покупка отменена — договор не действует.</div>'
    else:
        state = '<button class="btn" id="agree">Согласен с условиями</button><div class="err" id="err"></div>'
    values = {"KIND": "рассрочки" if debt.get("months") else "покупки в долг", "NUMBER": op["id"][:8].upper(),
              "DATE": rules._when(op["createdAt"])[:10], "SHOP": _h(p.get("shop")), "SELLER": _h(SELLER),
              "BUYER": _h(buyer.get("name")), "PHONE": "+" + _h(buyer.get("phone")), "LINES": lines, "TOTAL": _h(som(p.get("total"))),
              "PAID": paid, "SCHEDULE": schedule, "STATE": state}
    html = (HERE / "contract.html").read_text(encoding="utf-8")
    for key, value in values.items():
        html = html.replace("{{" + key + "}}", value)
    return HTMLResponse(html, headers={"Cache-Control": "no-store", "X-Robots-Tag": "noindex"})


@app.post("/kassa/c/{token}/accept")
def contract_accept(token: str, request: Request, conn: sqlite3.Connection = Depends(get_db)):
    op = _contract_op(conn, token)
    if op["status"] in ("cancelled", "cancelling"):
        return JSONResponse({"ok": False, "error": "покупка отменена"}, status_code=409)
    if not op["payload"].get("contractAcceptedAt"):
        _patch(conn, op["id"], {"contractAcceptedAt": (utcnow() + BISHKEK).isoformat(timespec="seconds"),
                                "contractIp": _client_ip(request), "contractDevice": str(request.headers.get("user-agent", ""))[:200]})
    return {"ok": True}


# ── сайт ↔ 1С: только наличие (владелец 22.10, вариант 2) ─────────────────────

SITE_REFRESH_SEC = 6 * 3600          # каталог сайта перечитываем не чаще раза в 6 часов (и кнопкой)
_SITE = {"busy": False, "last": None}


def _site_shops(conn: sqlite3.Connection) -> list[str]:
    """Магазины, чей остаток считается для сайта: KASSA_SITE_SHOPS через «;», по умолчанию — все."""
    names = [s["name"] for s in _shops(conn)]
    wanted = [x.strip() for x in os.environ.get("KASSA_SITE_SHOPS", "").split(";") if x.strip()]
    return [n for n in names if n in wanted] if wanted else names


def _site_items(conn: sqlite3.Connection) -> dict[str, dict]:
    return {r["id"]: {"id": r["id"], "name": r["name"], "unit": r["unit"], "code": r["code"], "stock": db.loads(r["stock"], {})}
            for r in conn.execute("SELECT id, code, name, unit, stock FROM items")}


def _site_refresh(conn: sqlite3.Connection) -> int | None:
    catalog = notify.site_catalog()
    if catalog is None:
        return None
    now = _utc_iso()
    with db.tx(conn):
        conn.execute("DELETE FROM site_products")
        conn.executemany("INSERT INTO site_products (id, name, brand, category, variants, fetched_at) VALUES (?, ?, ?, ?, ?, ?)",
                         [(p["id"], str(p.get("name") or ""), str(p.get("brand") or ""), str(p.get("category") or ""),
                           db.dumps(p.get("variants") or []), now) for p in catalog if p.get("id")])
    return len(catalog)


def _site_push(conn: sqlite3.Connection) -> dict:
    """Пересчитать «в наличии» связанных товаров и отправить на сайт только изменения."""
    last = conn.execute("SELECT MIN(fetched_at) FROM site_products").fetchone()[0]
    if not last or (utcnow() - datetime.fromisoformat(last)).total_seconds() > SITE_REFRESH_SEC:
        _site_refresh(conn)
    products = {r["id"]: {"id": r["id"], "variants": db.loads(r["variants"], [])} for r in conn.execute("SELECT id, variants FROM site_products")}
    links = {r["product_id"]: {"status": r["status"], "itemId": r["item_id"], "pkgItemId": r["pkg_item_id"]}
             for r in conn.execute("SELECT * FROM site_links")}
    todo = site.changes(products, links, _site_items(conn), _site_shops(conn), rules.reserved_by_ops(_new_ops(conn)))
    result = {"ok": True, "products": 0, "variants": 0, "at": (utcnow() + BISHKEK).isoformat(timespec="seconds")}
    if todo:
        answer = notify.site_stock(todo)
        if not answer.get("ok"):
            result = {**result, "ok": False, "error": answer.get("error") or f"сайт ответил {answer.get('status')}"}
        else:
            result.update(products=answer.get("products", 0), variants=answer.get("variants", 0))
            with db.tx(conn):    # копия каталога — как теперь на сайте, чтобы не слать то же самое снова
                for change in todo:
                    product = products[change["productId"]]
                    wanted = {v["id"]: v["inStock"] for v in change["variants"]}
                    for v in product["variants"]:
                        if isinstance(v, dict) and v.get("id") in wanted:
                            v["inStock"] = wanted[v["id"]]
                    conn.execute("UPDATE site_products SET variants = ? WHERE id = ?", (db.dumps(product["variants"]), change["productId"]))
    _SITE["last"] = result
    return result


async def site_push_background() -> None:
    """После обмена с 1С — наличие на сайт (если есть связи и ключ сайта). Один раз за раз, ошибки только в журнал."""
    if _SITE["busy"] or not notify.club_on():
        return
    _SITE["busy"] = True
    try:
        def work():
            conn = db.connect()
            try:
                if conn.execute("SELECT COUNT(*) FROM site_links WHERE status = 'linked'").fetchone()[0]:
                    return _site_push(conn)
                return None
            finally:
                conn.close()
        result = await asyncio.to_thread(work)
        if result and not result.get("ok"):
            logger.warning("наличие на сайт не ушло: %s", result.get("error"))
    finally:
        _SITE["busy"] = False


@app.get("/kassa/api/site/links")
def site_links(user: dict = Depends(owner_user), conn: sqlite3.Connection = Depends(get_db)):
    """Экран «Сайт ↔ 1С»: товары сайта, их связь и подсказки (похожие товары 1С)."""
    items = _site_items(conn)
    item_list = list(items.values())
    links = {r["product_id"]: r for r in conn.execute("SELECT * FROM site_links")}
    shops, taken = _site_shops(conn), rules.reserved_by_ops(_new_ops(conn))
    out = []
    for r in conn.execute("SELECT * FROM site_products ORDER BY brand COLLATE NOCASE, name COLLATE NOCASE"):
        product = {"id": r["id"], "name": r["name"], "brand": r["brand"], "category": r["category"], "variants": db.loads(r["variants"], [])}
        link = links.get(r["id"])
        row = {**product, "status": link["status"] if link else "", "itemId": link["item_id"] if link else "",
               "pkgItemId": link["pkg_item_id"] if link else ""}
        if link and link["item_id"] in items:
            row["item"] = {"name": items[link["item_id"]]["name"], "unit": items[link["item_id"]]["unit"],
                           "free": rules.num(site.free_total(items[link["item_id"]], shops, taken))}
        if link and link["pkg_item_id"] in items:
            row["pkgItem"] = {"name": items[link["pkg_item_id"]]["name"], "free": rules.num(site.free_total(items[link["pkg_item_id"]], shops, taken))}
        if not link:
            row["suggest"] = site.suggest(product, item_list, 3)
        out.append(row)
    fetched = conn.execute("SELECT MAX(fetched_at) FROM site_products").fetchone()[0]
    return {"on": notify.club_on(), "products": out, "fetchedAt": local_iso(fetched), "shops": shops, "last": _SITE["last"],
            "suggestMin": float(site.SUGGEST_MIN)}


@app.post("/kassa/api/site/refresh")
async def site_refresh(user: dict = Depends(owner_user), conn: sqlite3.Connection = Depends(get_db)):
    count = await asyncio.to_thread(_site_refresh, conn)
    if count is None:
        return JSONResponse({"ok": False, "error": "сайт не ответил" if notify.club_on() else "адрес сайта не настроен (KASSA_CLUB_URL)"},
                            status_code=502)
    return {"ok": True, "products": count}


@app.post("/kassa/api/site/links")
async def site_link_save(request: Request, user: dict = Depends(owner_user), conn: sqlite3.Connection = Depends(get_db)):
    """{productId, status: linked | none | '' (разорвать), itemId?, pkgItemId?} или {auto: true} — подтвердить все точные совпадения."""
    data = _json(await request.body())
    items = _site_items(conn)
    now = _utc_iso()
    if data.get("auto"):
        linked = {r[0] for r in conn.execute("SELECT product_id FROM site_links")}
        item_list, done = list(items.values()), 0
        with db.tx(conn):
            for r in conn.execute("SELECT id, name, brand FROM site_products").fetchall():
                if r["id"] in linked:
                    continue
                best = site.suggest({"name": r["name"], "brand": r["brand"]}, item_list, 1)
                if best and best[0]["score"] >= 0.99:
                    conn.execute("INSERT INTO site_links (product_id, status, item_id, user_name, updated_at) VALUES (?, 'linked', ?, ?, ?)",
                                 (r["id"], best[0]["id"], user["name"], now))
                    done += 1
        return {"ok": True, "linked": done}
    product_id, status = str(data.get("productId") or ""), str(data.get("status") or "")
    if not conn.execute("SELECT 1 FROM site_products WHERE id = ?", (product_id,)).fetchone():
        return JSONResponse({"ok": False, "error": "товара сайта нет — обновите каталог"}, status_code=404)
    item_id, pkg_id = str(data.get("itemId") or "").lower(), str(data.get("pkgItemId") or "").lower()
    if status not in ("", "linked", "none"):
        return JSONResponse({"ok": False, "error": "неизвестно"}, status_code=422)
    if status == "linked" and item_id not in items:
        return JSONResponse({"ok": False, "error": "выберите товар 1С"}, status_code=422)
    if pkg_id and pkg_id not in items:
        return JSONResponse({"ok": False, "error": "штучного товара нет в 1С"}, status_code=422)
    with db.tx(conn):
        if status == "":
            conn.execute("DELETE FROM site_links WHERE product_id = ?", (product_id,))
        else:
            conn.execute("INSERT INTO site_links (product_id, status, item_id, pkg_item_id, user_name, updated_at) VALUES (?, ?, ?, ?, ?, ?) "
                         "ON CONFLICT (product_id) DO UPDATE SET status = excluded.status, item_id = excluded.item_id, "
                         "pkg_item_id = excluded.pkg_item_id, user_name = excluded.user_name, updated_at = excluded.updated_at",
                         (product_id, status, item_id if status == "linked" else "", pkg_id if status == "linked" else "", user["name"], now))
    return {"ok": True}


@app.post("/kassa/api/site/push")
async def site_push_now(user: dict = Depends(owner_user), conn: sqlite3.Connection = Depends(get_db)):
    if not notify.club_on():
        return JSONResponse({"ok": False, "error": "адрес сайта не настроен (KASSA_CLUB_URL, KASSA_CLUB_KEY)"}, status_code=502)
    result = await asyncio.to_thread(_site_push, conn)
    return result if result.get("ok") else JSONResponse(result, status_code=502)
