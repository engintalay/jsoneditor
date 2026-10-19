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

# Sistem .pc dizinleri her zaman yolda olmali (ozellikle brew pkg-config
# kullaniliyorsa varsayilan arama yolu sistem dizinlerini icermez).
export PKG_CONFIG_PATH="/usr/lib/x86_64-linux-gnu/pkgconfig:/usr/lib/pkgconfig:/usr/share/pkgconfig${PKG_CONFIG_PATH:+:$PKG_CONFIG_PATH}"

# Hala eksik kalan basliklar varsa (sudosuz makine), .deb'leri kullanici
# alanina acip pkg-config'i oraya da yonlendirir (idempotent).
SYSROOT="$HOME/.cache/jsoneditor-sysroot"
PC_DIR="$SYSROOT/usr/lib/x86_64-linux-gnu/pkgconfig"
need_sysroot=0
for pc in dbus-1 cairo pango atk gdk-pixbuf-2.0 libsoup-3.0 webkit2gtk-4.1 javascriptcoregtk-4.1; do
  PKG_CONFIG_PATH="$PKG_CONFIG_PATH" pkg-config --exists "$pc" 2>/dev/null || need_sysroot=1
done
if [ "$need_sysroot" -eq 1 ]; then
  echo "Eksik sistem basliklari kullanici alanina kuruluyor (sudo gerekmez)..."
  mkdir -p "$SYSROOT"
  TMPD="$(mktemp -d)"
  (cd "$TMPD" && apt-get download libdbus-1-dev libcairo2-dev libpango1.0-dev libatk1.0-dev libgdk-pixbuf-2.0-dev libsoup-3.0-dev libwebkit2gtk-4.1-dev libjavascriptcoregtk-4.1-dev >/dev/null 2>&1)
  for f in "$TMPD"/*.deb; do dpkg-deb -x "$f" "$SYSROOT"; done
  rm -rf "$TMPD"
  grep -rl "^prefix=/usr" "$PC_DIR" | while read -r pc; do
    sed -i "s|^prefix=/usr|prefix=$SYSROOT/usr|" "$pc"
  done
  export PKG_CONFIG_PATH="$PC_DIR:$PKG_CONFIG_PATH"
fi

if [ ! -d node_modules ]; then
  echo "node_modules yok, bagimliliklar kuruluyor..."
  npm install
fi

echo "Masaustu uygulamasi baslatiliyor (Tauri dev)..."
# Kurumsal proxy WebKit'in localhost/127.0.0.1 isteklerine de engel
# oluyor ("loopback from external IP"); yerel dev sunucusu icin proxy
# degiskenlerini uygulamadan temizleyerek ciktiyoruz.
exec env -u HTTP_PROXY -u HTTPS_PROXY -u http_proxy -u https_proxy \
  -u ALL_PROXY -u all_proxy -u NO_PROXY -u no_proxy \
  npm run dev:tauri
