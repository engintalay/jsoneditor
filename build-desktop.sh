#!/usr/bin/env bash
# Gercek masaustu uygulamasi (Tauri) uretim derlemesi.
# Cikti: src-tauri/target/release/bundle/
# Kullanim: ./build-desktop.sh
#
# Sistem dev paketleri (libwebkit2gtk-4.1-dev vb.) kurulu degilse, sudo
# gerektirmeden kullanici alanina (~/.cache/jsoneditor-sysroot) .deb paketleri
# acilir ve pkg-config oraya yonlendirilir. Paket listesi manuel degil,
# pkg-config ihtiyacina gore apt-veritabanindan otomatik cozulur:
#   - dev paketlerinin ozdes olmayan recursive kapatimi icindeki tum *-dev
#     paketleri (.pc dosyalari icin),
#   - bu dev paketlerinin dogrudan bagimli oldugu kutuphane paketleri
#     (baglanti sirasi gereken .so/.so.N dosyalari icin).
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

if ! command -v pkg-config >/dev/null 2>&1; then
  echo "HATA: pkg-config bulunamadi. Kurmak icin: sudo apt-get install pkg-config" >&2
  missing=1
fi

if [ "$missing" -eq 1 ]; then
  exit 1
fi

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

# Sysroot'a indirilecek paketleri apt-veritabanindan cozer.
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

if command -v apt-get >/dev/null 2>&1 && pc_missing; then
  # Sistemde eksik olan dev paketlerini kullanici alanina kur (sudo gerekmez).
  # Once pkg-config yolu sysroot'u da gorecek bicilde genisletilir; boylece
  # kismi eski sysroot'ta eksikler dogru sekilde algilanir.
  export PKG_CONFIG_PATH="$PC_DIR:$PKG_CONFIG_PATH"
  if pc_missing; then
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
fi

# AppImage paketlemesindeki gtk plugin'i bu dizinleri kosulsuz kopyalar;
# sysroot'ta yoklarsa paketleme kotu sonuclaniyor (bos dizin yeterli,
# tipelib/gio modulleri bu uygulamada kullanilmiyor).
if [ -d "$PC_DIR" ]; then
  mkdir -p "$SYSROOT/usr/lib/x86_64-linux-gnu/girepository-1.0" \
           "$SYSROOT/usr/lib/x86_64-linux-gnu/gio/modules"
fi

# linuxdeploy-plugin-gtk, libdir yolunu LD_GTK_LIBRARY_PATH onekiyle
# normalize eder. GTK sysroot'tan cozuluyorsa ikisi ayni olmali; yoksa
# immodules.cache yolu bozulup paketleme hata veriyor. Degeri plugin'in
# kendi sorgusuyla (pkg-config) ayni kaynaktan aliyoruz.
gtk_libdir="$(pkg-config --variable=libdir gtk+-3.0 2>/dev/null || true)"
case "$gtk_libdir" in
  "$SYSROOT"/*) export LD_GTK_LIBRARY_PATH="$gtk_libdir" ;;
esac

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

echo "Web arayuzu derleniyor..."
npm run build:web

echo "Masaustu uygulamasi derleniyor (Tauri build)..."
exec env CARGO_NET_OFFLINE=true \
  CARGO_OFFLINE=true \
  no_proxy="localhost,127.0.0.1,::1,10.*,*.gelirler.gov.tr,*.gib.gov.tr,*.gelbim.gov.tr" \
  NO_PROXY="localhost,127.0.0.1,::1,10.*,*.gelirler.gov.tr,*.gib.gov.tr,*.gelbim.gov.tr" \
  npm run build:desktop
