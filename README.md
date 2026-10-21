# JSON Editor (Tauri + React + Monaco)

Masaüstü hissiyatlı JSON editörü: dosya/klasör (workspace) açma, kaydetme,
formatla/minify/key-sırala, hatanın satır/sütununu gösterme, ağaç/tablo
görünümü, JSON Schema doğrulama ve tema desteği.

## Özellikler

- **Dosya & workspace:** dosya/klasör aç, kaydet, sekmeli düzen (dirty `●`),
  bir kerelik oturum geri yükleme (son açık dosyalar + klasör), açık klasörü
  periyodik (5 sn) tazeleme.
- **Düzenleme:** formatla/minify/key-sırala; Monaco üzerinde canlı hata
  işaretleri; hataya tıklayınca imleç ilgili satır/sütuna gider.
- **Görünümler:** sağ panelde JSON ağacı (JSON Path kopyala, düğüm düzenle/sil)
  ve obje dizileri için tablo; JSON Schema ile Ajv doğrulama.
- **Arama:** `Ctrl+P` ile VS Code tarzı fuzzy dosya arama (dosya açıksa ilgili
  sekmeye geçer, kapalıysa açar).
- **Tema:** Sistem / Koyu / Açık. Panel genişlikleri sürüklenebilir.

## Gereksinimler

- Node 20+, Rust 1.90+
- Linux'ta Tauri sistem bağımlılıkları:

```bash
sudo apt-get install -y libwebkit2gtk-4.1-dev librsvg2-dev
```

## Çalıştırma (üç durum)

| Durum | Komut | Açıklama |
|---|---|---|
| Web önizleme | `./run-web.sh` | Tarayıcıda açılır (`http://localhost:1420/`). Dosya aç/kaydet fallback ile çalışır, klasör açma yok. |
| Uzak dosya sunucusu | `JSONEDITOR_FS_ROOT=/yol ./run-desktop.sh` | Web istemcisinin, sunucudaki bir klasöre tam erişmesi için HTTP dosya API'si (`:1422`) aynı işlemde başlar. |
| Masaüstü uygulaması | `./run-desktop.sh` | Gerçek Tauri penceresi: klasör/workspace açma dahil tam dosya erişimi. |

npm karşılıkları: `npm run dev:web`, `npm run dev:tauri`,
`npm run build:web`, `npm run build:desktop`.

`run-desktop.sh` eksik önkoşulları (Rust, webkit dev paketleri) kontrol eder
ve ne kurman gerektiğini söyler.

## Uzak dosya sunucusu (web modu)

Sabit bir sunucu üzerindeki klasörde tarayıcıdan çalışmak için:

1. Sunucuda `JSONEDITOR_FS_ROOT=/paylaşılan/klasör ./run-desktop.sh`
   (port için `JSONEDITOR_FS_PORT`, varsayılan **1422**) çalıştır.
2. Tarayıcıda web önizlemeyi aç (`http://<sunucu>:1420/`).
3. Menüdeki **Sunucu** düğmesine bas, `http://<sunucu>:1422` gir.
   Bağlantı `/fs/health` ile test edilir ve adres tarayıcıda saklanır.
4. **Klasör Aç** / **Dosya Aç** artık sunucudaki yolları sorar.

Uçlar: `GET /fs/list|read|exists`, `POST /fs/write`. Sunucu yalnızca
`JSONEDITOR_FS_ROOT` altına izin verir (canonicalize + prefix kontrolü).
**Kimlik doğrulama yoktur** — yalnızca güvenilir/iç ağlarda kullanın.

## Proxy / kısıtlı ağ notu

Bu repo, "crypto" içeren crates.io URL'lerini engelleyen bir proxy arkasında
geliştirildi. Üç otomatik çözüm devrede:

- `crypto-common` crates.io'dan çözülemediği için `src-tauri/Cargo.toml`
  içindeki `[patch.crates-io]` onu `vendor/crypto-common` yoluna sabitler.
  `vendor/` git'e dahil değildir; ilk kurulumda `run-desktop.sh`
  çalıştırmadan önce şu tek seferlik adımı yapın:
  ```bash
  git clone --depth 1 --branch crypto-common-v0.1.6 \
    https://github.com/RustCrypto/traits /tmp/traits
  mkdir -p vendor && cp -r /tmp/traits/crypto-common vendor/
  ```
  (Vendor kopyasındaki `generic-array` deprecated uyarılarını `run-desktop.sh`
  otomatik susturur; elle kurulumda `vendor/crypto-common/Cargo.toml` sonuna
  `[lints.rust]` + `deprecated = "allow"` ekleyebilirsiniz.)
- brew `pkg-config` sistem `.pc` dizinlerini görmez; `run-desktop.sh`
  `PKG_CONFIG_PATH`'i otomatik düzeltir. Hala eksik başlık kalırsa ilgili
  `-dev` paketlerini `~/.cache/jsoneditor-sysroot` altına sudosuz açar.
- WebKit, sistem proxy ayarını (gsettings/kioslaverc) okur ve manuel modda
  `localhost`/`127.0.0.1` isteklerini de proxyye yönlendirip
  "loopback from external IP" hatasına yol açar. Çözüm:
  ```bash
  gsettings set org.gnome.system.proxy mode 'none'
  ```
  KDE'de ayrıca `~/.config/kioslaverc` içindeki `NoProxyFor` listesine
  `localhost,127.0.0.1,::1` ekleyin. `run-desktop.sh` manuel mod görürse
  uyarı verir ve `no_proxy`/`NO_PROXY` değişkenlerini kendisi ayarlar.

Tarayıcıda açıldığında dosya işlemleri fallback ile çalışır
(dosya seç + indirerek kaydet); klasör/workspace açma masaüstü uygulamasında
veya yukarıdaki uzak dosya sunucusu modunda desteklenir.

## Paketleme

```bash
npm run tauri build
```

Çıktılar: `src-tauri/target/release/bundle/` altında `.AppImage` / `.deb`.

## Kısayollar

- `Ctrl+S` kaydet, `Ctrl+N` yeni sekme, `Ctrl+W` sekmeyi kapat
- `Ctrl+P` dosya ara (fuzzy), `Ctrl+R` sayfayı yenile
- Sekmeyi **orta tuşla** kapat (kaydedilmemişse onay ister)
- Panel ayırıcısına çift tıkla → genişliği sıfırla
- Hata listesinde satıra tıklayınca editör o konuma gider
