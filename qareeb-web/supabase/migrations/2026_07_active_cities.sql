-- ============================================================
--  تحكّم الأدمن بالمدن: أيّ المدن «نشطة» (يعمل فيها التطبيق) وأنواع المركبات
--  المتاحة في كلٍّ. تُخزَّن في settings كي يتحكّم بها الأدمن دون تحديث للتطبيق.
--    active_cities: مصفوفة معرّفات المدن النشطة (jsonb) — null = الافتراضي.
--    city_vehicles: { معرّف_مدينة: [أنواع المركبات] } — null/غياب = كل الأنواع.
--  شغّل هذا المقطع مرّة واحدة.
-- ============================================================
alter table public.settings add column if not exists active_cities jsonb;
alter table public.settings add column if not exists city_vehicles jsonb;
