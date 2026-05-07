# CURSOR TASK 9 — Desktop Web Store (Full PRO Version)

## GOAL
Add a complete, production-ready desktop web store layout to `src/App.jsx`.
- `window.innerWidth >= 1024` → Desktop layout renders
- `window.innerWidth < 1024` → Existing mobile layout renders **DO NOT TOUCH IT**

---

## PRE-CHECK — BEFORE WRITING ANY CODE

1. Verify `framer-motion` is imported at the top of `App.jsx`. If not: `import { motion, AnimatePresence } from 'framer-motion';`
2. Verify `fileUrl` and `audioUrl` helper functions exist in App.jsx. Do NOT add them again if they do.
3. Verify `normalizePhone` utility exists in App.jsx. Do NOT add it again if it does.

---

## CRITICAL RULES
- **DO NOT** modify any existing component or mobile layout — not a single line
- **DO NOT** add CSS files, Tailwind, or any external libraries
- ALL styles must be **inline JS objects only**
- ALL colors from the existing `T` object (`T.bg`, `T.text`, `T.accent`, `T.card`, `T.border`, `T.textSecond`, `T.textMuted`, `T.white`)
- **NO emoji anywhere** — SVG icons only throughout
- Use `framer-motion` (`motion`, `AnimatePresence` — already imported) for ALL animations
- Border-radius: `0` for cards and buttons (flat luxury style)
- Font: `-apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif`
- Uppercase labels: `letterSpacing: 2.5`, body text: `letterSpacing: 0.2`
- `fileUrl` and `audioUrl` are already imported — use them for product images/audio

---

## STEP 1 — Window Width Detection in App()

Inside `App()`, after ALL existing `useState` declarations, add:

```js
const [windowWidth, setWindowWidth] = useState(window.innerWidth);
useEffect(() => {
  const handler = () => setWindowWidth(window.innerWidth);
  window.addEventListener('resize', handler);
  return () => window.removeEventListener('resize', handler);
}, []);
const isDesktop = windowWidth >= 1024;
```

---

## STEP 2 — DesktopLayout Component

Add a new `DesktopLayout` component **directly before** the `App()` function definition.

### Props received by DesktopLayout:
```js
function DesktopLayout({
  products, cart, setCart, addToCart,
  banners, settings, showToast,
  user, onLogout, guestMode, setGuestMode,
  bonusBalance, bonusHistory, referralCode, handleCopyReferral,
  orders, onOrder,
  pbLoading, toast, dismissToast,
  lang, setLang, t,
  welcomeCelebration, setWelcomeCelebration,
  windowWidth,
})
```

### Internal state inside DesktopLayout:
```js
const [desktopSearch, setDesktopSearch] = useState('');
const [desktopCategory, setDesktopCategory] = useState('all');
const [desktopSort, setDesktopSort] = useState('default');
const [selectedProduct, setSelectedProduct] = useState(null);
const [cartOpen, setCartOpen] = useState(false);
const [selectedVariants, setSelectedVariants] = useState({});
const [announcementIndex, setAnnouncementIndex] = useState(0);
const [searchOpen, setSearchOpen] = useState(false);
const [userMenuOpen, setUserMenuOpen] = useState(false);
const [heroBannerIndex, setHeroBannerIndex] = useState(0);
const [deliveryType, setDeliveryType] = useState('pickup');
const [address, setAddress] = useState('');
const [comment, setComment] = useState('');
const [payMethod, setPayMethod] = useState('cash');
const [useBonus, setUseBonus] = useState(false);
const [modalVariantId, setModalVariantId] = useState(null);
const [modalImgIndex, setModalImgIndex] = useState(0);
```

### Helper inside DesktopLayout:
```js
const minPrice = (p) => {
  const prices = (p.variants || []).map(v => v.price || 0).filter(Boolean);
  return prices.length ? Math.min(...prices) : 0;
};

const cartCount = cart.reduce((s, i) => s + i.qty, 0);
const cartTotal = cart.reduce((s, ci) => {
  const prod = products.find(p => String(p.id) === String(ci.productId));
  const variant = prod?.variants?.find(v => String(v.id) === String(ci.variantId));
  return s + (variant?.price || 0) * ci.qty;
}, 0);

const announcements = settings?.announcementTexts?.split('\n').filter(Boolean) || [
  'Бесплатная доставка по Бишкеку от 1 000 сом',
  'Скидка 15% на Премиум коллекцию',
  'Новые ароматы каждую неделю',
];

const heroButtonText = settings?.heroButtonText || 'ВЫБРАТЬ АРОМАТ';

const gridColumns = windowWidth >= 1440 ? 'repeat(4, 1fr)' : 'repeat(3, 1fr)';

const filteredProducts = products
  .filter(p => desktopCategory === 'all' || p.category === desktopCategory)
  .filter(p => !desktopSearch ||
    p.name?.toLowerCase().includes(desktopSearch.toLowerCase()) ||
    p.brand?.toLowerCase().includes(desktopSearch.toLowerCase())
  )
  .sort((a, b) => {
    if (desktopSort === 'price_asc') return minPrice(a) - minPrice(b);
    if (desktopSort === 'price_desc') return minPrice(b) - minPrice(a);
    if (desktopSort === 'name') return (a.name || '').localeCompare(b.name || '');
    return 0;
  });
```

### Announcement bar auto-rotate useEffect:
```js
useEffect(() => {
  if (announcements.length <= 1) return;
  const timer = setInterval(() => {
    setAnnouncementIndex(i => (i + 1) % announcements.length);
  }, 4000);
  return () => clearInterval(timer);
}, [announcements.length]);
```

### Hero banner auto-slide useEffect:
```js
const activeHeroBanners = banners.filter(b => b.active);
useEffect(() => {
  if (activeHeroBanners.length <= 1) return;
  const timer = setInterval(() => {
    setHeroBannerIndex(i => (i + 1) % activeHeroBanners.length);
  }, 5000);
  return () => clearInterval(timer);
}, [activeHeroBanners.length]);
```

### Keyboard handler for search:
```js
useEffect(() => {
  const handler = (e) => { if (e.key === 'Escape') { setSearchOpen(false); setUserMenuOpen(false); } };
  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
}, []);
```

---

## STEP 3 — ANNOUNCEMENT BAR

`position: 'fixed'`, `top: 0`, `left: 0`, `right: 0`, `zIndex: 1100`
`height: 38px`, `background: '#111'`, `color: '#fff'`
`display: 'flex'`, `alignItems: 'center'`, `justifyContent: 'center'`, `gap: 20`

Left arrow SVG — wrap in div with onClick:
```jsx
<div
  onClick={() => setAnnouncementIndex(i => (i - 1 + announcements.length) % announcements.length)}
  style={{ cursor: 'pointer', padding: '0 8px', display: 'flex', alignItems: 'center' }}
>
  <svg width="7" height="12" viewBox="0 0 7 12" fill="none">
    <path d="M6 1L1 6L6 11" stroke="white" strokeWidth="1.2" strokeLinecap="round"/>
  </svg>
</div>
```

Text: wrap in `AnimatePresence mode="wait"`:
```jsx
<AnimatePresence mode="wait">
  <motion.span
    key={announcementIndex}
    initial={{ opacity: 0, y: 6 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -6 }}
    transition={{ duration: 0.3 }}
    style={{ fontSize: 10, letterSpacing: 2.5, textTransform: 'uppercase', minWidth: 280, textAlign: 'center' }}
  >
    {announcements[announcementIndex]}
  </motion.span>
</AnimatePresence>
```

