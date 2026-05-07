# CURSOR TASK 11 — Responsive Login Screen (Desktop vs Mobile)

## PROBLEM

On desktop (≥ 1024px) the login screen stretches full-width — the background
image and form fill the entire viewport in mobile style. It looks bad.

**Goal:**
- Desktop (≥ 1024px): split layout — left half = full-bleed background photo +
  branding, right half = white card with the login form (centered).
- Mobile (< 1024px): current login screen UNCHANGED — do not touch it.
- Works at ANY screen size without horizontal scroll.

---

## FILE TO EDIT

`src/App.jsx` only. One file, do not split.

---

## PRE-CHECK (read before editing)

1. `LoginScreen` component starts at the line:
   ```js
   function LoginScreen({ onLogin, welcomeConfig, onGuest, loginBg, showToast })
   ```
   It renders a full-screen dark background with the form overlaid.
   **DO NOT change LoginScreen internals.**

2. In `App()`, the login gate is:
   ```jsx
   if (!user && !isAdmin && !guestMode) return (
     <LangContext.Provider value={t_ctx}>
       <div style={{ width:"100vw", maxWidth:"100vw", minHeight:"100vh", ... }}>
         <Toast ... />
         <LoginScreen ... />
         {welcomeCelebration && <BonusCelebration ... />}
       </div>
     </LangContext.Provider>
   );
   ```

3. `windowWidth` state already exists in `App()`:
   ```js
   const [windowWidth, setWindowWidth] = useState(
     typeof window !== 'undefined' ? window.innerWidth : 1024
   );
   ```
   Use `windowWidth >= 1024` for the desktop check.

4. `settings.loginBg` contains the background image URL (may be empty — fallback
   to `/login-bg.jpeg`).

---

## EXACT FIX

### Change ONLY the login gate block in `App()`

**Find this block:**
```jsx
if (!user && !isAdmin && !guestMode) return (
  <LangContext.Provider value={t_ctx}>
    <div style={{ width: "100vw", maxWidth: "100vw", minHeight: "100vh", overflow: "hidden", background: T.bg, fontFamily: "-apple-system,BlinkMacSystemFont,'SF Pro Display',sans-serif" }}>
      <Toast toast={toast} onDismiss={dismissToast} />
      <LoginScreen onLogin={handleLogin} welcomeConfig={{ enabled: settings.welcomeBonusEnabled, amount: settings.welcomeBonus, expireDays: 30 }} onGuest={() => setGuestMode(true)} loginBg={settings.loginBg} showToast={showToast} />
      {welcomeCelebration && (
        <BonusCelebration
          amount={welcomeCelebration.amount}
          lang={lang}
          onClose={() => setWelcomeCelebration(null)}
        />
      )}
    </div>
  </LangContext.Provider>
);
```

