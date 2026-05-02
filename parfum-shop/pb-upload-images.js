#!/usr/bin/env node
// DEPRECATED — previously contained leaked admin password "Doniyor123" and
// hardcoded HTTP backend URL. Both are now compromised; rotate the PB admin
// password in the admin UI (Settings → Admins).
//
// To upload images, use the admin product editor (now persists images via
// the PB `file` field) or write a new env-driven script.
console.error('❌ pb-upload-images.js is deprecated. See MIGRATION_GUIDE.md.');
process.exit(1);
