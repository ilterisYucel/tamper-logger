# AGENTS.md — tamper-logger

Tamper-evident, HMAC-chained audit logging for Node.js (>=20) and Bun.
**MIT · npm: `tamper-logger` · generic/domain-free.**

Bu dosya bu repoda çalışan ajanlar için bağlayıcı başlangıç noktasıdır.
Mimari kararlar: [`docs/TAMPER-LOGGER-MIMARISI.md`](docs/TAMPER-LOGGER-MIMARISI.md).

## Quick commands

```bash
bun install
bun run test          # vitest run (104+ test)
bun run typecheck     # tsc (üretim kodu; testler hariç)
bun run build         # dist/index.js (bundle) + dist/*.d.ts
npm publish           # prepublishOnly = build + test
```

## Yapı

```
src/
├── tamper-logger.ts   # TamperLogger (orkestrasyon: kategori → redaction → imza → sink fan-out)
├── pipeline.ts        # canonicalize, enrich, signEvent, verifySignature
├── verify-chain.ts    # verifyChain (dosya sırası, GENESIS segmentleri, 3 ihlal türü)
├── config.ts          # resolveSigningKey / loadSigningKey
├── types.ts           # LogLevel/LogCategory/LogEventInput/LogEvent
├── interfaces.ts      # ILogSink
└── sinks/             # console, file, timescale, syslog, http-webhook, smtp, http-sms, alert-notifier
bin/verify-log.mjs     # NIS-2 denetim CLI (paket `bin`'i)
docs/                  # SPEC + bu repo sözleşmesi
```

## Değişmez sözleşmeler (MANDATORY)

1. **Zincir formatı donmuştur:** `signature = HMAC-SHA256(key, ${prevHash}\n${seq}\n${canonicalize(event)})`.
   Format değişikliği ancak MAJOR sürüm + göç notuyla yapılır; eski dosyalar
   yeni sürümle doğrulanabilir kalmalıdır (`verifyChain` geriye uyumlu).
2. **Canonical JSON** anahtar sırasından bağımsızdır (deterministik imza).
3. **Kategori politikası:** `app` batch'lenir + drop (sayaç + health degraded);
   `audit`/`security` **fail-closed** — batch önce flush, anında yaz, hata çağırana yayılır.
4. **eventCode serbest string'dir;** proje sözlüğü `eventCodeValidator` ile enjekte
   edilir; reddedilen kod `log()`'u throw ettirir (fail-closed). Bu pakette
   proje/domain kavramı (telemetri, tier, EMS vb.) YAŞAMAZ.
5. **Redaction** varsayılan 5 anahtar (`password/token/authorization/secret/api_key/apikey`),
   BK-duyarsız + kısmi eşleşme. Sır asla loglanmaz.
6. **Şema pakette DEĞİL:** `log_events` DDL'i ve `customer` tipleri tüketiciye
   aittir (ör. EMS `packages/platform/logging`). Paket yalnız `SqlExecutor` gibi
   dar portlar üzerinden yazar; tablo şeması taşımaz (K9).
7. **Bağımlılık:** tek runtime bağımlılığı `nodemailer`; test yardımcısı
   `./test-helpers` subpath'i `jose` ister (opsiyonel peer). Başka bağımlılık
   eklemeden önce gerekçe yaz.
8. **verify-log CLI sözleşmesi:** `--key` > `--key-file` > `LOG_SIGNING_KEY`;
   çıkış 0/1/2. Davranışı değiştiren PR çıkış kodlarını bozmaz.

## Geliştirme kuralları

- **Testsiz davranış değişikliği yok.** `*.test.ts` kaynakla co-located; önce test
  kırmızı, sonra implementasyon.
- **Güvenlik-kritik yollar** (pipeline imza, verifyChain, fail-closed, redaction):
  mutasyon eşiği **≥%90**. Bu dosyalara dokunan PR mutasyon koşusu ister.
- Named exports; `import type`; kebab-case dosya (sink'ler PascalCase sınıf).
- Sink'ler `ILogSink` (`write(events)`/`close()`/`name()`) sözleşmesine uyar;
  sink hatası diğer sink'leri etkilemez (app kategorisi), audit'te yayılır.
- Build artefaktı (`dist/`, `*.d.ts`, `*.d.ts.map`, `test-results/`) commit edilmez.
- Paket ESM'dir (`"type": "module"`, `dist` çıktısı); Node ≥20 ve Bun hedeflenir.

## Sürümleme / yayın

- Semver. Kırıcı değişiklik = MAJOR + `docs/TAMPER-LOGGER-MIMARISI.md` revizyonu.
- `npm publish` `prepublishOnly` ile test+build koşar; sürümü `package.json`'da
  artır, tag `v<semver>` at (CI `release.yml` yayınlar).
- npm adı: `tamper-logger` (unscoped, public).

## İlgili

- Tüketici örneği (EMS): `log_events` DDL + `LOG_EVENT_CODES` sözlüğü + montaj —
  tüketici repoda yaşar; bu repo onlara yalnız kütüphane verir.
- [docs/TAMPER-LOGGER-MIMARISI.md](docs/TAMPER-LOGGER-MIMARISI.md) — kararlar
  (K1-K9), kabul senaryoları, `log_events` 12 kolon sözleşmesi.
