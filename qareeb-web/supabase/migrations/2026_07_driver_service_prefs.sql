-- ============================================================
--  تفضيلات السائق: استقبال طلبات الطرود / السفر بين المدن.
--  فتُوجَّه هذه الطلبات فقط لمن فعّلها (لا تظهر لمن لا يريدها).
--  شغّل هذا المقطع مرّة واحدة في Supabase SQL Editor.
-- ============================================================
alter table public.drivers add column if not exists accepts_packages  boolean not null default true;
alter table public.drivers add column if not exists accepts_intercity boolean not null default false;

-- السائق يضبط تفضيلاته.
create or replace function public.set_driver_service_prefs(p_packages boolean, p_intercity boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.drivers where user_id = auth.uid()) then
    raise exception 'الحساب ليس سائقاً';
  end if;
  update public.drivers
     set accepts_packages = coalesce(p_packages, accepts_packages),
         accepts_intercity = coalesce(p_intercity, accepts_intercity)
   where user_id = auth.uid();
end $$;
grant execute on function public.set_driver_service_prefs(boolean, boolean) to authenticated;

-- الطلبات المتاحة: تُصفَّى حسب تفضيلات السائق (طرد/سفر) — تغيّر منطق الفلترة فقط.
drop function if exists public.list_available_rides();
create or replace function public.list_available_rides()
returns table (
  id uuid, customer_id uuid, driver_id uuid, service_id text, status ride_status,
  pickup_lat double precision, pickup_lng double precision, pickup_address text,
  dropoff_lat double precision, dropoff_lng double precision, dropoff_address text,
  fare numeric, payment_method payment_method, created_at timestamptz,
  customer_name text, customer_rating numeric,
  is_package boolean, package_note text, recipient_name text, recipient_phone text, intercity boolean
) language sql stable security definer set search_path = public as $$
  select r.id, r.customer_id, r.driver_id, r.service_id, r.status,
         r.pickup_lat, r.pickup_lng, r.pickup_address,
         r.dropoff_lat, r.dropoff_lng, r.dropoff_address,
         r.fare, r.payment_method, r.created_at,
         cu.full_name, cu.rating,
         r.is_package, r.package_note, r.recipient_name, r.recipient_phone, r.intercity
  from public.rides r
  join public.users cu on cu.id = r.customer_id
  join public.drivers d on d.user_id = auth.uid()
  where r.status = 'searching' and r.driver_id is null
    and (not r.is_package or d.accepts_packages)
    and (not r.intercity  or d.accepts_intercity)
  order by r.created_at asc;
$$;
grant execute on function public.list_available_rides() to authenticated;

-- حارس القبول: يمنع سائقاً لا يستقبل هذا النوع من قبوله (احتياط إن وصله إشعار).
create or replace function public.accept_ride(p_ride uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_status ride_status; v_driver uuid; v_pkg boolean; v_inter boolean;
begin
  if exists (select 1 from public.drivers where user_id = auth.uid()
       and (suspended or (frozen_until is not null and frozen_until > now()))) then
    raise exception 'حسابك موقوف/مجمّد عن العمل — تواصل مع الإدارة';
  end if;

  select status, driver_id, is_package, intercity
    into v_status, v_driver, v_pkg, v_inter
    from public.rides where id = p_ride for update;
  if v_status is null then raise exception 'الرحلة غير موجودة'; end if;

  -- منع القبول إن كان الطلب طرداً/سفراً والسائق لا يستقبله.
  if (v_pkg or v_inter) and exists (
    select 1 from public.drivers d where d.user_id = auth.uid()
      and ((v_pkg and not d.accepts_packages) or (v_inter and not d.accepts_intercity))
  ) then
    raise exception 'هذا الطلب خارج نوع الخدمات التي تستقبلها';
  end if;

  if exists (
    select 1 from public.rides
     where driver_id = auth.uid()
       and status in ('accepted', 'arrived', 'in_progress')
  ) then
    raise exception 'لديك رحلة جارية بالفعل';
  end if;

  if v_driver is not null or v_status not in ('searching', 'requested') then
    return false;
  end if;

  update public.rides
     set driver_id = auth.uid(), status = 'accepted'
   where id = p_ride;
  return true;
end $$;
grant execute on function public.accept_ride(uuid) to authenticated;
