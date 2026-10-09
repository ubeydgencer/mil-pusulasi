# Mil Pusulası

Miles&Smiles üyeleri için bağımsız, açık kaynak mil ve statü planlayıcısı. THY'nin renklerinden esinlenen mobil uyumlu arayüz; Türkçe ve İngilizce. MIT lisanslı kod, derleme ve üçüncü taraf çalışma zamanı bağımlılığı gerektirmez.

## Çalıştırma

Node.js 22 veya üstü:

```sh
git clone https://github.com/ubeydgencer/mil-pusulasi.git
cd mil-pusulasi
npm run dev
```

[Yerel uygulama](http://127.0.0.1:4173). Başka port için `PORT=4180 npm run dev`. Kurulum veya `npm install` gerekmez. `dist/` herhangi bir statik HTTPS sunucusunda doğrudan yayımlanabilir; göreli adresler alt dizin dağıtımını destekler. Dosyayı `file://` ile açmak yerine bir HTTP sunucusu kullanın.

## İlk sürüm

- **Millerimle keşfet:** Türkiye çıkışlı tek segment için 12 THY ödül bölgesi, promosyon/standart Economy ve Business, ülke araması ve bakiye filtresi.
- **Mil mi, nakit mi?:** Aynı yolculuk için nakit fiyatı, ödül biletin nakit ücretlerini ve kullanılan mili karşılaştırma. TRY/EUR/USD/GBP desteklenir; kur dönüşümü yapılmaz.
- **Mil kazanımı:** THY'nin işlettiği uçuşlarda rezervasyon sınıfı, statü, iç/dış hat ve IATA TPM mesafesine göre tahmin. İç hat sabit tutarları, dış hat minimumları ve Business statü oranları ayrı uygulanır.
- **Statü planı:** İşlenmiş ve planlanan kayıtlar; son 12 ayda yükseltme; üyelik dönemi boyunca ilk yıl veya tüm iki yıl koruma; Elite için Türkiye/yurt dışı ikamet; Classic Plus uygun uçuş sayısı alternatifi. Gelecek tarih projeksiyonunda eski kayıtlar pencereden düşer.
- **Yolculuk hedefim:** Yetişkin/çocuk sayısı, kabin, yön ve ödül türüne göre ihtiyaç ve kalan bakiye.

Kazanım ekranındaki varsayılan hesap resmi **Elite / IST–LAX / K sınıfı / 6.855 TPM → 10.968 mil** örneğidir. Diğer başlangıç bakiyeleri ve fiyatlar örnek olarak etiketlenir. Statü kayıtları başlangıçta boştur.

## Hesaplama kapsamı

Ödül tutarı, seçilen tarihte koltuk bulunduğu veya bölgedeki her ülkeye direkt hat olduğu anlamına gelmez. Vergi/harçlar ayrı kontrol edilir. Aktarmalı THY yolculuklarda segmentler ayrı hesaplanır; keşif ekranı Türkiye ile bölge arasındaki bir segmenti kapsar. Gidiş–dönüş hedefi aynı ödül türünde iki tek segment varsayar. Bebek fiyatlaması kapsam dışıdır.

Mil/nakit ölçüsü `(nakit bilet toplamı - ödül bilet nakit ödemesi) / kullanılan mil`dir. Millerin sabit piyasa değeri veya otomatik satın alma tavsiyesi değildir. Bagaj ve değişiklik koşulları ile nakit bilet kazanımı kullanıcı tarafından değerlendirilir.

Mil kazanımı için biletin tek harfli **rezervasyon sınıfı** gereklidir; kabin veya EcoFly gibi paket adı yeterli değildir. Dış hat mesafesi kullanıcı tarafından girilen IATA TPM olmalıdır. Harita/büyük çember mesafesi TPM kabul edilmez. Kesirli kazanım tahminleri aşağı yuvarlanır; resmi yuvarlama kuralı doğrulanmadığı için hesaba işlenen tutar esas alınır. Business statü bonusu tablodaki oranlarda zaten bulunur, tekrar çarpılmaz. Kampanya bonusları dahil değildir.

Statü için kullanıcı, hesabındaki statü dönem başlangıcını, ilk yıl sonunu ve mevcut bitişini girer. İlk yıl tutarı son gününden sonra sabit kalır; iki yıl hesabı her iki yılın tamamını içerir. Kayan yükseltme penceresi `(hesap tarihi - 12 takvim ayı, hesap tarihi]` olarak uygulanır. Kesin sınır günleri ve geriye dönük işlemler hesap toplamıyla doğrulanmalıdır. 29 Şubat için düşme tarihi, bu pencere kuralına göre takip eden yılda 1 Marttır.

Mevcut statü, düşük kayan toplam nedeniyle otomatik düşürülmez. Tahmini eşik sağlanması, statünün THY tarafından verildiği anlamına gelmez. İşlenmiş tutarlar kullanıcı beyanıdır; uygun uçuş sayısını hesapta görünen değerle girin. Normal bonus/kart milleri statü değildir.

## Kaynaklar ve güncelleme

Son doğrulama: **9 Ekim 2026**.

- [THY ödül bilet tablosu](https://www.turkishairlines.com/tr-tr/miles-and-smiles/mil-harcama/ucusta-mil-harcama/odul-bilet/)
- [THY uçuş mil kazanımı](https://www.turkishairlines.com/en-int/miles-and-smiles/program-partners/airlines/turkish-airlines/)
- [Miles&Smiles statü kuralları](https://www.turkishairlines.com/tr-tr/miles-and-smiles/uyelik-statuleri/)

`dist/data/` içindeki JSON dosyaları kaynak adresi ve doğrulama tarihini taşır. Otomatik veri güncellemesi yoktur. MIT lisansı uygulama koduna aittir; THY markaları ve kaynak içeriklerinin hakları ilgili sahiplerine aittir. Yeni veri değişikliklerini resmi kaynak bağlantısı ve hesaplama örneğiyle gönderin.

## Gizlilik ve erişim

THY şifresi, üyelik numarası veya PNR istenmez. Bakiye, kayıtlar ve hedefler cihazın `localStorage` alanında saklanır; sunucuya iletilmez. Tarayıcı verileri silinirse kayıtlar kaybolur. Cihazlar arasında senkronizasyon yoktur. Uygulamanın kendi kullanıcı hesabı, takip/analitik servisi ve dış font isteği yoktur. Dağıtıldığı barındırma hizmeti ayrıca erişim politikası uygulayabilir.

Canlı ödül koltuğu, THY hesap bakiyesi ve otomatik mil işleme doğrulanmış entegrasyonlar değildir. İlk sürüm THY hesaplarıyla bağlantı kurmaz. [Resmi geliştirici portalı](https://developer.apim.turkishairlines.com/) bağlantıları gelecekte ayrı modüller olarak eklenebilir.

## Kontrol ve test

```sh
npm run check
npm test
```

11 anlamlı hesaplama senaryosu: resmi kazanım örneği, minimumlar, ödül bilet sıfır kazanımı, desteklenmeyen sınıf/taşıyıcı, kişi/yön çarpımı, kayan ileri dönem, koruma dönemleri, ikamet farkı ve artık yıl sınırı.

`dist/lib/miles.js` bağımsız hesaplama motorudur. Tarayıcı arayüzü `dist/app.js` ve `dist/styles.css` içindedir. Destekleyen tarayıcılarda iki WebMCP aracı aynı görünen hesaplayıcılara veri girer; rezervasyon veya hesap işlemi yapmaz.

## Katkı

[Katkı rehberi](CONTRIBUTING.md). Sonraki kapsam: Miles&Smiles program ortaklarının **ayrı** ödül/kazanım tabloları, hesap verisi içe/dışa aktarma ve doğrulanmış API entegrasyonları. Bu özellikler mevcut sürümde etkin değildir.
