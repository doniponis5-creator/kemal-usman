# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Decant-first explorers in Bishkek: price-sensitive fragrance lovers who want to experience
expensive niche and designer perfumes (Dior, Chanel, and similar) in small volumes before
ever committing to a full bottle. They browse the catalog on a phone, add decants or
packaged bottles to a cart, and check out for pickup or delivery.

## Product Purpose

Kemal Usman is a mobile-first fragrance e-commerce shop serving Bishkek, Kyrgyzstan. It
sells premium/niche/designer perfumes decanted into small volumes (5ml, 10ml, 20ml) as
well as packaged 50ml bottles. It exists to make expensive fragrance accessible on a
try-before-you-commit basis. Success is a completed order (cash, O!Dengi, or MBank) and,
over time, repeat purchases driven by the bonus/referral loyalty loop.

## Positioning

Selling fragrance by volume rather than only by full bottle is the mechanism: it removes
the price barrier that normally keeps niche and designer-tier scents out of reach. A
competitor that only sells full retail bottles cannot truthfully offer the same
low-commitment way to try a scent.

## Operating Context

- Flow: catalog browse → product detail (notes, gallery, audio note) → cart → checkout
  (pickup or delivery, address + comment) → payment (cash, O!Dengi, or MBank deeplink) →
  order status tracked new → confirmed → preparing → delivering → delivered/cancelled,
  communicated over a WhatsApp deeplink.
- Loyalty loop: welcome bonus on registration, referral codes (inviter + friend bonus),
  bonus earned as a % of order value, bonus spendable up to a configured cap — all
  amounts configurable from `settings`, not hardcoded.
- Backend is PocketBase (`products`, `orders`, `clients` collections); admin staff run a
  password-protected panel for orders, products, banners, bonus config, and stats.
- Shipped to the App Store as an iOS Capacitor wrapper (no Android target exists in this
  repo). Native capabilities actually used: haptics, local push notifications, native
  audio record/playback for fragrance voice notes, splash screen, status bar and keyboard
  integration, offline cart persistence.

## Capabilities and Constraints

- Products are priced and stocked per `variants` entry (ml decants + packaged units), not
  per flat product price — never flatten this to separate columns.
- No card payment gateway. O!Dengi and MBank both require a Kyrgyz bank account; cash is
  the universal fallback and the one path that always completes (used for App Store
  review, for example).
- UI language is Russian / Kyrgyz only — no English surface.
- Currency is сом (KGS); city is Bishkek only (no multi-city delivery logic).

## Brand Commitments

- Name: "Kemal Usman", tagline "Parfum".
- Visual system is deliberately monochrome/near-black (`#111111` accent) per the
  project's existing design tokens — this is a settled brand choice, not an open question.

## Evidence on Hand

- Real seeded catalog data exists (e.g. Dior Sauvage, Miss Dior, Chanel Bleu de Chanel,
  N°5) with authored Russian-language fragrance-note copy — usable as realistic content.
- This is a live, already-shipped App Store product (multiple submitted builds), not a
  concept. No testimonials, press, or case studies are on hand — do not invent any.

## Product Principles

1. **Volume-first accessibility** — every flow should reinforce that trying a fragrance
   is low-risk and low-cost; decant framing should never read as a "lesser" version of
   the real product.
2. **Trust in authenticity** — customers are trialing expensive brands via decants, so
   catalog and product presentation must read as credible and premium, never
   counterfeit-adjacent.
3. **Frictionless repeat loop** — bonus and referral mechanics exist to turn one-time
   samplers into repeat buyers; surface balance/rewards without nagging.
4. **Native-feel web, not native code** — iOS-quality motion and polish are achieved
   through CSS/inline-styles inside the existing Capacitor wrapper. Do not propose a
   SwiftUI or native rewrite.
5. **Bishkek-local pragmatism** — Kyrgyz payment rails (O!Dengi, MBank, cash), RU/KG-only
   language, and a single delivery city are fixed constraints; design decisions should
   stay grounded in this specific local context rather than generic global e-commerce
   patterns.
