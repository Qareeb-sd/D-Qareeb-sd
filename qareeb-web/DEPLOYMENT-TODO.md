# مهام مؤجّلة إلى مرحلة النشر (تحتاج صلاحيات المالك)

هذه خطوات لا يمكن تنفيذها من داخل الكود — تحتاج حساب Supabase/Cloudflare.
تُنفَّذ **دفعة واحدة عند النشر الفعلي**.

## 1) تفعيل إشعارات Web Push (الكود جاهز — يبقى الإعداد)
راجع التفاصيل الكاملة في [`PUSH.md`](./PUSH.md). باختصار:

- [ ] **متغيّر الواجهة**: أضِف `VITE_VAPID_PUBLIC_KEY` (المفتاح العام) في `.env`
      محلياً وفي متغيّرات بيئة Cloudflare Pages، ثم أعِد البناء.
      ```
      VITE_VAPID_PUBLIC_KEY=BC-kBP06kbR3KYDZuLcX4ug4hCBmbb2gVkOEjSpie2RDl1GT8nXBNtgPSjr4e506N3BoDEzzk12KW12HbBY17Wg
      ```
- [ ] **نشر دالة Edge + الأسرار** (Supabase CLI):
      ```bash
      supabase secrets set \
        VAPID_PUBLIC_KEY=<العام> VAPID_PRIVATE_KEY=<الخاص> VAPID_SUBJECT=mailto:you@example.com
      supabase functions deploy push --no-verify-jwt
      ```
      (المفتاح الخاص سُلّم في المحادثة — لا يوضع في المستودع.)
- [ ] **Database Webhooks** (Supabase → Database → Webhooks): 3 خطّافات تستدعي دالة `push`:
      - `rides` — Insert + Update
      - `driver_applications` — Update
      - `commute_orders` — Update

## 2) النشر الفعلي على Cloudflare Pages
راجع [`DEPLOY.md`](./DEPLOY.md): ربط المستودع، متغيّرات البيئة (Supabase + Google Maps
+ VAPID العام)، Build command `npm run build`، Output `dist`، Root `qareeb-web`.
