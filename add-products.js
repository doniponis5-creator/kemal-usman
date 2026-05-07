#!/usr/bin/env node
// DEPRECATED — this script previously contained a hardcoded admin password
// ("doni96doni019-s") and a hardcoded HTTP backend URL.
//
// It has been REMOVED from the working tree as part of the production hardening.
// The leaked password is in git history — ROTATE IT NOW at https://<your-domain>/_/.
//
// To seed products instead:
//   1. Use the admin UI at https://api.kemalusman.kg/_/
//   2. Or write a new script using env-driven config:
//        PB_URL=$VITE_PB_URL PB_TOKEN=$(cat .pb_token) node your-script.js
//
// Refer to MIGRATION_GUIDE.md.

console.error('❌ add-products.js is deprecated. See MIGRATION_GUIDE.md.');
process.exit(1);