Right arrow SVG — wrap in div with onClick:
```jsx
<div
  onClick={() => setAnnouncementIndex(i => (i + 1) % announcements.length)}
  style={{ cursor: 'pointer', padding: '0 8px', display: 'flex', alignItems: 'center' }}
>
  <svg width="7" height="12" viewBox="0 0 7 12" fill="none">
    <path d="M1 1L6 6L1 11" stroke="white" strokeWidth="1.2" strokeLinecap="round"/>
  </svg>
</div>
```

---

## STEP 4 — HEADER

`position: 'fixed'`, `top: 38`, `left: 0`, `right: 0`, `zIndex: 1000`
`background: '#fff'`, `borderBottom: '1px solid #E5E5E5'`

### Row 1 — Logo + Icons (height: 68px, padding: `0 48px`):
`display: 'flex'`, `alignItems: 'center'`, `justifyContent: 'space-between'`

**Logo** (left):
```jsx
<div style={{ fontSize: 20, fontWeight: 800, letterSpacing: 4, textTransform: 'uppercase', color: '#111', cursor: 'pointer' }}
  onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
  KEMAL USMAN
</div>
```

**Icons** (right) — `display: 'flex'`, `alignItems: 'center'`, `gap: 24`:

Search icon (click → `setSearchOpen(true)`):
```jsx
<svg width="20" height="20" viewBox="0 0 24 24" fill="none">
  <circle cx="11" cy="11" r="7" stroke="#111" strokeWidth="1.5"/>
  <path d="M16.5 16.5L21 21" stroke="#111" strokeWidth="1.5" strokeLinecap="round"/>
</svg>
```

User icon (click → `setUserMenuOpen(v => !v)`), wrap in `position: 'relative'`:
```jsx
<svg width="20" height="20" viewBox="0 0 24 24" fill="none">
  <circle cx="12" cy="7" r="4" stroke="#111" strokeWidth="1.5"/>
  <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="#111" strokeWidth="1.5" strokeLinecap="round"/>
</svg>
```

Cart icon (click → `setCartOpen(v => !v)`), wrap in `position: 'relative'`:
```jsx
<svg width="20" height="20" viewBox="0 0 24 24" fill="none">
  <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" stroke="#111" strokeWidth="1.5" strokeLinejoin="round"/>
  <line x1="3" y1="6" x2="21" y2="6" stroke="#111" strokeWidth="1.5"/>
  <path d="M16 10a4 4 0 01-8 0" stroke="#111" strokeWidth="1.5" strokeLinecap="round"/>
</svg>
```
Cart badge (only if `cartCount > 0`):
```jsx
<motion.div
  key={cartCount}
  animate={{ scale: [1, 1.35, 1] }}
  transition={{ duration: 0.3 }}
  style={{ position: 'absolute', top: -7, right: -9, background: '#111', color: '#fff',
    borderRadius: '50%', width: 17, height: 17, fontSize: 9,
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}
>
  {cartCount}
</motion.div>
```

### Row 2 — Navigation (height: 44px, padding: `0 48px`, borderTop: `1px solid #F0F0F0`):
`display: 'flex'`, `alignItems: 'center'`, `gap: 36`, `position: 'relative'`

Nav items array and labels map:
```js
const NAV_ITEMS = [
  { id: 'all',      label: 'Все' },
  { id: 'female',   label: 'Женские' },
  { id: 'male',     label: 'Мужские' },
  { id: 'unisex',   label: 'Унисекс' },
  { id: 'premium',  label: 'Премиум' },
  { id: 'about',    label: 'О нас' },
  { id: 'contacts', label: 'Контакты' },
];
```

Each nav item (map over `NAV_ITEMS`):
```jsx
{NAV_ITEMS.map(item => (
  <div
    key={item.id}
    onClick={() => {
      if (item.id === 'about' || item.id === 'contacts') {
        document.getElementById('footer')?.scrollIntoView({ behavior: 'smooth' });
        return;
      }
      setDesktopCategory(item.id);
      document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' });
    }}
    style={{ fontSize: 10, letterSpacing: 2.5, textTransform: 'uppercase', cursor: 'pointer',
      color: desktopCategory === item.id ? '#111' : '#888',
      paddingBottom: 2, position: 'relative',
      borderBottom: desktopCategory === item.id ? '1.5px solid #111' : '1.5px solid transparent',
      transition: 'color 0.2s, border-color 0.2s' }}
  >
    {item.label}
  </div>
))}
```

---

## STEP 5 — MAIN CONTENT WRAPPER

All content below header:
```jsx
<div style={{ marginTop: 38 + 68 + 44, background: '#FAF6EE', minHeight: '100vh' }}>
  {/* hero, catalog, promo, footer go here */}
</div>
```

---

## STEP 6 — HERO BANNER

`position: 'relative'`, `height: 480`, `background: '#0d0d0d'`, `overflow: 'hidden'`

Current banner data:
```js
const currentBanner = activeHeroBanners[heroBannerIndex];
```

If `currentBanner?.image`:
```jsx
<img
  src={currentBanner?.collectionId
    ? fileUrl(currentBanner, currentBanner.image)
    : currentBanner?.image}
  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
/>
```
> PocketBase records have `collectionId` — use `fileUrl()`. Default/static banners are plain objects with a direct URL string — use `.image` directly.

Dark overlay (always):
```jsx
<div style={{ position: 'absolute', inset: 0,
  background: 'linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.72) 100%)' }} />
```

Centered content (`position: 'absolute'`, `inset: 0`, `display: 'flex'`, `flexDirection: 'column'`, `alignItems: 'center'`, `justifyContent: 'center'`, `textAlign: 'center'`):

```jsx
<motion.div
  key={heroBannerIndex}
  initial={{ opacity: 0, y: 16 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.6 }}
>
  <div style={{ fontSize: 9, letterSpacing: 5, textTransform: 'uppercase', color: '#C9A84C', marginBottom: 14 }}>
    {currentBanner?.subtitle || 'Bishkek · Parfum na razliv'}
  </div>
  <div style={{ fontSize: 52, fontWeight: 200, letterSpacing: 8, textTransform: 'uppercase', color: '#fff', lineHeight: 1.15, marginBottom: 6 }}>
    {currentBanner?.title ? (
      currentBanner.title
    ) : (
      <>KEMAL<br /><strong style={{ fontWeight: 800 }}>USMAN</strong></>
    )}
  </div>
  <div style={{ fontSize: 10, letterSpacing: 3, color: 'rgba(255,255,255,0.4)', marginBottom: 32, textTransform: 'uppercase' }}>
    Оригинальные ароматы · Лучшие бренды
  </div>
  <motion.div
    whileHover={{ background: 'rgba(255,255,255,0.12)' }}
    onClick={() => document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' })}
    style={{ display: 'inline-block', border: '1px solid rgba(255,255,255,0.5)',
      color: '#fff', fontSize: 10, letterSpacing: 3, textTransform: 'uppercase',
      padding: '14px 44px', cursor: 'pointer' }}
  >
    {heroButtonText}
  </motion.div>
</motion.div>
```

Banner dots (if `activeHeroBanners.length > 1`) — bottom-center, `position: 'absolute'`, `bottom: 24`:
```jsx
<div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
  {activeHeroBanners.map((_, i) => (
    <div key={i} onClick={() => setHeroBannerIndex(i)}
      style={{ width: i === heroBannerIndex ? 24 : 8, height: 3,
        background: i === heroBannerIndex ? '#fff' : 'rgba(255,255,255,0.35)',
        cursor: 'pointer', transition: 'all 0.3s' }} />
  ))}
</div>
```

---

## STEP 7 — CATALOG SECTION

`id="catalog"`, `padding: '52px 48px 0'`

