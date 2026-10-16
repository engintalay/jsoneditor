#!/usr/bin/env bash
# Web onizleme: masaustu hissiyatli arayuz tarayicida calisir.
# Kullanim: ./run-web.sh
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

echo "Web onizleme baslatiliyor -> http://localhost:1420/"
echo "(Durdurmak icin Ctrl+C)"
exec npm run dev:web
