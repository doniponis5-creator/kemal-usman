"""
Программа кассы на компьютере магазина Kemal Usman: связывает 1С Kemal с сервером кассы.

  python kassa_agent.py run              работать всё время (так запускает задача Windows «Kemal касса»)
  python kassa_agent.py once             один круг: товары → сервер, продажи → 1С (для проверки)
  python kassa_agent.py setup            проверить настройки, кассы «Перевод <магазин>» в 1С; --apply — завести недостающие
  python kassa_agent.py owner-pin        задать PIN владельца (вводится скрыто, на сервер уходит с подписью)

Что делает в работе:
  — раз в 2 минуты читает из 1С товары, остатки и цены двух магазинов и шлёт на сервер, если что-то изменилось;
  — ждёт продажи с телефонов (сервер отвечает сразу, как продажа появилась) и проводит их в 1С: реализация + ПКО;
  — отмену проведённой продажи с телефона распроводит в 1С.
1С может быть открыта у продавца — программа подключается к той же базе отдельно (файловая база это позволяет).
Простаивает 10 минут — отключается от 1С, чтобы база была свободна (например, для обновления).

Настройки — файл agent.env рядом с программой (образец agent.env.example), переменные окружения важнее файла:
  KASSA_URL, KASSA_1C_SECRET, ONEC_BASE, ONEC_USER, ONEC_PASSWORD, KASSA_SHOPS.
"""
from __future__ import annotations

import getpass
import json
import logging
import os
import sys
import time
from logging.handlers import RotatingFileHandler
from pathlib import Path

import httpx

import onec_kemal as onec
import onec_kemal_stage2 as stage2

HERE = Path(__file__).resolve().parent
SNAPSHOT_EVERY = 120        # секунд между проверками товаров в 1С
RESEND_EVERY = 1800         # даже без изменений — полный список раз в 30 минут
IDLE_RELEASE = 600          # без работы 10 минут — отключиться от 1С
WAIT_SEC = 20

log = logging.getLogger("kemal-kassa")


def load_env() -> dict:
    values = {}
    env_file = Path(os.environ.get("KASSA_AGENT_ENV") or HERE / "agent.env")
    if env_file.exists():
        for line in env_file.read_text(encoding="utf-8-sig").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, value = line.split("=", 1)
                values[key.strip()] = value.strip().strip('"').strip("'")
    for key in ("KASSA_URL", "KASSA_1C_SECRET", "ONEC_BASE", "ONEC_USER", "ONEC_PASSWORD", "KASSA_SHOPS"):
        if os.environ.get(key):
            values[key] = os.environ[key]
    return values


def shops_from(cfg: dict) -> list[dict]:
    """KASSA_SHOPS: магазины через «;». У каждого можно указать кассы: «Склад|Касса наличных|Касса перевода»."""
    raw = cfg.get("KASSA_SHOPS") or "Kemal Usman Parfume;Kemal Usman Parfume Osh"
    out = []
    for part in raw.split(";"):
        bits = [b.strip() for b in part.split("|")]
        if bits[0]:
            out.append({"name": bits[0], "cashDesk": bits[1] if len(bits) > 1 and bits[1] else "Касса " + bits[0],
                        "transferDesk": bits[2] if len(bits) > 2 and bits[2] else "Перевод " + bits[0]})
    return out