Section header row (`display: 'flex'`, `justifyContent: 'space-between'`, `alignItems: 'baseline'`, `marginBottom: 24`):
- Left: `КАТАЛОГ АРОМАТОВ` — `fontSize: 11, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: '#111'`
- Right: `Все товары →` — `fontSize: 10, letterSpacing: 2, color: '#BBB', cursor: 'pointer', borderBottom: '1px solid #DDD'`

Filter row (`display: 'flex'`, `alignItems: 'center'`, `borderBottom: '1px solid #E5E5E5'`, `marginBottom: 0`):

Category tabs (same style as header nav):
```js
const CAT_TABS = [
  { id: 'all', label: 'Все' },
  { id: 'female', label: 'Женские' },
  { id: 'male', label: 'Мужские' },
  { id: 'unisex', label: 'Унисекс' },
  { id: 'premium', label: 'Премиум' },
];
```
Each tab: click → `setDesktopCategory(tab.id)`
Active: `color: '#111'`, `borderBottom: '1.5px solid #111'`, `marginBottom: -1`

Right side selects (`marginLeft: 'auto'`, `display: 'flex'`, `gap: 10`):
```jsx
<select value={desktopSort} onChange={e => setDesktopSort(e.target.value)}
  style={{ border: '1px solid #E5E5E5', padding: '8px 12px', fontSize: 10, letterSpacing: 1, color: '#666', background: '#fff', outline: 'none', cursor: 'pointer' }}>
  <option value="default">По умолчанию</option>
  <option value="price_asc">Цена ↑</option>
  <option value="price_desc">Цена ↓</option>
  <option value="name">По названию</option>
</select>
```

---

## STEP 8 — PRODUCT GRID

```jsx
<div style={{
  display: 'grid',
  gridTemplateColumns: gridColumns,
  borderTop: '1px solid #EBEBEB',
  borderLeft: '1px solid #EBEBEB',
}}>
  {filteredProducts.map((product, index) => renderProductCard(product, index))}
</div>
```

**⚠️ IMPORTANT**: Do NOT define ProductCard as a separate `function ProductCard()` component — it would lose access to DesktopLayout's state (setSelectedProduct, setModalVariantId, selectedVariants, setSelectedVariants, setCartOpen, minPrice). Instead, define it as a **render helper function** inside DesktopLayout:

```js
const renderProductCard = (product, index) => {
  // all JSX below goes here
  return ( ... );
};
```

Then in the grid: `{filteredProducts.map((product, index) => renderProductCard(product, index))}`

### ProductCard JSX (inside renderProductCard):

Outer `motion.div` — do NOT use a wrapping outer `<div>` separately, just use `motion.div` directly:

```jsx
<motion.div
  key={product.id}
  initial={{ opacity: 0, y: 16 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ delay: index * 0.04, duration: 0.4 }}
  whileHover={{ background: '#FAFAFA' }}
  onClick={() => {
    setSelectedProduct(product);
    setModalVariantId(product.variants?.[0]?.id || null);
    setModalImgIndex(0);
  }}
  style={{ borderRight: '1px solid #EBEBEB', borderBottom: '1px solid #EBEBEB',
    padding: '28px 22px 22px', background: '#fff', position: 'relative', cursor: 'pointer' }}
>
```

Wishlist heart (top-right, `position: 'absolute'`, `top: 18, right: 18`):
```jsx
<svg width="18" height="18" viewBox="0 0 24 24" fill="none">
  <path d="M12 21C12 21 3 14 3 8.5A5.5 5.5 0 0 1 12 5a5.5 5.5 0 0 1 9 3.5C21 14 12 21 12 21z"
    stroke="#CCC" strokeWidth="1.4" strokeLinejoin="round"/>
</svg>
```

Product image area (`height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 22`):
```jsx
{product.images?.[0] ? (
  <img
    src={fileUrl(product, product.images[0])}
    style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }}
    alt={product.name}
  />
) : (
  // Placeholder SVG bottle
  <svg width="60" height="140" viewBox="0 0 60 140" fill="none">
    <rect x="20" y="0" width="20" height="16" rx="2" fill="#E5E5E5"/>
    <rect x="8" y="16" width="44" height="110" rx="4" fill="#EBEBEB"/>
    <rect x="16" y="24" width="28" height="2" rx="1" fill="#DDD"/>
  </svg>
)}
```

Card info:
```jsx
<div style={{ fontSize: 9, letterSpacing: 2.5, textTransform: 'uppercase', color: '#BBB', marginBottom: 6 }}>
  {product.brand}
</div>
<div style={{ fontSize: 14, fontWeight: 700, color: '#111', marginBottom: 5, lineHeight: 1.3 }}>
  {product.name}
</div>
<div style={{ fontSize: 11, color: '#BBB', marginBottom: 14, lineHeight: 1.5,
  overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
  {product.description}
</div>
<div style={{ fontSize: 18, fontWeight: 800, color: '#111', marginBottom: 12 }}>
  от {minPrice(product)} сом
</div>
```

