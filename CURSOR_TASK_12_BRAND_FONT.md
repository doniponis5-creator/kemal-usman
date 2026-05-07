# CURSOR TASK 12 — Desktop Brand Font: Serif Italic

## PROBLEM

Desktop da "KEMAL USMAN" yozuvi `UPPERCASE + sans-serif + fontWeight 800`
ko'rinishida chiqmoqda (mobile catalog header stilida).  
Maqsad: login ekranidagi chap paneldagi kabi — **italic serif**, `fontWeight 400`,
normal case, `Georgia` yoki `'Playfair Display'` shrifti.

---

## ⚠️ QOIDALAR (har doim amal qil)

1. `App.jsx` — bitta fayl, **split qilma**
2. Boshqa komponentlarga **tegma** — faqat ko'rsatilgan 2 joyni o'zgartir
3. Inline JS style objects — CSS fayl, Tailwind **yozma**
4. `T` color tokens ishlatilmoqda — ranglarni **hardcode qilma**
5. `onClick` handler (`handleDeskSecretTap`) — **o'chirilmasin**
6. `npm run build` — **0 error** bilan tugashi shart

---

## FILE TO EDIT

`src/App.jsx` — only. Do not create new files.

---

## CHANGE 1 — Desktop Header Logo (line ~6919)

**FIND:**
```jsx
<div style={{ fontSize: 20, fontWeight: 800, letterSpacing: 4, textTransform: 'uppercase', color: '#111', cursor: 'pointer' }}
  onClick={handleDeskSecretTap}>
  KEMAL USMAN
</div>
```

**REPLACE WITH:**
```jsx
<div
  style={{
    fontFamily: "'Georgia', 'Playfair Display', serif",
    fontStyle: 'italic',
    fontWeight: 400,
    fontSize: 26,
    letterSpacing: -0.3,
    color: '#111',
    cursor: 'pointer',
    lineHeight: 1,
    userSelect: 'none',
  }}
  onClick={handleDeskSecretTap}
>
  Kemal Usman
</div>
```

---

## CHANGE 2 — Desktop Footer Brand (line ~7225)

**FIND:**
```jsx
<div style={{ fontSize: 13, fontWeight: 800, letterSpacing: 4, color: '#fff' }}>
  KEMAL USMAN
</div>
```

**REPLACE WITH:**
```jsx
<div style={{
  fontFamily: "'Georgia', 'Playfair Display', serif",
  fontStyle: 'italic',
  fontWeight: 400,
  fontSize: 18,
  letterSpacing: -0.2,
  color: '#fff',
  lineHeight: 1,
}}>
  Kemal Usman
</div>
```

---

## AFTER EDITING

```bash
npm run build
```

✅ 0 errors — done.

**Test:**
1. Open `kemalusman.kg` desktop (≥ 1024px)
2. Header top-left: "Kemal Usman" — italic serif, not bold caps
3. Footer bottom-left: same italic serif on dark background
4. Click logo 5× — admin login modal still opens (onClick preserved)
5. Mobile (< 1024px) — unchanged
