# 🔔 تفعيل إشعارات السائق (Web Push)

إشعارات أصلية بلا طرف ثالث. الكود جاهز في المستودع؛ تبقّت **خطوات إعداد لمرة واحدة**.
قبل إتمامها: التطبيق يعمل عادياً، وزرّ الجرس لا يظهر للسائق (يظهر فقط بعد ضبط المفتاح العام).

---

## 1) ولّد مفاتيح VAPID (مرة واحدة)

```bash
npx web-push generate-vapid-keys
```

ستحصل على `Public Key` و`Private Key`. احتفظ بهما.

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

## 6) اختبر

1. سائق: افتح التطبيق → اضغط 🔔 → اسمح بالإشعارات → فعّل «متصل».
2. من جهاز آخر: اطلب رحلة.
3. يصل إشعار «🚗 طلب رحلة جديد» للسائق حتى والتطبيق في الخلفية.

## ملاحظات
- **iOS**: تعمل الإشعارات فقط بعد **تثبيت التطبيق على الشاشة الرئيسية** (Add to Home Screen) على iOS 16.4+.
- **أندرويد/سطح المكتب (Chrome/Edge/Firefox)**: تعمل مباشرة بعد السماح.
- الإشعار **بلا تفاصيل الرحلة** عمداً (أخفّ وأوثق) — السائق يفتح التطبيق فيرى الطلب عبر Realtime.
- الاشتراكات المنتهية تُحذف تلقائياً عند أول إرسال فاشل (410/404).
