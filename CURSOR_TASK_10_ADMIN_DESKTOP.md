# CURSOR TASK 10 — Fix Admin Panel on Desktop

## PROBLEM

When an admin logs in on desktop (window ≥ 1024px), the app crashes with the
ErrorBoundary "Что-то пошло не так" screen.

**Root cause:** After `setIsAdmin(true)`, the ternary
`isDesktop && !isAdmin ? <DesktopLayout> : <mobile-div>` switches from
DesktopLayout to the mobile div for the **first time**. The mobile div contains
`paddingBottom: 'calc(var(--nav-height) + 16px)'` and a `NavBar` component
that uses mobile-only CSS variables (`--nav-height`) which are never set on
desktop. This causes a rendering crash.

---

## FILE TO EDIT

`src/App.jsx` — only one file, do not create or split files.

---

## PRE-CHECK (read these lines before editing)

1. Find the main return ternary in `App()` — it looks like:
```jsx
{isDesktop && !isAdmin ? (
  <DesktopLayout ... />
) : (
  <div style={{ width:"100%", minHeight:"100vh", ... paddingBottom:'calc(var(--nav-height)+16px)' ... }}>
    <div style={{ paddingBottom:'calc(var(--nav-height)+16px)', ... }}>
      {isAdmin ? (
        <>admin content</>
      ) : (
        <MotionScreen ...>user content</MotionScreen>
      )}
    </div>
    {/* NavBar, createPortal floating bar, etc. */}
  </div>
)}
```

2. The admin content block starts at `{isAdmin ? (` and contains:
   - Admin header bar (black, with `t.adminPanel` title)
   - `ErrorBoundary key={safeAdminScreen}` wrapping the 4 admin screens
   - `AdminOrdersScreen`, `AdminProductsScreen`, `AdminStatsScreen`, `AdminSettingsScreen`

3. The `NavBar` is rendered BELOW the `isAdmin ? ... : ...` block, inside the
   mobile div. It uses `--nav-height` CSS variable which is only set on mobile.

---

## EXACT FIX — 3 cases instead of 2

Change the ternary to handle **three** cases:

```
isDesktop && !isAdmin  →  <DesktopLayout />          (unchanged)
isDesktop &&  isAdmin  →  <DesktopAdminWrapper />     (NEW — see below)
!isDesktop             →  mobile div                  (unchanged)
```

### Step 1 — Change the outer ternary condition

**Find:**
```jsx
{isDesktop && !isAdmin ? (
  <DesktopLayout
```

**Keep DesktopLayout block unchanged. After the closing `/>` of DesktopLayout
and before the `) : (` add a new case using nested ternary:**

Change:
```jsx
{isDesktop && !isAdmin ? (
  <DesktopLayout
    ...all existing props...
  />
) : (
  <div style={{ width: "100%", minHeight: "100vh", ...
```

