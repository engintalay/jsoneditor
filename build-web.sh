#!/usr/bin/env bash
# Web onayli uretim derlemesi (Vite).
# Cikti: dist/
# Kullanim: ./build-web.sh
set -euo pipefail
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "HATA: node bulunamadi. Once Node 20+ kurun." >&2
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "node_modules yok, bagimliliklar kuruluyor..."
  npm install
fi

echo "Web derleniyor..."
npm run build:web

echo "Tamam. Cikti klasoru: dist/"
