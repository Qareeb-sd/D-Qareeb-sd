-- تسعير الإعلانات: أسعار ثابتة (يوم/أسبوع/شهر) يحدّدها الأدمن، والمُعلِن يدفع مقدّماً.
-- الإعلان يخزّن السعر الإجمالي المدفوع + وسم المدة، بلا حساب أرباح تلقائي.

-- بطاقة الأسعار في الإعدادات.
alter table public.settings add column if not exists ad_price_day   numeric(12,2) not null default 0;
alter table public.settings add column if not exists ad_price_week  numeric(12,2) not null default 0;
alter table public.settings add column if not exists ad_price_month numeric(12,2) not null default 0;

-- على كل إعلان: السعر الإجمالي المدفوع مقدّماً + وسم المدة (يوم/أسبوع/شهر).
alter table public.ad_banners add column if not exists price  numeric(12,2) not null default 0;
alter table public.ad_banners add column if not exists period text; -- 'day' | 'week' | 'month'
