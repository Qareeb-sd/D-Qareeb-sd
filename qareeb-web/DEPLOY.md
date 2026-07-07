# دليل النشر — قريب (qareeb-web)

خطوات تشغيل التطبيق فعلياً: **Supabase** (قاعدة البيانات والمصادقة) →
**Google Maps** (الخرائط) → **Cloudflare Pages** (الاستضافة + الدومين).
كلها على الباقات المجانية. الوقت المتوقّع: ~15 دقيقة.

> قبل الربط، التطبيق يعمل في **وضع تجريبي** (بيانات وهمية) حتى تُضاف المفاتيح.

---

## 1) Supabase — قاعدة البيانات والمصادقة

1. أنشئ حساباً على <https://supabase.com> ثم **New Project** (اختر منطقة قريبة، واحفظ كلمة مرور قاعدة البيانات).
2. من **Project Settings → API** انسخ:
   - `Project URL`  → سيكون `VITE_SUPABASE_URL`
   - `anon public`  → سيكون `VITE_SUPABASE_ANON_KEY`
3. **SQL Editor → New query** → الصق كامل محتوى `supabase/schema.sql` → **Run**.
   - يُنشئ الجداول، الدوال، سياسات RLS، و bucket التخزين `topup-proofs`.
4. تحقّق:
   - **Table Editor**: تظهر الجداول (`users, drivers, rides, wallets, transactions, topups, settings`).
   - **Storage**: يظهر bucket `topup-proofs` (خاص).
5. **المصادقة بالهاتف (OTP):** **Authentication → Providers → Phone** → فعّلها،
   واضبط مزوّد الرسائل (Twilio أو غيره). للتجربة يمكن استخدام
   **Email OTP** بدلاً منها مؤقتاً.
6. **تعيين أول أدمن** (بعد أول تسجيل دخول لك): في SQL Editor:
   ```sql
   update public.users set role = 'admin' where phone = '+2499XXXXXXXX';
   ```

---

## 2) Google Maps — الخرائط

1. من <https://console.cloud.google.com> أنشئ مشروعاً.
2. **APIs & Services → Enable APIs** → فعّل:
   - **Maps JavaScript API**
   - **Places API**
3. **Credentials → Create credentials → API key** → انسخه → `VITE_GOOGLE_MAPS_API_KEY`.
4. (موصى به) قيّد المفتاح: **Application restrictions → Websites** وأضف دومين
   Cloudflare بعد الحصول عليه (خطوة 3)، ودومين `localhost` للتطوير.

---

## 3) Cloudflare Pages — الاستضافة

1. من <https://dash.cloudflare.com> → **Workers & Pages → Create → Pages → Connect to Git**.
2. اختر المستودع `Qareeb-sd/D-Qareeb-sd` والفرع المطلوب.
3. إعدادات البناء:
   | الحقل | القيمة |
   |------|--------|
   | **Root directory** | `qareeb-web` |
   | **Framework preset** | `Vite` (أو None) |
   | **Build command** | `npm run build` |
   | **Build output directory** | `dist` |
4. **Environment variables** (أضف الثلاثة):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_GOOGLE_MAPS_API_KEY`
5. **Save and Deploy**. بعد اكتمال البناء يظهر رابط `*.pages.dev`.
6. **الدومين المخصّص:** **Custom domains → Set up a domain** واتبع تعليمات DNS.

> توجيه الـ SPA مضبوط مسبقاً عبر `public/_redirects` — لا حاجة لإعداد إضافي.

---

## بعد النشر — قائمة تحقّق

- [ ] فتح `*.pages.dev` يعرض الأونبوردنق.
- [ ] التسجيل/الدخول يرسل OTP فعلياً.
- [ ] الخريطة تظهر في "حدد الوجهة" (لا رسالة مفتاح ناقص).
- [ ] إنشاء رحلة تجريبية → تظهر في جدول `rides` بـ Supabase.
- [ ] طلب تعبئة مع صورة → يظهر في `/admin` ويُفتح الإثبات.
- [ ] اعتماد التعبئة → يزيد رصيد المحفظة وتُسجَّل معاملة.
- [ ] السائق (بعد `role='admin'`/`'driver'`) يستقبل الطلب ويكمله → تُخصم العمولة.

## تحديث لاحق

كل `git push` على الفرع المربوط يعيد النشر تلقائياً على Cloudflare Pages.

## أمان (تذكير)

- لا تضع `service_role key` في متغيّرات الواجهة إطلاقاً — فقط `anon key`.
- عمليات الأدمن الحسّاسة محميّة بـ RLS ودوال `security definer` في القاعدة.
- ملف `.env` غير مرفوع (مستثنى في `.gitignore`) — المفاتيح تُضاف في Cloudflare فقط.
