#!/bin/bash
# Kemal Usman — deploy script
# Ishlatish: ./deploy.sh

echo "🔨 Building..."
npm run build

if [ $? -ne 0 ]; then
  echo "❌ Build failed!"
  exit 1
fi

echo "🚀 Uploading to VPS..."
rsync -avz --checksum dist/ root@145.223.100.16:/var/www/parfum/

echo "✅ Done! Site updated."