class Agent:
    def __init__(self, cfg: dict):
        missing = [k for k in ("KASSA_URL", "KASSA_1C_SECRET", "ONEC_BASE", "ONEC_USER") if not cfg.get(k)]
        if missing:
            raise SystemExit("В agent.env не хватает: " + ", ".join(missing))
        self.cfg = cfg
        self.url = cfg["KASSA_URL"].rstrip("/")
        self.secret = cfg["KASSA_1C_SECRET"]
        self.shops = shops_from(cfg)
        self.http = httpx.Client(timeout=WAIT_SEC + 25)
        self.s = None
        self.last_used = 0.0
        self.last_snapshot = 0.0
        self.last_sent = 0.0
        self.sent_print = ""

    # ── связь ──
    def one_c(self):
        if self.s is None:
            log.info("подключаюсь к 1С: %s", self.cfg["ONEC_BASE"])
            self.s = onec.connect(self.cfg["ONEC_BASE"], self.cfg["ONEC_USER"], self.cfg.get("ONEC_PASSWORD", ""))
        self.last_used = time.monotonic()
        return self.s

    def release(self):
        if self.s is not None:
            self.s = None
            import gc
            gc.collect()
            log.info("отключился от 1С (простой)")

    def post(self, path: str, data: dict) -> httpx.Response:
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        from hashlib import sha256
        import hmac
        sign = hmac.new(self.secret.encode("utf-8"), body, sha256).hexdigest()
        return self.http.post(self.url + path, content=body, headers={"X-Signature": sign, "Content-Type": "application/json"})

    def get(self, path: str, **params) -> httpx.Response:
        return self.http.get(self.url + path, params=params, headers={"X-Api-Key": self.secret})

    # ── работа ──
    def send_items(self, force: bool = False) -> None:
        items = onec.snapshot(self.one_c(), [s["name"] for s in self.shops])
        more = stage2.extras(self.one_c())      # долги, статьи расходов, деньги в кассах
        self.last_snapshot = time.monotonic()
        print_ = onec.fingerprint(items + [more])
        if not force and print_ == self.sent_print and time.monotonic() - self.last_sent < RESEND_EVERY:
            return
        r = self.post("/api/1c/sync", {"shops": self.shops, "items": items, "full": True, **more})
        r.raise_for_status()
        self.sent_print, self.last_sent = print_, time.monotonic()
        log.info("товары → сервер: %s", r.json())

    def handle(self, answer: dict) -> bool:
        worked = False
        shops = {s["name"]: s for s in self.shops}
        for op_id in answer.get("cancels") or []:
            count = onec.cancel_sale(self.one_c(), op_id)
            self.post(f"/api/1c/ops/{op_id}/cancelled", {"docs": count}).raise_for_status()
            log.info("отмена %s: документов распроведено %s", op_id, count)
            worked = True
        for op in answer.get("ops") or []:
            worked = True
            try:
                docs = onec.post_op(self.one_c(), op, shops)
            except Exception as error:   # noqa: BLE001 — любую причину показать владельцу на телефоне
                reason = str(error) if isinstance(error, onec.OneCError) else onec._com_text(error)
                log.warning("%s %s не провелась: %s", op.get("kind"), op["id"], reason)
                self.post(f"/api/1c/ops/{op['id']}/failed", {"reason": reason[:900]})
                continue
            r = self.post(f"/api/1c/ops/{op['id']}/done", {"docs": docs})
            if r.status_code == 409:
                # Пока проводили, продажу отменили с телефона — документы не нужны.
                onec.cancel_sale(self.one_c(), op["id"])
                log.info("продажа %s отменена с телефона во время проведения — распровёл", op["id"])
            else:
                r.raise_for_status()
                log.info("%s %s проведена: %s", op.get("kind"), op["id"], ", ".join(f"{d['type']} {d['number']}" for d in docs))
        return worked

    def cycle(self, wait: int = WAIT_SEC) -> bool:
        if time.monotonic() - self.last_snapshot >= SNAPSHOT_EVERY or not self.sent_print:
            self.send_items()
        r = self.get("/api/1c/wait", sec=wait)
        r.raise_for_status()
        worked = self.handle(r.json())
        if worked:
            self.send_items()       # остаток на телефоне — сразу после проведения
        elif self.s is not None and time.monotonic() - self.last_used > IDLE_RELEASE:
            self.release()
        return worked

    def run(self) -> None:
        log.info("касса Kemal: старт, сервер %s, магазины: %s", self.url, ", ".join(s["name"] for s in self.shops))
        pause = 5
        while True:
            try:
                self.cycle()
                pause = 5
            except httpx.HTTPError as error:
                log.warning("сервер не ответил (%s) — повтор через %s с", type(error).__name__, pause)
                time.sleep(pause)
                pause = min(pause * 2, 120)
            except Exception as error:   # noqa: BLE001 — 1С занята / закрыта на обновление: подождать и снова
                log.warning("1С: %s — повтор через %s с", onec._com_text(error) if not isinstance(error, onec.OneCError) else error, pause)
                self.release()
                time.sleep(pause)
                pause = min(pause * 2, 120)


def setup_logging() -> None:
    logs = HERE / "logs"
    logs.mkdir(exist_ok=True)
    handler = RotatingFileHandler(logs / "kassa_agent.log", maxBytes=2_000_000, backupCount=5, encoding="utf-8")
    handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
    # В задаче Windows программа идёт через pythonw: окна нет, sys.stdout = None — пишем только в журнал.
    logging.basicConfig(level=logging.INFO, handlers=[handler] + ([logging.StreamHandler(sys.stdout)] if sys.stdout else []))


def main() -> None:
    if sys.stdout:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    setup_logging()
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    cfg = load_env()
    if cmd == "run":
        Agent(cfg).run()
    elif cmd == "once":
        agent = Agent(cfg)
        agent.send_items(force=True)
        print("проведено/отменено:" if agent.cycle(wait=0) else "новых продаж нет")
    elif cmd == "setup":
        agent = Agent(cfg)
        for note in onec.ensure_desks(agent.one_c(), agent.shops, create="--apply" in sys.argv):
            print("•", note)
        r = agent.get("/api/1c/wait", sec=0)
        print("• сервер:", "на связи" if r.status_code == 200 else f"ответил {r.status_code} (проверьте KASSA_URL и KASSA_1C_SECRET)")
    elif cmd == "owner-pin":
        agent = Agent(cfg)
        pin = getpass.getpass("Новый PIN владельца (4–6 цифр, не видно при вводе): ")
        if getpass.getpass("Ещё раз: ") != pin:
            raise SystemExit("PIN не совпал — ничего не изменено")
        r = agent.post("/api/1c/owner-pin", {"pin": pin, "name": "Владелец"})
        print("PIN владельца задан" if r.status_code == 200 else f"Не получилось: {r.status_code} {r.text[:200]}")
    else:
        print(__doc__)


if __name__ == "__main__":
    main()
