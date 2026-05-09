#!/usr/bin/env node
/**
 * PocketBase: Add sale/discount fields to "products" collection.
 *
 * Run ONCE on the server or locally:
 *   node pb-add-sale-fields.js
 *
 * Fields added:
 *   - salePercent (number)  — discount percentage (0 = no sale)
 *   - saleEnd     (text)    — ISO datetime when sale expires
 *   - saleStart   (text)    — ISO datetime when sale started
 *
 * Safe to re-run — checks if fields already exist.
 */

const PB_URL = process.env.PB_URL || 'http://145.223.100.16:8090';
const ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL || 'admin@admin.com';
const ADMIN_PASS = process.env.PB_ADMIN_PASS || '';

if (!ADMIN_PASS) {
  console.error('Usage: PB_ADMIN_PASS=yourpassword node pb-add-sale-fields.js');
  console.error('  or:  PB_ADMIN_PASS=yourpassword PB_ADMIN_EMAIL=you@mail.com node pb-add-sale-fields.js');
  process.exit(1);
}

async function main() {
  // 1. Login as admin
  console.log(`Logging in to ${PB_URL}...`);

  let token;
  // Try legacy admin endpoint first
  let res = await fetch(`${PB_URL}/api/admins/auth-with-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: ADMIN_EMAIL, password: ADMIN_PASS }),
  });

  if (!res.ok && res.status === 404) {
    // Try new _superusers endpoint
    res = await fetch(`${PB_URL}/api/collections/_superusers/auth-with-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity: ADMIN_EMAIL, password: ADMIN_PASS }),
    });
  }

  if (!res.ok) {
    console.error('Login failed:', res.status, await res.text());
    process.exit(1);
  }

  const auth = await res.json();
  token = auth.token;
  console.log('Logged in successfully.');

  // 2. Get products collection schema
  res = await fetch(`${PB_URL}/api/collections/products`, {
    headers: { Authorization: token },
  });

  if (!res.ok) {
    console.error('Failed to get products collection:', res.status);
    process.exit(1);
  }

  const collection = await res.json();
  const existingFields = (collection.schema || []).map(f => f.name);
  console.log('Existing fields:', existingFields.join(', '));

  // 3. Add missing fields
  const newFields = [];

  if (!existingFields.includes('salePercent')) {
    newFields.push({
      name: 'salePercent',
      type: 'number',
      required: false,
      options: { min: 0, max: 90 },
    });
  } else {
    console.log('  salePercent already exists — skipping');
  }

  if (!existingFields.includes('saleEnd')) {
    newFields.push({
      name: 'saleEnd',
      type: 'text',
      required: false,
    });
  } else {
    console.log('  saleEnd already exists — skipping');
  }

  if (!existingFields.includes('saleStart')) {
    newFields.push({
      name: 'saleStart',
      type: 'text',
      required: false,
    });
  } else {
    console.log('  saleStart already exists — skipping');
  }

  if (newFields.length === 0) {
    console.log('\nAll sale fields already exist. Nothing to do.');
    return;
  }

  // 4. Update collection schema
  const updatedSchema = [...(collection.schema || []), ...newFields];

  res = await fetch(`${PB_URL}/api/collections/products`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: token,
    },
    body: JSON.stringify({ schema: updatedSchema }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('Failed to update schema:', res.status, err);
    process.exit(1);
  }

  console.log(`\nAdded ${newFields.length} field(s): ${newFields.map(f => f.name).join(', ')}`);
  console.log('Done! Products collection now supports sale/discount fields.');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
