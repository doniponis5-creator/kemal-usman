# Graph Report - kemal-usman  (2026-09-27)

## Corpus Check
- 125 files · ~214,486 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 21 file(s) not represented in the graph (top: (none) 6, .backup 2, .plist 2)

## Summary
- 928 nodes · 1871 edges · 61 communities (52 shown, 9 thin omitted)
- Extraction: 90% EXTRACTED · 10% INFERRED · 0% AMBIGUOUS · INFERRED: 191 edges (avg confidence: 0.84)
- Token cost: 428,977 input · 0 output

## Community Hubs (Navigation)
- PocketBase admin scripts
- Storefront UI components
- Audio notes and banners
- Push notifications deploy
- Admin screens
- App shell and brand look
- Perfume descriptions pipeline
- Catalog, cart and pricing
- CI and secret checks
- Project overview and flows
- Auth and OTP login
- Design tokens and iOS polish
- Package manifest
- Secret leak checker
- Liquid Glass nav bar
- Monolith refactor and i18n
- Runtime dependencies
- Native admin tabs
- OTA updates and release
- Privacy and store compliance
- npm scripts
- iOS AppDelegate
- Server hardening
- Bonus and order data rules
- i18n tooling
- App Store screenshots plan
- Dev dependencies
- Backend API and O!Dengi client
- App Store launch checklist
- App Review resubmission
- Native bridge modes
- Server setup and WhatsApp
- HTTPS and admin gateway
- OTP hook and bundle tuning
- Terms and payment rules
- Native web host
- Admin media and cart pill
- O!Dengi payment hook
- Audio descriptions and screenshots
- Liquid Glass tab view
- Native tab bridge
- Bonus and referral loop
- Pre-release checks
- JS bridge handler
- Audio player state
- Demo to production migration
- Payment app deeplinks
- iOS native sources
- Android setup
- ESLint config
- Vite build config
- Loading skeletons
- Security test script
- Swift package
- MD5 helpers
- SMS and Telegram OTP
- Web deploy script
- GitHub push script
- Welcome bonus test

## God Nodes (most connected - your core abstractions)
1. `haptic()` - 32 edges
2. `react` - 30 edges
3. `App()` - 28 edges
4. `react` - 25 edges
5. `useLang()` - 25 edges
6. `Release Verification Report (2026-04-30)` - 22 edges
7. `SharedBridge` - 20 edges
8. `Production-readiness fix sweep` - 19 edges
9. `AppTab` - 18 edges
10. `AdminTab` - 18 edges

## Surprising Connections (you probably didn't know these)
- `App Store launch checklist PDF (2026-05-10, 75% readiness)` --semantically_similar_to--> `Release Checklist (App Store submission)`  [INFERRED] [semantically similar]
  App_Store_Checklist.pdf → RELEASE_CHECKLIST.md
- `Operator launch tasks (developer account, ASC app, metadata, screenshots, privacy page, build, archive, submit)` --semantically_similar_to--> `Xcode archive & upload procedure (bundle kg.kemalusman.parfum)`  [INFERRED] [semantically similar]
  App_Store_Checklist.pdf → RELEASE_CHECKLIST.md
- `Screenshot 1: Catalog hero` --conceptually_related_to--> `CatalogScreen()`  [INFERRED]
  appstore_screenshots_prompt.md → src/App.jsx
- `MyOrders phone comparison normalized on both sides` --references--> `MyOrdersScreen()`  [INFERRED]
  RELEASE_VERIFICATION.md → src/App.jsx
