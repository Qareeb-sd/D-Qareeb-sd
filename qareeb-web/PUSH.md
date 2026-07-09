# إشعارات Web Push — دليل الإعداد والنشر

إشعارات خلفية (تصل حتى والتطبيق مغلق) للسائق والراكب. المكوّنات:

| الجزء | الملف |
|------|-------|
| Service Worker | `public/sw.js` |
| اشتراك/إلغاء من الواجهة | `src/lib/push.ts` + `src/components/NotificationToggle.tsx` |
| تخزين الاشتراكات | جدول `push_subscriptions` في `supabase/schema.sql` |
| إرسال الإشعارات | دالة Edge `supabase/functions/push/index.ts` |

## متى تُرسَل الإشعارات؟
- **رحلة جديدة** (`rides` INSERT) → لكل السائقين المتصلين.
- **تغيّر حالة الرحلة** (`rides` UPDATE: accepted/arrived/in_progress/completed) → للراكب.
- **اعتماد طلب سائق** (`driver_applications` UPDATE → approved) → لمقدّم الطلب.
- **إرسال طلب ترحيل** (`commute_orders` UPDATE → dispatched) → للسائقين المتصلين.

---

## خطوات التفعيل (مرّة واحدة)

### 1) قاعدة البيانات
شغّل `supabase/schema.sql` (ينشئ جدول `push_subscriptions` وسياساته).

### 2) مفاتيح VAPID
مفاتيح جاهزة لهذا المشروع (وُلّدت بمعيار Web Push):

```
PUBLIC : BC-kBP06kbR3KYDZuLcX4ug4hCBmbb2gVkOEjSpie2RDl1GT8nXBNtgPSjr4e506N3BoDEzzk12KW12HbBY17Wg
PRIVATE: (سُلّم بشكل منفصل — لا يوضع في المستودع)
```

> لتوليد زوج جديد بدلاً منها: `npx web-push generate-vapid-keys`

### 3) الواجهة (Frontend)
أضِف المفتاح **العام** كمتغيّر بيئة:

- محلياً في `.env`:
  ```
  VITE_VAPID_PUBLIC_KEY=BC-kBP06kbR3KYDZuLcX4ug4hCBmbb2gVkOEjSpie2RDl1GT8nXBNtgPSjr4e506N3BoDEzzk12KW12HbBY17Wg
  ```
- على Cloudflare Pages: أضِف نفس المتغيّر في Project → Settings → Environment variables، ثم أعد البناء.

### 4) دالة Edge (الإرسال)
تتطلّب Supabase CLI (`npm i -g supabase` ثم `supabase login` و `supabase link`).

```bash
# اضبط الأسرار (المفتاح الخاص + العام + بريد المسؤول)
supabase secrets set \
  VAPID_PUBLIC_KEY=BC-kBP06kbR3KYDZuLcX4ug4hCBmbb2gVkOEjSpie2RDl1GT8nXBNtgPSjr4e506N3BoDEzzk12KW12HbBY17Wg \
  VAPID_PRIVATE_KEY=<المفتاح-الخاص> \
  VAPID_SUBJECT=mailto:you@example.com

# انشر الدالة (تُستدعى من Webhooks بلا JWT)
supabase functions deploy push --no-verify-jwt
```

> `SUPABASE_URL` و `SUPABASE_SERVICE_ROLE_KEY` متوفّران تلقائياً داخل بيئة الدالة.

### 5) Database Webhooks (المشغّلات)
من Supabase Dashboard → **Database → Webhooks → Create**، أنشئ 3 خطّافات كلها تستدعي
دالة `push` (HTTP POST، النوع: Supabase Edge Function):

| الجدول | الأحداث |
|--------|---------|
| `rides` | Insert + Update |
| `driver_applications` | Update |
| `commute_orders` | Update |

الدالة نفسها تُقرّر المستلمين والرسالة حسب الجدول والحدث، وتتجاهل ما لا يعنيها.

---

## التجربة
1. من **حسابي** في أي تطبيق (سائق/عميل) اضغط **تفعيل** بجانب «إشعارات قريب» واسمح بالإذن.
2. أنشئ رحلة من حساب عميل → يصل إشعار «طلب رحلة جديد» لحساب سائق متصل.
3. غيّر حالة الرحلة من السائق → تصل الإشعارات للراكب.

## ملاحظات
- الإشعارات تعمل على HTTPS فقط (Cloudflare Pages يوفّره) — أو `localhost` للتجربة.
- على iOS تتطلّب تثبيت التطبيق على الشاشة الرئيسية (PWA) أولاً (iOS 16.4+).
- اشتراك منتهٍ (404/410) تحذفه الدالة تلقائياً.
