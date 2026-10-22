"""
База кассы — один файл SQLite (KASSA_DB, по умолчанию data/kassa.db). Свой сервер, свои данные: ничего общего с Smart Centr.

SQLite, а не отдельный PostgreSQL: два магазина и несколько продавцов — это сотни операций в день, файл с ними
справляется; копия базы — копия одного файла. Режим WAL: телефон читает, пока программа 1С пишет.

Таблицы:
  items     — товары из 1С: остаток и цена по магазинам (JSON), единица (мл, шт)
  shops     — магазины (склады 1С) и их кассы: наличные и перевод
  users     — кто работает в кассе; PIN только хешем; shop — свой магазин сотрудника ('' — любой)
  sessions  — входы с телефонов (кука на 30 дней)
  ops       — операции с телефона; id даёт телефон (повтор не создаёт дубль);
              status: new → done | failed; отмена: new → cancelled, done/failed → cancelling → cancelled (1С распровела)
  sync_log  — когда 1С была на связи
  settings  — разное (ключ → значение)
Время — UTC в ISO; на телефон уходит бишкекское (UTC+6).
"""
from __future__ import annotations

import json
import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path

SCHEMA = """
CREATE TABLE IF NOT EXISTS items (
    id          TEXT PRIMARY KEY,
    code        TEXT NOT NULL DEFAULT '',
    name        TEXT NOT NULL,
    article     TEXT NOT NULL DEFAULT '',
    grp         TEXT NOT NULL DEFAULT '',
    unit        TEXT NOT NULL DEFAULT '',
    stock       TEXT NOT NULL DEFAULT '{}',
    price       TEXT NOT NULL DEFAULT '{}',
    updated_at  TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS shops (
    name          TEXT PRIMARY KEY,
    cash_desk     TEXT NOT NULL DEFAULT '',
    transfer_desk TEXT NOT NULL DEFAULT '',
    sort          INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS users (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    role        TEXT NOT NULL DEFAULT 'staff',
    pin_hash    TEXT NOT NULL,
    active      INTEGER NOT NULL DEFAULT 1,
    shop        TEXT NOT NULL DEFAULT '',
    created_at  TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
    token       TEXT PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    device      TEXT NOT NULL DEFAULT '',
    created_at  TEXT NOT NULL,
    last_seen   TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS ops (
    id          TEXT PRIMARY KEY,
    kind        TEXT NOT NULL,
    payload     TEXT NOT NULL,
    user_id     INTEGER,
    user_name   TEXT NOT NULL DEFAULT '',
    shop        TEXT NOT NULL DEFAULT '',
    status      TEXT NOT NULL DEFAULT 'new',
    docs        TEXT,
    error       TEXT,
    created_at  TEXT NOT NULL,
    done_at     TEXT
);
CREATE INDEX IF NOT EXISTS ops_status ON ops (status, created_at);
CREATE INDEX IF NOT EXISTS ops_created ON ops (created_at);
CREATE TABLE IF NOT EXISTS sync_log (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    kind        TEXT NOT NULL,
    items       INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS settings (
    key         TEXT PRIMARY KEY,
    value       TEXT NOT NULL DEFAULT ''
);
-- Этап 2. Долги покупателей из 1С (реализации с неоплаченным остатком), статьи расходов, деньги в кассах 1С.
CREATE TABLE IF NOT EXISTS debts (
    id          TEXT PRIMARY KEY,               -- uuid реализации
    doc         TEXT NOT NULL DEFAULT '',
    date        TEXT NOT NULL DEFAULT '',
    client_id   TEXT NOT NULL DEFAULT '',
    client_name TEXT NOT NULL DEFAULT '',
    phones      TEXT NOT NULL DEFAULT '',
    shop        TEXT NOT NULL DEFAULT '',
    total       REAL NOT NULL DEFAULT 0,
    left_sum    REAL NOT NULL DEFAULT 0,
    schedule    TEXT NOT NULL DEFAULT '[]',      -- только неоплаченные части [{date, sum}]
    updated_at  TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS articles (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    uses        INTEGER NOT NULL DEFAULT 0
);
-- Сайт ↔ 1С (только наличие): копия каталога сайта и связи «товар сайта → товар 1С», их подтверждает владелец.
CREATE TABLE IF NOT EXISTS site_products (
    id          TEXT PRIMARY KEY,               -- id товара в PocketBase сайта
    name        TEXT NOT NULL DEFAULT '',
    brand       TEXT NOT NULL DEFAULT '',
    category    TEXT NOT NULL DEFAULT '',
    variants    TEXT NOT NULL DEFAULT '[]',
    fetched_at  TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS site_links (
    product_id  TEXT PRIMARY KEY,
    status      TEXT NOT NULL DEFAULT 'linked',  -- linked | none (в 1С такого нет — не трогать)
    item_id     TEXT NOT NULL DEFAULT '',        -- товар 1С в мл (варианты «5 мл», «10 мл»…)
    pkg_item_id TEXT NOT NULL DEFAULT '',        -- штучный товар 1С для «Упаковки» (необязательно)
    user_name   TEXT NOT NULL DEFAULT '',
    updated_at  TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS balances (
    name        TEXT PRIMARY KEY,               -- касса 1С
    amount      REAL NOT NULL DEFAULT 0
);
"""

# Колонки, которых не было в этапе 1: (таблица, колонка, описание). SQLite не умеет «ADD COLUMN IF NOT EXISTS».
COLUMNS = (
    ("items", "cost", "REAL NOT NULL DEFAULT 0"),              # себестоимость за единицу из 1С
    ("users", "bonus_pct", "REAL NOT NULL DEFAULT 10"),        # бонус продавца, % от прибыли его продаж
)


def path() -> Path:
    return Path(os.environ.get("KASSA_DB") or Path(__file__).resolve().parents[1] / "data" / "kassa.db")


def connect() -> sqlite3.Connection:
    db_path = path()
    db_path.parent.mkdir(parents=True, exist_ok=True)
    # autocommit (транзакции — через tx()); одно соединение — один запрос, но FastAPI может открыть его в другом потоке
    conn = sqlite3.connect(db_path, timeout=10, isolation_level=None, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA busy_timeout = 10000")
    return conn


def init() -> None:
    conn = connect()
    try:
        conn.executescript(SCHEMA)
        for table, column, spec in COLUMNS:
            if column not in [r[1] for r in conn.execute(f"PRAGMA table_info({table})")]:
                conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {spec}")
    finally:
        conn.close()


@contextmanager
def tx(conn: sqlite3.Connection):
    """Одна запись целиком или ничего: BEGIN IMMEDIATE — второй писатель ждёт, а не портит."""
    conn.execute("BEGIN IMMEDIATE")
    try:
        yield conn
    except BaseException:
        conn.execute("ROLLBACK")
        raise
    else:
        conn.execute("COMMIT")


def loads(value, default):
    if value is None or value == "":
        return default
    try:
        return json.loads(value)
    except (TypeError, ValueError):
        return default


def dumps(value) -> str:
    return json.dumps(value, ensure_ascii=False)
