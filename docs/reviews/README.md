# Sürümlü resmi kural incelemesi

Veri sürümü (`dist/data/{awards,earning,status,partners}.json` içindeki
`verifiedAt`) ile son başarılı **tablo alanı incelemesi** ayrı kavramlardır.
30 Ekim 2026 kaydı, yedi resmi kaynak kapsamındaki 198 sayısal/sınıf alanının
elle aktarılmış gözlemleridir. Kaynak URL'si, tarih, inceleyen, bölüm tarifi ve
alan birimi her kayıtta tutulur. Önceki 24 Ekim genel incelemesi bu yeni biçime
sonradan ölçülmüş gibi dönüştürülmedi; ilk alan bazlı kayıt 30 Ekim'dir.

Bu araç HTML kazıyıcısı değildir. Resmi sayfayı okuyup tablo alanlarını bağımsız
olarak aktarın; uygulamanın verisini kopyalamak kaynak doğrulaması sayılmaz.
Web okuyucusunun önbelleği olabilir; kontrol tarihi havayolunun yayımlama tarihi
veya hesaba özel doğrulama anlamına gelmez. Kaynak metnini bütünüyle depolamayın.

## İnceleme komutu

```sh
npm run review:rules -- \
  --input docs/reviews/2026-10-30-observations.json \
  --output /tmp/mil-review-report.json
```

Yeni bir çıktı yolu kullanın. Raporlar özel olarak yeni dosya oluşturur; mevcut
rapor veya doğrulanmış hesaplama verisi üzerine yazılmaz.

| Çıkış | Sonuç | Anlamı |
|---|---|---|
| 0 | `unchanged` | Yedi kaynağın beklenen tüm alanları karşılaştırıldı, fark yok |
| 1 | `changed` | En az bir alan değişti; alan yolu ve eski/yeni değer raporda |
| 2 | `unavailable` / girdi hatası | Kaynak eksik, okunamadı, yanlış URL/birim veya eksik kapsam; başarı değil |

`status: unavailable` ve gerçek `reason` ile başarısız kaynağı kaydedin;
başarısız denemede eski alan değerlerini yeniden doğrulanmış gibi vermeyin.
Eksik alan, kuralın kaldırıldığına kanıt sayılmaz. Sınıf sırası, yüzde gösterimi
ve tam sayı binlik ayırıcıları normalize edilir; anlamlı oran ve minimum farkları
korunur. United'da yayımlanmayan minimum `null` kalır, sıfıra dönüşmez.

Komut ne arayüz geçmişini ne hesaplama tablolarını otomatik günceller. Sonucu
inceleyin; başarılı, değişmiş veya erişilemeyen gerçek denemeyi
`dist/data/reviews.json` içindeki `reviews` listesine ekleyin. Tarihler ISO
`YYYY-MM-DD`, kaynak kimlikleri sabit, yöntem `manual-transcription` olmalıdır.
Her yeni kayıt kendi kaynak gözlemlerini taşımalıdır. İnceleme dosyası ve komut
raporunu bu klasörde tarihli tutun. Test fixture'ları üretim inceleme kaydı değildir.

Arayüz sonucu güncel uygulama alanlarına karşı yeniden hesaplar. Daha yeni
başarısız/değişmiş deneme önceki başarılı inceleme tarihini ilerletmez. Güncel
hesaplama alanlarıyla eşleşen geçmiş yoksa tarih "Doğrulanmadı" olur. Yayın
kontrolü, güncel tablo için en az bir tam eşleşen kaydın bulunmasını ister.

Kapsam: Türkiye bağlantılı 12 THY ödül bölgesinin dört fiyat sütunu, THY
rezervasyon sınıfı/iç hat/dış hat oran ve minimumları, LH/UA oran-minimum ve
dışlanan sınıfları, statü yükseltme/koruma eşikleri, satın alma sayısal limitleri
ve dönüştürme oran/üst sınırı. Ülke listeleri, genel koşul metinleri, tam dönem
sınırı yorumu, TPM, canlı koltuk, hesap bakiyesi ve hesap/kart uygunluğu bu alan
karşılaştırmasının dışındadır. Bu konular ayrıca resmi kaynakla incelenmelidir.

`npm test` ağa çıkmadan değişmeyen tabloyu, tek oran farkını, kaynak hatasını,
eksik alanları, null minimumu, veri değişikliğiyle eski incelemenin geçersiz
olmasını ve komutun dosya korumasını sınar.