Volume dropdown (stop propagation on change so card click doesn't fire):
```jsx
<select
  value={selectedVariants[product.id] || product.variants?.[0]?.id || ''}
  onChange={e => { e.stopPropagation(); setSelectedVariants(p => ({ ...p, [product.id]: e.target.value })); }}
  onClick={e => e.stopPropagation()}
  style={{ width: '100%', border: '1px solid #E5E5E5', padding: '9px 10px',
    fontSize: 11, letterSpacing: 1, color: '#555', background: '#fff',
    marginBottom: 11, cursor: 'pointer', outline: 'none' }}
>
  {(product.variants || []).filter(v => v.inStock !== false).map(v => (
    <option key={v.id} value={v.id}>{v.label} — {v.price} сом</option>
  ))}
</select>
```

Button (check if all variants out of stock):
```jsx
{(product.variants || []).every(v => v.inStock === false) ? (
  <div style={{ width: '100%', background: '#F5F5F5', color: '#BBB', border: 'none',
    padding: 13, fontSize: 10, letterSpacing: 2.5, textTransform: 'uppercase',
    textAlign: 'center', fontWeight: 600 }}>
    Нет в наличии
  </div>
) : (
  <motion.button
    whileTap={{ scale: 0.97 }}
    onClick={e => {
      e.stopPropagation();
      const varId = selectedVariants[product.id] || product.variants?.[0]?.id;
      if (varId) { addToCart(product.id, varId); setCartOpen(true); }
    }}
    style={{ width: '100%', background: '#111', color: '#fff', border: 'none',
      padding: 13, fontSize: 10, letterSpacing: 2.5, textTransform: 'uppercase',
      cursor: 'pointer', fontWeight: 600 }}
  >
    В корзину
  </motion.button>
)}
```

---

## STEP 9 — PRODUCT DETAIL MODAL

Render inside `AnimatePresence`:
```jsx
<AnimatePresence>
  {selectedProduct && (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={() => setSelectedProduct(null)}
      style={{ position: 'fixed', inset: 0, zIndex: 2000,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 20 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        onClick={e => e.stopPropagation()}
        style={{ width: 860, maxWidth: '90vw', background: '#fff',
          maxHeight: '85vh', overflow: 'hidden',
          display: 'grid', gridTemplateColumns: '1fr 1fr' }}
      >
```

**Left side** (`background: '#FAFAFA'`, `display: 'flex'`, `alignItems: 'center'`, `justifyContent: 'center'`, `minHeight: 460`, `flexDirection: 'column'`, `gap: 12`):
- Use `modalImgIndex` and `setModalImgIndex` (already declared in Step 2 state — do NOT re-declare)
- Main image: `maxHeight: 380, maxWidth: '100%', objectFit: 'contain'`
- Image src: same pattern as hero — `selectedProduct?.collectionId ? fileUrl(selectedProduct, selectedProduct.images[modalImgIndex]) : selectedProduct?.images?.[modalImgIndex]`
- Thumbnails row (if `selectedProduct.images?.length > 1`): flex row of 56×56 boxes, `objectFit: 'cover'`, click → `setModalImgIndex(i)`, active thumbnail gets `outline: '2px solid #111'`

**Right side** (`padding: 48`, `overflowY: 'auto'`, `position: 'relative'`):

Close button (top-right, `position: 'absolute'`, `top: 20, right: 20`):
```jsx
<svg width="20" height="20" viewBox="0 0 24 24" fill="none">
  <path d="M18 6L6 18M6 6l12 12" stroke="#111" strokeWidth="1.5" strokeLinecap="round"/>
</svg>
```

Content:
```jsx
<div style={{ fontSize: 10, letterSpacing: 2.5, textTransform: 'uppercase', color: '#BBB', marginBottom: 8 }}>
  {selectedProduct.brand}
</div>
<div style={{ fontSize: 28, fontWeight: 800, letterSpacing: -0.5, color: '#111', marginBottom: 12 }}>
  {selectedProduct.name}
</div>
<div style={{ fontSize: 14, color: '#666', lineHeight: 1.7, marginBottom: 24 }}>
  {selectedProduct.description}
</div>
{/* Selected variant price */}
{(() => {
  const selVariant = (selectedProduct.variants || []).find(v => v.id === modalVariantId);
  return selVariant ? (
    <div style={{ fontSize: 24, fontWeight: 800, color: '#111', marginBottom: 20 }}>
      {selVariant.price.toLocaleString()} сом
    </div>
  ) : null;
})()}
```

Variant pills:
```jsx
<div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
  {(selectedProduct.variants || []).map(v => (
    <div key={v.id} onClick={() => setModalVariantId(v.id)}
      style={{ padding: '10px 16px', border: `1px solid ${modalVariantId === v.id ? '#111' : '#E5E5E5'}`,
        background: modalVariantId === v.id ? '#111' : '#fff',
        color: modalVariantId === v.id ? '#fff' : '#555',
        fontSize: 12, cursor: v.inStock === false ? 'not-allowed' : 'pointer',
        opacity: v.inStock === false ? 0.4 : 1 }}>
      {v.label} — {v.price} сом
    </div>
  ))}
</div>
```

"В корзину" button (full-width, black):
```jsx
<motion.button whileTap={{ scale: 0.98 }}
  onClick={() => {
    if (modalVariantId) { addToCart(selectedProduct.id, modalVariantId); setSelectedProduct(null); setCartOpen(true); }
  }}
  style={{ width: '100%', background: '#111', color: '#fff', border: 'none',
    padding: '16px', fontSize: 11, letterSpacing: 2.5, textTransform: 'uppercase',
    cursor: 'pointer', fontWeight: 600, marginBottom: 16 }}>
  В корзину
</motion.button>
```

Audio (if `selectedProduct.audio`):
```jsx
<div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 0', borderTop: '1px solid #F0F0F0' }}>
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="10" stroke="#111" strokeWidth="1.5"/>
    <path d="M10 8l6 4-6 4V8z" fill="#111"/>
  </svg>
  <span style={{ fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: '#555' }}>
    Послушать аромат
  </span>
</div>
```

---

## STEP 10 — CART SIDEBAR PANEL

Render inside `AnimatePresence` (outside main content, sibling):
```jsx
<AnimatePresence>
  {cartOpen && (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={() => setCartOpen(false)}
        style={{ position: 'fixed', inset: 0, zIndex: 1400, background: 'rgba(0,0,0,0.3)' }}
      />
      {/* Panel */}
      <motion.div
        initial={{ x: 420 }} animate={{ x: 0 }} exit={{ x: 420 }}
        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
        style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 420,
          background: '#fff', borderLeft: '1px solid #E5E5E5',
          zIndex: 1500, display: 'flex', flexDirection: 'column' }}
      >
```

**Panel header** (`padding: '24px 28px'`, `borderBottom: '1px solid #F0F0F0'`, `display: 'flex'`, `justifyContent: 'space-between'`, `alignItems: 'center'`):
```jsx
<div style={{ padding: '24px 28px', borderBottom: '1px solid #F0F0F0',
  display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
    <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 2.5, textTransform: 'uppercase', color: '#111' }}>
      Корзина
    </span>
    {cartCount > 0 && (
      <span style={{ background: '#111', color: '#fff', borderRadius: '50%',
        width: 20, height: 20, fontSize: 10, fontWeight: 700,
        display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {cartCount}
      </span>
    )}
  </div>
  <div onClick={() => setCartOpen(false)} style={{ cursor: 'pointer', padding: 4 }}>
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M18 6L6 18M6 6l12 12" stroke="#111" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  </div>
</div>
```

**Cart items list** (`flex: 1`, `overflowY: 'auto'`, `padding: '0 28px'`):

Each item:
```jsx
{cart.map(ci => {
  const prod = products.find(p => String(p.id) === String(ci.productId));
  const variant = prod?.variants?.find(v => String(v.id) === String(ci.variantId));
  return (
    <div key={`${ci.productId}-${ci.variantId}`}
      style={{ display: 'flex', gap: 14, padding: '16px 0', borderBottom: '1px solid #F5F5F5', alignItems: 'flex-start' }}>
      {/* Thumbnail */}
      <div style={{ width: 56, height: 56, background: '#F5F5F5', flexShrink: 0, overflow: 'hidden' }}>
        {prod?.images?.[0] && <img src={fileUrl(prod, prod.images[0])} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
      </div>
      {/* Info */}
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#111', marginBottom: 2 }}>{prod?.name}</div>
        <div style={{ fontSize: 11, color: '#BBB', marginBottom: 8 }}>{variant?.label}</div>
        {/* Qty controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => {
            setCart(prev => {
              const next = prev.map(i => i.productId === ci.productId && i.variantId === ci.variantId
                ? { ...i, qty: Math.max(1, i.qty - 1) } : i);
              localStorage.setItem('parfum_cart', JSON.stringify(next));
              return next;
            });
          }} style={{ width: 28, height: 28, background: '#F5F5F5', border: 'none', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            −
          </button>
          <span style={{ fontSize: 13, fontWeight: 600 }}>{ci.qty}</span>
          <button onClick={() => {
            setCart(prev => {
              const next = prev.map(i => i.productId === ci.productId && i.variantId === ci.variantId
                ? { ...i, qty: i.qty + 1 } : i);
              localStorage.setItem('parfum_cart', JSON.stringify(next));
              return next;
            });
          }} style={{ width: 28, height: 28, background: '#111', border: 'none', cursor: 'pointer', color: '#fff', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            +
          </button>
        </div>
      </div>
      {/* Price + Delete */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>{(variant?.price || 0) * ci.qty} сом</div>
        <div onClick={() => {
          setCart(prev => {
            const next = prev.filter(i => !(i.productId === ci.productId && i.variantId === ci.variantId));
            localStorage.setItem('parfum_cart', JSON.stringify(next));
            return next;
          });
        }} style={{ cursor: 'pointer' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="#BBB" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </div>
    </div>
  );
})}
```

If cart is empty:
```jsx
<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 16, padding: 40 }}>
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
    <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" stroke="#DDD" strokeWidth="1.3" strokeLinejoin="round"/>
    <line x1="3" y1="6" x2="21" y2="6" stroke="#DDD" strokeWidth="1.3"/>
  </svg>
  <div style={{ fontSize: 14, fontWeight: 600, color: '#BBB' }}>Корзина пуста</div>
  <div onClick={() => setCartOpen(false)}
    style={{ fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: '#111',
      borderBottom: '1px solid #111', cursor: 'pointer', paddingBottom: 2 }}>
    Перейти в каталог
  </div>
</div>
```

**Cart footer** (`padding: '20px 28px'`, `borderTop: '1px solid #F0F0F0'`):

Delivery toggle:
```jsx
<div style={{ display: 'flex', gap: 0, marginBottom: 14 }}>
  {['pickup', 'delivery'].map(type => (
    <div key={type} onClick={() => setDeliveryType(type)}
      style={{ flex: 1, padding: '10px', textAlign: 'center', fontSize: 11,
        letterSpacing: 1.5, textTransform: 'uppercase', cursor: 'pointer',
        background: deliveryType === type ? '#111' : '#F5F5F5',
        color: deliveryType === type ? '#fff' : '#888' }}>
      {type === 'pickup' ? 'Самовывоз' : 'Доставка'}
    </div>
  ))}
</div>
```

If delivery — show address input:
```jsx
{deliveryType === 'delivery' && (
  <input
    value={address}
    onChange={e => setAddress(e.target.value)}
    placeholder="Улица, дом, квартира..."
    style={{ width: '100%', border: '1px solid #E5E5E5', padding: '10px 12px',
      fontSize: 13, color: '#111', background: '#fff', outline: 'none',
      marginBottom: 10, boxSizing: 'border-box' }}
  />
)}
```

Comment textarea — always visible, optional:
```jsx
<textarea
  value={comment}
  onChange={e => setComment(e.target.value)}
  placeholder="Комментарий к заказу..."
  rows={2}
  style={{ width: '100%', border: '1px solid #E5E5E5', padding: '10px 12px',
    fontSize: 13, color: '#111', background: '#fff', outline: 'none',
    resize: 'none', marginBottom: 14, boxSizing: 'border-box',
    fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}
/>
```

Payment method — use logo components (already imported: `MBankLogo`, `OBankLogo`, `CashLogo` from `./components/BankLogos`):
```jsx
<div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
  {[
    { id: 'mbank', label: 'M-Bank', logo: <MBankLogo size={22} /> },
    { id: 'obank', label: 'O!Bank', logo: <OBankLogo size={22} /> },
    { id: 'cash',  label: 'Наличные', logo: <CashLogo size={22} /> },
  ].map(pm => (
    <div key={pm.id} onClick={() => setPayMethod(pm.id)}
      style={{ flex: 1, padding: '10px 4px', textAlign: 'center', fontSize: 10,
        letterSpacing: 1, textTransform: 'uppercase', cursor: 'pointer',
        border: `1px solid ${payMethod === pm.id ? '#111' : '#E5E5E5'}`,
        background: payMethod === pm.id ? '#111' : '#fff',
        color: payMethod === pm.id ? '#fff' : '#888',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
      {pm.logo}
      {pm.label}
    </div>
  ))}
</div>
```

After the payment method buttons, if `payMethod === 'mbank'` or `payMethod === 'obank'`, show a **Реквизиты** panel:
```jsx
{(payMethod === 'mbank' || payMethod === 'obank') && (() => {
  const pmPhone = localStorage.getItem(payMethod === 'mbank' ? 'mbank_phone' : 'obank_phone') || '';
  const pmQr    = payMethod === 'mbank' ? settings?.mbankQr : settings?.obankQr;
  const pmLabel = payMethod === 'mbank' ? 'M-Bank' : 'O!Bank';
  return (
    <div style={{ background: '#FAFAFA', border: '1px solid #F0F0F0', padding: '14px 16px', marginBottom: 12 }}>
      <div style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: '#BBB', marginBottom: 8 }}>
        Реквизиты {pmLabel}
      </div>
      {pmPhone ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: pmQr ? 12 : 0 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#111', letterSpacing: 1 }}>{pmPhone}</div>
          <div onClick={() => { navigator.clipboard?.writeText(pmPhone); showToast('Скопировано!'); }}
            style={{ fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: '#888',
              border: '1px solid #E5E5E5', padding: '5px 10px', cursor: 'pointer' }}>
            Копировать
          </div>
        </div>
      ) : (
        <div style={{ fontSize: 12, color: '#BBB' }}>Номер не настроен — обратитесь к администратору</div>
      )}
      {pmQr && (
        <img src={pmQr} alt={`QR ${pmLabel}`}
          style={{ width: 120, height: 120, objectFit: 'contain', display: 'block', margin: '0 auto' }} />
      )}
    </div>
  );
})()}
```

Bonus balance row (if `bonusBalance > 0`):
```jsx
<div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, padding: '10px 12px', background: '#FAFAFA' }}>
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
      stroke="#C9A84C" strokeWidth="1.5" strokeLinejoin="round"/>
  </svg>
  <span style={{ fontSize: 11, color: '#888' }}>У вас {bonusBalance} бонусов</span>
  <label style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#555', cursor: 'pointer' }}>
    <input type="checkbox" checked={useBonus} onChange={e => setUseBonus(e.target.checked)} />
    Применить
  </label>
</div>
```

Totals:
```jsx
<div style={{ marginBottom: 4, display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#888' }}>
  <span>Подытог</span><span>{cartTotal} сом</span>
</div>
<div style={{ marginBottom: 4, display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#888' }}>
  <span>Доставка</span>
  <span style={{ color: deliveryType === 'pickup' || cartTotal >= (settings?.minOrderForFreeDelivery || 1000) ? '#22a86e' : '#111' }}>
    {deliveryType === 'pickup' ? 'Самовывоз' : cartTotal >= (settings?.minOrderForFreeDelivery || 1000) ? 'Бесплатно' : `${settings?.deliveryCost || 200} сом`}
  </span>
</div>
<div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 800, color: '#111', marginTop: 10, marginBottom: 16 }}>
  <span>Итого</span><span>{cartTotal} сом</span>
</div>
```

Checkout button:
```jsx
<motion.button whileTap={{ scale: 0.98 }}
  onClick={() => {
    if (!user) { showToast('Войдите для оформления заказа', 'error'); return; }
    if (deliveryType === 'delivery' && !address.trim()) { showToast('Укажите адрес доставки', 'error'); return; }
    const deliveryCost = deliveryType === 'pickup' ? 0 : cartTotal >= (settings?.minOrderForFreeDelivery || 1000) ? 0 : (settings?.deliveryCost || 200);
    const bonusDiscount = useBonus ? Math.min(bonusBalance, Math.floor(cartTotal * (settings?.useBonusPercent || 30) / 100)) : 0;
    onOrder({ deliveryType, address, comment, payMethod, total: cartTotal + deliveryCost - bonusDiscount, bonusDiscount });
    if (payMethod === 'cash') {
      setCartOpen(false);
      setAddress(''); setComment('');
    }
    // For mbank/obank: handleOrder triggers payment modal — cart stays open until modal confirms
  }}
  style={{ width: '100%', background: '#111', color: '#fff', border: 'none',
    padding: '16px', fontSize: 11, letterSpacing: 2.5, textTransform: 'uppercase',
    cursor: 'pointer', fontWeight: 600 }}>
  Оформить заказ
</motion.button>
```

---

## STEP 11 — PROMO BANNERS

Below grid. `margin: '52px 48px 0'`. `display: 'grid'`, `gridTemplateColumns: '1fr 1fr'`, `gap: 2`

```jsx
{[
  { bg: 'linear-gradient(135deg, #111 0%, #2a1f0e 100%)', eye: 'НОВАЯ КОЛЛЕКЦИЯ', title: 'ЖЕНСКИЕ\nАРОМАТЫ', cat: 'female' },
  { bg: 'linear-gradient(135deg, #0d1f3c 0%, #111 100%)', eye: 'ПРЕМИУМ ЛИНЕЙКА', title: 'МУЖСКИЕ\nАРОМАТЫ', cat: 'male' },
].map((b, i) => (
  <motion.div key={i} whileHover={{ scale: 1.01 }} transition={{ duration: 0.2 }}
    onClick={() => { setDesktopCategory(b.cat); document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' }); }}
    style={{ height: 220, background: b.bg, display: 'flex', alignItems: 'flex-end',
      padding: '28px 32px', cursor: 'pointer', overflow: 'hidden' }}>
    <div>
      <div style={{ fontSize: 9, letterSpacing: 3, textTransform: 'uppercase', color: '#C9A84C', marginBottom: 6 }}>{b.eye}</div>
      <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: '#fff', marginBottom: 12, whiteSpace: 'pre-line' }}>{b.title}</div>
      <div style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)', borderBottom: '1px solid rgba(255,255,255,0.2)', paddingBottom: 1, display: 'inline-block' }}>
        СМОТРЕТЬ КАТАЛОГ →
      </div>
    </div>
  </motion.div>
))}
```

---

## STEP 12 — SEARCH OVERLAY

```jsx
<AnimatePresence>
  {searchOpen && (
    <motion.div
      initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
      style={{ position: 'fixed', top: 38 + 68 + 44, left: 0, right: 0, zIndex: 1050,
        background: '#fff', borderBottom: '1px solid #E5E5E5', padding: '20px 48px',
        display: 'flex', alignItems: 'center', gap: 16 }}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <circle cx="11" cy="11" r="7" stroke="#BBB" strokeWidth="1.5"/>
        <path d="M16.5 16.5L21 21" stroke="#BBB" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
      <input
        autoFocus
        value={desktopSearch}
        onChange={e => setDesktopSearch(e.target.value)}
        placeholder="Поиск ароматов..."
        style={{ flex: 1, fontSize: 22, border: 'none', outline: 'none', color: '#111', background: 'transparent' }}
      />
      <div onClick={() => { setSearchOpen(false); setDesktopSearch(''); }} style={{ cursor: 'pointer' }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M18 6L6 18M6 6l12 12" stroke="#BBB" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </div>
    </motion.div>
  )}
</AnimatePresence>
```

---

## STEP 13 — USER DROPDOWN MENU

```jsx
<AnimatePresence>
  {userMenuOpen && (
    <motion.div
      initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
      style={{ position: 'absolute', top: '100%', right: 0, width: 210,
        background: '#fff', border: '1px solid #E5E5E5', zIndex: 1001, marginTop: 8 }}
    >
      {user ? (
        <>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #F5F5F5' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>{user.name}</div>
            <div style={{ fontSize: 11, color: '#BBB' }}>{user.phone}</div>
          </div>
          {[
            { label: 'Мои заказы', icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="2" stroke="#555" strokeWidth="1.4"/><path d="M8 10h8M8 14h5" stroke="#555" strokeWidth="1.4" strokeLinecap="round"/></svg> },
            { label: `Бонусы: ${bonusBalance} сом`, icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke="#C9A84C" strokeWidth="1.4"/></svg> },
            { label: 'Выйти', icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" stroke="#555" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>, action: () => { onLogout(); setUserMenuOpen(false); } },
          ].map((item, i) => (
            <div key={i} onClick={item.action || (() => setUserMenuOpen(false))}
              style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10,
                fontSize: 13, color: '#555', cursor: 'pointer', borderBottom: i < 2 ? '1px solid #F5F5F5' : 'none' }}
              onMouseEnter={e => e.currentTarget.style.background = '#FAFAFA'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              {item.icon} {item.label}
            </div>
          ))}
        </>
      ) : (
        <div style={{ padding: '20px 16px' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#111', marginBottom: 12 }}>Войти в аккаунт</div>
          <div onClick={() => { setUserMenuOpen(false); /* trigger login flow */ }}
            style={{ width: '100%', background: '#111', color: '#fff', padding: '12px',
              textAlign: 'center', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase',
              cursor: 'pointer', marginBottom: 8 }}>
            Войти
          </div>
          <div onClick={() => { setGuestMode(true); setUserMenuOpen(false); }}
            style={{ textAlign: 'center', fontSize: 11, color: '#BBB', cursor: 'pointer', letterSpacing: 1 }}>
            Продолжить как гость
          </div>
        </div>
      )}
    </motion.div>
  )}
</AnimatePresence>
```

---

## STEP 14 — FOOTER

`id="footer"`. `marginTop: 52, background: '#111', padding: '52px 48px 0'`

3-column grid (`display: 'grid'`, `gridTemplateColumns: '1fr 1fr 1fr'`, `gap: 48`, `marginBottom: 48`):

Column heading style: `fontSize: 9, letterSpacing: 3, textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', marginBottom: 18, fontWeight: 600`
Column link style: `fontSize: 12, color: 'rgba(255,255,255,0.55)', marginBottom: 10, cursor: 'pointer', display: 'block'`, on hover: `color: '#fff'` (use `onMouseEnter/Leave`)

```jsx
{/* Column 1 */}
<div>
  <div style={{ fontSize: 9, letterSpacing: 3, textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', marginBottom: 18, fontWeight: 600 }}>Компания</div>
  {['О нас', 'Доставка и оплата', 'Возврат товара', 'Контакты', 'Условия'].map(link => (
    <div key={link} style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', marginBottom: 10, cursor: 'pointer' }}
      onMouseEnter={e => e.currentTarget.style.color = '#fff'}
      onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.55)'}>
      {link}
    </div>
  ))}
</div>
{/* Column 2 */}
<div>
  <div style={{ fontSize: 9, letterSpacing: 3, textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', marginBottom: 18, fontWeight: 600 }}>Помощь</div>
  {['Как сделать заказ', 'Отследить заказ', 'FAQ'].map(link => (
    <div key={link} style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', marginBottom: 10, cursor: 'pointer' }}
      onMouseEnter={e => e.currentTarget.style.color = '#fff'}
      onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.55)'}>
      {link}
    </div>
  ))}
  <div onClick={() => window.open('https://wa.me/' + (settings?.whatsappPhone || '').replace(/\D/g,''), '_blank')}
    style={{ fontSize: 12, color: '#25D366', marginBottom: 10, cursor: 'pointer' }}>
    WhatsApp
  </div>
</div>
{/* Column 3 */}
<div>
  <div style={{ fontSize: 9, letterSpacing: 3, textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', marginBottom: 18, fontWeight: 600 }}>Будьте в курсе</div>
  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 16, lineHeight: 1.7 }}>
    Подпишитесь на новинки и акции
  </div>
  <div style={{ display: 'flex', gap: 0 }}>
    <input
      placeholder="Ваш email"
      style={{ flex: 1, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)',
        color: '#fff', padding: '10px 14px', fontSize: 12, outline: 'none' }}
    />
    <div style={{ background: '#fff', color: '#111', padding: '10px 16px', fontSize: 10,
      letterSpacing: 2, textTransform: 'uppercase', cursor: 'pointer', fontWeight: 700,
      display: 'flex', alignItems: 'center' }}>
      OK
    </div>
  </div>
</div>
```

Footer bottom (`borderTop: '1px solid rgba(255,255,255,0.08)'`, `padding: '24px 0'`, `display: 'flex'`, `justifyContent: 'space-between'`, `alignItems: 'center'`):

Left: `KEMAL USMAN` — `fontSize: 13, fontWeight: 800, letterSpacing: 4, color: '#fff'`

Center — 4 social icons, each 34×34, `border: '1px solid rgba(255,255,255,0.15)'`, `display: 'flex'`, `alignItems: 'center'`, `justifyContent: 'center'`, `cursor: 'pointer'`:

```jsx
<div style={{ display: 'flex', gap: 10 }}>
  {/* Instagram */}
  <div style={{ width: 34, height: 34, border: '1px solid rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
    onClick={() => window.open('https://instagram.com', '_blank')}>
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <rect x="2" y="2" width="20" height="20" rx="5" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5"/>
      <circle cx="12" cy="12" r="4" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5"/>
      <circle cx="17.5" cy="6.5" r="1" fill="rgba(255,255,255,0.5)"/>
    </svg>
  </div>
  {/* TikTok */}
  <div style={{ width: 34, height: 34, border: '1px solid rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
    onClick={() => window.open('https://tiktok.com', '_blank')}>
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  </div>
  {/* YouTube */}
  <div style={{ width: 34, height: 34, border: '1px solid rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
    onClick={() => window.open('https://youtube.com', '_blank')}>
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <rect x="2" y="5" width="20" height="14" rx="4" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5"/>
      <path d="M10 9l5 3-5 3V9z" fill="rgba(255,255,255,0.5)"/>
    </svg>
  </div>
  {/* WhatsApp */}
  <div style={{ width: 34, height: 34, border: '1px solid rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
    onClick={() => window.open('https://wa.me/' + (settings?.whatsappPhone || '').replace(/\D/g,''), '_blank')}>
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5"/>
      <path d="M8 12c0 2.2 1.8 4 4 4 .8 0 1.5-.2 2.1-.6l2 .6-.6-2C15.8 13.5 16 12.8 16 12c0-2.2-1.8-4-4-4S8 9.8 8 12z" stroke="rgba(255,255,255,0.5)" strokeWidth="1.3"/>
    </svg>
  </div>
</div>
```

Right: `© 2026 Kemal Usman · All Rights Reserved` — `fontSize: 9, letterSpacing: 1.5, color: 'rgba(255,255,255,0.2)', textTransform: 'uppercase'`

---

## STEP 15 — ADMIN SETTINGS — ADD DESKTOP + PAYMENT FIELDS

### 15A — Add to `renderShop` sub-screen (heroButtonText + Announcement Bar)

In `AdminSettingsScreen`, inside `renderShop`, add these two new fields using the **exact same style** as neighboring fields in that sub-screen (copy style from a nearby SettingsTextField or SettingsSection wrapper):

```jsx
<SettingsTextField
  label="Текст кнопки Hero (Desktop)"
  value={settings?.heroButtonText || ''}
  onChange={v => setSettings(p => ({ ...p, heroButtonText: v }))}
  placeholder="ВЫБРАТЬ АРОМАТ"
/>
```

Directly below, a textarea using the same wrapper/label style as other fields in `renderShop`:
```jsx
<div style={{ /* same style as neighboring SettingsSection card */ }}>
  <div style={{ fontSize: 12, marginBottom: 6, /* same label color as neighboring labels */ }}>
    Announcement Bar — каждая строка = новое объявление
  </div>
  <textarea
    value={settings?.announcementTexts || ''}
    onChange={e => setSettings(p => ({ ...p, announcementTexts: e.target.value }))}
    placeholder={'Бесплатная доставка от 1000 сом\nСкидка 15% на Премиум'}
    rows={3}
    style={{ width: '100%', border: 'none', outline: 'none', resize: 'none',
      background: 'transparent', fontSize: 14,
      fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
      padding: 0, boxSizing: 'border-box' }}
  />
</div>
```

---

### 15B — Add QR code upload to `renderMbank` sub-screen

Inside the existing `renderMbank()` function (after the SettingsTextField for phone), add a QR code image input:

```jsx
<SettingsSection header="QR-код для оплаты" footer="Клиент отсканирует QR прямо из корзины на сайте">
  {settings?.mbankQr && (
    <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
      <img src={settings.mbankQr} alt="QR M-Bank"
        style={{ width: 80, height: 80, objectFit: 'contain', border: '1px solid #E5E5E5' }} />
      <div onClick={() => setSettings(p => ({ ...p, mbankQr: '' }))}
        style={{ fontSize: 12, color: '#FF3B30', cursor: 'pointer', letterSpacing: 0.5 }}>
        Удалить QR
      </div>
    </div>
  )}
  <div style={{ padding: '12px 16px' }}>
    <input
      type="file"
      accept="image/*"
      onChange={e => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => setSettings(p => ({ ...p, mbankQr: ev.target.result }));
        reader.readAsDataURL(file);
      }}
      style={{ fontSize: 13 }}
    />
  </div>
</SettingsSection>
```

---

### 15C — Add QR code upload to `renderObank` sub-screen

Inside the existing `renderObank()` function (after the SettingsTextField for phone), add:

```jsx
<SettingsSection header="QR-код для оплаты" footer="Клиент отсканирует QR прямо из корзины на сайте">
  {settings?.obankQr && (
    <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
      <img src={settings.obankQr} alt="QR O!Bank"
        style={{ width: 80, height: 80, objectFit: 'contain', border: '1px solid #E5E5E5' }} />
      <div onClick={() => setSettings(p => ({ ...p, obankQr: '' }))}
        style={{ fontSize: 12, color: '#FF3B30', cursor: 'pointer', letterSpacing: 0.5 }}>
        Удалить QR
      </div>
    </div>
  )}
  <div style={{ padding: '12px 16px' }}>
    <input
      type="file"
      accept="image/*"
      onChange={e => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => setSettings(p => ({ ...p, obankQr: ev.target.result }));
        reader.readAsDataURL(file);
      }}
      style={{ fontSize: 13 }}
    />
  </div>
</SettingsSection>
```

> **Note**: `settings` state is already persisted to PocketBase when admin saves — `mbankQr` and `obankQr` will automatically be included. No extra wiring needed.

---

## STEP 16 — WIRE INTO App() RETURN

### ⚠️ CRITICAL: MBankPayment / OBankPayment must render OUTSIDE the ternary

In the existing App() return, locate where `{showMBank && pendingOrder && <MBankPayment ... />}` and `{showOBank && pendingOrder && <OBankPayment ... />}` are rendered. They are currently **inside the mobile div**. Move them outside so they work on both desktop and mobile.

The new structure of App() return must be:

```jsx
return (
  <LangContext.Provider value={t_ctx}>
    <Toast toast={toast} onDismiss={dismissToast} />
    {welcomeCelebration && (
      <BonusCelebration
        amount={welcomeCelebration.amount}
        lang={lang}
        onClose={() => setWelcomeCelebration(null)}
      />
    )}

    {/* ── Payment modals: OUTSIDE ternary — must show on BOTH desktop and mobile ── */}
    {showMBank && pendingOrder && (
      <MBankPayment
        total={pendingOrder.total}
        orderId={pendingOrder.id}
        onConfirm={async (status) => {
          // KEEP the EXACT same onConfirm handler that was previously inside the mobile div
          // Do NOT rewrite it — just move it here verbatim
        }}
        onCancel={() => { setShowMBank(false); setPendingOrder(null); }}
      />
    )}
    {showOBank && pendingOrder && (
      <OBankPayment
        total={pendingOrder.total}
        orderId={pendingOrder.id}
        onConfirm={async (status) => {
          // KEEP the EXACT same onConfirm handler that was previously inside the mobile div
          // Do NOT rewrite it — just move it here verbatim
        }}
        onCancel={() => { setShowOBank(false); setPendingOrder(null); }}
      />
    )}

    {isDesktop && !isAdmin ? (
      <DesktopLayout
        products={products}
        cart={cart}
        setCart={setCart}
        addToCart={addToCart}
        banners={banners.filter(b => b.active)}
        settings={settings}
        showToast={showToast}
        user={user}
        onLogout={handleLogout}
        guestMode={guestMode}
        setGuestMode={setGuestMode}
        bonusBalance={bonusBalance}
        bonusHistory={bonusHistory}
        referralCode={referralCode}
        handleCopyReferral={handleCopyReferral}
        orders={orders.filter(o => normalizePhone(o.clientPhone) === normalizePhone(user?.phone))}
        onOrder={handleOrder}
        pbLoading={pbLoading}
        toast={toast}
        dismissToast={dismissToast}
        lang={lang}
        setLang={setLang}
        t={t}
        welcomeCelebration={welcomeCelebration}
        setWelcomeCelebration={setWelcomeCelebration}
        windowWidth={windowWidth}
      />
    ) : (
      /* ━━━ EXISTING MOBILE LAYOUT — DO NOT CHANGE ANYTHING BELOW ━━━ */
      /* Keep ALL existing mobile JSX exactly as it was.               */
      /* ONLY remove the MBankPayment + OBankPayment blocks from here  */
      /* (they now live above, outside the ternary).                   */
      <div style={{ /* EXACT existing outer div style — do not touch */ }}>
        {/* All existing mobile JSX — unchanged */}
        {/* ⚠️ DELETE only these two lines from here (moved above):    */}
        {/* {showMBank && pendingOrder && <MBankPayment ... />}         */}
        {/* {showOBank && pendingOrder && <OBankPayment ... />}         */}
      </div>
    )}
  </LangContext.Provider>
);
```

**IMPORTANT RULES for this step:**
1. For the `onConfirm` handlers — do NOT simplify them. Copy the EXACT async handlers from the current code. They save the order to PocketBase, update bonuses, send WhatsApp, etc.
2. For the mobile fallback `<div>` — keep ALL existing mobile JSX 100% unchanged. Only remove the two payment modal lines (since they now live above).
3. The outer div style of the mobile section must stay bit-for-bit identical.

---

## STEP 17 — LOADING STATE (inside DesktopLayout)

While `pbLoading === true`, show skeleton instead of catalog grid:

```jsx
{pbLoading ? (
  <div style={{ padding: '52px 48px', display: 'grid', gridTemplateColumns: gridColumns, gap: 0,
    borderTop: '1px solid #EBEBEB', borderLeft: '1px solid #EBEBEB' }}>
    {Array.from({ length: 8 }).map((_, i) => (
      <div key={i} style={{ borderRight: '1px solid #EBEBEB', borderBottom: '1px solid #EBEBEB',
        padding: '28px 22px 22px' }}>
        <div style={{ height: 220, background: '#F0F0F0', marginBottom: 20,
          animation: 'pulse 1.5s ease-in-out infinite' }} />
        <div style={{ height: 10, background: '#F0F0F0', marginBottom: 10, width: '60%',
          animation: 'pulse 1.5s ease-in-out infinite' }} />
        <div style={{ height: 14, background: '#F0F0F0', marginBottom: 8, width: '80%',
          animation: 'pulse 1.5s ease-in-out infinite' }} />
        <div style={{ height: 40, background: '#F0F0F0', marginTop: 20,
          animation: 'pulse 1.5s ease-in-out infinite' }} />
      </div>
    ))}
  </div>
) : (
  /* real grid here */
)}
```

Add this `<style>` tag once at the top of DesktopLayout's JSX return:
```jsx
<style>{`
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }
`}</style>
```

