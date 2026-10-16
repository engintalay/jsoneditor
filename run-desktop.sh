#!/usr/bin/env bash
# Gercek masaustu uygulamasi (Tauri): native pencere + tam dosya sistemi erisimi.
# Kullanim: ./run-desktop.sh
set -euo pipefail
cd "$(dirname "$0")"

missing=0

if ! command -v node >/dev/null 2>&1; then
  echo "HATA: node bulunamadi. Once Node 20+ kurun." >&2
  missing=1
fi

if ! command -v cargo >/dev/null 2>&1 || ! command -v rustc >/dev/null 2>&1; then
  echo "HATA: Rust bulunamadi. Kurmak icin: https://rustup.rs/" >&2
  missing=1
fi

if command -v dpkg >/dev/null 2>&1; then
  for pkg in libwebkit2gtk-4.1-dev librsvg2-dev; do
    if ! dpkg -s "$pkg" >/dev/null 2>&1; then
      echo "HATA: sistem paketi eksik: $pkg" >&2
      missing=1
    fi
  done
  if [ "$missing" -eq 1 ]; then
    echo "" >&2
    echo "Eksik sistem bagimliliklarini kurmak icin:" >&2
    echo "  sudo apt-get install -y libwebkit2gtk-4.1-dev librsvg2-dev" >&2
  fi
fi

if [ "$missing" -eq 1 ]; then
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "node_modules yok, bagimliliklar kuruluyor..."
  npm install
fi

echo "Masaustu uygulamasi baslatiliyor (Tauri dev)..."
exec npm run dev:tauri
