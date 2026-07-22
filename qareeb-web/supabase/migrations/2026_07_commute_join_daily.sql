-- انضمام الترحيل اليومي عبر دالّة آمنة بدل الإدراج المباشر:
--   • قفل صفّ الطلب (for update) يمنع سباق المقاعد بين منضمَّين في آنٍ واحد.
--   • فرض سعة المقاعد خادمياً (حسب نوع المركبة) بدل فحص العميل القابل للتجاوز.
--   • منع الانضمام المكرّر لنفس المستخدم.
-- (الشهري يمرّ عبر commute_join_monthly أصلاً؛ هذه نظيرتها لليومي.)

create or replace function public.commute_join_daily(
  p_order uuid, p_name text, p_home_lat double precision, p_home_lng double precision,
  p_home_addr text, p_fare numeric, p_pay_method text default 'cash'
) returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_plan text; v_service text; v_seats int; v_count int;
begin
  if v_uid is null then raise exception 'غير مصرّح'; end if;

  select plan, service_id into v_plan, v_service
    from public.commute_orders where id = p_order for update;   -- قفل يمنع سباق المقاعد
  if not found then raise exception 'الطلب غير موجود'; end if;
  if coalesce(v_plan, 'daily') <> 'daily' then raise exception 'الطلب ليس يومياً'; end if;

  if exists (select 1 from public.commute_members where order_id = p_order and user_id = v_uid) then
    raise exception 'أنت مشترك بالفعل في هذا الترحيل';
  end if;

  select coalesce(seats, 4) into v_seats from public.service_pricing where service_id = v_service;
  select count(*) into v_count from public.commute_members where order_id = p_order;
  if v_count >= coalesce(v_seats, 4) then
    raise exception 'اكتمل عدد المقاعد في هذا الترحيل';
  end if;

  insert into public.commute_members
    (order_id, user_id, name, home_lat, home_lng, home_address, is_organizer, fare, pay_method)
  values (p_order, v_uid, p_name, p_home_lat, p_home_lng, p_home_addr, false,
          p_fare, coalesce(p_pay_method, 'cash'));
end $$;
grant execute on function public.commute_join_daily(
  uuid, text, double precision, double precision, text, numeric, text
) to authenticated;
