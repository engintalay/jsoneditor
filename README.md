# JSON Editor (Tauri + React + Monaco)

Masaüstü hissiyatlı JSON editörü: dosya/klasör (workspace) açma, kaydetme,
formatla/minify/key-sırala, hatanın satır/sütununu gösterme, ağaç görünümü ve
JSON Schema doğrulama.

## Gereksinimler

- Node 20+, Rust 1.90+
- Linux'ta Tauri sistem bağımlılıkları:

```bash
sudo apt-get install -y libwebkit2gtk-4.1-dev librsvg2-dev
```

## Çalıştırma (iki durum)

| Durum | Komut | Açıklama |
|---|---|---|
| Web önizleme | `./run-web.sh` | Tarayıcıda açılır (`http://localhost:1420/`). Dosya aç/kaydet fallback ile çalışır, klasör açma yok. |
| Masaüstü uygulaması | `./run-desktop.sh` | Gerçek Tauri penceresi: klasör/workspace açma dahil tam dosya erişimi. |

npm karşılıkları: `npm run dev:web`, `npm run dev:tauri`,
`npm run build:web`, `npm run build:desktop`.

`run-desktop.sh` eksik önkoşulları (Rust, webkit dev paketleri) kontrol eder
ve ne kurman gerektiğini söyler.

## Proxy / kısıtlı ağ notu

Bu repo, "crypto" içeren crates.io URL'lerini engelleyen bir proxy arkasında
geliştirildi. İki otomatik çözüm devrede:

- `crypto-common` crates.io'dan çözülemediği için `src-tauri/Cargo.toml`
  içindeki `[patch.crates-io]` onu `vendor/crypto-common` yoluna sabitler.
  `vendor/` git'e dahil değildir; ilk kurulumda `run-desktop.sh`
  çalıştırmadan önce şu tek seferlik adımı yapın:
  ```bash
  git clone --depth 1 --branch crypto-common-v0.1.6 \
    https://github.com/RustCrypto/traits /tmp/traits
  mkdir -p vendor && cp -r /tmp/traits/crypto-common vendor/
  ```
- brew `pkg-config` sistem `.pc` dizinlerini görmez; `run-desktop.sh`
  `PKG_CONFIG_PATH`'i otomatik düzeltir. Hala eksik başlık kalırsa ilgili
  `-dev` paketlerini `~/.cache/jsoneditor-sysroot` altına sudosuz açar.

Tarayıcıda açıldığında dosya işlemleri fallback ile çalışır
(dosya seç + indirerek kaydet); klasör/workspace açma yalnızca
masaüstü uygulamasında desteklenir.

## Paketleme

```bash
npm run tauri build
```

Çıktılar: `src-tauri/target/release/bundle/` altında `.AppImage` / `.deb`.

## Kısayollar

- `Ctrl+S` kaydet, `Ctrl+N` yeni sekme, `Ctrl+W` sekmeyi kapat
- Hata listesinde satıra tıklayınca editör o konuma gider
