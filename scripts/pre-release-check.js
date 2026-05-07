// scripts/pre-release-check.js
// Run before every App Store submission. Catches the common mistakes
// that cause review rejection or, worse, ship security regressions.
//
// Run: node scripts/pre-release-check.js  (or: npm run prerelease)

import fs from 'fs';
import path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.production' });

const ROOT = process.cwd();
let passed = 0;
let failed = 0;
let warned = 0;

const ok      = (msg) => { console.log(`  ✅ ${msg}`); passed++; };
const fail    = (msg) => { console.error(`  ❌ ${msg}`); failed++; };
const warn    = (msg) => { console.warn(`  ⚠️  ${msg}`); warned++; };
const section = (title) => console.log(`\n── ${title} ──`);

const read = (rel) => {
  try { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
  catch { return null; }
};

async function run() {
  console.log('\n🚀 Pre-release check — Kemal Usman Parfum\n');

  // ── 1. Security ─────────────────────────────────────────────
  section('SECURITY');

  const appJsx = read('src/App.jsx') || '';

  // C1 — hardcoded admin password
  if (/['"]admin123['"]/.test(appJsx)) {
    fail('Hardcoded "admin123" found in App.jsx — C1 NOT fixed!');
  } else {
    ok('No hardcoded admin password');
  }

  // C3 — green-api direct calls from client
  if (appJsx.includes('green-api.com')) {
    fail('green-api.com found in App.jsx — C3 NOT fixed!');
  } else {
    ok('No green-api client calls');
  }

  // C3 — token storage on client. Match only ACTIVE storage access — naked
  // mentions in comments documenting the security fix are fine.
  const tokenStorageActive = /localStorage\.[a-zA-Z]+\(['"](?:green_token|green_instance)['"]/.test(appJsx);
  if (tokenStorageActive) {
    fail('localStorage.{get,set,remove}Item("green_token"/"green_instance") found in App.jsx — C3 NOT fixed!');
  } else {
    ok('No WA tokens in client code');
  }

  // C4 — HTTPS PB URL
  const pbUrl = process.env.VITE_PB_URL || '';
  if (pbUrl.startsWith('https://')) {
    ok(`PB URL is HTTPS: ${pbUrl}`);
  } else if (pbUrl.startsWith('http://')) {
    fail(`PB URL is HTTP — C4 NOT fixed! (${pbUrl})`);
  } else {
    fail('VITE_PB_URL not set in .env.production');
  }

  // No hardcoded staging IP
  if (appJsx.includes('145.223.100.16')) {
    fail('Hardcoded VPS IP found in App.jsx');
  } else {
    ok('No hardcoded IP addresses');
  }

  // ── 2. iOS / ATS ─────────────────────────────────────────────
  section('iOS / ATS');

  const plist = read('ios/App/App/Info.plist') || '';

  // Detect NSAllowsArbitraryLoads = true (App Store rejects this).
  // Match the key followed by <true/> with whitespace tolerance, instead
  // of a naive includes check that triggers on any unrelated <true/>.
  if (/<key>NSAllowsArbitraryLoads<\/key>\s*<true\/>/.test(plist)) {
    fail('NSAllowsArbitraryLoads = true — App Store will REJECT!');
  } else {
    ok('NSAllowsArbitraryLoads = false');
  }

  if (plist.includes('CFBundleDisplayName')) {
    ok('CFBundleDisplayName set');
  } else {
    fail('CFBundleDisplayName missing from Info.plist');
  }

  const versionMatch = plist.match(/<key>CFBundleShortVersionString<\/key>\s*<string>([^<]+)<\/string>/);
  if (versionMatch) {
    ok(`App version: ${versionMatch[1]}`);
  } else {
    fail('CFBundleShortVersionString missing');
  }

  if (plist.includes('NSPhotoLibraryUsageDescription')) {
    ok('Photo library permission string present');
  } else {
    warn('NSPhotoLibraryUsageDescription missing — needed for image picker');
  }

  if (plist.includes('UIBackgroundModes') && /<string>audio<\/string>/.test(plist)) {
    ok('Background audio mode enabled');
  } else {
    warn('Background audio not configured — audio stops when app backgrounds');
  }

  // ── 3. Build artifacts ────────────────────────────────────────
  section('BUILD');

  const distExists = fs.existsSync(path.join(ROOT, 'dist/index.html'));
  if (distExists) {
    ok('dist/ exists — build completed');
  } else {
    fail('dist/ missing — run: npm run build');
  }

  const distAssets = path.join(ROOT, 'dist/assets');
  if (fs.existsSync(distAssets)) {
    const files = fs.readdirSync(distAssets).filter(f => f.endsWith('.js'));

    // Count remaining direct console.log calls. logger.log() noops in prod
    // so this only catches pieces terser missed.
    let consoleCount = 0;
    for (const f of files) {
      const content = fs.readFileSync(path.join(distAssets, f), 'utf8');
      const m = content.match(/console\.log\s*\(/g) || [];
      consoleCount += m.length;
    }
    if (consoleCount === 0) {
      ok('No console.log in production bundle');
    } else {
      warn(`${consoleCount} console.log calls in bundle (terser may have missed some)`);
    }

    // Hardcoded admin password must not survive
    const allJs = files
      .map(f => fs.readFileSync(path.join(distAssets, f), 'utf8'))
      .join('');
    if (/['"]admin123['"]/.test(allJs)) {
      fail('"admin123" found in production bundle!');
    } else {
      ok('"admin123" not in production bundle');
    }

    // Per-chunk size report
    const sizes = files
      .map(f => ({ name: f, kb: Math.round(fs.statSync(path.join(distAssets, f)).size / 1024) }))
      .sort((a, b) => b.kb - a.kb);
    sizes.forEach(s => {
      const status = s.kb > 400 ? '⚠️' : '✅';
      console.log(`  ${status}  ${s.name}: ${s.kb} KB`);
    });
  } else {
    warn('dist/assets not found — build first');
  }

  // ── 4. Environment ────────────────────────────────────────────
  section('ENVIRONMENT');

  const envProd = read('.env.production') || '';

  if (/VITE_SENTRY_DSN=https:\/\//.test(envProd)) {
    ok('Sentry DSN configured');
  } else {
    warn('Sentry DSN not set — production crashes will be invisible');
  }

  if (/VITE_APP_ENV=production/.test(envProd)) {
    ok('APP_ENV = production');
  } else {
    warn('VITE_APP_ENV not set to production');
  }

  // .env files must not be committed
  const gitignore = read('.gitignore') || '';
  if (gitignore.includes('.env')) {
    ok('.env in .gitignore');
  } else {
    fail('.env NOT in .gitignore — secrets will leak to git!');
  }

  // ── 5. PocketBase hooks ───────────────────────────────────────
  section('POCKETBASE HOOKS');

  const hooks = ['pb_hooks/main.pb.js', 'pb_hooks/otp.pb.js', 'pb_hooks/whatsapp.pb.js'];
  for (const h of hooks) {
    if (fs.existsSync(path.join(ROOT, h))) {
      ok(`${h} exists`);
    } else {
      fail(`${h} MISSING — deploy this to the PB host!`);
    }
  }

  // Dangerous deprecated stubs must be deleted
  const dangerous = [
    'pb-open-all.js',
    'pb-fix-rules.js',
    'scripts/pb-open-all.js',
    'scripts/pb-fix-rules.js',
  ];
  for (const f of dangerous) {
    if (fs.existsSync(path.join(ROOT, f))) {
      fail(`${f} exists — DELETE before release!`);
    } else {
      ok(`${f} deleted ✓`);
    }
  }

  // ── Summary ───────────────────────────────────────────────────
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📊 ${passed} passed, ${warned} warnings, ${failed} failed`);

  if (failed > 0) {
    console.error('\n🚨 STOP — fix all ❌ before submitting to App Store\n');
    process.exit(1);
  } else if (warned > 0) {
    console.warn('\n⚠️  Warnings present — review before submission\n');
  } else {
    console.log('\n🎉 All checks passed — ready for App Store!\n');
  }
}

run().catch(err => {
  console.error('Fatal:', err.message || err);
  process.exit(1);
});