- `Audit tasks 1-8 completion table` --references--> `adminLogin()`  [INFERRED]
  RELEASE_CHECKLIST.md → src/api/auth.js

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **v1.3 iOS PRO polish release contents** — cursor_task_16_deploy_v1_3_release_v1_3, cursor_task_15_design_polish_pro_motion_tokens, cursor_task_15_design_polish_pro_color_token_sweep, cursor_task_15_design_polish_pro_radius_scale, cursor_task_15_design_polish_pro_bottomsheet_primitive, cursor_task_15_design_polish_pro_order_success_gate, cursor_task_15_design_polish_pro_otp_six_cells, cursor_task_15_design_polish_pro_banner_swipe, cursor_task_16_deploy_v1_3_splash_intro [EXTRACTED 1.00]
- **Build 4 App Review rejection fixes** — app_store_submission_resubmission_build_4, app_store_submission_local_fallback_catalog, app_store_submission_banner_onerror_guard, app_store_submission_demo_review_account, app_store_submission_ui_background_modes_removal, app_store_submission_iphone_only_targeting [EXTRACTED 1.00]
- **Server-side trust enforcement (never trust the client)** — audit_report_server_side_money_hooks, fixes_applied_main_pb_hooks, fixes_applied_pb_secure_rules_script, fixes_applied_otp_authentication, deploy_2026_06_28_clients_self_update_guard [INFERRED 0.85]
- **O!Dengi payment hardening (P0)** — security_fix_readme_webhook_signature_mandatory, security_fix_readme_webhook_amount_check, security_fix_readme_odengi_creds_server_env, security_fix_readme_payment_endpoint_auth, security_fix_readme_fail_closed_payments, pb_hooks_odengi_pb [EXTRACTED 1.00]
- **Move secrets out of the client to server env/hooks** — push_setup_rest_api_key_server_only, security_fix_readme_whatsapp_server_hook, security_fix_readme_odengi_creds_server_env, migration_guide_server_side_admin_login, release_verification_leaked_scripts_neutralised [INFERRED 0.85]
- **App Store review compliance requirements** — deploy_info_plist_patch_ats_no_arbitrary_loads, deploy_info_plist_patch_permission_usage_strings, deploy_info_plist_patch_account_deletion, deploy_info_plist_patch_privacy_nutrition_label, legal_privacy_policy_ru [INFERRED 0.85]

## Communities (61 total, 9 thin omitted)

### Community 0 - "PocketBase admin scripts"
Cohesion: 0.06
Nodes (38): dotenv, pocketbase, pb, adminAuth(), FIELDS, main(), pb, PB_URL (+30 more)

### Community 1 - "Storefront UI components"
Cohesion: 0.08
Nodes (31): sendPushBroadcast(), sendWhatsApp(), MultiImageUpload(), OtpBoxes(), ProductCard, ProductImage(), ProfileScreen(), StatusChip() (+23 more)

### Community 2 - "Audio notes and banners"
Cohesion: 0.10
Nodes (27): framer-motion, react, react-dom, audioUrl(), BannerSlider(), ClientAudioBtn(), AudioPlayerOverlay(), fmt() (+19 more)

### Community 3 - "Push notifications deploy"
Cohesion: 0.09
Nodes (31): deploy-odengi.sh script, Push Notifications deploy guide (OneSignal), Admin 'Уведомления' -> Всем -> Push broadcast toggle, OneSignal native push integration, POST /api/custom/push/send (admin-only), OneSignal REST API key kept in server env only, Targeted single-hook deploy (avoid deploy-odengi.sh --delete), @onesignal/capacitor-plugin (+23 more)

### Community 4 - "Admin screens"
Cohesion: 0.09
Nodes (24): AdminBannersScreen, AdminBonusScreen, _adminChunk(), AdminClientsScreen, AdminNotificationsScreen, AdminOrdersScreen, AdminProductsScreen, AdminReviewsScreen (+16 more)

