window.STATE =
{
  "slug": "kemalusman-pro-redesign",
  "dir": "2026-09-27-kemalusman-pro-redesign--wip",
  "title": "Kemal Usman — PRO redizayn (iOS + desktop) va admin audit",
  "mode": "semi",
  "depth": "deep",
  "polish": null,
  "tier": "T2",
  "briefFile": "2026-09-27-brief.md",
  "memoryFile": "CLAUDE.md",
  "skillDir": "/Users/doniyorabduganiev/.claude/skills/autopilot",
  "startedAt": "2026-09-27T23:27:26+06:00",
  "updatedAt": "2026-09-28T00:21:08+06:00",
  "finishedAt": null,
  "stages": [
    {
      "id": "preflight",
      "status": "done",
      "startedAt": "2026-09-27T23:27:26+06:00",
      "finishedAt": "2026-09-27T23:29:16+06:00"
    },
    {
      "id": "manifest",
      "status": "done",
      "startedAt": "2026-09-27T23:28:40+06:00",
      "finishedAt": "2026-09-27T23:29:16+06:00"
    },
    {
      "id": "briefing",
      "status": "done",
      "startedAt": "2026-09-27T23:29:16+06:00",
      "finishedAt": "2026-09-27T23:46:24+06:00"
    },
    {
      "id": "spec",
      "status": "done",
      "startedAt": "2026-09-27T23:46:24+06:00",
      "finishedAt": "2026-09-28T00:21:08+06:00"
    },
    {
      "id": "plan",
      "status": "active",
      "startedAt": "2026-09-28T00:21:08+06:00",
      "note": "6 тасков, ярус T2, 4 волны"
    },
    {
      "id": "build",
      "status": "pending"
    },
    {
      "id": "review",
      "status": "pending"
    },
    {
      "id": "final",
      "status": "pending"
    }
  ],
  "requirements": {
    "total": 20,
    "done": 0,
    "inTicket": 21,
    "inSpec": 0,
    "placeholder": 0,
    "deferred": 0,
    "dropped": 0
  },
  "tickets": [
    {
      "id": "01",
      "title": "Фундамент: палитра B, шрифт, нативная оболочка",
      "requirements": [
        "R09",
        "R19i",
        "R01.1",
        "R03",
        "R20i"
      ],
      "blockedBy": [],
      "wave": 1,
      "zone": [
        "src/index.css",
        "src/theme.js",
        "src/components/",
        "ios/App/App/"
      ],
      "status": "pending",
      "retries": 0,
      "repairs": 0,
      "handoffs": 0
    },
    {
      "id": "02",
      "title": "Каталог, карточка и страница товара (телефон)",
      "requirements": [
        "R01",
        "R04",
        "R08",
        "R11",
        "G01"
      ],
      "blockedBy": [
        "01"
      ],
      "wave": 2,
      "zone": [
        "src/App.jsx (каталог/товар)",
        "src/i18n/"
      ],
      "status": "pending",
      "retries": 0,
      "repairs": 0,
      "handoffs": 0
    },
    {
      "id": "04",
      "title": "Сайт на компьютере",
      "requirements": [
        "R02",
        "R03",
        "R04",
        "R08",
        "G01"
      ],
      "blockedBy": [
        "01"
      ],
      "wave": 2,
      "zone": [
        "src/screens/DesktopLayout.jsx"
      ],
      "status": "pending",
      "retries": 0,
      "repairs": 0,
      "handoffs": 0
    },
    {
      "id": "05",
      "title": "Админка: ошибки и единый вид",
      "requirements": [
        "R06",
        "R15i",
        "R17i"
      ],
      "blockedBy": [
        "01"
      ],
      "wave": 2,
      "zone": [
        "src/screens/AdminScreens.jsx",
        "src/api/"
      ],
      "status": "pending",
      "retries": 0,
      "repairs": 0,
      "handoffs": 0
    },
    {
      "id": "03",
      "title": "Корзина → заказ → профиль, вход; админ-правки в App.jsx",
      "requirements": [
        "R01",
        "R04",
        "R11",
        "R15i",
        "R20i",
        "A01"
      ],
      "blockedBy": [
        "01",
        "02"
      ],
      "wave": 3,
      "zone": [
        "src/App.jsx (остальное)",
        "src/i18n/"
      ],
      "status": "pending",
      "retries": 0,
      "repairs": 0,
      "handoffs": 0
    },
    {
      "id": "06",
      "title": "Финальный polish и письменный отчёт",
      "requirements": [
        "R05",
        "R07",
        "R08",
        "R09",
        "R10",
        "R11",
        "R13"
      ],
      "blockedBy": [
        "02",
        "03",
        "04",
        "05"
      ],
      "wave": 4,
      "zone": [
        "src/ (механика)",
        "docs/"
      ],
      "status": "pending",
      "retries": 0,
      "repairs": 0,
      "handoffs": 0
    }
  ],
  "singlePass": null,
  "tests": null,
  "debt": {
    "placeholders": [],
    "assumptions": [],
    "emptyEnv": []
  },
  "additions": [],
  "coverage": {
    "findings": 8,
    "missing": 0,
    "half": 8,
    "extra": 21,
    "action": "8 половинчатых дописаны в spec (полнота, PRO-метрика, polish-история, graphify всё, порядок push, тёмные статус-токены + plinth, смысл «оригинальные», десктоп-форма); лишнее — deepening R08/R09/R11 и R15i/R17i по решениям semi, A01 с родителем R11"
  },
  "concerns": [],
  "reviewers": {
    "manifestSpec": null,
    "craft": null
  },
  "blind": null
}
