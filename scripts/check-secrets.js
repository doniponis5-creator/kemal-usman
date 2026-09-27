// scripts/check-secrets.js
// Parollar oqib ketganmi va serverdagi bilan bir xilmi — tekshiruv.
//
// Hech qanday parol ekranga chiqmaydi — faqat ✅ / ❌ / ⚠️.
//   1. Git tarixidan (GitHub'dagi eski versiyalar ham) ochiq yozilgan
//      parol/tokenlarni yig'adi — "oqib ketganlar" ro'yxati.
//   2. SSH orqali serverga kiradi. Serverdan parolning o'zi emas, faqat
//      sha256 "barmoq izi" qaytadi. Shu iz .env dagi va oqib ketgan
//      qiymatlarning izi bilan solishtiriladi.
//   3. PocketBase admin: .env dagi parol serverda ishlaydimi va eski
//      oqib ketgan parollar hali ham ishlaydimi — tekshiradi.
//
// Ishga tushirish:   npm run check:secrets
// Serversiz (faqat .env va git tarixi):   npm run check:secrets -- --no-server

import * as dotenv from 'dotenv';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import readline from 'node:readline';

dotenv.config();

const VPS = 'root@145.223.100.16';
const PB_URL = (process.env.VITE_PB_URL || 'https://api.kemalusman.kg').replace(/\/$/, '');
const NO_SERVER = process.argv.includes('--no-server');

// Server kalitlarni qayerdan o'qiydi (pb_hooks bilan bir xil):
//   avval ishlab turgan PocketBase jarayonining env'i (systemd Environment= yoki EnvironmentFile),
//   O!Dengi uchun env bo'sh bo'lsa — pb_data/odengi_credentials.json.
const SECRETS = [
  { key: 'ODENGI_PASSWORD', json: true, secret: true, local: true, missing: "Onlayn to'lov ishlamaydi." },
  { key: 'ODENGI_SID', json: true, secret: false, local: true, missing: "Onlayn to'lov ishlamaydi." }, // merchant ID — maxfiy emas
];

const sha = (s) => createHash('sha256').update(s, 'utf8').digest('hex');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ─── 1. Git tarixidan oqib ketgan qiymatlar ───────────────────────────────────
const SECRET_KEY = /pass|pwd|secret|token|api_?key|auth_?key|sid/i;
const ADMIN_EMAIL_KEY = /admin_?email|identity/i;
const PLACEHOLDER = /^(your[-_].*|example.*|x{3,}|placeholder|parol|password|secret|token|none|null|undefined|true|false)$|\.\.\.|\*\*\*|change_?me/i;
const PATTERNS = [
  /\b([A-Za-z_][A-Za-z0-9_]*)\s*[:=]\s*(['"`])([^'"`\s${}<>]{6,200})\2/g, // key = "value"
  /"([A-Za-z_][A-Za-z0-9_]*)"\s*:\s*"([^"\s${}<>]{6,200})"/g,           // "key": "value"
  /\b([A-Z][A-Z0-9_]{2,})=([^\s'"`${}<>#;&|)]{6,200})/g,                 // KEY=value
];

async function collectLeaked() {
  const leaked = new Map();      // sha -> { files:Set, isPassword:bool, value }
  const adminEmails = new Set();
  const git = spawn('git', ['log', '-p', '--all', '--no-color', '--format=%x00'], { stdio: ['ignore', 'pipe', 'ignore'] });
  const rl = readline.createInterface({ input: git.stdout, crlfDelay: Infinity });
  let file = '?';

  for await (const line of rl) {
    if (line.startsWith('diff --git ')) { file = line.split(' b/').pop(); continue; }
    if (!(line[0] === '+' || line[0] === '-') || line.startsWith('+++') || line.startsWith('---')) continue;
    const text = line.slice(1);
    for (const re of PATTERNS) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(text))) {
        const key = m[1];
        const value = m.length === 4 ? m[3] : m[2];
        if (ADMIN_EMAIL_KEY.test(key) && /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(value)) { adminEmails.add(value); continue; }
        if (!SECRET_KEY.test(key) || PLACEHOLDER.test(value)) continue;
        const h = sha(value);
        const entry = leaked.get(h) || { files: new Set(), isPassword: false, value };
        entry.files.add(file);
        if (/pass|pwd/i.test(key)) entry.isPassword = true;
        leaked.set(h, entry);
      }
    }
  }
  await new Promise((r) => git.on('close', r));
  return { leaked, adminEmails };
}