---

## STEP 18 — ANIMATIONS SUMMARY

| Element | Animation |
|---|---|
| Announcement text | `AnimatePresence` + fade + y shift |
| Hero content | `initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }}` |
| Product cards | staggered `delay: index * 0.04` |
| Cart panel | spring slide from right `x:420 → 0` |
| Cart backdrop | opacity fade |
| Product modal overlay | opacity fade |
| Product modal card | `scale:0.96 → 1` + `y:20 → 0` |
| Search overlay | `y:-10 → 0` + opacity |
| User dropdown | `y:-8 → 0` + opacity |
| Hero CTA button | `whileHover={{ background:'rgba(255,255,255,0.12)' }}` |
| Cart button | `whileTap={{ scale:0.97 }}` |
| Checkout button | `whileTap={{ scale:0.98 }}` |
| Promo banners | `whileHover={{ scale:1.01 }}` |
| Cart badge | `animate={{ scale:[1, 1.35, 1] }}` on count change |
| Banner dots | `width: active ? 24 : 8` smooth CSS transition |

---

## FINAL BUILD + DEPLOY

After all coding is done:

```bash
npm run build
scp -r dist/* root@145.223.100.16:/var/www/parfum/
```

Test: https://kemalusman.kg (desktop browser — must show new layout)
Test: https://kemalusman.kg (mobile browser — must show OLD layout unchanged)

