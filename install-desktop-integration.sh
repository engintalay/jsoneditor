#!/bin/bash
# JSON Editor - Linux Desktop Integration Script
# Bu script .desktop dosyasını ve MIME type'ı sisteme kurar

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$SCRIPT_DIR/src-tauri/target/release/bundle/appimage"
DESKTOP_FILE="jsoneditor.desktop"
MIME_FILE="x-jsoneditor.xml"

echo "=== JSON Editor Desktop Integration ==="
echo ""

# Uygulama yolunu bul
APP_IMAGE="$APP_DIR/JSON Editor_0.1.0_amd64.AppImage"
if [ ! -f "$APP_IMAGE" ]; then
    echo "Hata: AppImage bulunamadı: $APP_IMAGE"
    echo "Lütfen önce 'npm run build' ve 'cd src-tauri && tauri build' komutlarını çalıştırın."
    exit 1
fi

# .desktop dosyasını oluştur
# AppImage yolu boşluk içerdiği için tırnak işareti ile sarılmalı
APP_IMAGE_ESCAPED="\"$APP_IMAGE\""
DESKTOP_CONTENT="[Desktop Entry]
Name=JSON Editor
Exec=$APP_IMAGE_ESCAPED %F
Type=Application
MimeType=application/json;application/jsonc
Extensions=json,jsonc
Icon=$SCRIPT_DIR/src-tauri/icons/128x128.png
Categories=Utility;TextEditor;
Terminal=false
SingleInstance=true"

# Kullanıcı dizinlerini kontrol et
if [ ! -d "$HOME/.local/share/applications" ]; then
    mkdir -p "$HOME/.local/share/applications"
    echo "Oluşturulan: $HOME/.local/share/applications"
fi

if [ ! -d "$HOME/.local/share/mime/packages" ]; then
    mkdir -p "$HOME/.local/share/mime/packages"
    echo "Oluşturulan: $HOME/.local/share/mime/packages"
fi

# .desktop dosyasını kopyala
echo "Kurulum: .desktop dosyası..."
echo "$DESKTOP_CONTENT" > "$HOME/.local/share/applications/$DESKTOP_FILE"
chmod +x "$HOME/.local/share/applications/$DESKTOP_FILE"
echo "  -> $HOME/.local/share/applications/$DESKTOP_FILE"

# MIME type XML dosyasını kopyala
echo "Kurulum: MIME type..."
cp "$SCRIPT_DIR/$MIME_FILE" "$HOME/.local/share/mime/packages/$MIME_FILE"
echo "  -> $HOME/.local/share/mime/packages/$MIME_FILE"

# MIME veritabanını güncelle
echo "Güncelleniyor: MIME veritabanı..."
if command -v update-mime-database &> /dev/null; then
    update-mime-database "$HOME/.local/share/mime"
    echo "  -> MIME veritabanı güncellendi"
else
    echo "  -> Uyarı: update-mime-database komutu bulunamadı"
fi

# Desktop database'i güncelle
echo "Güncelleniyor: Uygulama menüsü..."
if command -v update-desktop-database &> /dev/null; then
    update-desktop-database "$HOME/.local/share/applications"
    echo "  -> Uygulama menüsü güncellendi"
else
    echo "  -> Uyarı: update-desktop-database komutu bulunamadı"
fi

# MIME tipini kontrol et
echo ""
echo "Kontrol: MIME tipi..."
if command -v mimetype &> /dev/null; then
    echo "  Test .json dosyası:"
    echo "test.json" > /tmp/test.json
    mimetype /tmp/test.json
    rm /tmp/test.json
fi

echo ""
echo "=== Kurulum Tamamlandı ==="
echo ""
echo "Artık .json dosyalarını çift tıklayarak JSON Editor ile açabilirsiniz."
echo "Eğer ilişkilendirme görünmüyorsa, oturumu kapatıp tekrar açın."
echo ""
echo "Kaldırmak için:"
echo "  rm ~/.local/share/applications/$DESKTOP_FILE"
echo "  rm ~/.local/share/mime/packages/$MIME_FILE"
echo "  update-mime-database ~/.local/share/mime"
echo "  update-desktop-database ~/.local/share/applications"
