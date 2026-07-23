# استضافة Valhalla لخريطة السودان (ملاحة الكابتن)

ملاحة الكابتن (المسار + خطوات الاتجاه + الوقت المتوقّع) عالية الحجم — تُعاد
لكل حركة سائق أثناء الرحلة. توجيهها عبر قوقل يكلّف مئات الدولارات شهرياً؛
Valhalla على خادمك يجعلها **مجانية عملياً وبطلبات غير محدودة**.

> تقدير الأجرة للعميل يبقى على **Google Directions** (واعٍ بحركة المرور، نداء
> واحد لكل حجز فقط)، والعرض/البحث على قوقل. Valhalla لملاحة الكابتن فقط.

متى ضُبط `VITE_VALHALLA_URL` يستخدمه التطبيق تلقائياً؛ وإن غاب يعود إلى OSRM —
فلا يتعطّل شيء قبل الاستضافة.

---

## المتطلّبات (صغيرة — السودان وحده)

- خادم (VPS): **٢ نواة / ٤ جيجا رام / ٤٠ جيجا SSD** تكفي بسهولة.
  - أمثلة: Hetzner CX22 (~€٤.٥/شهر) · Contabo VPS S (~٦$/شهر) · Oracle Cloud
    Free Tier (مجاني دائماً).
  - ⚠️ اختر مزوّداً يقبل التسجيل/الدفع من بلدك (البطاقة البحرينية تعمل مع أغلبهم).
- Docker مثبّت على الخادم.

## الخطوات

### ١) تثبيت Docker (على أوبنتو)
```bash
curl -fsSL https://get.docker.com | sh
```

### ٢) تنزيل خريطة السودان (OpenStreetMap)
```bash
mkdir -p ~/valhalla/custom_files && cd ~/valhalla
curl -L -o custom_files/sudan-latest.osm.pbf \
  https://download.geofabrik.de/africa/sudan-latest.osm.pbf
```

### ٣) بناء البلاطات وتشغيل الخادم (صورة رسمية جاهزة)
```bash
docker run -dt --name valhalla -p 8002:8002 \
  -v $PWD/custom_files:/custom_files \
  ghcr.io/gis-ops/docker-valhalla/valhalla:latest
```
عند أول تشغيل يبني البلاطات من ملفّ السودان تلقائياً (دقائق قليلة). تابع:
```bash
docker logs -f valhalla   # انتظر حتى: "Running Valhalla"
```

### ٤) اختبار محلّي (الخرطوم → أم درمان تقريباً)
```bash
curl "http://localhost:8002/route?json=%7B%22locations%22%3A%5B%7B%22lat%22%3A15.5007%2C%22lon%22%3A32.5599%7D%2C%7B%22lat%22%3A15.6445%2C%22lon%22%3A32.4777%7D%5D%2C%22costing%22%3A%22auto%22%7D"
```
يجب أن يعود JSON فيه `trip.summary.length`.

### ٥) HTTPS + نطاق (إلزامي — التطبيق يعمل على https فلا يقبل http)
ضع Valhalla خلف Nginx/Caddy مع شهادة. مثال Caddy (تلقائي الشهادة):
```
valhalla.your-domain.com {
    reverse_proxy localhost:8002
    header Access-Control-Allow-Origin *
}
```
> **CORS مهم:** التطبيق يستدعي Valhalla من المتصفّح مباشرةً، فلا بدّ من ترويسة
> `Access-Control-Allow-Origin`. (طلبنا GET بسيط بلا preflight.)

### ٦) ربط التطبيق
في `qareeb-web/.env`:
```
VITE_VALHALLA_URL=https://valhalla.your-domain.com
```
ثم أعد بناء الويب/الـAPK. تمّ — ملاحة الكابتن الآن على خادمك.

---

## التحديث الدوري (اختياري)
خريطة السودان تتغيّر ببطء. لتحديثها كل بضعة أشهر: أعد تنزيل `sudan-latest.osm.pbf`
واحذف مجلّد البلاطات المبنيّة وأعد تشغيل الحاوية لتبنيها من جديد.

## ملاحظة على الجودة
Valhalla يحسب أسرع مسار من بيانات OSM لكنه **بلا حركة مرور حيّة**. لسائقي المدن
السودانية هذا كافٍ غالباً (يعرفون طرقهم البديلة)، وتقدير الأجرة للعميل يبقى واعياً
بالازدحام عبر قوقل. إن احتجت ازدحاماً حيّاً في الملاحة لاحقاً، يمكن إضافة طبقة
قوقل للملاحة دون تغيير هذه البنية.