To:
```jsx
{isDesktop && !isAdmin ? (
  <DesktopLayout
    ...all existing props (DO NOT CHANGE THESE)...
  />
) : isDesktop && isAdmin ? (
  <div style={{
    width: '100%', minHeight: '100vh', background: '#fff',
    fontFamily: "-apple-system,BlinkMacSystemFont,'SF Pro Display',sans-serif",
    color: '#111',
  }}>
    {/* Desktop admin top bar */}
    <div style={{
      position: 'sticky', top: 0, zIndex: 100,
      background: '#111', padding: '0 48px',
      height: 56, display: 'flex', alignItems: 'center',
      justifyContent: 'space-between',
    }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', letterSpacing: 3, textTransform: 'uppercase' }}>
        {t.adminPanel} — Kemal Usman
      </div>
      <button
        onClick={() => { setIsAdmin(false); setAdminScreen('orders'); }}
        style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
          color: '#fff', padding: '6px 16px', fontSize: 11, letterSpacing: 2,
          textTransform: 'uppercase', cursor: 'pointer', fontWeight: 600 }}>
        {t.exit || 'Выйти'}
      </button>
    </div>

    {/* Desktop admin tab nav */}
    <div style={{
      display: 'flex', gap: 0,
      borderBottom: '1px solid #EBEBEB',
      padding: '0 48px',
    }}>
      {[
        { id: 'orders',   label: t.orders   || 'Заказы'    },
        { id: 'products', label: t.products || 'Товары'    },
        { id: 'stats',    label: t.stats    || 'Статистика'},
        { id: 'settings', label: t.settings || 'Настройки' },
      ].map(tab => (
        <div key={tab.id} onClick={() => setAdminScreen(tab.id)}
          style={{
            padding: '14px 20px', fontSize: 12, fontWeight: 600,
            letterSpacing: 1.5, textTransform: 'uppercase', cursor: 'pointer',
            color: adminScreen === tab.id ? '#111' : '#BBB',
            borderBottom: adminScreen === tab.id ? '2px solid #111' : '2px solid transparent',
            marginBottom: -1,
          }}>
          {tab.label}
        </div>
      ))}
    </div>

    {/* Admin screen content */}
    <div style={{ padding: '32px 48px', minHeight: 'calc(100vh - 120px)' }}>
      {(() => {
        const VALID_ADMIN_TABS = ['orders', 'products', 'stats', 'settings'];
        const safeAdminScreen = VALID_ADMIN_TABS.includes(adminScreen) ? adminScreen : 'orders';
        return (
          <ErrorBoundary key={safeAdminScreen}>
            {safeAdminScreen === 'orders' && (
              <AdminOrdersScreen
                allOrders={orders}
                onRefresh={handleRefresh}
                onStatusChange={async (id, st) => {
                  setOrders(p => p.map(o => o.id === id ? { ...o, status: st } : o));
                  try { await api.updateOrder(id, { status: st }); } catch (e) { console.warn(e); }
                }}
                onDelete={async (id) => {
                  setOrders(p => p.filter(o => o.id !== id));
                  try { await api.deleteOrder(id); } catch (e) { console.warn(e); }
                }}
                onSendWhatsApp={handleSendWhatsApp}
                onConfirmMBankPayment={(id) => {
                  setOrders(p => p.map(o => o.id === id ? { ...o, paymentStatus: 'paid' } : o));
                  showToast(t.orderPlaced);
                }}
              />
            )}
            {safeAdminScreen === 'products' && (
              <AdminProductsScreen products={products} setProducts={setProducts} showToast={showToast} />
            )}
            {safeAdminScreen === 'stats' && (
              <AdminStatsScreen orders={orders} products={products} registeredUsers={registeredUsers} visitCount={visitCount} />
            )}
            {safeAdminScreen === 'settings' && (
              <AdminSettingsScreen banners={banners} setBanners={setBanners} settings={settings} setSettings={setSettings} onLogout={handleLogout} showToast={showToast} lang={lang} />
            )}
          </ErrorBoundary>
        );
      })()}
    </div>
  </div>
) : (
  <div style={{ width: "100%", minHeight: "100vh", ...existing mobile div styles... }}>
    ...existing mobile content UNCHANGED...
  </div>
)}
```

---

## IMPORTANT RULES

- DO NOT change the DesktopLayout props or its internal code.
- DO NOT change the mobile div (the last `else` branch) — keep it exactly as is.
- DO NOT change AdminOrdersScreen, AdminProductsScreen, AdminStatsScreen, AdminSettingsScreen components.
- The `ErrorBoundary` import already exists — use it as shown.
- The `api`, `handleRefresh`, `handleSendWhatsApp`, `setOrders`, `showToast`, `t`, `orders`, `products`, `registeredUsers`, `visitCount`, `banners`, `setBanners`, `settings`, `setSettings`, `handleLogout`, `lang`, `adminScreen`, `setAdminScreen`, `setIsAdmin` — all already exist in App() scope.
- Use existing `t.*` translation keys. Do not add new keys.
- Inline styles only — no CSS files, no Tailwind.

---

## AFTER EDITING

Run:
```bash
npm run build
```

Verify build succeeds with 0 errors.

Then test:
1. Open kemalusman.kg on desktop (≥ 1024px width)
2. Click "KEMAL USMAN" logo 5 times quickly
3. Admin login modal appears → enter email + password → click OK
4. Desktop admin panel should open with: sticky black header + tab nav (Заказы / Товары / Статистика / Настройки) + content area
5. Clicking "Выйти" exits admin mode and returns to DesktopLayout
6. Tab switching works without crash
7. Mobile (< 1024px) — admin login and panel work exactly as before (unchanged)
