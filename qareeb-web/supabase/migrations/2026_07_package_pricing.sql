-- ============================================================
--  تسعير توصيل الطرود من لوحة الأدمن (#1)
--  مضاعف + رسم ثابت يُطبَّقان على أجرة المسافة لكل طرد.
--  شغّل هذا المقطع مرّة واحدة في Supabase SQL Editor.
-- ============================================================
alter table public.settings add column if not exists package_multiplier numeric(4,2) not null default 1.0;
alter table public.settings add column if not exists package_fee numeric(12,2) not null default 0;