**Replace with:**
```jsx
if (!user && !isAdmin && !guestMode) return (
  <LangContext.Provider value={t_ctx}>
    <Toast toast={toast} onDismiss={dismissToast} />
    {welcomeCelebration && (
      <BonusCelebration
        amount={welcomeCelebration.amount}
        lang={lang}
        onClose={() => setWelcomeCelebration(null)}
      />
    )}
    {windowWidth >= 1024 ? (
      /* ── DESKTOP LOGIN — split layout ── */
      <div style={{
        display: 'flex', width: '100vw', height: '100vh',
        fontFamily: "-apple-system,BlinkMacSystemFont,'SF Pro Display',sans-serif",
        overflow: 'hidden',
      }}>
        {/* Left — full-bleed photo + branding */}
        <div style={{
          flex: 1, position: 'relative', overflow: 'hidden',
          background: '#0d0d0d',
        }}>
          <img
            src={settings.loginBg || '/login-bg.jpeg'}
            alt=""
            style={{
              position: 'absolute', inset: 0,
              width: '100%', height: '100%',
              objectFit: 'cover', objectPosition: 'center',
              opacity: 0.75,
            }}
          />
          {/* Dark gradient overlay */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(135deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.15) 100%)',
          }} />
          {/* Branding */}
          <div style={{
            position: 'absolute', bottom: 52, left: 52,
          }}>
            <div style={{
              fontSize: 11, letterSpacing: 5, textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.55)', marginBottom: 12,
              fontWeight: 500,
            }}>
              Бишкек · Парфюм на разлив
            </div>
            <div style={{
              fontFamily: "'Georgia', serif",
              fontStyle: 'italic',
              fontSize: 48, fontWeight: 400,
              color: '#fff', letterSpacing: -1, lineHeight: 1.1,
            }}>
              Kemal Usman
            </div>
            <div style={{
              fontSize: 10, letterSpacing: 6, textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.45)', marginTop: 10, fontWeight: 500,
            }}>
              Parfum
            </div>
          </div>
        </div>

        {/* Right — login card */}
        <div style={{
          width: 480, flexShrink: 0,
          background: '#fff',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: '48px 52px',
          overflowY: 'auto',
        }}>
          {/* Language toggle */}
          <div style={{
            position: 'absolute', top: 24, right: 24,
            display: 'flex', gap: 6,
          }}>
            {['ru', 'kg'].map(l => (
              <div key={l} onClick={() => setLang(l)}
                style={{
                  padding: '5px 12px', fontSize: 10, letterSpacing: 2,
                  textTransform: 'uppercase', cursor: 'pointer', fontWeight: 700,
                  background: lang === l ? '#111' : '#F5F5F5',
                  color: lang === l ? '#fff' : '#888',
                }}>
                {l === 'ru' ? 'РУС' : 'КЫР'}
              </div>
            ))}
          </div>

          {/* Logo mark */}
          <div style={{ marginBottom: 36, textAlign: 'center' }}>
            <div style={{
              fontSize: 22, fontWeight: 800, letterSpacing: 5,
              textTransform: 'uppercase', color: '#111',
            }}>
              Kemal Usman
            </div>
            <div style={{
              fontSize: 9, letterSpacing: 4, textTransform: 'uppercase',
              color: '#BBB', marginTop: 4,
            }}>
              Parfum
            </div>
          </div>

          {/* Render LoginScreen but constrain it to card width */}
          <div style={{ width: '100%' }}>
            <LoginScreen
              onLogin={handleLogin}
              welcomeConfig={{ enabled: settings.welcomeBonusEnabled, amount: settings.welcomeBonus, expireDays: 30 }}
              onGuest={() => setGuestMode(true)}
              loginBg={null}
              showToast={showToast}
              desktopMode={true}
            />
          </div>
        </div>
      </div>
    ) : (
      /* ── MOBILE LOGIN — unchanged ── */
      <div style={{ width: "100vw", maxWidth: "100vw", minHeight: "100vh", overflow: "hidden", background: T.bg, fontFamily: "-apple-system,BlinkMacSystemFont,'SF Pro Display',sans-serif" }}>
        <LoginScreen
          onLogin={handleLogin}
          welcomeConfig={{ enabled: settings.welcomeBonusEnabled, amount: settings.welcomeBonus, expireDays: 30 }}
          onGuest={() => setGuestMode(true)}
          loginBg={settings.loginBg}
          showToast={showToast}
        />
      </div>
    )}
  </LangContext.Provider>
);
```

---

## UPDATE LoginScreen to support `desktopMode` prop

`LoginScreen` receives a new optional prop: `desktopMode?: boolean`

When `desktopMode === true`:
- Remove the full-screen background image (`loginBg` is null anyway)
- Remove the fixed/absolute positioning — render as a normal flow element
- Remove the dark overlay
- Remove the "Kemal Usman / PARFUM" branding block (already shown in the left panel)
- Keep ALL form logic unchanged (phone input, OTP step, name, referral, guest button)
- Style the form for a white background: labels in `#111`, inputs with light border, button stays black

**Find in `LoginScreen` the JSX return — it wraps everything in:**
```jsx
<div style={{ position:"fixed", inset:0, ... background image ... }}>
  ...branding...
  <div id="login-form-container" style={{ position:"absolute", bottom:0, ... }}>
    ...form...
  </div>
</div>
```

**Add this at the top of LoginScreen's return, BEFORE the existing JSX:**
```jsx
if (desktopMode) {
  return (
    <div style={{ width: '100%' }}>
      {/* form fields only — no background, no branding, no fixed positioning */}
      ...copy the inner form JSX (phone input, name input, referral, OTP step, buttons)...
    </div>
  );
}
// existing mobile JSX unchanged below
```

Copy the form JSX from inside `<div id="login-form-container">` exactly as-is.
Style adjustments for desktop white background:
- Input `background: '#F5F5F5'`, `border: '1px solid #E5E5E5'`, `color: '#111'`
- Label `color: '#888'`, `fontSize: 10`, `letterSpacing: 2`, `textTransform: 'uppercase'`
- Primary button: `background: '#111'`, `color: '#fff'` (unchanged)
- Guest button: `color: '#888'`, `fontSize: 12` (unchanged)
- Error text: `color: '#E53935'`

---

## IMPORTANT RULES

- DO NOT change any login logic (OTP flow, phone formatting, validation)
- DO NOT change the mobile LoginScreen path
- DO NOT break `handleLogin`, `requestOtp`, `verifyOtp` calls
- `setLang` is available in `App()` scope — use it for the language toggle in the right panel
- `lang` is available in `App()` scope
- `T.bg` is available in `App()` scope
- Inline styles only — no Tailwind, no CSS files

---

## AFTER EDITING

```bash
npm run build
```

Verify 0 errors. Then test:
1. Desktop (≥ 1024px): left = dark photo + branding, right = white card with form
2. Mobile (< 1024px): existing login screen — UNCHANGED
3. OTP flow works on both (request code → enter code → login)
4. "Войти как гость" works on both
5. After login → DesktopLayout opens on desktop, mobile layout on mobile
6. Resize browser: below 1024px switches to mobile login, above switches to desktop split
