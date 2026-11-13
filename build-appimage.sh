#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

echo "==> JSON Editor - Linux AppImage & Binary Build Script"

# 1. Check required Ubuntu/Debian packages for Tauri v2 + AppImage
REQUIRED_PKGS=(
  libwebkit2gtk-4.1-dev
  libgtk-3-dev
  libsoup-3.0-dev
  libgdk-pixbuf-2.0-dev
  libayatana-appindicator3-dev
  librsvg2-dev
  libdbus-1-dev
  libssl-dev
  libxdo-dev
  build-essential
  pkg-config
  patchelf
  desktop-file-utils
  xdg-utils
  file
  wget
  curl
)

MISSING_PKGS=()
if command -v dpkg-query >/dev/null 2>&1; then
  for pkg in "${REQUIRED_PKGS[@]}"; do
    if ! dpkg-query -W -f='${Status}' "$pkg" 2>/dev/null | grep -q "install ok installed"; then
      MISSING_PKGS+=("$pkg")
    fi
  done
fi

if [ "${#MISSING_PKGS[@]}" -gt 0 ]; then
  echo "==> Eksik sistem paketleri tespit edildi: ${MISSING_PKGS[*]}"
  echo "==> Kurulum yapılıyor (sudo yetkisi gerekir)..."
  sudo apt-get update
  sudo apt-get install -y "${MISSING_PKGS[@]}"
fi

# 2. Force system pkg-config paths (prevents Homebrew/Conda pkg-config conflicts)
if [ -x /usr/bin/pkg-config ]; then
  export PKG_CONFIG=/usr/bin/pkg-config
fi
export PKG_CONFIG_PATH="/usr/lib/x86_64-linux-gnu/pkgconfig:/usr/lib/pkgconfig:/usr/share/pkgconfig${PKG_CONFIG_PATH:+:$PKG_CONFIG_PATH}"

# 3. Prevent linuxdeploy strip failure on modern Ubuntu (RELR ELF section issue)
export NO_STRIP=true

# 4. Ensure vendor/ directory exists for [patch.crates-io] (proxy workaround)
ensure_vendor_crate() {
  local name="$1"
  local ver="$2"
  local target_dir="$ROOT_DIR/vendor/$name"

  if [ -f "$target_dir/Cargo.toml" ]; then
    return 0
  fi

  echo "==> vendor/$name eksik, yerel önbellekten/yedekten hazırlanıyor..."
  mkdir -p "$ROOT_DIR/vendor"

  # 4a. Check sibling backup directory
  if [ -f "$ROOT_DIR/../jsoneditor.bak/vendor/$name/Cargo.toml" ]; then
    cp -r "$ROOT_DIR/../jsoneditor.bak/vendor/$name" "$target_dir"
    return 0
  fi

  # 4b. Check ~/.cargo/registry/src
  local src_match
  src_match="$(find "$HOME/.cargo/registry/src" -maxdepth 2 -type d -name "${name}-${ver}" 2>/dev/null | head -n 1 || true)"
  if [ -n "$src_match" ] && [ -f "$src_match/Cargo.toml" ]; then
    cp -r "$src_match" "$target_dir"
    return 0
  fi

  # 4c. Check ~/.cargo/registry/cache (.crate tarball)
  local crate_match
  crate_match="$(find "$HOME/.cargo/registry/cache" -maxdepth 2 -type f -name "${name}-${ver}.crate" 2>/dev/null | head -n 1 || true)"
  if [ -n "$crate_match" ]; then
    local tmpd
    tmpd="$(mktemp -d)"
    tar -xzf "$crate_match" -C "$tmpd"
    if [ -d "$tmpd/${name}-${ver}" ]; then
      mv "$tmpd/${name}-${ver}" "$target_dir"
      rm -rf "$tmpd"
      return 0
    fi
    rm -rf "$tmpd"
  fi

  # 4d. Fallback: clone from GitHub for crypto-common
  if [ "$name" = "crypto-common" ]; then
    local tmpd
    tmpd="$(mktemp -d)"
    if git clone --depth 1 --branch "crypto-common-v${ver}" https://github.com/RustCrypto/traits "$tmpd/traits" >/dev/null 2>&1; then
      cp -r "$tmpd/traits/crypto-common" "$target_dir"
      rm -rf "$tmpd"
      return 0
    fi
    rm -rf "$tmpd"
  fi

  echo "HATA: vendor/$name (${ver}) bulunamadı ve indirilemedi!" >&2
  return 1
}

if grep -q '^\[patch\.crates-io\]' "$ROOT_DIR/src-tauri/Cargo.toml" 2>/dev/null; then
  ensure_vendor_crate "crypto-common" "0.1.6"
  ensure_vendor_crate "generic-array" "0.14.9"
  ensure_vendor_crate "typenum" "1.20.1"

  if [ -f "$ROOT_DIR/vendor/crypto-common/Cargo.toml" ] && \
     ! grep -q '^\[lints\.rust\]' "$ROOT_DIR/vendor/crypto-common/Cargo.toml"; then
    printf '\n[lints.rust]\ndeprecated = "allow"\n' >> "$ROOT_DIR/vendor/crypto-common/Cargo.toml"
  fi
fi

# 5. Install npm dependencies if node_modules is missing
if [ ! -d "node_modules" ]; then
  echo "==> node_modules bulunamadı, npm install çalıştırılıyor..."
  npm install
fi

# 6. Build AppImage (and standalone release binary)
BUNDLES="${1:-appimage}"
echo "==> Tauri derlemesi başlatılıyor (bundles: ${BUNDLES})..."
export no_proxy="localhost,127.0.0.1,::1,10.*,*.gelirler.gov.tr,*.gib.gov.tr,*.gelbim.gov.tr"
export NO_PROXY="$no_proxy"
npx tauri build --bundles "$BUNDLES"

# 7. Collect outputs into ./release-linux/
OUT_DIR="$ROOT_DIR/release-linux"
mkdir -p "$OUT_DIR"

for bin_candidate in "$ROOT_DIR/src-tauri/target/release/jsoneditor" "$ROOT_DIR/src-tauri/target/release/app"; do
  if [ -f "$bin_candidate" ]; then
    cp -f "$bin_candidate" "$OUT_DIR/jsoneditor"
    chmod +x "$OUT_DIR/jsoneditor"
    break
  fi
done

APPIMAGE_DIR="$ROOT_DIR/src-tauri/target/release/bundle/appimage"
if [ -d "$APPIMAGE_DIR" ]; then
  find "$APPIMAGE_DIR" -maxdepth 1 -name "*.AppImage" -exec cp -f {} "$OUT_DIR/" \;
  chmod +x "$OUT_DIR"/*.AppImage 2>/dev/null || true
fi

echo ""
echo "==> Derleme tamamlandı! Çıktılar:"
ls -lh "$OUT_DIR"