---

## FINAL CHECKLIST

- [ ] `windowWidth` state + `isDesktop` in App()
- [ ] `DesktopLayout` component with all props (including `windowWidth`, `guestMode`, `setGuestMode`)
- [ ] Announcement bar: fixed top:0, zIndex:1100, arrows have onClick handlers (prev/next), AnimatePresence text
- [ ] Header: logo (left) + search/user/cart SVG icons (right), zIndex:1000, top:38
- [ ] Navigation: NAV_ITEMS array with 7 items, map over it (not hardcoded strings), active underline
- [ ] Hero banner: PB fileUrl vs static image handled, auto-slide, dots, CTA button text from settings
- [ ] Search overlay: zIndex:1050 (above header), animated, Escape to close, filters catalog live
- [ ] User dropdown: SVG icons, login/logout, guest mode, positioned relative to user icon wrapper
- [ ] Catalog section: id="catalog", filter tabs + sort dropdown
- [ ] Product grid: `renderProductCard` function (NOT a component), 4 cols ≥1440 / 3 cols 1024-1439
- [ ] ProductCard: `setModalImgIndex(0)` called when opening modal
- [ ] ProductCard: wishlist SVG, bottle placeholder SVG, out-of-stock state, volume dropdown
- [ ] Product detail modal: zIndex:2000, left side uses `modalImgIndex` state + thumbnails, right side has variant pills, audio row
- [ ] Cart sidebar: zIndex:1500, spring slide, items list, qty +/−, delete with trash SVG
- [ ] Cart: address input JSX (shown when deliveryType==='delivery'), comment textarea JSX
- [ ] Cart payment buttons use `MBankLogo`, `OBankLogo`, `CashLogo` (logo+text, column layout)
- [ ] Реквизиты panel: phone from localStorage + "Копировать" + QR image from settings
- [ ] Cart empty state with cart SVG
- [ ] Checkout button: guards (user, address), bonus calc, onOrder() call
- [ ] 2 promo banners (hover animate, click → filter + scroll)
- [ ] Footer: 3 column JSX complete, hover effects on links, WhatsApp link, email subscribe input+button
- [ ] Footer social icons: all 4 have actual SVG paths (Instagram, TikTok, YouTube, WhatsApp)
- [ ] Admin settings (renderShop): heroButtonText + announcementTexts fields
- [ ] Admin settings (renderMbank): QR code upload → `settings.mbankQr`
- [ ] Admin settings (renderObank): QR code upload → `settings.obankQr`
- [ ] MBankPayment + OBankPayment moved OUTSIDE ternary (onConfirm handlers copied verbatim)
- [ ] Loading skeleton with `@keyframes pulse` via `<style>` tag at top of DesktopLayout JSX
- [ ] All framer-motion animations as listed in Step 18
- [ ] Zero emoji — SVG only
- [ ] Zero hardcoded hex (only #111, #fff, #C9A84C allowed as design accents)
- [ ] Mobile layout 100% unchanged (only MBankPayment/OBankPayment lines removed from it)
- [ ] `npm run build` + `scp -r dist/* root@145.223.100.16:/var/www/parfum/`
