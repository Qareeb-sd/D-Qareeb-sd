# 🔔 تفعيل إشعارات السائق (Web Push)

إشعارات أصلية بلا طرف ثالث. الكود جاهز في المستودع؛ تبقّت **خطوات إعداد لمرة واحدة**.
قبل إتمامها: التطبيق يعمل عادياً، وزرّ الجرس لا يظهر للسائق (يظهر فقط بعد ضبط المفتاح العام).

---

## 1) ولّد مفاتيح VAPID (مرة واحدة)

```bash
npx web-push generate-vapid-keys
```

ستحصل على `Public Key` و`Private Key`. احتفظ بهما.

> **مفتاح عام جاهز** (وُلّد لهذا المشروع — عام وآمن للنشر): ضعه في الخطوة 2.
> `VITE_VAPID_PUBLIC_KEY = BIxqPiuM-9JDyILE3St6GYMTdfpxMZd0NEfgEouT-h2-o3wJ9k0PwxlXI2pOkD8cByyB81iHqtN0e7uB-JxSL_I`
> **المفتاح الخاصّ لا يُكتب هنا ولا في Git** — استلمه من قناة آمنة واضبطه سرّاً في الخطوة 4.
> إن ولّدت زوجاً جديداً، فاستبدل الاثنين معاً (يجب أن يتطابقا).

## 2) المفتاح العام في Cloudflare Pages

في مشروع Cloudflare Pages → **Settings → Environment variables** أضف:

```
VITE_VAPID_PUBLIC_KEY = <Public Key>
```

ثم أعد النشر (Retry deployment) حتى يدخل المتغيّر في البناء. بعدها يظهر زرّ 🔔 للسائق.

## 3) جدول الاشتراكات في قاعدة البيانات

طبّق إضافات `schema.sql` (جدول `push_subscriptions` + RLS). أو شغّل هذا في **SQL Editor**:

```sql
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  endpoint text unique not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
create index if not exists push_subs_user_idx on public.push_subscriptions(user_id);
alter table public.push_subscriptions enable row level security;
drop policy if exists "own push subs" on public.push_subscriptions;
create policy "own push subs" on public.push_subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

## 4) انشر Edge Function

يتطلّب [Supabase CLI](https://supabase.com/docs/guides/cli). من مجلد `qareeb-web`:

```bash
supabase login
supabase link --project-ref <PROJECT_REF>

# الأسرار (استبدل القيم):
supabase secrets set \
  VAPID_PUBLIC_KEY="<Public Key>" \
  VAPID_PRIVATE_KEY="<Private Key>" \
  VAPID_SUBJECT="mailto:admin@qareeb.sd" \
  WEBHOOK_SECRET="<سرّ-عشوائي-طويل>"

# النشر (بلا تحقق JWT — نحرسه بالسرّ المشترك):
supabase functions deploy notify-drivers --no-verify-jwt
```

> `SUPABASE_URL` و`SUPABASE_SERVICE_ROLE_KEY` يحقنهما Supabase تلقائياً — لا تضِفهما.

## 5) استدعِ الدالة عند كل طلب جديد (Trigger)

في **SQL Editor** (استبدل `<PROJECT_REF>` و`<WEBHOOK_SECRET>`):

```sql
create extension if not exists pg_net with schema extensions;

create or replace function public.notify_new_ride()
returns trigger language plpgsql security definer
set search_path = public, extensions as $$
begin
  if new.status in ('requested', 'searching') then
    perform net.http_post(
      url     := 'https://<PROJECT_REF>.functions.supabase.co/notify-drivers',
      headers := jsonb_build_object(
                   'Content-Type', 'application/json',
                   'x-webhook-secret', '<WEBHOOK_SECRET>'),
      body    := jsonb_build_object('ride_id', new.id::text)
    );
  end if;
  return new;
end $$;

drop trigger if exists trg_notify_new_ride on public.rides;
create trigger trg_notify_new_ride
  after insert on public.rides
  for each row execute function public.notify_new_ride();
```

---

## 🛡️ إشعارات الإدارة (تعبئة / طلب VIP / طوارئ)

تصل الأدمن والموظّفين النشطين حتى واللوحة مغلقة، بنصٍّ واضح لكل حدث (بخلاف
إشعار السائق «بلا حمولة»). تشترك نفس مفاتيح VAPID وأسرارها — خطوتان إضافيتان فقط:

### أ) انشر دالة `notify-admins`

```bash
supabase functions deploy notify-admins --no-verify-jwt
```
> الأسرار نفسها (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `WEBHOOK_SECRET`,
> `VAPID_SUBJECT`) — لا حاجة لإعادة ضبطها إن ضُبطت في الخطوة 4.

### ب) طبّق المشغّلات واضبط رابط الدالة

طبّق الترحيل `supabase/migrations/2026_07_notify_admins.sql` (ينشئ جدول إعداد
مقفلاً + دالّة `notify_admins` + مشغّلات على `topups` و`vip_requests` و`sos_alerts`).
ثم في **SQL Editor** املأ الرابط والسرّ مرّةً واحدة:

```sql
insert into public.app_push_config (id, fn_base_url, webhook_secret)
values (1, 'https://<PROJECT_REF>.functions.supabase.co', '<WEBHOOK_SECRET>')
on conflict (id) do update
  set fn_base_url = excluded.fn_base_url,
      webhook_secret = excluded.webhook_secret;
```

> قبل ملء هذا الصف: المشغّلات تعمل بلا أثر (لا تُرسل، ولا تُعطّل الإدخال).
> السرّ يُخزَّن في جدول بلا سياسات RLS — لا يقرؤه أي دور عبر الـ API.

### ج) فعّل جرس الأدمن

في اللوحة (تبويب «نظرة عامة») اضغط 🔔 «تفعيل» على جهاز الأدمن (يفضّل بعد
**تثبيت اللوحة على الشاشة الرئيسية** من المتصفّح — Add to Home Screen). يظهر الجرس
فقط بعد الخطوة 2 (المفتاح العام).

---

## 6) اختبر

1. سائق: افتح التطبيق → اضغط 🔔 → اسمح بالإشعارات → فعّل «متصل».
2. من جهاز آخر: اطلب رحلة.
3. يصل إشعار «🚗 طلب رحلة جديد» للسائق حتى والتطبيق في الخلفية.

## ملاحظات
- **iOS**: تعمل الإشعارات فقط بعد **تثبيت التطبيق على الشاشة الرئيسية** (Add to Home Screen) على iOS 16.4+.
- **أندرويد/سطح المكتب (Chrome/Edge/Firefox)**: تعمل مباشرة بعد السماح.
- الإشعار **بلا تفاصيل الرحلة** عمداً (أخفّ وأوثق) — السائق يفتح التطبيق فيرى الطلب عبر Realtime.
- الاشتراكات المنتهية تُحذف تلقائياً عند أول إرسال فاشل (410/404).
