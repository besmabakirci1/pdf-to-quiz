# pdf-to-quiz
aöf sınavlarına çalışırken pdften üni sonu sorularını çekebilecek otomasyon 
--

Bu repoda uygulama pdf-quiz klasöründe: React + TypeScript + Vite ve PDF için pdfjs-dist kullanıyor. Yerelde çalıştırmak için adımlar şöyle:

Klasöre gir:
cd pdf-quiz

Bağımlılıkları kur (ilk sefer veya node_modules yoksa):
npm install

Geliştirme sunucusu:
npm run dev

Tarayıcıda genelde adres: http://localhost:5173/ (Vite varsayılanı).

Diğer komutlar:

npm run build — üretim derlemesi
npm run preview — build’i yerelde önizleme
Az önce bu ortamda npm install ve npm run dev çalıştı; sunucu http://localhost:5173/ üzerinde ayağa kalktı.

Üst dizindeki README.md sadece proje fikrini anlatıyor (AÖF / PDF’ten soru çekme); asıl uygulama pdf-quiz içinde.

## GitHub Pages (canlı site)

1. **Kodu gönder:** `git push origin main`  
   Uzak dal ile ayrıştıysan önce: `git pull --rebase origin main`, sonra push.

2. **Repo ayarları (zorunlu):** GitHub’da repo → **Settings** → **Pages**  
   **Build and deployment** → **Source:** **GitHub Actions** seç.  
   Hâlâ “Deploy from a branch” görünüyorsa veya hiç açmadıysan önce bunu **GitHub Actions** yap; aksi halde `deploy` adımı **404** verir (*Ensure GitHub Pages has been enabled*).

3. **Yayın:** `main`’e her push’ta `.github/workflows/pages.yml` çalışır: `pdf-quiz` içinde `npm ci` ve `npm run build`, çıktı `dist` GitHub Pages’e gider. **Actions** sekmesinden iş akışının yeşil bittiğini kontrol et.

4. **Adres:** `https://<kullanıcı-adın>.github.io/<repo-adın>/`  
   Örnek: repo adı `pdf-to-quiz` ise `https://<github-kullanıcı-adın>.github.io/pdf-to-quiz/`.  
   Workflow, build sırasında `VITE_BASE_URL=/<repo-adı>/` verir; Vite `base` yolu böyle doğru olur.

5. **Özel alan adı (isteğe bağlı):** Pages’ten custom domain eklenirse `vite.config.ts` içindeki `base` ve workflow’daki `VITE_BASE_URL` buna göre güncellenmeli (çoğunlukla kök için `/`).

---
