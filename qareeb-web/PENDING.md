# ⏭️ مهام معلّقة — قريب (Qareeb)

## 🔔 غداً: تفعيل إشعارات السائق (Web Push)
الكود جاهز ومنشور. تبقّى إعداد لمرة واحدة — الخطوات كاملة في
[`supabase/NOTIFICATIONS.md`](supabase/NOTIFICATIONS.md):

1. `npx web-push generate-vapid-keys` → مفتاح عام + خاص.
2. Cloudflare Pages: أضف `VITE_VAPID_PUBLIC_KEY` (العام) → أعد النشر.
3. طبّق جدول `push_subscriptions` (SQL في الدليل — أو من `schema.sql`).
4. `supabase functions deploy notify-drivers --no-verify-jwt` + اضبط الأسرار
   (`VAPID_PRIVATE_KEY`, `VAPID_PUBLIC_KEY`, `WEBHOOK_SECRET`, `VAPID_SUBJECT`).
5. أنشئ الـ Trigger على جدول `rides` (SQL في الدليل).

**ملاحظة:** التطبيق يعمل عادياً بدون هذا؛ زرّ الجرس 🔔 للسائق يظهر فقط بعد الخطوة 2.

## ⏳ أخرى
- فوترة قوقل (خريطة + أجرة Directions دقيقة تلقائياً بعد الاعتماد).
- تسجيل واتساب للحساب الجديد (مستقبلاً).
- (تحسين لاحق) إشعار Push للأدمن عند تنبيه الطوارئ SOS — حالياً يصل عبر Realtime في لوحة الأدمن.
