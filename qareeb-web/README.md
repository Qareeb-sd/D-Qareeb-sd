# قريب · Qareeb (web)

تطبيق نقل/توصيل سوداني — **نقل آمن في كل السودان**. هذه نسخة الويب (عميل/سائق/أدمن)
المبنية بـ **Vite + React + TypeScript + Tailwind + Supabase + خرائط قوقل**، بهوية
"قريب" الكاملة (RTL، خط Tajawal، الأخضر السوداني والذهبي).

## المكدّس (Stack)

- **Vite + React 18 + TypeScript**
- **Tailwind CSS** — الهوية معرّفة في `tailwind.config.ts`
- **Supabase** — Auth + Postgres + Storage + Realtime (`src/lib/supabase.ts`)
- **@react-google-maps/api** — الخرائط (`src/components/MapView.tsx`)
- **react-router-dom** — المسارات (`src/App.tsx`)

## التشغيل محلياً

```bash
cp .env.example .env      # املأ مفاتيح Supabase و Google Maps
npm install
npm run dev               # http://localhost:5173
```

> التطبيق يعمل حتى بدون مفاتيح: الخريطة والـ backend يعرضان بدائل واضحة
> بدل أن يتعطّل، لتسهيل معاينة الواجهة.

## البناء

```bash
npm run build             # ينتج dist/
npm run preview           # معاينة نسخة الإنتاج
```

## قاعدة البيانات

شغّل `supabase/schema.sql` في **Supabase → SQL Editor** (أو `supabase db push`).
يُنشئ الجداول: `users, drivers, rides, wallets, transactions, topups, settings`
مع RLS، ومحفظة تلقائية لكل مستخدم جديد، وصف إعدادات واحد للعمولة والحساب البنكي.

## النشر على Cloudflare Pages

1. اربط المستودع بـ Cloudflare Pages.
2. **Build command:** `npm run build`
3. **Build output directory:** `dist`
4. **Root directory:** `qareeb-web`
5. أضف متغيّرات البيئة (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`,
   `VITE_GOOGLE_MAPS_API_KEY`) في إعدادات المشروع.

توجيه الـ SPA مضبوط عبر `public/_redirects`.

## هيكل المشروع

```
qareeb-web/
├── index.html                 # RTL + Tajawal
├── src/
│   ├── main.tsx / App.tsx      # الدخول + المسارات
│   ├── index.css               # طبقات Tailwind + مكوّنات الهوية
│   ├── theme.ts                # ألوان الهوية في JS
│   ├── lib/                    # supabase, maps, types, format
│   ├── data/services.ts        # كتالوج الخدمات (المركبات)
│   ├── store/RideContext.tsx   # حالة تدفّق الرحلة
│   ├── components/             # Logo, Screen, BottomNav, MapView, ...
│   └── pages/
│       ├── customer/           # أونبوردنق، دخول، رئيسية، موقع، رحلة، تقييم، محفظة، ترحيل، حسابي
│       ├── driver/             # تطبيق السائق (مبدئي)
│       └── admin/              # لوحة الأدمن (مبدئي)
├── supabase/schema.sql
└── public/vehicles/            # صور المركبات (ضع الحقيقية هنا)
```

## المسارات

| المسار | الوصف |
|--------|-------|
| `/` | أونبوردنق |
| `/auth` | تسجيل/دخول (OTP للتسجيل الجديد فقط) |
| `/home` | الرئيسية + اختيار الخدمة |
| `/select-location` | تحديد الوجهة على الخريطة |
| `/find-driver` → `/trip` → `/rate` | تدفّق الرحلة |
| `/wallet` | محفظة قريب + التعبئة + المعاملات |
| `/commute` | ترحيل يومي |
| `/profile` | حسابي |
| `/driver` | تطبيق السائق (مبدئي) |
| `/admin` | لوحة الأدمن (عمولة + الحساب البنكي) |

## المتبقّي (خطوات لاحقة)

- ربط `supabase.auth` فعلياً بشاشة `Auth` (OTP عبر SMS).
- جلب/حفظ الرحلات والمحفظة والإعدادات من Supabase بدل البيانات التجريبية.
- Realtime للبحث عن سائق وتتبّع الرحلة.
- إكمال تطبيق السائق ولوحة الأدمن.
- وضع صور المركبات الحقيقية في `public/vehicles/` (خصوصاً **أمجاد — الداماس الأزرق**).