// ─── 2. Server'dagi qiymatlarning barmoq izlari (SSH) ─────────────────────────
// Server faqat sha256 izini qaytaradi. Parol tarmoqdan qaytib kelmaydi.
const REMOTE = String.raw`
F=/root/parfum-backend/pb_data/odengi_credentials.json
E=/etc/pocketbase/env
P=$(pgrep -f "pocketbase serve" | head -1)
h() { if [ -n "$1" ]; then printf %s "$1" | sha256sum | cut -c1-64; else echo none; fi; }
if [ -n "$P" ] && [ -r "/proc/$P/environ" ]; then echo "proc:RUNNING yes"; else echo "proc:RUNNING no"; fi
if [ -f "$F" ]; then
  echo "json:ODENGI_SID $(h "$(grep -o '"sid":"[^"]*"' "$F" | head -1 | sed 's/.*:"//; s/"$//')")"
  echo "json:ODENGI_PASSWORD $(h "$(grep -o '"password":"[^"]*"' "$F" | head -1 | sed 's/.*:"//; s/"$//')")"
fi
for k in ODENGI_SID ODENGI_PASSWORD; do
  v=""
  if [ -n "$P" ] && [ -r "/proc/$P/environ" ]; then
    v=$(tr '\0' '\n' < "/proc/$P/environ" | grep -E "^$k=" | tail -1 | cut -d= -f2-)
  fi
  echo "proc:$k $(h "$v")"
  v=""
  if [ -f "$E" ]; then
    v=$(grep -E "^[[:space:]]*(export[[:space:]]+)?$k=" "$E" | tail -1 | cut -d= -f2- | tr -d "\"'")
  fi
  echo "file:$k $(h "$v")"
done
`;

function serverFingerprints() {
  const r = spawnSync('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', VPS, 'bash -s'], { input: REMOTE, encoding: 'utf8' });
  if (r.status !== 0) return { error: (r.stderr || '').trim().split('\n').pop() || `ssh exit ${r.status}` };
  const out = {};
  for (const line of r.stdout.trim().split('\n')) {
    const [name, value] = line.split(' ');
    out[name] = value;
  }
  return { out };
}

// Server qaysi qiymatni HAQIQATDA ishlatadi — pb_hooks'dagi tartib bilan.
function effective(server, key, json) {
  const val = (v) => (v && v !== 'none' ? v : null);
  if (server['proc:RUNNING'] === 'yes') {
    if (val(server[`proc:${key}`])) return { hash: server[`proc:${key}`], from: 'ishlab turgan server' };
  } else if (val(server[`file:${key}`])) {
    return { hash: server[`file:${key}`], from: '/etc/pocketbase/env' };
  }
  if (json && val(server[`json:${key}`])) return { hash: server[`json:${key}`], from: 'pb_data/odengi_credentials.json' };
  return null;
}

