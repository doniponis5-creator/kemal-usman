// Проверка консультанта «Спросить» на рабочем сервере: настроен ли ключ, сколько
// вызовов сегодня и последние ошибки из журнала PocketBase.
// Запуск владельцем: node scripts/assistant-diag.mjs
// Логин админа берётся из .env (PB_ADMIN_EMAIL / PB_ADMIN_PASSWORD); пароли и ключи не печатаются.
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^['"]|['"]$/g, '')]; }),
);
const PB = (env.VITE_PB_URL || 'https://api.kemalusman.kg').replace(/\/$/, '');
const body = JSON.stringify({ identity: env.PB_ADMIN_EMAIL, password: env.PB_ADMIN_PASSWORD });
const headers = { 'content-type': 'application/json' };

let auth = await fetch(`${PB}/api/admins/auth-with-password`, { method: 'POST', headers, body });
if (!auth.ok) auth = await fetch(`${PB}/api/collections/_superusers/auth-with-password`, { method: 'POST', headers, body });
if (!auth.ok) { console.log('❌ Вход в PocketBase не удался (HTTP ' + auth.status + ')'); process.exit(1); }
const token = (await auth.json()).token;
const h = { Authorization: token };

const usage = await fetch(`${PB}/api/custom/assistant/usage`, { headers: h });
console.log('— Настройка консультанта —');
console.log(usage.ok ? JSON.stringify(await usage.json(), null, 2) : 'usage HTTP ' + usage.status);

const filter = encodeURIComponent("message ~ 'assistant'");
const logs = await fetch(`${PB}/api/logs?perPage=5&sort=-created&filter=${filter}`, { headers: h });
console.log('\n— Последние записи журнала —');
if (!logs.ok) { console.log('logs HTTP ' + logs.status); process.exit(0); }
for (const it of (await logs.json()).items || []) {
  const d = { ...(it.data || {}) };
  for (const k of Object.keys(d)) if (/key|token|auth|password/i.test(k)) delete d[k];
  console.log(`${it.created}  ${it.level}  ${it.message}\n  ${JSON.stringify(d).slice(0, 600)}`);
}
