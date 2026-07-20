-- ============================================================
--  طلب حسب المدينة (city_demand) — لقسم «التوسّع» في لوحة الأدمن.
--  يصنّف كل نقطة طلب فعلية (rides.pickup) وكل سائق (drivers.last_*) لأقرب
--  مدينة ضمن نطاقها، ويعيد لكل مدينة: عدد عملائنا، عدد سائقينا، عدد الطلبات.
--  النقاط خارج كل المدن تُجمَّع تحت المعرّف '__outside__' (فرص مدن جديدة:
--  عملاء سجّلوا وطلبوا في مكان لا نخدمه). آمن للأدمن فقط.
--  المدن تُمرَّر كـ JSONB: [{id, lat, lng, radius}] فتبقى المصدر في التطبيق.
--  شغّل هذا المقطع مرّة واحدة.
-- ============================================================
create or replace function public.city_demand(p_cities jsonb)
returns table (city_id text, customers bigint, drivers bigint, rides bigint)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_staff_or_admin() then
    raise exception 'forbidden';
  end if;

  return query
  with cty as (
    select (c->>'id') as id,
           (c->>'lat')::float8 as lat,
           (c->>'lng')::float8 as lng,
           coalesce((c->>'radius')::float8, 30) as radius_km
    from jsonb_array_elements(p_cities) c
  ),
  -- كل طلب → أقرب مدينة ضمن نطاقها (bbox أولاً للسرعة) أو __outside__.
  ride_city as (
    select r.id as ride_id, r.customer_id, coalesce(nc.id, '__outside__') as city_id
    from public.rides r
    left join lateral (
      select ct.id
      from cty ct
      where abs(ct.lat - r.pickup_lat) < 0.7 and abs(ct.lng - r.pickup_lng) < 0.7
        and 6371 * acos(least(1, greatest(-1,
              sin(radians(r.pickup_lat)) * sin(radians(ct.lat)) +
              cos(radians(r.pickup_lat)) * cos(radians(ct.lat)) *
              cos(radians(ct.lng - r.pickup_lng))))) <= ct.radius_km
      order by 6371 * acos(least(1, greatest(-1,
              sin(radians(r.pickup_lat)) * sin(radians(ct.lat)) +
              cos(radians(r.pickup_lat)) * cos(radians(ct.lat)) *
              cos(radians(ct.lng - r.pickup_lng))))) asc
      limit 1
    ) nc on true
    where r.pickup_lat is not null and r.pickup_lng is not null
  ),
  driver_city as (
    select d.user_id, coalesce(nc.id, '__outside__') as city_id
    from public.drivers d
    left join lateral (
      select ct.id
      from cty ct
      where abs(ct.lat - d.last_lat) < 0.7 and abs(ct.lng - d.last_lng) < 0.7
        and 6371 * acos(least(1, greatest(-1,
              sin(radians(d.last_lat)) * sin(radians(ct.lat)) +
              cos(radians(d.last_lat)) * cos(radians(ct.lat)) *
              cos(radians(ct.lng - d.last_lng))))) <= ct.radius_km
      order by 6371 * acos(least(1, greatest(-1,
              sin(radians(d.last_lat)) * sin(radians(ct.lat)) +
              cos(radians(d.last_lat)) * cos(radians(ct.lat)) *
              cos(radians(ct.lng - d.last_lng))))) asc
      limit 1
    ) nc on true
    where d.last_lat is not null and d.last_lng is not null
  ),
  r_agg as (
    select city_id, count(distinct customer_id) as customers, count(*) as rides
    from ride_city group by city_id
  ),
  d_agg as (
    select city_id, count(distinct user_id) as drivers
    from driver_city group by city_id
  )
  select coalesce(r.city_id, d.city_id) as city_id,
         coalesce(r.customers, 0) as customers,
         coalesce(d.drivers, 0) as drivers,
         coalesce(r.rides, 0) as rides
  from r_agg r
  full outer join d_agg d on r.city_id = d.city_id;
end;
$$;

grant execute on function public.city_demand(jsonb) to authenticated;
