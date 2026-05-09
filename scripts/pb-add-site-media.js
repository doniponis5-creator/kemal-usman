// scripts/pb-add-site-media.js
// Run: node scripts/pb-add-site-media.js
//
// Creates the `site_media` collection in PocketBase.
// Fields: key (text, unique), file (file).
// Used for shared media like Instagram screenshot that must be visible to ALL users.

import PocketBase from 'pocketbase';
import * as dotenv from 'dotenv';
dotenv.config();

const PB_URL = process.env.VITE_PB_URL || 'http://127.0.0.1:8090';
const ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL;
const ADMIN_PASS = process.env.PB_ADMIN_PASS || process.env.PB_ADMIN_PASSWORD;

if (!ADMIN_EMAIL || !ADMIN_PASS) {
  console.error('❌ Set PB_ADMIN_EMAIL and PB_ADMIN_PASS in .env');
  process.exit(1);
}

const pb = new PocketBase(PB_URL);

async function setup() {
  console.log('📦 Creating site_media collection...\n');
  await pb.admins.authWithPassword(ADMIN_EMAIL, ADMIN_PASS);
  console.log('✅ Authenticated\n');

  // Check if collection already exists
  try {
    await pb.collections.getOne('site_media');
    console.log('ℹ️  site_media collection already exists — skipping.\n');
    return;
  } catch {
    // doesn't exist — create it
  }

  await pb.collections.create({
    name: 'site_media',
    type: 'base',
    schema: [
      {
        name: 'key',
        type: 'text',
        required: true,
        options: { min: 1, max: 100 },
      },
      {
        name: 'file',
        type: 'file',
        required: false,
        options: {
          maxSelect: 1,
          maxSize: 5242880, // 5MB
          mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
        },
      },
    ],
    indexes: ['CREATE UNIQUE INDEX idx_site_media_key ON site_media (key)'],
    listRule: '',
    viewRule: '',
    createRule: '',
    updateRule: '',
    deleteRule: '',
  });

  console.log('✅ site_media collection created!\n');
  console.log('Now run: node scripts/pb-secure-rules.js  (to lock down access)\n');
}

setup().catch(e => { console.error('❌', e); process.exit(1); });