### Community 5 - "App shell and brand look"
Cohesion: 0.08
Nodes (25): Dark luxury style with gold accent (#C9A84C), index.html app shell (RU, Vite entry), Branded 'Kemal Usman' pure-CSS intro animation, Content Security Policy meta (self + own API, O!Dengi, Green API, Nominatim, Instagram), Accessible viewport (user-scalable=no removed), background_color, description, display (+17 more)

### Community 6 - "Perfume descriptions pipeline"
Cohesion: 0.11
Nodes (24): Pilot batch: 25 Russian fragrance descriptions, Fragrantica as the fragrance-notes source, House description format (top/middle/base notes, longevity, desc + shortDesc), MEDIUM-confidence entries to verify (A Scent, Amber Empire, Ambre Levant), Brand trademark disclaimer for decanted originals, Principle: trust in authenticity, authAdmin(), http() (+16 more)

### Community 7 - "Catalog, cart and pricing"
Cohesion: 0.16
Nodes (21): fileUrl(), CartScreen(), CatalogScreen(), DesktopLayout, getSaleInfo(), ProductCardBase(), productMinPrice(), SaleCountdownBadge() (+13 more)

### Community 8 - "CI and secret checks"
Cohesion: 0.13
Nodes (24): CI workflow (ci.yml), Hardcoded Cyrillic JSX counter (warn-only), lint-build-audit CI job, npm audit (high+) step, Committed-secret pattern check step, Secrets committed in pb-setup/pb-fix-rules/pb-open-all scripts, Duplicate i18n keys and hardcoded RU strings, KR Law 58 personal-data compliance (+16 more)

### Community 9 - "Project overview and flows"
Cohesion: 0.11
Nodes (21): Banner image onError gradient guard, Client-side admin password check, Admin panel, BannerSlider, Cart persistence (localStorage parfum_cart), Kemal Usman Parfum Shop, Modern best-practice decision rule, Order status flow (new to delivered/cancelled) (+13 more)

### Community 10 - "Auth and OTP login"
Cohesion: 0.16
Nodes (20): deleteAccount(), logout(), requestOtp(), verifyOtp(), authedFetch(), LoginScreen(), handleRequestOtp(), handleResendOtp() (+12 more)

### Community 11 - "Design tokens and iOS polish"
Cohesion: 0.14
Nodes (22): Native features list (Guideline 4.2 defense), Hardcoded hex colors outside T tokens, PRO-level (top 1%) roadmap, Inline JS styles only rule, T design tokens (theme.js), Universal BottomSheet primitive (drag-to-dismiss), Color token sweep for dark mode, iOS PRO design polish audit (2026-07-02) (+14 more)

### Community 12 - "Package manifest"
Cohesion: 0.09
Nodes (21): name, private, type, version, @capacitor/android, @capacitor/app, @capacitor/cli, @capacitor/core (+13 more)

### Community 13 - "Secret leak checker"
Cohesion: 0.15
Nodes (20): ref_node_child_process, ref_node_crypto, ref_node_readline, adminLogin(), bad(), collectLeaked(), effective(), good() (+12 more)

### Community 14 - "Liquid Glass nav bar"
Cohesion: 0.16
Nodes (17): GlassNavBar(), iosSpring, S, Tab(), GLASS_RADIUS, glassInk(), glassOr(), glassSurface() (+9 more)

### Community 15 - "Monolith refactor and i18n"
Cohesion: 0.12
Nodes (17): MyOrders phone-format mismatch bug, Single-file App.jsx monolith, RU/KG i18n (LangContext, strings-ru/kg.json), Lazy admin/desktop chunks (withSuspense), P2.1 App.jsx module refactor (2026-06-10), Desktop admin crash (--nav-height undefined), Desktop admin wrapper (3-case layout ternary), LoginScreen desktopMode prop (+9 more)

### Community 16 - "Runtime dependencies"
Cohesion: 0.10
Nodes (20): dependencies, @capacitor/android, @capacitor/app, @capacitor/cli, @capacitor/core, @capacitor/haptics, @capacitor/ios, @capacitor/keyboard (+12 more)

### Community 17 - "Native admin tabs"
Cohesion: 0.12
Nodes (19): CaseIterable, Hashable, Identifiable, AdminTab, .id, .label, orders, products (+11 more)

### Community 18 - "OTA updates and release"
Cohesion: 0.14
Nodes (15): iOS project via Swift Package Manager (.xcodeproj, no CocoaPods), Capgo OTA live updates, notifyAppReady() auto-rollback, Capgo production channel, Capacitor 8 iOS shell (com.kemalusman.parfum), deploy.sh web deploy (build + rsync to VPS), npm run release pre-release check, Cloudflare cache purge after deploy (+7 more)

### Community 19 - "Privacy and store compliance"
Cohesion: 0.14
Nodes (18): Play Console Data Safety declaration, iOS Info.plist required changes, In-app account deletion (Apple guideline 5.1.1(v)), Permission usage strings (microphone, location, camera, photo library), App Store privacy nutrition label, Light-content status bar style (dark login screen), Data Protection & Transparency Policy (RU, v1.0), 72-hour data breach notification commitment (+10 more)

### Community 20 - "npm scripts"
Cohesion: 0.11
Nodes (18): scripts, audit, build, check:secrets, dev, lint, pb:ensure-settings, pb:fix-bonus-fields (+10 more)

### Community 21 - "iOS AppDelegate"
Cohesion: 0.15
Nodes (11): Any, AppDelegate, Bool, Void, NSUserActivity, UIApplication, UIApplicationDelegate, UIResponder (+3 more)

### Community 22 - "Server hardening"
Cohesion: 0.14
Nodes (14): Legacy leaked-secret PB scripts (pb-setup, pb-fix-rules, pb-open-all), PocketBase rules lockdown (replaces pb-open-all.js), Release Verification Report (2026-04-30), CI grep for committed secrets, Domain-agnostic service worker (/api/, /_/ path matching), Env-driven PB_URL (no hardcoded HTTP in src/), Leaked-secret scripts neutralised as fail-fast stubs (7 scripts), pb-secure-rules.js guards (type-conflict, missing dotenv, plaintext HTTP warning) (+6 more)

### Community 23 - "Bonus and order data rules"
Cohesion: 0.20
Nodes (16): localStorage as source of truth for money state, Server-side bonus/order math in PocketBase hooks, api.* contract no-breaking-changes rule, Bonus system, Deploy checklist, PocketBase collections (products, orders, clients), PocketBase schema safety rule (add-only fields), Products variants JSON array (+8 more)

### Community 24 - "i18n tooling"
Cohesion: 0.15
Nodes (11): Gradual screen-by-screen i18n migration to react-i18next, i18next, i18next-browser-languagedetector, react-i18next, i18n consolidated into strings-ru.json / strings-kg.json (203/203 keys), DEFAULT_LANG, SUPPORTED_LANGS, LangContext (+3 more)

### Community 25 - "App Store screenshots plan"
Cohesion: 0.16
Nodes (14): App Store screenshots design prompt, Screenshot 4: Bonus system & profile (referral code), Screenshot 5: Brand / welcome slide (KU monogram), Screenshot 3: Cart & checkout (delivery/pickup, bank/cash), Screenshot 1: Catalog hero, Screenshot 2: Product detail with ml variant pills, Product definition: Kemal Usman Parfum, Decant-first explorers (target users, Bishkek) (+6 more)

### Community 26 - "Dev dependencies"
Cohesion: 0.14
Nodes (14): devDependencies, dotenv, eslint, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals, puppeteer (+6 more)

### Community 27 - "Backend API and O!Dengi client"
Cohesion: 0.29
Nodes (10): api, TODO: move IG token server-side (audit 3.3/5.4) — token is currently fetched to…, cancelOdengiInvoice(), createOdengiInvoice(), pbFetch(), pollOdengiPayment(), pb, PB_URL (+2 more)

### Community 28 - "App Store launch checklist"
Cohesion: 0.19
Nodes (13): App Store launch checklist PDF (2026-05-10, 75% readiness), Background audio mode justification for review, Code-side completed items (AppIcon, PrivacyInfo.xcprivacy, HTTPS-only ATS, iOS 16 target, Cloudflare SSL, PB port blocked), Operator launch tasks (developer account, ASC app, metadata, screenshots, privacy page, build, archive, submit), Screenshot requirements (6.7-inch and 5.5-inch sets, 3+ screens), Remove ATS NSAllowsArbitraryLoads exception, HTTPS backend via Caddy + Let's Encrypt (api.kemalusman.kg), Release Checklist (App Store submission) (+5 more)

### Community 29 - "App Review resubmission"
Cohesion: 0.23
Nodes (11): App Store screenshot pixel dimensions, In-app account deletion (Guideline 5.1.1v), Server-side demo review account, iPhone-only distribution (TARGETED_DEVICE_FAMILY=1), Local demo-catalog fallback, PrivacyInfo.xcprivacy manifest, Resolution Center reply text, Build 4 resubmission after first rejection (+3 more)

### Community 30 - "Native bridge modes"
Cohesion: 0.19
Nodes (11): CAPBridgeViewController, Equatable, Int, BarMode, admin, hidden, user, SharedBridge (+3 more)

### Community 31 - "Server setup and WhatsApp"
Cohesion: 0.21
Nodes (10): setup-server.sh script, Caddy rate limiting (per-IP/per-phone OTP, admin login, writes), update-odengi-creds.sh script, O!Dengi merchant credentials read from server env only, WhatsApp sending via server hook (Green API token server-only), Security posture map (2026-06-11), Caddy edge hardening (HTTPS+HSTS preload, frame/referrer/permissions headers, CORS, loopback PB), DoS/abuse input limits (100 items, qty 1-999, 1000-char text, 4000-char WA) (+2 more)

### Community 32 - "HTTPS and admin gateway"
Cohesion: 0.24
Nodes (10): ATS HTTPS-only (NSAllowsArbitraryLoads=false), Caddy + Let's Encrypt HTTPS for api.kemalusman.kg, 5-tap secret admin gateway, Plain-HTTP backend on bare IP, PocketBase backend, Serif italic 'Kemal Usman' wordmark, Mixed-content blocking (HTTPS page to HTTP API), Cloudflare Tunnel routing (no Caddy) (+2 more)

### Community 33 - "OTP hook and bundle tuning"
Cohesion: 0.17
Nodes (8): Deploy PocketBase server-side hooks (pb_hooks), NOTE: no bonus crediting here. Welcome + referral bonuses are credited by, Audit tasks 1-8 completion table, Bundle splitting (app chunk -31%, framer-motion own chunk), Console stripping (Terser) + Sentry error reporting, OTP hook uses setPassword()/refreshTokenKey() auth API, Crypto-random OTP codes ($security, not Math.random), OTP limits: 5/hour per phone, 5 attempts, hashed, 5-min TTL

### Community 34 - "Terms and payment rules"
Cohesion: 0.20
Nodes (11): Apple IAP exemption for physical goods, Bank-app payment link with manual admin confirmation, Terms of Use (RU, v1.0), Delivery within Bishkek only (1-3 business days) or pickup, One phone number = one account (anti bonus farming), Payment terms: M-Bank / O!Bank transfer (admin-confirmed) or cash, Perfume return policy (non-returnable except mismatch/defect/expired; 7-day claims), Kyrgyz payment rails: cash, O!Dengi, MBank (no card gateway) (+3 more)

### Community 35 - "Native web host"
Cohesion: 0.31
Nodes (5): Context, Bool, WebHostVC, .isAllowedToAdopt, UIViewController

### Community 36 - "Admin media and cart pill"
Cohesion: 0.18
Nodes (11): react, AnimatedSum(), BannerCropModal(), CropModal(), FloatingCartPill(), NavBar(), OrderReceipt(), pickAudioMime() (+3 more)

### Community 37 - "O!Dengi payment hook"
Cohesion: 0.22
Nodes (10): NOTE: all code stays inside callbacks (Goja scoping fix from v3)., Security fixes deploy guide (P0/P1/P2, 2026-06-10), Admin panel gated by real admin token (no #admin/localStorage bypass), Debug endpoints removed from production (debug_odengi, debug_variant), Fail-closed online payments (503 payment_not_configured), Money-logic integration tests (8 tests: price tamper, bonus overflow, debit, welcome dup), Payment endpoints require PB token + order ownership, ProductCard memoization (100+ catalog cards) (+2 more)

### Community 38 - "Audio descriptions and screenshots"
Cohesion: 0.20
Nodes (9): Audio fragrance descriptions (Слушать player), Dark premium + gold screenshot style, 500+ detailed perfume descriptions (top/middle/base notes), Five-screen App Store screenshot set, What's New update text (RU), UIBackgroundModes audio removal (Guideline 2.5.4), Scent profile visualization (top/heart/base notes), Product audio notes (+1 more)

### Community 39 - "Liquid Glass tab view"
Cohesion: 0.24
Nodes (10): Binding, LiquidGlassTabView, .adminTabView, .body, .userTabView, WebHost, .selectedKey, String (+2 more)

### Community 40 - "Native tab bridge"
Cohesion: 0.29
Nodes (4): .adminBinding, .userBinding, UIView, WKWebView

### Community 41 - "Bonus and referral loop"
Cohesion: 0.27
Nodes (9): Bonus program terms (default 5%, 1 bonus = 1 som, up to 30% of order, 12-month expiry), Referral program terms (friend welcome bonus; inviter bonus after friend's first order), Move bonus / order math to the server, Bonus / referral loyalty loop (settings-configurable), Principle: frictionless repeat loop, Two-phase bonus debit inside runInTransaction, Admin settings synced to PocketBase (1.2s debounce, merge on load), OTP hook v2: camelCase fields (referral system fix) (+1 more)

### Community 42 - "Pre-release checks"
Cohesion: 0.31
Nodes (9): ref_fs, ref_path, fail(), ok(), read(), ROOT, run(), section() (+1 more)

### Community 43 - "JS bridge handler"
Cohesion: 0.31
Nodes (6): BridgeMsgHandler, Void, NSObject, WKScriptMessage, WKScriptMessageHandler, WKUserContentController

### Community 44 - "Audio player state"
Cohesion: 0.42
Nodes (8): audioPlayerPause(), audioPlayerPlay(), audioPlayerSeek(), audioPlayerToggle(), _listeners, _notify(), _state, useAudioPlayer()

### Community 45 - "Demo to production migration"
Cohesion: 0.32
Nodes (8): Admin panel review note with client-side demo password, Migration Guide: demo to production, Switch LoginScreen to OTP auth (requestOtp/verifyOtp), Leaked PocketBase admin password rotation, Migration roll-back plan, Move admin login server-side (adminLogin), Remaining operator risks register, adminLogin()

### Community 46 - "Payment app deeplinks"
Cohesion: 0.39
Nodes (7): copyToClipboard(), dialPhone(), fillTemplate(), openPaymentApp(), SCHEMES, sendSms(), tryOpenUrl()

### Community 47 - "iOS native sources"
Cohesion: 0.47
Nodes (4): Capacitor, SwiftUI, UIKit, WebKit

### Community 48 - "Android setup"
Cohesion: 0.33
Nodes (6): Android Capacitor first-time setup guide, AndroidManifest config (cleartext off, bank/WhatsApp package queries, permissions), Release AAB build + upload-key signing, Target SDK 34 (Play Store requirement), LSApplicationQueriesSchemes (mbank, obank, whatsapp, tel), iOS Capacitor wrapper (App Store)

### Community 49 - "ESLint config"
Cohesion: 0.33
Nodes (5): ref_eslint_config, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals

### Community 50 - "Vite build config"
Cohesion: 0.40
Nodes (3): React + Vite template README, vite, @vitejs/plugin-react

### Community 52 - "Security test script"
Cohesion: 0.67
Nodes (3): check(), test-security.sh script, P0 security acceptance test (curl)

## Ambiguous Edges - Review These
- `CURSOR_TASK_13_ADMIN_LOGIN_FIX.md` → `deploy/Caddyfile reverse proxy`  [AMBIGUOUS]
  CURSOR_TASK_13_ADMIN_LOGIN_FIX.md · relation: references
- `iOS Capacitor wrapper (App Store)` → `Android Capacitor first-time setup guide`  [AMBIGUOUS]
  PRODUCT.md · relation: conceptually_related_to
- `Kyrgyz payment rails: cash, O!Dengi, MBank (no card gateway)` → `Payment terms: M-Bank / O!Bank transfer (admin-confirmed) or cash`  [AMBIGUOUS]
  legal/TERMS_OF_USE_RU.md · relation: conceptually_related_to
- `App Store Connect metadata (Shopping, 4+, RU description, keywords)` → `Service not intended for users under 16`  [AMBIGUOUS]
  legal/PRIVACY_POLICY_RU.md · relation: conceptually_related_to
- `O!Dengi payment webhook: mandatory hash verification` → `Bank-app payment link with manual admin confirmation`  [AMBIGUOUS]
  legal/DATA_PROTECTION_RU.md · relation: conceptually_related_to

## Knowledge Gaps
- **183 isolated node(s):** `deploy-odengi.sh script`, `deploy.sh script`, `push-to-github.sh script`, `setup-server.sh script`, `WebKit` (+178 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 270 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `CURSOR_TASK_13_ADMIN_LOGIN_FIX.md` and `deploy/Caddyfile reverse proxy`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **What is the exact relationship between `iOS Capacitor wrapper (App Store)` and `Android Capacitor first-time setup guide`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `Kyrgyz payment rails: cash, O!Dengi, MBank (no card gateway)` and `Payment terms: M-Bank / O!Bank transfer (admin-confirmed) or cash`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `App Store Connect metadata (Shopping, 4+, RU description, keywords)` and `Service not intended for users under 16`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `O!Dengi payment webhook: mandatory hash verification` and `Bank-app payment link with manual admin confirmation`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `Release Verification Report (2026-04-30)` connect `Server hardening` to `OTP hook and bundle tuning`, `Terms and payment rules`, `Push notifications deploy`, `Audio notes and banners`, `App shell and brand look`, `Bonus and referral loop`, `Package manifest`, `Demo to production migration`, `Android setup`, `Privacy and store compliance`, `Server setup and WhatsApp`?**
  _High betweenness centrality (0.068) - this node is a cross-community bridge._
- **Why does `dotenv` connect `PocketBase admin scripts` to `Pre-release checks`, `Package manifest`, `Secret leak checker`, `Server hardening`?**
  _High betweenness centrality (0.056) - this node is a cross-community bridge._