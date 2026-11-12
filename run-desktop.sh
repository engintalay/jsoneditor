#!/usr/bin/env bash
# Gercek masaustu uygulamasi (Tauri): native pencere + tam dosya sistemi erisimi.
# Kullanim: ./run-desktop.sh
set -euo pipefail
cd "$(dirname "$0")"
export LC_ALL=C   # apt-cache/sed ciktilari sabit dilde olmali

missing=0

# crypto-common vendor kopyasindaki generic-array 0.14 deprecated uyarilari
# susturulur (idempotent; vendor yeniden kurulsa da uygulanir).
if [ -f vendor/crypto-common/Cargo.toml ] && \
   ! grep -q '^\[lints.rust\]' vendor/crypto-common/Cargo.toml; then
  printf '\n[lints.rust]\ndeprecated = "allow"\n' >> vendor/crypto-common/Cargo.toml
fi

if ! command -v node >/dev/null 2>&1; then
  echo "HATA: node bulunamadi. Once Node 20+ kurun." >&2
  missing=1
fi

if ! command -v cargo >/dev/null 2>&1 || ! command -v rustc >/dev/null 2>&1; then
  echo "HATA: Rust bulunamadi. Kurmak icin: https://rustup.rs/" >&2
  missing=1
fi

if [ "$missing" -eq 1 ]; then
  exit 1
fi

# Sistem .pc dizinleri her zaman yolda olmali (ozellikle brew pkg-config
# kullaniliyorsa varsayilan arama yolu sistem dizinlerini icermez).
export PKG_CONFIG_PATH="/usr/lib/x86_64-linux-gnu/pkgconfig:/usr/lib/pkgconfig:/usr/share/pkgconfig${PKG_CONFIG_PATH:+:$PKG_CONFIG_PATH}"

SYSROOT="$HOME/.cache/jsoneditor-sysroot"
PC_DIR="$SYSROOT/usr/lib/x86_64-linux-gnu/pkgconfig"

# Tauri/WebKit derlemesi icin pkg-config'te bulunmasi sarta kosulan .pc'ler.
NEEDED_PC="glib-2.0 gtk+-3.0 atk cairo pango gdk-pixbuf-2.0 dbus-1 \
libsoup-3.0 webkit2gtk-4.1 javascriptcoregtk-4.1 librsvg-2.0"

pc_missing() {
  local pc
  for pc in $NEEDED_PC; do
    pkg-config --exists "$pc" 2>/dev/null || return 0
  done
  return 1
}

# Sysroot'a indirilecek paketleri apt-veritabanindan cozer: recursive
# kapatimdaki tum *-dev paketleri + bunlarin dogrudan lib bagimliliklari.
sysroot_packages() {
  local base="libwebkit2gtk-4.1-dev libjavascriptcoregtk-4.1-dev librsvg2-dev"
  local devs rt p
  devs=$(apt-cache depends --recurse --no-recommends --no-suggests \
      --no-conflicts --no-breaks --no-replaces --no-enhances $base 2>/dev/null |
    grep -vE '^[[:space:]]|^$' | sed 's/:$//' | grep -E -- '-dev$' | sort -u)
  rt=""
  for p in $devs; do
    # 'Depends: pkg', 'Depends: <sanal>' ve sanal alternatif satirlarini cozer.
    rt="$rt
$(apt-cache depends "$p" 2>/dev/null |
  sed -n 's/^[[:space:]]*\([^:]*: \)\{0,1\}<\{0,1\}\([a-z0-9][a-z0-9.+-]*\)>\{0,1\}$/\2/p' |
  grep -E '^lib')"
  done
  printf '%s\n%s\n%s\n' "$devs" "$rt" "$base" | grep -v '^$' | sort -u
}

