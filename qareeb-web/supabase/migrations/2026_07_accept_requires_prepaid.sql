-- تحصين قبول الرحلة: لا يُقبَل طلب محفظة غير مدفوع مسبقاً.
-- كان بالإمكان أن تبقى رحلة محفظة «قيد البحث» بلا دفع (إن فشل prepay ثم فشل الإلغاء
-- بسبب انقطاع الشبكة)، فيقبلها السائق ثم يفشل التحصيل عند التسوية — عملٌ بلا مقابل.
-- الآن القبول يرفضها حتى يُتمّ العميل الدفع المسبق. (settle_ride يبقى كما هو: يحصّل
-- عند التسوية إن لم يُدفع مسبقاً، أو يفشل بأمان — فلا مال يُخلق من عدم.)

create or replace function public.accept_ride(p_ride uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_status ride_status; v_driver uuid; v_pkg boolean; v_inter boolean; v_service text; v_vtype text;
        v_payment text; v_prepaid boolean;
begin
  if exists (select 1 from public.drivers where user_id = auth.uid()
       and (suspended or (frozen_until is not null and frozen_until > now()))) then
    raise exception 'حسابك موقوف/مجمّد عن العمل — تواصل مع الإدارة';
  end if;

  select status, driver_id, is_package, intercity, service_id, payment_method, prepaid
    into v_status, v_driver, v_pkg, v_inter, v_service, v_payment, v_prepaid
    from public.rides where id = p_ride for update;
  if v_status is null then raise exception 'الرحلة غير موجودة'; end if;

  if v_payment = 'wallet' and not coalesce(v_prepaid, false) then
    raise exception 'الرحلة غير مدفوعة بعد — بانتظار دفع العميل';
  end if;

  select vehicle_type into v_vtype from public.drivers where user_id = auth.uid();
  if v_vtype is distinct from v_service then
    raise exception 'هذا الطلب لفئة مركبة مختلفة عن مركبتك';
  end if;

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

  update public.rides set driver_id = auth.uid(), status = 'accepted' where id = p_ride;
  return true;
end $$;
grant execute on function public.accept_ride(uuid) to authenticated;
