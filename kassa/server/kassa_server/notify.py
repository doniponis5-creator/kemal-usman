"""
Этап 3: связь кассы с другими системами Kemal Usman.

Бонусы клуба — в PocketBase сайта (clients.bonus_balance), обработчик pb_hooks/kassa.pb.js:
  KASSA_CLUB_URL  — адрес PocketBase, например https://api.kemalusman.kg
  KASSA_CLUB_KEY  — тот же ключ, что в pb_data/kassa_credentials.json на сервере PocketBase
WhatsApp — свой Green API Kemal (не Smart Centr):
  GREEN_API_INSTANCE, GREEN_API_TOKEN, GREEN_API_HOST (по умолчанию https://api.green-api.com)
Нет ключей — «пробный режим»: бонусов нет, WhatsApp не уходит (в ответе dry), касса продаёт как обычно.
"""
from __future__ import annotations

import logging
import os

import httpx

logger = logging.getLogger("kassa.notify")
TIMEOUT = 12


def club_on() -> bool:
    return bool(os.environ.get("KASSA_CLUB_URL") and os.environ.get("KASSA_CLUB_KEY"))


def club(action: str, **data) -> dict:
    """Запрос к PocketBase. Ответ — JSON обработчика + status; нет связи — {ok: False, error: 'offline'}."""
    if not club_on():
        return {"ok": False, "error": "off", "status": 0}
    try:
        r = httpx.post(os.environ["KASSA_CLUB_URL"].rstrip("/") + "/api/custom/kassa/club", json={"action": action, **data},
                       headers={"X-Kassa-Key": os.environ["KASSA_CLUB_KEY"]}, timeout=TIMEOUT)
        body = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
        return {**body, "status": r.status_code}
    except (httpx.HTTPError, ValueError) as error:
        logger.warning("club %s: %s", action, type(error).__name__)
        return {"ok": False, "error": "offline", "status": 0}


def site_catalog() -> list[dict] | None:
    """Все товары сайта (открытый список PocketBase). Нет связи — None."""
    if not club_on():
        return None
    base = os.environ["KASSA_CLUB_URL"].rstrip("/") + "/api/collections/products/records"
    out, page = [], 1
    try:
        while page < 50:
            data = httpx.get(base, params={"perPage": 500, "page": page, "fields": "id,name,brand,category,variants"}, timeout=30).json()
            out += data.get("items") or []
            if page >= int(data.get("totalPages") or 1):
                return out
            page += 1
    except (httpx.HTTPError, ValueError) as error:
        logger.warning("каталог сайта: %s", type(error).__name__)
    return None


def site_stock(updates: list[dict]) -> dict:
    """Наличие вариантов на сайт (pb_hooks/kassa.pb.js → /api/custom/kassa/stock)."""
    if not club_on():
        return {"ok": False, "error": "off"}
    try:
        r = httpx.post(os.environ["KASSA_CLUB_URL"].rstrip("/") + "/api/custom/kassa/stock", json={"updates": updates},
                       headers={"X-Kassa-Key": os.environ["KASSA_CLUB_KEY"]}, timeout=60)
        return {**(r.json() if r.headers.get("content-type", "").startswith("application/json") else {}), "status": r.status_code}
    except (httpx.HTTPError, ValueError) as error:
        logger.warning("наличие на сайт: %s", type(error).__name__)
        return {"ok": False, "error": "offline"}


def whatsapp_on() -> bool:
    return bool(os.environ.get("GREEN_API_INSTANCE") and os.environ.get("GREEN_API_TOKEN"))


def whatsapp(phone: str, text: str) -> dict:
    """Текст в WhatsApp на номер 996XXXXXXXXX. Нет ключей — пробный режим (ничего не уходит)."""
    digits = "".join(ch for ch in str(phone or "") if ch.isdigit())
    if len(digits) != 12:
        return {"ok": False, "error": "нет номера покупателя"}
    if not whatsapp_on():
        logger.info("whatsapp (пробный режим) …%s", digits[-4:])
        return {"ok": True, "dry": True}
    host = os.environ.get("GREEN_API_HOST", "https://api.green-api.com").rstrip("/")
    url = f"{host}/waInstance{os.environ['GREEN_API_INSTANCE']}/sendMessage/{os.environ['GREEN_API_TOKEN']}"
    try:
        r = httpx.post(url, json={"chatId": digits + "@c.us", "message": text[:4000]}, timeout=TIMEOUT)
        if r.status_code == 200 and (r.json() or {}).get("idMessage"):
            return {"ok": True}
        logger.warning("whatsapp: Green API %s", r.status_code)
    except (httpx.HTTPError, ValueError) as error:
        logger.warning("whatsapp: %s", type(error).__name__)
    return {"ok": False, "error": "WhatsApp не принял сообщение — попробуйте позже"}
