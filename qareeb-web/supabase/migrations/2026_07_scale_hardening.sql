-- ============================================================
--  تصليب قابلية التوسّع (100 ألف مستخدم) — فهارس + توجيه إشعار الطلب للقريبين.
--  شغّل هذا المقطع مرّة واحدة.
-- ============================================================

-- (1) فهارس المسارات الساخنة ------------------------------------------------

-- استطلاع السائق للطلبات المتاحة (list_available_rides) — فهرس جزئي صغير.
create index if not exists rides_available_idx
  on public.rides (created_at) where status = 'searching' and driver_id is null;

-- سجلّ رحلات العميل + الرحلة النشطة (listRides / getActiveCustomerRide).
create index if not exists rides_customer_created_idx
  on public.rides (customer_id, created_at desc);

-- استعلامات أداء/كشف حساب السائق (driver_id + status + التاريخ).
create index if not exists rides_driver_status_created_idx
  on public.rides (driver_id, status, created_at);

-- ترتيب لوحة الأدمن + التحليلات حسب التاريخ (admin_list_rides / deep_analytics).
create index if not exists rides_created_idx
  on public.rides (created_at desc);

-- سجلّ المحفظة (listTransactions / listDriverTransactions).
create index if not exists tx_wallet_created_idx
  on public.transactions (wallet_id, created_at desc);

-- (2) توجيه إشعار الطلب الجديد للسائقين القريبين فقط (بدل بثّ لكل المتصلين) ----

create or replace function public.nearby_online_driver_ids(
  p_lat double precision, p_lng double precision, p_radius_km double precision default 10
)
returns table (user_id uuid)
language sql stable security definer set search_path = public as $$
  select d.user_id
  from public.drivers d
  where d.is_online
    and d.last_lat is not null and d.last_lng is not null
    and d.last_loc_at > now() - interval '3 minutes'
    and d.last_lat between p_lat - p_radius_km / 111.0 and p_lat + p_radius_km / 111.0
    and d.last_lng between p_lng - p_radius_km / (111.0 * cos(radians(p_lat)))
                      and p_lng + p_radius_km / (111.0 * cos(radians(p_lat)))
    and 6371 * acos(least(1,
          cos(radians(p_lat)) * cos(radians(d.last_lat)) * cos(radians(d.last_lng) - radians(p_lng))
          + sin(radians(p_lat)) * sin(radians(d.last_lat)))) <= p_radius_km
  limit 300;
$$;

-- تُستدعى من الخادم فقط (service_role في Edge Function).
revoke all on function public.nearby_online_driver_ids(double precision, double precision, double precision) from public;
revoke all on function public.nearby_online_driver_ids(double precision, double precision, double precision) from authenticated;