// ─── 3. PocketBase admin login ────────────────────────────────────────────────
async function adminLogin(identity, password) {
  try {
    const res = await fetch(`${PB_URL}/api/admins/auth-with-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity, password }),
    });
    return res.status;
  } catch {
    return 0;
  }
}

// ─── Hisobot ──────────────────────────────────────────────────────────────────
const problems = [];
const bad = (msg, fix) => { console.log(`   ❌ ${msg}`); if (fix) problems.push(fix); };
const good = (msg) => console.log(`   ✅ ${msg}`);
const warn = (msg) => console.log(`   ⚠️  ${msg}`);
const where = (entry) => [...entry.files].slice(0, 2).join(', ');

async function main() {
  console.log('🔍 Git tarixidan oqib ketgan parollar yig\'ilmoqda...');
  const { leaked, adminEmails } = await collectLeaked();
  console.log(`   Git tarixida ${leaked.size} ta ochiq yozilgan parol/token topildi (qiymatlari ko'rsatilmaydi).\n`);

  let server = null;
  if (!NO_SERVER) {
    console.log(`🔐 Serverga kirilmoqda (${VPS})...`);
    const s = serverFingerprints();
    if (s.error) { warn(`Serverga kirib bo'lmadi: ${s.error}`); problems.push('SSH ishlamadi — internetni va SSH kalitni tekshiring.'); }
    else { good('Serverga kirildi.'); server = s.out; }
    console.log('');
  }

  if (server && server['proc:RUNNING'] !== 'yes') warn("PocketBase jarayoni topilmadi — /etc/pocketbase/env fayli bo'yicha tekshirilyapti.\n");

  // O!Dengi
  for (const { key, json, secret, local: needLocal, missing } of SECRETS) {
    console.log(`▸ ${key}${secret ? '' : ' (maxfiy emas)'}`);
    const local = process.env[key] || '';
    const eff = server ? effective(server, key, json) : null;
    const remote = eff?.hash || null;

    if (!local && needLocal) warn(`.env da yo'q. Qo'shing:  ${key}=...`);
    if (server && !remote) bad(`Serverda yo'q — ${missing}`, `${key}: serverga qo'shish kerak — ${missing}`);

    if (local && remote) {
      if (sha(local) === remote) good(`.env va server bir xil (${eff.from}).`);
      else if (json && eff.from.startsWith('pb_data')) bad(`.env va server BIR XIL EMAS (${eff.from}).`, `${key}: .env ga to'g'ri qiymatni yozing va  bash scripts/update-odengi-creds.sh  ni ishga tushiring.`);
      else bad(`.env va server BIR XIL EMAS (${eff.from}).`, `${key}: serverdagi PocketBase sozlamasini (systemd env) .env dagi qiymat bilan yangilang.`);
    }

    if (secret) {
      if (local && leaked.has(sha(local))) bad(`.env dagi qiymat git tarixida bor (${where(leaked.get(sha(local)))}).`, `${key}: yangi qiymat oling (almashtiring) va .env ga yozing.`);
      else if (local) good('.env dagi qiymat git tarixida yo\'q.');
      if (remote && leaked.has(remote)) bad(`Serverdagi qiymat git tarixida bor (${where(leaked.get(remote))}) — hozir ham oqib ketgan qiymat ishlatilyapti!`, `${key}: yangi qiymat oling (almashtiring) va serverga joylang.`);
      else if (remote) good('Serverdagi qiymat git tarixida yo\'q.');
    }
    console.log('');
  }

  // PocketBase admin
  console.log('▸ PocketBase admin paroli');
  const email = process.env.PB_ADMIN_EMAIL || '';
  const pass = process.env.PB_ADMIN_PASS || process.env.PB_ADMIN_PASSWORD || '';
  const ADMIN_FIX = `PocketBase admin: ${PB_URL}/_/ ga kiring → Settings → Admins → yangi kuchli parol qo'ying va .env dagi PB_ADMIN_PASS ga yozing.`;
  if (!email || !pass) warn('.env da PB_ADMIN_EMAIL yoki PB_ADMIN_PASS yo\'q.');
  if (pass && leaked.has(sha(pass))) bad(`.env dagi admin paroli git tarixida bor (${where(leaked.get(sha(pass)))}).`, ADMIN_FIX);
  else if (pass) good('.env dagi admin paroli git tarixida yo\'q.');

  if (!NO_SERVER) {
    if (email && pass) {
      const code = await adminLogin(email, pass);
      if (code === 200) good('.env dagi parol serverda ishlaydi — bir xil.');
      else if (code === 400) bad('.env dagi parol serverdagi bilan BIR XIL EMAS.', 'PB_ADMIN_PASS: .env ga serverdagi haqiqiy admin parolini yozing.');
      else warn(`Serverga ulanib bo'lmadi (javob: ${code || 'tarmoq xatosi'}).`);
    }

    // Eski oqib ketgan parollar bilan kirib ko'rish
    const emails = [...new Set([email, ...adminEmails].filter(Boolean))].slice(0, 3);
    const candidates = [...leaked.values()].filter((e) => e.isPassword && e.value !== pass).slice(0, 15);
    if (emails.length && candidates.length) console.log(`   … eski ${candidates.length} ta oqib ketgan parol serverda sinalmoqda (~${Math.ceil(emails.length * candidates.length * 0.7)} soniya, kuting)`);
    let stillWorks = 0;
    let unknown = 0;
    for (const id of emails) {
      for (const c of candidates) {
        const code = await adminLogin(id, c.value);
        if (code === 200) { stillWorks++; bad(`Eski oqib ketgan parol HALI ISHLAYAPTI — ${id} (${where(c)}).`, ADMIN_FIX); }
        else if (code !== 400) unknown++;
        await sleep(600);
      }
    }
    if (unknown) warn(`${unknown} ta sinovga server javob bermadi (tarmoq yoki cheklov). 5 daqiqadan keyin qayta ishga tushiring.`);
    else if (emails.length && candidates.length && !stillWorks) good(`Eski oqib ketgan parollarning hech biri serverda ishlamaydi (${candidates.length} ta sinaldi).`);
  }
  console.log('');

  // Xulosa
  const fixes = [...new Set(problems)];
  if (!fixes.length) console.log('🎉 Hammasi joyida: .env va server bir xil, oqib ketgan parol ishlatilmayapti.');
  else {
    console.log(`🛠  Nima qilish kerak (${fixes.length}):`);
    fixes.forEach((f, i) => console.log(`   ${i + 1}. ${f}`));
    process.exitCode = 1;
  }
}

main().catch((e) => { console.error('Xato:', e.message); process.exit(2); });
