#!/usr/bin/env node
// DEPRECATED AND DANGEROUS — this script used to open ALL PocketBase API rules
// to the public internet. Running it would re-introduce a CRITICAL data leak
// (any user could read every customer's name, phone and orders).
//
// Use scripts/pb-secure-rules.js instead, which LOCKS the rules.
console.error('❌ pb-open-all.js was a critical security hole. Use scripts/pb-secure-rules.js.');
process.exit(1);
