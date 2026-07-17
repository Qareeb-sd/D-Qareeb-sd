-- ============================================================
--  توصيل الطرود + السفر بين المدن كخدمتين مستقلّتين لهما تسعير كامل
--  بالمسافة والزمن وحسب الفترات (مثل بقية المركبات).
--  شغّل هذا المقطع مرّة واحدة في Supabase SQL Editor.
--  الخدمتان مخفيّتان (state=hidden) فلا تظهران في قائمة اختيار المركبة،
--  لكنهما تظهران في جدول «التسعير حسب الفترة الزمنية» في لوحة الأدمن.
-- ============================================================

-- 1) صفّا الخدمة (تسعير أساسي + حقول العرض). قابلة للتعديل لاحقاً من اللوحة.
insert into public.service_pricing
  (service_id, name, base_fare, per_km_urban, per_km_far, per_minute,
   sort_order, active, tagline, seats, art, tint, noun, sharable, destination_optional, state)
values
  ('package',   'توصيل طرد',    2400, 2400, 3000, 56, 20, true,
   'أرسل غرضاً لأي مكان', 1, 'rickshaw', '#B0870F', 'الطرد',   false, false, 'hidden'),
  ('intercity', 'سفر بين المدن', 5000, 4500, 5000, 56, 21, true,
   'رحلة لمدينة أخرى',    4, 'sedan',    '#0E3B2E', 'السيارة', false, false, 'hidden')
on conflict (service_id) do nothing;

-- 2) تسعير الفترات الأربع لكل خدمة (صباح/ظهر/مساء/ليل).
--    الصيغة: الأجرة = فتح العداد + (سعر الكيلومتر × كم) + (سعر الدقيقة × دقيقة) ثم الحدّ الأدنى.
insert into public.service_pricing_periods (service_id, period, base_fare, per_km, per_min, min_fare)
values
  -- توصيل طرد (اقتصادي — عدّله كما تراه مناسباً)
  ('package','morning',   2400, 2400, 56, 6000),
  ('package','afternoon', 2400, 2400, 56, 6000),
  ('package','evening',   2640, 2640, 56, 6600),
  ('package','night',     2760, 2760, 56, 6900),
  -- سفر بين المدن (أعلى للمسافات الطويلة)
  ('intercity','morning',   5000, 4500, 56, 15000),
  ('intercity','afternoon', 5000, 4500, 56, 15000),
  ('intercity','evening',   5500, 4950, 56, 16500),
  ('intercity','night',     5750, 5175, 56, 17300)
on conflict (service_id, period) do nothing;
