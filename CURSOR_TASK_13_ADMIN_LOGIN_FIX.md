# CURSOR TASK 13 — Fix Admin Login (Неверный пароль)

## PROBLEM

Admin login modal opens correctly (5× tap on "Kemal Usman"), but always returns
"Неверный пароль" even when PocketBase admin UI at
`http://145.223.100.16:8090/_/` accepts the same credentials.

Root cause: TWO compounding issues.

---

## ROOT CAUSE 1 — Mixed Content (HTTPS → HTTP blocked by browser)

The site runs at `https://kemalusman.kg` (HTTPS).
`.env.production` sets `VITE_PB_URL=http://145.223.100.16:8090` (HTTP).
Modern browsers **block** HTTPS → HTTP requests (mixed content policy).
The admin `fetch()` in `src/api/auth.js` silently fails or is blocked.

**Fix:** Change `.env.production` to use the HTTPS reverse-proxy endpoint:

```
VITE_PB_URL=https://api.kemalusman.kg
```

Caddy already proxies `https://api.kemalusman.kg` → `http://localhost:8090`
(confirmed: PocketBase UI works at that domain).

---

## ROOT CAUSE 2 — Wrong request body field name

`src/api/auth.js` line 44 sends:
```js
body: JSON.stringify({ identity: email, password }),
```

PocketBase v0.22 and below expects `{ identity, password }` ✅
PocketBase v0.23+ (superusers) expects `{ identity, password }` ✅

BUT some versions of PB return 400 if the field is `identity` instead of
`email`. Add a fallback: try `identity` first, then `email` if it fails.

---

## ⚠️ RULES (always follow)

1. `App.jsx` — do NOT split, do NOT touch for this task
2. Only edit: `src/api/auth.js` and `.env.production`
3. Do NOT change PocketBase URL in `.env` (dev file) — only `.env.production`
4. Do NOT hardcode credentials anywhere
5. `npm run build` must complete with 0 errors
6. Do NOT break existing OTP login (`requestOtp`, `verifyOtp`)

---

## FILE 1 — `.env.production`

**FIND:**
```
VITE_PB_URL=http://145.223.100.16:8090
```

**REPLACE WITH:**
```
VITE_PB_URL=https://api.kemalusman.kg
```

---

## FILE 2 — `src/api/auth.js`

**FIND:**
```js
export async function adminLogin(email, password) {
  const res = await fetch(`${PB_URL}/api/admins/auth-with-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: email, password }),
  });

  if (!res.ok) {
    throw new Error('Неверный email или пароль');
  }

  const data = await res.json();
  pb.authStore.save(data.token, data.admin);
  return data;
}
```

**REPLACE WITH:**
```js
export async function adminLogin(email, password) {
  // Try legacy admin endpoint first (PB < v0.23)
  let res = await fetch(`${PB_URL}/api/admins/auth-with-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: email, password }),
  });

  // Fallback: newer PB versions renamed admins → _superusers
  if (!res.ok && res.status === 404) {
    res = await fetch(`${PB_URL}/api/collections/_superusers/auth-with-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity: email, password }),
    });
  }

  if (!res.ok) {
    throw new Error('Неверный email или пароль');
  }

  const data = await res.json();
  // Handle both response shapes: legacy uses data.admin, new uses data.record
  const adminModel = data.admin || data.record || null;
  pb.authStore.save(data.token, adminModel);
  return data;
}
```

---

## AFTER EDITING

```bash
npm run build
scp -r dist/* root@145.223.100.16:/var/www/parfum/
```

✅ 0 errors — done.

**Test:**
1. Open `kemalusman.kg` (desktop ≥1024px or mobile)
2. Click "Kemal Usman" 5× → admin modal opens
3. Email: `doniponis5@gmail.com`, Password: `qwerty019`
4. Click OK → should enter admin panel (no "Неверный пароль")
5. Verify OTP client login still works (don't break it)
