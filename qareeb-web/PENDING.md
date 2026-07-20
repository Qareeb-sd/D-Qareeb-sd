# ⏭️ مهام معلّقة — قريب (Qareeb)

## 🔔 غداً: تفعيل إشعارات Web Push (سائق + إدارة)
الكود جاهز بالكامل (عميل + سائق + إدارة). تبقّى إعداد لمرة واحدة — الخطوات كاملة في
[`supabase/NOTIFICATIONS.md`](supabase/NOTIFICATIONS.md):

1. المفتاح العام جاهز في الدليل (`VITE_VAPID_PUBLIC_KEY`) — أو ولّد زوجاً جديداً.
2. Cloudflare Pages: أضف `VITE_VAPID_PUBLIC_KEY` (العام) → أعد النشر.
3. طبّق جدول `push_subscriptions` (SQL في الدليل — أو من `schema.sql`).
4. `supabase functions deploy notify-drivers --no-verify-jwt` + اضبط الأسرار
   (`VAPID_PRIVATE_KEY`, `VAPID_PUBLIC_KEY`, `WEBHOOK_SECRET`, `VAPID_SUBJECT`).
5. أنشئ الـ Trigger على جدول `rides` (SQL في الدليل).

**إشعارات الإدارة** (تعبئة/طلب VIP/طوارئ — نصّ واضح واللوحة مغلقة):
6. `supabase functions deploy notify-admins --no-verify-jwt` (نفس الأسرار).
7. طبّق `migrations/2026_07_notify_admins.sql` ثم املأ `app_push_config`
   (الرابط + السرّ) بأمر SQL واحد في الدليل.
8. من تبويب «نظرة عامة» في اللوحة: اضغط 🔔 «تفعيل» على جهاز الأدمن.

**ملاحظة:** التطبيق يعمل عادياً بدون هذا؛ زرّ الجرس 🔔 يظهر فقط بعد الخطوة 2.

## ⏳ أخرى
- فوترة قوقل (خريطة + أجرة Directions دقيقة تلقائياً بعد الاعتماد).
- تسجيل واتساب للحساب الجديد (مستقبلاً).
- (تحسين لاحق) إشعار Push للأدمن عند تنبيه الطوارئ SOS — حالياً يصل عبر Realtime في لوحة الأدمن.
