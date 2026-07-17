# استضافة خادم الملاحة OSRM لبيانات السودان 🇸🇩🗺️

دليل عملي خطوة بخطوة لتشغيل خادم توجيه (OSRM) خاص بك ببيانات خرائط السودان،
ليعمل التوجيه والمناورات في «قريب» بدقّة وموثوقية دون الاعتماد على الخادم العام.

> بعد الانتهاء تضبط متغيّراً واحداً فقط في التطبيق: `VITE_OSRM_URL` — بلا أي تعديل على الكود.

---

## لماذا؟

- الخادم العام `router.project-osrm.org` مجاني لكنه **بلا ضمان توفّر**، وقد يبطئ أو يحظر
  مع الاستخدام الكثيف، وأحياناً تكون تغطيته للسودان ضعيفة.
- خادمك الخاص = مسارات ومناورات دقيقة، سرعة عالية (خادم قريب جغرافياً)، بلا حدود طلبات،
  وتحديث خريطة السودان متى شئت.

---

## المتطلبات

| البند | الحدّ الأدنى | المستحسن |
|------|-------------|----------|
| المعالج | 1 vCPU | 2 vCPU |
| الذاكرة (RAM) | 2 GB | 4 GB |
| القرص | 10 GB | 20 GB SSD |
| نظام التشغيل | Ubuntu 22.04+ | Ubuntu 22.04/24.04 |

- **التكلفة التقديرية:** VPS بهذه المواصفات ≈ **5–12 دولار/شهر** (Hetzner / DigitalOcean /
  Contabo / Linode…). خريطة السودان صغيرة نسبياً فلا تحتاج خادماً ضخماً.
- **نطاق (Domain) فرعي:** مثل `osrm.qareeb.sd` موجّه إلى IP الخادم (سجلّ A) — ضروري لشهادة HTTPS.
- أدوات: `docker` و`docker compose` (سنثبّتها).

> ملاحظة أمان: هذا الخادم **لا يحتوي أي أسرار** (لا مفاتيح Supabase ولا خدمة). مهمّته
> حساب المسارات فقط. حافظ رغم ذلك على تحديثه وتقييد الوصول كما في قسم الأمان أدناه.

---

## الخطوة ١ — تجهيز الخادم وتثبيت Docker

اتصل بالخادم عبر SSH ثم:

```bash
sudo apt update && sudo apt upgrade -y
# تثبيت Docker + docker compose plugin
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
# أعِد تسجيل الدخول (logout/login) ليسري تأثير المجموعة، ثم تحقّق:
docker --version && docker compose version
```

---

## الخطوة ٢ — تنزيل خريطة السودان ومعالجتها

نستخدم خريطة السودان الجاهزة من **Geofabrik** (مقتطف OpenStreetMap للسودان)، ونعالجها
بخوارزمية **MLD** (الأسرع للتحديث والتشغيل).

```bash
mkdir -p ~/osrm && cd ~/osrm

# 1) تنزيل خريطة السودان (تُحدَّث يومياً على Geofabrik)
wget https://download.geofabrik.de/africa/sudan-latest.osm.pbf

# 2) استخراج شبكة الطرق لسيّارة (car profile)
docker run --rm -t -v "$PWD:/data" ghcr.io/project-osrm/osrm-backend \
  osrm-extract -p /opt/car.lua /data/sudan-latest.osm.pbf

# 3) التقسيم (partition)
docker run --rm -t -v "$PWD:/data" ghcr.io/project-osrm/osrm-backend \
  osrm-partition /data/sudan-latest.osrm

# 4) التخصيص (customize)
docker run --rm -t -v "$PWD:/data" ghcr.io/project-osrm/osrm-backend \
  osrm-customize /data/sudan-latest.osrm
```

> إن أردت لاحقاً إضافة **جنوب السودان** أو دول الجوار، نزّل مقتطفاتها وادمجها بأداة
> `osmium merge` قبل الاستخراج، أو استخدم مقتطف **أفريقيا** كاملاً (أكبر بكثير — يحتاج RAM أعلى).

الأوامر أعلاه تُنشئ ملفات `sudan-latest.osrm.*` في `~/osrm`. هذه هي بيانات المسار الجاهزة.

---

## الخطوة ٣ — تشغيل OSRM عبر docker compose

أنشئ ملف `~/osrm/docker-compose.yml`:

```yaml
services:
  osrm:
    image: ghcr.io/project-osrm/osrm-backend
    container_name: osrm-sudan
    restart: unless-stopped
    # MLD algorithm + حدّ أقصى للمسافة/عدد النتائج لحماية الخادم
    command: >
      osrm-routed --algorithm mld
      --max-table-size 1000
      /data/sudan-latest.osrm
    volumes:
      - ./:/data
    # لا نكشف المنفذ للإنترنت مباشرة — Caddy (الخطوة 4) يمرّر إليه محلياً فقط
    expose:
      - "5000"
    networks:
      - web

networks:
  web:
    name: web
```

شغّله:

```bash
cd ~/osrm && docker compose up -d
# تحقّق أنه يعمل محلياً (مثال مسار داخل الخرطوم):
docker run --rm --network web curlimages/curl -s \
  "http://osrm-sudan:5000/route/v1/driving/32.5599,15.5007;32.5322,15.5881?overview=false" | head -c 200
```

إن ظهر ردّ JSON فيه `"code":"Ok"` فالخادم يعمل. 🎉

---

## الخطوة ٤ — HTTPS + نطاق عبر Caddy (تلقائي)

التطبيق يعمل عبر `https` داخل WebView، لذا **يجب** أن يكون رابط OSRM `https`.
سنستخدم **Caddy** الذي يجلب شهادة Let's Encrypt تلقائياً ويضيف رؤوس CORS.

