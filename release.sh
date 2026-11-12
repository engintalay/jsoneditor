#!/usr/bin/env bash
# Versiyon yukseltme + git commit/tag.
#
# Tek kaynak: package.json.
#   - src-tauri/tauri.conf.json "version": "../package.json" referansiyla
#     deb/rpm/AppImage paket adlarini bu numaradan uretir.
#   - src-tauri/Cargo.toml surumu bu betikle senkronlanir.
#   - Arayuz (durum cubugu) vite `define` ile ayni numarayi gosterir.
#
# Kullanim:
#   ./release.sh patch          # 0.1.0 -> 0.1.1
#   ./release.sh minor          # 0.1.0 -> 0.2.0
#   ./release.sh major          # 0.1.0 -> 1.0.0
#   ./release.sh 1.2.3          # dogrudan surum ata
set -euo pipefail
cd "$(dirname "$0")"

bump="${1:-}"
case "$bump" in
  major|minor|patch) ;;
  [0-9]*.[0-9]*.[0-9]*) bump="$bump" ;;
  *)
    echo "Kullanim: ./release.sh <major|minor|patch|X.Y.Z>" >&2
    exit 1
    ;;
esac

if [ -n "$(git tag -l "$bump")" ]; then
  echo "HATA: $bump icin zaten git tag'i var." >&2
  exit 1
fi
if ! git diff --quiet -- package.json package-lock.json src-tauri/Cargo.toml; then
  echo "HATA: surum dosyalarinda commit edilmemis degisiklik var;" >&2
  echo "once bunlari commit edin veya geri alin." >&2
  exit 1
fi

# package.json + package-lock.json guncellenir (tag'i biz atacagiz).
npm version "$bump" --no-git-tag-version --allow-same-version >/dev/null
ver="$(node -p "require('./package.json').version")"

# Cargo.toml [package] surumunu esitle (dosyadaki ilk version satiri).
sed -i "0,/^version = \"[^\"]*\"/s//version = \"$ver\"/" src-tauri/Cargo.toml

git add package.json package-lock.json src-tauri/Cargo.toml
git commit -m "chore(release): $ver"
git tag "$ver"

echo "Surum $ver: commit + tag olusturuldu."
echo "Dagitim paketleri icin: ./build-desktop.sh"