# Hala eksik kalan basliklar varsa (sudosuz makine), .deb'leri kullanici
# alanina acip pkg-config'i oraya da yonlendirir (idempotent).
export PKG_CONFIG_PATH="$PC_DIR:$PKG_CONFIG_PATH"
if command -v apt-get >/dev/null 2>&1 && pc_missing; then
  echo "Eksik sistem basliklari kullanici alanina kuruluyor (sudo gerekmez)..."
  mkdir -p "$SYSROOT"
  TMPD="$(mktemp -d)"
  pkgs=""
  for p in $(sysroot_packages); do
    apt-cache policy "$p" 2>/dev/null | grep -qE 'Candidate: (none|\(none\))$' ||
      pkgs="$pkgs $p"
  done
  # apt-get download tek seferde basarisiz olursa paket paket dene.
  if ! (cd "$TMPD" && apt-get download $pkgs >/dev/null 2>&1); then
    for p in $pkgs; do
      (cd "$TMPD" && apt-get download "$p" >/dev/null 2>&1) ||
        echo "UYARI: indirilemedi (atlandi): $p" >&2
    done
  fi
  for f in "$TMPD"/*.deb; do
    [ -e "$f" ] && dpkg-deb -x "$f" "$SYSROOT"
  done
  rm -rf "$TMPD"
  # .pc dosyalardaki mutlak /usr yollarini sysroot'a cevir.
  while IFS= read -r pc; do
    sed -i "s|^prefix=/usr|prefix=$SYSROOT/usr|" "$pc"
  done < <(grep -rl '^prefix=/usr' "$PC_DIR" 2>/dev/null || true)
fi

if pc_missing; then
  echo "HATA: pkg-config gerekli kütüphaneleri bulamiyor." >&2
  for pc in $NEEDED_PC; do
    pkg-config --exists "$pc" 2>/dev/null ||
      echo "  eksik: $pc" >&2
  done
  echo "" >&2
  echo "Cozum icin sistem paketlerini kurmayi deneyin:" >&2
  echo "  sudo apt-get install -y libwebkit2gtk-4.1-dev librsvg2-dev" >&2
  exit 1
fi

# WebKit (glib-networking) sistem proxy ayarini okur ve manuel modda
# localhost/127.0.0.1 isteklerini de proxyye yonlendirebilir; kurumsal
# proxy bunlari "loopback from external IP" olarak reddeder.
if command -v gsettings >/dev/null 2>&1; then
  if [ "$(gsettings get org.gnome.system.proxy mode 2>/dev/null)" = "'manual'" ]; then
    echo "UYARI: Sistem proxy ayari 'manual' - WebKit localhost isteklerini" >&2
    echo "  engelleyebilir ('loopback from external IP' hatasi). Gerekirse:" >&2
    echo "  gsettings set org.gnome.system.proxy mode 'none'" >&2
  fi
fi

if [ ! -d node_modules ]; then
  echo "node_modules yok, bagimliliklar kuruluyor..."
  npm install
fi

echo "Masaustu uygulamasi baslatiliyor (Tauri dev)..."
# Web istemcisi icin HTTP dosya sunucusu: JSONEDITOR_FS_ROOT verilirse
# Tauri ayni islem icinde 0.0.0.0:${JSONEDITOR_FS_PORT:-1422} dinler.
if [ -n "${JSONEDITOR_FS_ROOT:-}" ]; then
  echo "  + web fs sunucusu acik olacak: ${JSONEDITOR_FS_ROOT} (port ${JSONEDITOR_FS_PORT:-1422})"
fi
# Kurumsal proxy WebKit'in localhost/127.0.0.1 isteklerine de engel
# oluyor ("loopback from external IP"). WebKit'in resolver'i libproxy'dir
# (kioslaverc + gsettings okur); ikisine de loopback'i disinda birakma
# kaydi eklenmis olsa da ek guvence olarak no_proxy'yi burada veriyoruz.
exec env -u HTTP_PROXY -u HTTPS_PROXY -u http_proxy -u https_proxy \
  -u ALL_PROXY -u all_proxy \
  no_proxy="localhost,127.0.0.1,::1,10.*,*.gelirler.gov.tr,*.gib.gov.tr,*.gelbim.gov.tr" \
  NO_PROXY="localhost,127.0.0.1,::1,10.*,*.gelirler.gov.tr,*.gib.gov.tr,*.gelbim.gov.tr" \
  npm run dev:tauri