أنشئ `~/osrm/Caddyfile` (استبدل النطاق ببريدك ونطاقك):

```
osrm.qareeb.sd {
    encode gzip

    # اسمح فقط لطلبات المسارات (route/table/nearest/match) — إغلاق ما عداها
    @osrm path /route/* /table/* /nearest/* /match/* /trip/*
    handle @osrm {
        header {
            Access-Control-Allow-Origin "*"
            Access-Control-Allow-Methods "GET, OPTIONS"
        }
        reverse_proxy osrm-sudan:5000
    }

    # أي مسار آخر → 404 (لا نكشف واجهات غير لازمة)
    handle {
        respond "Not found" 404
    }
}
```

أضِف Caddy إلى الـcompose — عدّل `~/osrm/docker-compose.yml` بإضافة خدمة Caddy:

```yaml
  caddy:
    image: caddy:2
    container_name: caddy
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
      - caddy_config:/config
    networks:
      - web

volumes:
  caddy_data:
  caddy_config:
```

> تأكّد أن سجلّ **A** للنطاق `osrm.qareeb.sd` يشير إلى IP الخادم، وأن منفذي 80 و443 مفتوحان
> في جدار الحماية. ثم:

```bash
cd ~/osrm && docker compose up -d
# اختبر من أي جهاز:
curl -s "https://osrm.qareeb.sd/route/v1/driving/32.5599,15.5007;32.5322,15.5881?overview=false" | head -c 200
```

ردّ `"code":"Ok"` عبر `https` = انتهى إعداد الخادم. ✅

---

## الخطوة ٥ — ربط التطبيق بالخادم

في مشروع `qareeb-web`، ملف `.env` (المحلي، غير مرفوع):

```bash
VITE_OSRM_URL=https://osrm.qareeb.sd
```

ثم أعِد بناء التطبيقين:

```bash
git pull origin claude/development-continuation-nxfgub
npm run run:customer
npm run run:driver
```

الكود يقرأ `OSRM_BASE_URL` من هذا المتغيّر تلقائياً (`src/lib/maps.ts`) — لا تعديل برمجي.
من الآن كل المسارات والمناورات والـETA تأتي من خادمك بدقّة السودان.

> للوحة الإدارة على Cloudflare Pages: أضِف نفس المتغيّر `VITE_OSRM_URL` في إعدادات
> متغيّرات البيئة للمشروع على Cloudflare، ثم أعِد النشر.

---

## التحديث الدوري لخريطة السودان

كل بضعة أشهر (أو عند إضافة طرق جديدة على OpenStreetMap):

```bash
cd ~/osrm
wget -O sudan-latest.osm.pbf https://download.geofabrik.de/africa/sudan-latest.osm.pbf
docker run --rm -t -v "$PWD:/data" ghcr.io/project-osrm/osrm-backend osrm-extract -p /opt/car.lua /data/sudan-latest.osm.pbf
docker run --rm -t -v "$PWD:/data" ghcr.io/project-osrm/osrm-backend osrm-partition /data/sudan-latest.osrm
docker run --rm -t -v "$PWD:/data" ghcr.io/project-osrm/osrm-backend osrm-customize /data/sudan-latest.osrm
docker compose restart osrm
```

> نصيحة: يمكن أتمتة ذلك بمهمّة cron شهرية على الخادم.

---

## الأمان والمتانة

- **لا أسرار على هذا الخادم** — مهمّته الحساب فقط. لا تضع عليه مفاتيح Supabase/الخدمة.
- **جدار حماية:** افتح 22 (SSH) و80 و443 فقط. أغلق منفذ OSRM 5000 عن الإنترنت (compose
  يكشفه داخلياً فقط عبر `expose`، لا `ports`).
  ```bash
  sudo ufw allow 22 && sudo ufw allow 80 && sudo ufw allow 443 && sudo ufw enable
  ```
- **حدّ الطلبات (اختياري):** لِمنع الإساءة، فعّل حدّاً في Caddy (`rate_limit`) أو ضع
  Cloudflare أمام النطاق.
- **CORS:** ضبطناه `*` لأن OSRM لا يكشف بيانات حسّاسة؛ إن أردت التقييد، ضع نطاق تطبيقك بدل `*`.
- **مراقبة:** `docker compose logs -f osrm` لمتابعة الطلبات، و`docker stats` لاستهلاك الموارد.
- **نسخة احتياطية:** يكفي الاحتفاظ بأمر إعادة البناء — البيانات تُشتقّ من ملف `.osm.pbf` العام.

---

## استكشاف الأخطاء

| العرض | السبب المحتمل | الحل |
|------|----------------|------|
| `"code":"NoRoute"` | نقطتان خارج شبكة الطرق أو بعيدتان جداً | تحقّق من الإحداثيات (lng,lat وليس lat,lng) |
| فشل `osrm-extract` بنفاد الذاكرة | RAM غير كافٍ | ارفع الذاكرة مؤقتاً أو أضِف swap |
| شهادة HTTPS لا تصدر | النطاق لا يشير للخادم / 80 مغلق | صحّح سجلّ A وافتح المنفذ 80 |
| التطبيق ما زال يستخدم الخادم العام | لم يُعَد البناء بعد ضبط المتغيّر | تأكّد من `.env` ثم أعِد `npm run run:*` |

---

## ملخّص الأمر الواحد بعد الإعداد

```bash
# على الخادم لأول مرة:
cd ~/osrm && docker compose up -d
# في التطبيق:
echo 'VITE_OSRM_URL=https://osrm.qareeb.sd' >> .env && npm run run:driver
```

بهذا يصبح توجيه «قريب» مستقلاً تماماً وبجودة عالية داخل السودان. ✅
