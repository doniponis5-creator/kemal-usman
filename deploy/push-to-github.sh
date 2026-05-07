#!/usr/bin/env bash
# Initialize git, commit everything, and push to GitHub.
# Run this on your Mac (NOT inside the Cowork sandbox).
#
# Usage:
#   1. Create an empty repo on GitHub: https://github.com/new
#      Name suggestion: parfum-shop  (private!)
#      Do NOT add README / .gitignore / license — we already have them.
#
#   2. Run this script with the SSH or HTTPS URL of your new repo:
#        bash deploy/push-to-github.sh git@github.com:YOUR_USER/parfum-shop.git
#      or
#        bash deploy/push-to-github.sh https://github.com/YOUR_USER/parfum-shop.git
#
# What it does:
#   - Cleans any half-initialised .git from the sandbox (sudo prompt may appear)
#   - Initialises a fresh repo on branch `main`
#   - Stages all files (respects .gitignore — .env / pb_data / node_modules / ios builds excluded)
#   - Sanity-checks no leaked secret pattern is staged
#   - Makes one comprehensive initial commit
#   - Adds the remote and pushes
#
# Safe to re-run — it auto-detects already-initialised repos.

set -euo pipefail

REMOTE_URL="${1:-}"
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$PROJECT_DIR"
echo "▶ Working in: $PROJECT_DIR"

# 1. Clean half-broken .git from the sandbox if it exists.
if [ -d .git ] && [ ! -f .git/HEAD ]; then
    echo "▶ Cleaning half-initialised .git (may need sudo)…"
    sudo rm -rf .git
fi

# 2. Initialise git if needed.
if [ ! -d .git ]; then
    echo "▶ git init"
    git init -b main
fi

# 3. Local identity (only set if missing — won't override your global config).
git config user.email >/dev/null 2>&1 || git config user.email "doniponis5@gmail.com"
git config user.name  >/dev/null 2>&1 || git config user.name  "Doniyor Abduganiev"

# 4. Stage.
echo "▶ Staging files (gitignore respected)…"
git add -A

# 5. Sanity check: refuse to commit if any leaked-secret pattern slipped in.
if git diff --cached -U0 | grep -E '(Doniyor123|doni96doni019-s|ADMIN_PASSWORD\s*=\s*"[^"]+")' >/dev/null 2>&1; then
    echo "❌ Leaked secret pattern detected in staged content. Aborting."
    echo "   Inspect with: git diff --cached | grep -E '(Doniyor123|doni96doni019-s)'"
    exit 1
fi

# 6. Commit (skip if there's already a commit and nothing changed).
if git rev-parse --verify HEAD >/dev/null 2>&1 && git diff --cached --quiet; then
    echo "▶ No changes to commit."
else
    git commit -m "Initial production release: secure backend + premium UI

Backend hardening
- Server-side bonus / order validation in pb_hooks (no localStorage trust)
- SMS-OTP auth via /api/custom/otp/{request,verify}
- Strict PocketBase API rules (replaces leaked open-all script)
- Account-deletion endpoint (Apple guideline 5.1.1.v compliance)
- Caddy reverse proxy + Lets Encrypt + rate-limit module
- systemd hardening + daily SQLite backup cron

Frontend
- Premium iOS-style glass navbar with liquid bubble (layoutId animation)
- Edge-swipe-to-dismiss on product detail
- Order timeline tracker (Dominos-style 5-step pulse)
- Welcome bonus celebration (confetti + counter)
- Pull-to-refresh on catalog
- Spring animations everywhere (Framer Motion)
- Capacitor haptics + status bar + splash screen
- Inline-SVG bank logos (replaces missing /public assets)
- M-Bank / O-Bank deep links via Capacitor App.openUrl with copy / dial fallbacks
- Native-feel CSS (overscroll behaviour, safe-area tokens, fluid type)

i18n
- react-i18next + ru/kg JSON resources (deduplicated)
- Custom ESLint rule: no hardcoded Cyrillic in JSX

Mobile
- Info.plist permission strings + URL schemes (mbank/obank/whatsapp)
- Android Capacitor setup docs + manifest
- Account deletion flow

DevOps
- .env / .env.example, secrets out of repo
- GitHub Actions CI: lint + build + secret regex + npm audit
- Legal docs: Privacy Policy / Terms / Data Protection (RU)
"
fi

# 7. Remote.
if [ -n "$REMOTE_URL" ]; then
    if git remote get-url origin >/dev/null 2>&1; then
        echo "▶ Updating remote origin → $REMOTE_URL"
        git remote set-url origin "$REMOTE_URL"
    else
        echo "▶ Adding remote origin → $REMOTE_URL"
        git remote add origin "$REMOTE_URL"
    fi
elif ! git remote get-url origin >/dev/null 2>&1; then
    echo
    echo "⚠️  No remote configured and no URL passed."
    echo "   Re-run with your GitHub repo URL:"
    echo "      bash deploy/push-to-github.sh git@github.com:YOUR_USER/parfum-shop.git"
    exit 0
fi

# 8. Push.
echo "▶ Pushing to $(git remote get-url origin)…"
git push -u origin main

echo
echo "✅ Done. Repo URL: $(git remote get-url origin)"
