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

## Geliştirme

```bash
npm install
npm run tauri dev
# ya da sadece web önizleme:
npm run dev
```

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
