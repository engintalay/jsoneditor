#!/bin/bash
# JSON Editor - Installation Script
# Bu script uygulamayı sisteme kurar

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_NAME="JSON Editor"
VERSION="0.1.0"
BINARY_NAME="JSON Editor_${VERSION}_amd64.AppImage"

echo "=== $APP_NAME Kurulumu ==="
echo ""

# Gerekli bağımlılıkları kontrol et
check_dependencies() {
    local missing_deps=()
    
    for cmd in xdg-mime update-mime-database update-desktop-database; do
        if ! command -v "$cmd" &> /dev/null; then
            missing_deps+=("$cmd")
        fi
    done
    
    if [ ${#missing_deps[@]} -ne 0 ]; then
        echo "Uyarı: Aşağıdaki komutlar bulunamadı:"
        for dep in "${missing_deps[@]}"; do
            echo "  - $dep"
        done
        echo "Bazı özellikler çalışmayabilir."
        echo ""
        read -p "Devam etmek istiyor musunuz? (e/H) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Ee]$ ]]; then
            exit 1
        fi
    fi
}

# Kurulum dizinlerini belirle
INSTALL_DIR="$HOME/.local/bin"
APPIMAGE_PATH="$INSTALL_DIR/$BINARY_NAME"
DESKTOP_FILE="$HOME/.local/share/applications/jsoneditor.desktop"
MIME_FILE="$HOME/.local/share/mime/packages/x-jsoneditor.xml"

echo "Kurulum dizini: $INSTALL_DIR"
echo ""

# Kurulum dizinini oluştur
if [ ! -d "$INSTALL_DIR" ]; then
    mkdir -p "$INSTALL_DIR"
    echo "Oluşturulan: $INSTALL_DIR"
fi

# AppImage'ı kopyala
echo "Kurulum: AppImage..."
if [ -f "$SCRIPT_DIR/src-tauri/target/release/bundle/appimage/$BINARY_NAME" ]; then
    cp "$SCRIPT_DIR/src-tauri/target/release/bundle/appimage/$BINARY_NAME" "$APPIMAGE_PATH"
    chmod +x "$APPIMAGE_PATH"
    echo "  -> $APPIMAGE_PATH"
else
    echo "Hata: AppImage bulunamadı: $SCRIPT_DIR/src-tauri/target/release/bundle/appimage/$BINARY_NAME"
    echo "Lütfen önce 'npm run build' ve 'npx tauri build' komutlarını çalıştırın."
    exit 1
fi

# .desktop dosyasını oluştur
echo "Kurulum: .desktop dosyası..."
cat > "$DESKTOP_FILE" << DESKTOP_EOF
[Desktop Entry]
Name=JSON Editor
Exec=$HOME/.local/bin/"JSON Editor_0.1.0_amd64.AppImage" %F
Type=Application
MimeType=application/json;application/jsonc
Icon=$HOME/.local/share/icons/hicolor/128x128/apps/jsoneditor.png
Categories=Utility;TextEditor;
Terminal=false
StartupNotify=false
DESKTOP_EOF
chmod +x "$DESKTOP_FILE"
echo "  -> $DESKTOP_FILE"

# MIME type XML dosyasını kopyala
echo "Kurulum: MIME type..."
if [ -f "$SCRIPT_DIR/x-jsoneditor.xml" ]; then
    cp "$SCRIPT_DIR/x-jsoneditor.xml" "$MIME_FILE"
    echo "  -> $MIME_FILE"
else
    echo "Hata: MIME type dosyası bulunamadı: $SCRIPT_DIR/x-jsoneditor.xml"
    exit 1
fi

# MIME veritabanını güncelle
echo "Güncelleniyor: MIME veritabanı..."
if command -v update-mime-database &> /dev/null; then
    update-mime-database "$HOME/.local/share/mime" 2>/dev/null || true
    echo "  -> MIME veritabanı güncellendi"
else
    echo "  -> Uyarı: update-mime-database komutu bulunamadı"
fi

# Desktop database'i güncelle
echo "Güncelleniyor: Uygulama menüsü..."
if command -v update-desktop-database &> /dev/null; then
    update-desktop-database "$HOME/.local/share/applications" 2>/dev/null || true
    echo "  -> Uygulama menüsü güncellendi"
else
    echo "  -> Uyarı: update-desktop-database komutu bulunamadı"
fi

# İkonu kopyala (opsiyonel)
echo "Kurulum: İkon..."
if [ -d "$SCRIPT_DIR/src-tauri/icons" ]; then
    ICON_DIR="$HOME/.local/share/icons/hicolor/128x128/apps"
    mkdir -p "$ICON_DIR"
    if [ -f "$SCRIPT_DIR/src-tauri/icons/128x128.png" ]; then
        cp "$SCRIPT_DIR/src-tauri/icons/128x128.png" "$ICON_DIR/jsoneditor.png"
        echo "  -> $ICON_DIR/jsoneditor.png"
    fi
fi

# MIME tipini kontrol et
echo ""
echo "Kontrol: MIME tipi..."
if command -v mimetype &> /dev/null; then
    echo "  application/json MIME tipi:"
    mimetype -a application/json 2>/dev/null | head -5
fi

# Varsayılan uygulamayı ayarla
echo ""
echo "İlişkilendirme: .json dosyaları için varsayılan uygulama..."
if command -v xdg-mime &> /dev/null; then
    xdg-mime default jsoneditor.desktop application/json 2>/dev/null || true
    DEFAULT_APP=$(xdg-mime query default application/json 2>/dev/null || echo "bilinmiyor")
    echo "  Varsayılan: $DEFAULT_APP"
else
    echo "  -> Uyarı: xdg-mime komutu bulunamadı"
fi

# PATH kontrolü
echo ""
echo "Kontrol: PATH ayarı..."
if [[ ":$PATH:" != *":$HOME/.local/bin:"* ]]; then
    echo "  Uyarı: $HOME/.local/bin PATH'e eklenmemiş olabilir."
    echo "  Bash için: echo 'export PATH=\"\$HOME/.local/bin:\$PATH\"' >> ~/.bashrc"
    echo "  Zsh için: echo 'export PATH=\"\$HOME/.local/bin:\$PATH\"' >> ~/.zshrc"
fi

echo ""
echo "=== Kurulum Tamamlandı ==="
echo ""
echo "Uygulama şu konumda: $APPIMAGE_PATH"
echo ""
echo "Kullanım:"
echo "  - Dosya yöneticisinden .json dosyasına çift tıklayın"
echo "  - Terminalden: xdg-open file.json"
echo "  - Veya doğrudan: $APPIMAGE_PATH file.json"
echo ""
echo "Kaldırmak için:"
echo "  rm $APPIMAGE_PATH"
echo "  rm $DESKTOP_FILE"
echo "  rm $MIME_FILE"
echo "  rm $ICON_DIR/jsoneditor.png 2>/dev/null || true"
echo "  update-mime-database \$HOME/.local/share/mime"
echo "  update-desktop-database \$HOME/.local/share/applications"
