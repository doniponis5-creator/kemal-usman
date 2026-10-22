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

import hmac
import json
import logging
import os
import sqlite3
import time
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path

from fastapi import Depends, FastAPI, Header, HTTPException, Request, Response
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse

from . import db, rules

logger = logging.getLogger("kassa")
HERE = Path(__file__).resolve().parent
BISHKEK = timedelta(hours=6)
COOKIE = "kassa_session"
COOKIE_PATH = "/kassa"
OWNER_NAME = "Владелец"
SHOP_TITLE = os.environ.get("KASSA_SHOP_TITLE", "Kemal Usman Parfume")
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
                continue      # не менялся — updated_at не трогаем: телефон не качает список заново
            conn.execute("INSERT INTO items (id, code, name, article, grp, unit, stock, price, updated_at) VALUES (?,?,?,?,?,?,?,?,?) "
                         "ON CONFLICT (id) DO UPDATE SET code = excluded.code, name = excluded.name, article = excluded.article, "
                         "grp = excluded.grp, unit = excluded.unit, stock = excluded.stock, price = excluded.price, "
                         "updated_at = excluded.updated_at", (item["id"], *row, now))
            changed += 1
        if data.get("full", True) and before:
            conn.executemany("DELETE FROM items WHERE id = ?", [(k,) for k in before])
        _note_seen(conn, "sync", len(items))
    return {"ok": True, "items": len(items), "changed": changed, "removed": len(before) if data.get("full", True) else 0,
            "rejected": len(raw_items) - len(items)}


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
            if status == "cancelling":
                conn.execute("UPDATE ops SET status = 'cancelled', done_at = ? WHERE id = ?", (_utc_iso(), op_id))
                return {"ok": True, "status": "cancelled"}
            return {"ok": True, "status": status}
        if status == "cancelled" and result == "done":
            # Телефон отменил, пока 1С проводила: 1С получает отказ и сама распроводит документы.
            return JSONResponse({"ok": False, "error": "продажу отменили с телефона — распроведите документы"}, status_code=409)
        if status in ("cancelled", "cancelling"):
            return {"ok": True, "status": status}      # отмену проведённой 1С заберёт следующим опросом
        docs = data.get("docs") if result == "done" and isinstance(data.get("docs"), list) else None
        conn.execute("UPDATE ops SET status = ?, docs = ?, error = ?, done_at = ? WHERE id = ?",
                     (result, db.dumps(docs) if docs is not None else None,
                      None if result == "done" else (str(data.get("reason") or "")[:900] or "ошибка 1С"), _utc_iso(), op_id))
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
    return {"user": {"name": user["name"], "role": user["role"], "shop": user["shop"]}, **rules.visible_to(user["role"]),
            "shops": [s["name"] for s in _shops(conn)], "sync": _sync_info(conn),
            "pending": conn.execute("SELECT COUNT(*) FROM ops WHERE status = 'new'").fetchone()[0],
            "items": conn.execute("SELECT COUNT(*) FROM items").fetchone()[0],
            "ops": [_public(o, user) for o in mine], "totals": rules.day_totals(today_ops),
            "now": (utcnow() + BISHKEK).isoformat(timespec="seconds")}


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
            out[r["id"]] = {"id": r["id"], "code": r["code"], "name": r["name"], "unit": r["unit"],
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
    ids = [str(l.get("itemId") or "").lower() for l in (payload.get("lines") or []) if isinstance(l, dict)]
    with db.tx(conn):     # проверка остатка и запись — одной транзакцией: два телефона не продадут последний флакон дважды
        verdict = rules.check_sale({"id": op_id, "kind": data.get("kind"), "payload": payload}, user, _items_map(conn, ids),
                                   [s["name"] for s in _shops(conn)], rules.reserved_by_ops(_new_ops(conn)))
        if not verdict["ok"]:
            return JSONResponse({"ok": False, "error": verdict["error"]}, status_code=409)
        clean = verdict["payload"]
        conn.execute("INSERT INTO ops (id, kind, payload, user_id, user_name, shop, created_at) VALUES (?, 'sale', ?, ?, ?, ?, ?)",
                     (op_id, db.dumps(clean), user["id"], user["name"], clean["shop"], _utc_iso()))
        row = conn.execute("SELECT * FROM ops WHERE id = ?", (op_id,)).fetchone()
    return {"ok": True, "op": _public(_op_row(row), user)}


def _op_for(conn: sqlite3.Connection, op_id: str, user: dict) -> dict:
    row = conn.execute("SELECT * FROM ops WHERE id = ?", (op_id.lower(),)).fetchone()
    if not row:
        raise HTTPException(404, "операция не найдена")
    op = _op_row(row)
    if user["role"] != "owner" and op["userId"] != user["id"]:
        raise HTTPException(403, "чужая операция")
    return op


@app.post("/kassa/api/ops/{op_id}/cancel")
def op_cancel(op_id: str, user: dict = Depends(current_user), conn: sqlite3.Connection = Depends(get_db)):
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
        "SELECT u.id, u.name, u.role, u.active, u.shop, u.created_at, MAX(s.last_seen) AS seen FROM users u "
        "LEFT JOIN sessions s ON s.user_id = u.id GROUP BY u.id ORDER BY u.role = 'owner' DESC, u.active DESC, u.name").fetchall()
    return [{"id": r["id"], "name": r["name"], "role": r["role"], "active": bool(r["active"]), "shop": r["shop"] or "",
             "lastSeen": local_iso(r["seen"])} for r in rows]


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
            conn.execute("INSERT INTO users (name, role, pin_hash, shop, created_at) VALUES (?, 'staff', ?, ?, ?)",
                         (form["name"], rules.hash_pin(form["pin"]), form.get("shop", ""), _utc_iso()))
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

