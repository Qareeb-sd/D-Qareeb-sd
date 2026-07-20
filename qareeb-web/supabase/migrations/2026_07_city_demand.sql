-- ============================================================
--  طلب حسب المدينة (city_demand) — لقسم «التوسّع» في لوحة الأدمن.
--  يصنّف كل طلب فعلي (rides.pickup) وكل سائق (drivers.last_*) لأقرب مدينة،
--  ويفصّل حسب نوع المركبة (service_id / vehicle_type: قريب/هايس/أمجاد/ركشة/سحاب…).
--  لكل مدينة صفّ إجمالي (vehicle_type='__all__') + صفّ لكل نوع مركبة.
--  النقاط خارج كل المدن تحت المعرّف '__outside__' (فرص مدن جديدة).
--  آمنة للأدمن فقط. المدن تُمرَّر JSONB: [{id, lat, lng, radius}].
--  شغّل هذا المقطع مرّة واحدة (يستبدل النسخة السابقة — تغيّر شكل الإرجاع).
-- ============================================================
drop function if exists public.city_demand(jsonb);

create or replace function public.city_demand(p_cities jsonb)
returns table (city_id text, vehicle_type text, customers bigint, drivers bigint, rides bigint)
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
  ride_city as (
    select r.customer_id, r.service_id as vt, coalesce(nc.id, '__outside__') as city_id
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
    select d.user_id, d.vehicle_type as vt, coalesce(nc.id, '__outside__') as city_id
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
  -- إجماليّ المدينة (تمييز العملاء/السائقين الفريدين بدقّة)
  r_all as (select rc.city_id, '__all__'::text as vt, count(distinct rc.customer_id) as customers, count(*) as rides from ride_city rc group by rc.city_id),
  d_all as (select dc.city_id, '__all__'::text as vt, count(distinct dc.user_id) as drivers from driver_city dc group by dc.city_id),
  -- تفصيل حسب نوع المركبة
  r_typ as (select rc.city_id, rc.vt, count(distinct rc.customer_id) as customers, count(*) as rides from ride_city rc group by rc.city_id, rc.vt),
  d_typ as (select dc.city_id, dc.vt, count(distinct dc.user_id) as drivers from driver_city dc group by dc.city_id, dc.vt),
  merged as (
    select coalesce(r.city_id, d.city_id) as city_id, coalesce(r.vt, d.vt) as vt,
           coalesce(r.customers, 0) as customers, coalesce(d.drivers, 0) as drivers, coalesce(r.rides, 0) as rides
    from r_all r full outer join d_all d on r.city_id = d.city_id
    union all
    select coalesce(r.city_id, d.city_id) as city_id, coalesce(r.vt, d.vt) as vt,
           coalesce(r.customers, 0) as customers, coalesce(d.drivers, 0) as drivers, coalesce(r.rides, 0) as rides
    from r_typ r full outer join d_typ d on r.city_id = d.city_id and r.vt = d.vt
  )
  select m.city_id, m.vt as vehicle_type, m.customers, m.drivers, m.rides from merged m;
end;
$$;

grant execute on function public.city_demand(jsonb) to authenticated;
