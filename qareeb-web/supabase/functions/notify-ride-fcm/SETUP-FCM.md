# إعداد إشعارات FCM (طلبات الكابتن في الخلفية)

يصل السائق إشعار الطلب والتطبيق في الخلفية أو الهاتف مقفل، ما دام «متصلاً».
النظام مبني بالكامل — يبقى فقط إنشاء مشروع Firebase وربط مفاتيحه.

## 1) أنشئ مشروع Firebase
1. افتح https://console.firebase.google.com ← **Add project** (أي حساب Google).
2. أضِف تطبيق أندرويد للكابتن بالحزمة: **`sd.qareeb.captain`**
   (وإن أردت العميل أيضاً لاحقاً: `sd.qareeb.app`).
3. نزّل ملف **`google-services.json`** وضعه في:
   ```
   qareeb-web/android/app/google-services.json
   ```
   (البناء يطبّق إضافة google-services تلقائياً عند وجود الملف — بدونه لا تعمل الإشعارات.)

## 2) فعّل Cloud Messaging وأنشئ حساب خدمة
1. في Firebase Console ← **Project settings ← Cloud Messaging**: تأكّد أن **Firebase Cloud Messaging API (V1)** مفعّلة.
2. **Project settings ← Service accounts ← Generate new private key** → ينزّل ملف JSON (حساب خدمة). احتفظ به بأمان — لا تضعه في المستودع.

## 3) خزّن المفاتيح في أسرار Supabase (لا في المستودع)
من طرفية فيها Supabase CLI ومربوطة بمشروعك:
```bash
# محتوى ملف حساب الخدمة كاملاً (JSON) في سرّ واحد:
supabase secrets set FCM_SERVICE_ACCOUNT="$(cat ~/Downloads/service-account.json)"

# (اختياري) سرّ يحرس استدعاء الدالة:
supabase secrets set WEBHOOK_SECRET="اكتب-سرًّا-قويًّا"
```

## 4) انشر الدالة
```bash
supabase functions deploy notify-ride-fcm
```

## 5) شغّل مخطّط القاعدة المحدّث
`supabase/schema.sql` يضيف جدول `device_tokens` (رموز أجهزة FCM) — شغّله مرّة.

## 6) ابنِ تطبيق الكابتن من جديد
```bash
npm run apk:driver   # يبني + cap sync + gradle (يلتقط google-services.json تلقائياً)
```

## كيف يعمل بعد الإعداد
- عند اتصال الكابتن («متصل») يُسجَّل رمز جهازه في `device_tokens`، ويُحذف عند «غير متصل».
- عند إنشاء العميل رحلة، يستدعي التطبيق دالة `notify-ride-fcm`، فترسل FCM لكل
  السائقين المتصلين → يصلهم إشعار «طلب رحلة جديد» بصوت واهتزاز على قناة `qareeb_rides`
  حتى لو كان التطبيق مغلقاً أو الشاشة مقفلة.
- الرموز المنتهية تُنظَّف تلقائياً.

## ملاحظات أمان
- مفتاح حساب الخدمة و`WEBHOOK_SECRET` يعيشان **فقط** في أسرار Supabase — لا في الكود ولا في المستودع.
- `google-services.json` آمن نسبياً (معرّفات عميل عامة) لكن يُفضّل عدم رفعه؛ أضِفه محلياً على جهاز البناء.
