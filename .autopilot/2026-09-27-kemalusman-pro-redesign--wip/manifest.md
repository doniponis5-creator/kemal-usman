# Манифест требований

Источник: `2026-09-27-brief.md`. Строку из этого списка может снять **только пользователь**.

| ID | Из брифа (дословно) | Статус | Основание | Где |
|----|---------------------|--------|-----------|-----|
| R01 | «IOS ... versigani re dizayn qilamiz» | in-ticket | ясно из брифа, вопрос не нужен; ждёт спецификации | spec §3.1–3.2 → T02, T03 |
| R02 | «web deskop versigani re dizayn qilamiz» | in-ticket | ясно из брифа, вопрос не нужен; ждёт спецификации | spec §3.3 → T04 |
| R03 | «/impeccable qoidalari boyicha» | in-ticket | ясно из брифа, вопрос не нужен; ждёт спецификации | spec §4 → T01–T06 |
| R04 | «dizayn no proffesional bolganiligini inobatga olib polnyi tuzatamiz» | in-ticket | ясно из брифа, вопрос не нужен; ждёт спецификации | spec §3.2 (13–16h) → T02, T03, T06 |
| R05 | «/autopilot audit qil dizayn» | in-ticket | ясно из брифа, вопрос не нужен; ждёт спецификации | spec §3.5 (21) → T06 |
| R06 | «sistemnyi admin panelidagi hatolarni kor» | in-ticket | ясно из брифа, вопрос не нужен; ждёт спецификации | spec §3.4, §3.5 (22) → T05, T06 |
| R07 | «tavsiyalaringni ayt» | in-ticket | ясно из брифа, вопрос не нужен; ждёт спецификации | spec §3.5 (23) → T06 |
| R08 | «parfum dizaynlarga tavsiyalaring» | in-ticket | ясно из брифа, вопрос не нужен; ждёт спецификации | spec §3.2, §3.5 (24) → T02, T04, T06 |
| R09 | «qanaqa rang ishlatelik» | in-ticket | пользователь выбрал «B · Fil suyagi galereya» после просмотра макетов; обоснование палитры — в отчёте | spec §4.1, §3.5 (25) → T01, T06 |
| R10 | «hamma hammasini okib yozib chiq» | in-ticket | ясно из брифа, вопрос не нужен; ждёт спецификации | spec §3.5 → T06 |
| R11 | «PRO market qilelik Kemalusmandi» | in-ticket | ясно из брифа, вопрос не нужен; ждёт спецификации | spec §3.2–3.3, 16k, 26 → T02–T04, T06 |
| R12 | «/graphify» (+ «kegin /graphify ga yoz hammasini») | in-ticket | ясно из брифа, вопрос не нужен; ждёт спецификации | spec §3.6 (27) → финал (Phase 8) |
| R13 | «/impeccable /polish» | in-ticket | ясно из брифа, вопрос не нужен; ждёт спецификации | spec §3.2 (polish) → T06 |
| R14 | «githubka push qilishdan oldin» (+ «va git ga commit qil», «ohirida githubka push qil !») | in-ticket | пользователь явно разрешил commit + push в конце | spec §3.6 (29) → финал (Phase 8) |
| R15i | *(подразумевается)* найденные ошибки админки — исправить или только описать? | in-ticket | клиентский код — исправить (решение semi); серверные хуки/правила — пользователь: «Faqat hisobotga yoz» | spec §3.4 (клиент); серверное — §6 deferred → T03, T05; сервер — deferred |
| R16i | *(подразумевается)* редизайн не ломает работающую логику: заказы, оплата, бонусы, вход | in-ticket | ясно из брифа, вопрос не нужен; ждёт спецификации | spec §3.6 (30), §5 → все таски + финал |
| R17i | *(подразумевается)* админ-панель тоже входит в редизайн «IOS va web deskop versiya» | in-ticket | РЕШЕНО (semi): админка получает новую палитру/токены и исправление несогласованностей; полной перерисовки раскладки нет (режим Operate) | spec §3.4 (42–44) → T05 |
| R18i | *(подразумевается, память пользователя)* после изменений — сборка в симулятор + открыть Xcode | in-ticket | из памяти: «After every task/fix… build… simulator… open App.xcodeproj» | spec §3.6 (28) → финал (Phase 8) |
| R19i | *(подразумевается)* новая палитра применяется в редизайне, а не только советуется | in-ticket | подтверждено выбором пользователя (вариант B) | spec §3.1 → T01 |
| R20i | *(подразумевается)* бренд сохраняется: имя Kemal Usman, фото, логотип | in-ticket | РЕШЕНО (semi): имя, фото на входе, KU-логотип, курсивный словесный знак сохраняются; опечатка «Kemal Ussman» в баннерах — это картинки пользователя, только в отчёт | spec §3.1 (5), 16g → T01, T03 |
| G01 | «Kemal tanlovi» — бейдж «By KemalUsman» означает подборку основателя | in-ticket | пользователь, ответ на вопрос о бейдже; переименовать в «Выбор Кемаля», без короны/золота, подборка-фильтр | spec 16a → T02, T04 |
