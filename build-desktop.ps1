# Windows masaüstü uygulaması (Tauri) üretım derlemesi.
# Çıktı: src-tauri/target/release/bundle/
# Kullanım: .\build-desktop.ps1

$ErrorActionPreference = "Stop"

Write-Host "==> JSON Editor - Windows Desktop Build Script" -ForegroundColor Cyan

# PowerShell 7+ kontrolü
if ($PSVersionTable.PSVersion.Major -lt 7) {
    Write-Host "UYARI: PowerShell 7+ önerilir. Devam ediliyor..." -ForegroundColor Yellow
}

# Node.js kontrolü
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "HATA: node bulunamadı. Önce Node.js 20+ yükleyin." -ForegroundColor Red
    exit 1
}

# Rust kontrolü
if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) {
    Write-Host "HATA: Rust bulunamadı. Kurmak için: https://rustup.rs/" -ForegroundColor Red
    exit 1
}

# npm dependencies kontrolü
if (-not (Test-Path "node_modules")) {
    Write-Host "node_modules yok, bağımlılıklar kuruluyor..." -ForegroundColor Cyan
    npm install
}

# Web arayüzü derle
Write-Host "==> Web arayüzü derleniyor..." -ForegroundColor Cyan
npm run build:web

if (-not $?) {
    Write-Host "HATA: Web arayüzü derleme başarısız." -ForegroundColor Red
    exit 1
}

# Masaüstü uygulaması derle (Tauri build)
Write-Host "==> Masaüstü uygulaması derleniyor (Tauri build)..." -ForegroundColor Cyan
npm run build:desktop

if (-not $?) {
    Write-Host "HATA: Tauri build başarısız." -ForegroundColor Red
    exit 1
}

Write-Host "==> Derleme tamamlandı!" -ForegroundColor Green
Write-Host "Çıktı klasörü: src-tauri/target/release/bundle/" -ForegroundColor Cyan
