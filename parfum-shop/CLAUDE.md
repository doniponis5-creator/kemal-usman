# Kemal Usman — Parfum Shop

Mobile-first fragrance e-commerce PWA for Bishkek, Kyrgyzstan. Sold by volume (ml) or packaged units. Deployable as an iOS app via Capacitor.

## Tech Stack

| Layer | Tool |
|---|---|
| Frontend | React 19 + Vite 8 |
| Backend | PocketBase at `http://145.223.100.16:8090` |
| Mobile | Capacitor 8 (iOS target, `com.kemalusman.parfum`) |
| Styling | Inline JS style objects only (no CSS framework) |
| State | `useState` / `useContext`, cart persisted in `localStorage` |

## Project Structure

```
parfum-shop/
├── src/
│   ├── App.jsx          # Entire app — all components in one file
│   ├── App.css          # Global resets only
│   ├── index.css        # Base font/body styles
│   ├── main.jsx         # React entry point
│   └── assets/          # Static images (hero, icons)
├── public/
│   ├── banner1-3.jpeg   # Hero banners shown in slider
│   └── login-bg.jpeg    # Login screen background photo
├── capacitor.config.json
├── vite.config.js       # Dev server on port 5173, host: true
├── pb-setup.js          # PocketBase collection scaffolding script
├── pb-open-all.js       # Opens PB collection rules
└── pb-fix-rules.js      # Fixes PB access rules
```

## App.jsx Sections (in order)

1. **TRANSLATIONS** — `ru` and `kg` (Kyrgyz) string maps; `LangContext` + `useLang()` hook
2. **DESIGN SYSTEM** — `T` color tokens, `card()`, `btnGreen()`, `btnOutline()`, `inputStyle` helpers
3. **ICONS** — `IC` object of inline SVG elements
4. **DATA** — `PAYMENT_METHODS`, `BG_PRESETS`, `INITIAL_PRODUCTS`, `DEFAULT_SETTINGS`, `DEFAULT_BANNERS`
5. **POCKETBASE API** — `api` object wrapping all PB calls (products, orders, clients)
6. **UI PRIMITIVES** — `Toast`, `StatusChip`, `LangToggle`, `NavBar`
7. **IMAGE UPLOAD + CROP** — `CropModal`, `ImageUpload`, `MultiImageUpload`
8. **BANNER SLIDER** — `BannerSlider`
9. **USER SCREENS** — `LoginScreen`, `CatalogScreen`, `CartScreen`, `MyOrdersScreen`, `ProfileScreen`
10. **ADMIN SCREENS** — `AdminOrdersScreen`, `AdminProductsScreen`, `AdminStatsScreen`, `AdminBannersScreen`, `AdminBonusScreen`, `AdminSettingsScreen`
11. **MBANK PAYMENT** — `MBankPayment` (deeplink to M-Bank app)
12. **AUDIO COMPONENTS** — `ProductAudioRecorder`, `AudioRecordBtn`, `ClientAudioBtn`
13. **APP ROOT** — `App()` — top-level state, routing, data loading

## PocketBase Collections

| Collection | Purpose |
|---|---|
| `products` | Catalog items; each has `variants` JSON field (array of `{id, label, price, type, inStock}`) |
| `orders` | Customer orders; fields include `status`, `paymentMethod`, `paymentStatus`, `clientPhone` |
| `clients` | Registered users; indexed by `phone`; holds `bonusBalance`, `bonusHistory`, `referralCode` |

## Key Features Already Built

- **Catalog** — search, category filter (Женские / Мужские / Унисекс / Премиум), product detail modal with image gallery
- **Cart** — persisted in `localStorage` key `parfum_cart`; delivery type (pickup / delivery); address + comment
- **Checkout** — MBank deeplink payment, O!Bank, cash; bonus points apply/earn on order
- **Bonus system** — earn % of order value; spend up to configured % as discount; welcome bonus on first order
- **Referral codes** — auto-generated on registration; referrer and friend both earn bonus
- **Admin panel** — password-protected (default `admin123`); separate nav (orders / products / stats / banners / bonus / settings)
- **Order management** — status flow: `new → confirmed → preparing → delivering → delivered / cancelled`; WhatsApp deeplink per order
- **Banner slider** — up to N banners, editable title/subtitle/background/image from admin
- **Image upload + crop** — drag-to-reposition canvas crop modal; multi-image support on products
- **Audio notes** — admin can record audio per product; clients can play it
- **i18n** — Russian / Kyrgyz toggle stored in `LangContext`; all UI strings go through `t.<key>`
- **Stats dashboard** — revenue, order counts, top products, visit counter, recent clients

## Design System Rules

- All colors come from the `T` object. **Never hardcode hex values directly in JSX** — reference `T.<token>`.
- Use `card()`, `btnGreen()`, `btnOutline()`, `inputStyle` for consistent component styling.
- The accent color is `#111111` (near-black). The palette is intentionally minimal/monochrome.
- All styles are **inline JS objects**. Do not add Tailwind, CSS modules, or styled-components.
- Spacing follows an 8 px base unit. Border-radius for cards is 16, buttons 14, chips 20.

## Routing & Navigation

There is no React Router. Navigation is done via `useState`:
- `screen` — user screens: `"catalog"`, `"cart"`, `"myorders"`, `"profile"`
- `adminScreen` — admin tabs: `"orders"`, `"products"`, `"stats"`, `"banners"`, `"bonus"`, `"settings"`
- The `NavBar` component receives the correct setter depending on `isAdmin`.

## Adding New Screens / Features

1. Define the screen as a top-level function component in App.jsx, following the existing section order.
2. Add a translation key to **both** `TRANSLATIONS.ru` and `TRANSLATIONS.kg`.
3. Add a nav item to `USER_NAV` or `ADMIN_NAV` array with an `id` matching your screen name.
4. Render the screen inside the conditional block in `App()`.
5. If it needs PocketBase data, add a method to the `api` object.

## Important Rules

- **Do not split App.jsx into multiple files** unless explicitly asked — the entire app is intentionally one file.
- **Do not change the PocketBase URL** (`http://145.223.100.16:8090`) without updating `pb-setup.js` too.
- Products use a `variants` array field, not separate price columns. Always work with `variants` when reading/writing prices or stock.
- The admin password lives in `settings.adminPassword` (default `"admin123"`), not hardcoded — always check `settings` before comparing.
- Cart quantity changes must also update `localStorage` key `parfum_cart` to survive page reload.
- WhatsApp deeplink uses phone `settings.whatsappPhone` — do not hardcode a number.
- MBank deeplink is built in `MBankPayment`; the format is `mbank://...` — test on real device, not browser.

## Dev Commands

```bash
npm run dev      # Start Vite dev server at http://localhost:5173
npm run build    # Production build → dist/
npm run preview  # Preview production build
npm run lint     # ESLint check
```
