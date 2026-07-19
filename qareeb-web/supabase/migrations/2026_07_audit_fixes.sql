-- ============================================================
--  إصلاحات جولة الفحص (SQL) — شغّل هذا المقطع مرّة واحدة في محرّر Supabase.
--  يشمل: مطابقة نوع المركبة، حارس السعر، عدم تكرار الرواتب، برومو لكل عميل،
--  انتهاء مهلة الطلبات المعلّقة (استرجاع تلقائي)، وتعطيل خصم VIP التلقائي.
-- ============================================================

-- ── (D1) مطابقة نوع المركبة مع الخدمة: لا يقبل السائق فئة غير فئته ──────────────
-- يمنع سائق ركشة من قبول هايس، وسائق رجل من قبول «قريب نسائي»، وسيارة من قبول «سحّاب».
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
    and d.vehicle_type = r.service_id                 -- مطابقة الفئة
    and (not r.is_package or d.accepts_packages)
    and (not r.intercity  or d.accepts_intercity)
  order by r.created_at asc;
$$;
grant execute on function public.list_available_rides() to authenticated;

create or replace function public.accept_ride(p_ride uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_status ride_status; v_driver uuid; v_pkg boolean; v_inter boolean; v_service text; v_vtype text;
begin
  if exists (select 1 from public.drivers where user_id = auth.uid()
       and (suspended or (frozen_until is not null and frozen_until > now()))) then
    raise exception 'حسابك موقوف/مجمّد عن العمل — تواصل مع الإدارة';
  end if;

  select status, driver_id, is_package, intercity, service_id
    into v_status, v_driver, v_pkg, v_inter, v_service
    from public.rides where id = p_ride for update;
  if v_status is null then raise exception 'الرحلة غير موجودة'; end if;

  -- مطابقة نوع مركبة السائق مع فئة الطلب.
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

-- ── (C3) حارس سعر الرحلة: لا يُقبَل سعر صفري/سالب/فارغ أو مبالغ فيه ────────────
create or replace function public.guard_ride_fare()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.fare is null or new.fare <= 0 then
    raise exception 'سعر الرحلة غير صالح';
  end if;
  if new.fare > 100000000 then           -- سقف أمان ضدّ التلاعب/الأخطاء
    raise exception 'سعر الرحلة تجاوز الحدّ المعقول';
  end if;
  return new;
end $$;
drop trigger if exists trg_guard_ride_fare on public.rides;
create trigger trg_guard_ride_fare before insert on public.rides
  for each row execute function public.guard_ride_fare();

-- ── (A1) عدم تكرار صرف الرواتب في الشهر نفسه ──────────────────────────────────
create or replace function public.pay_salaries(p_account uuid, p_note text default null)
returns numeric language plpgsql security definer set search_path = public as $$
declare v_total numeric := 0; r record;
begin
  if not public.is_admin() then raise exception 'غير مصرّح'; end if;
  -- حارس التكرار: إن صُرِف راتب هذا الشهر من قبل، امنع صرفاً ثانياً.
  if exists (
    select 1 from public.expenses
     where category = 'salary' and spent_at >= date_trunc('month', now())::date
  ) then
    raise exception 'رواتب هذا الشهر مصروفة مسبقاً';
  end if;
  for r in select id, name, salary from public.hr_employees where active and salary > 0 loop
    insert into public.expenses (category, description, amount, employee_id, account_id, created_by)
      values ('salary', coalesce(p_note,'راتب') || ' — ' || r.name, r.salary, r.id, p_account, auth.uid());
    v_total := v_total + r.salary;
  end loop;
  if p_account is not null and v_total > 0 then
    update public.company_accounts set balance = balance - v_total where id = p_account;
  end if;
  perform public.log_action('صرف رواتب', v_total::text || ' ج.س');
  return v_total;
end $$;

-- ── (C5) كود الخصم: استخدام واحد لكل عميل (منع تكراره على كل رحلة) ─────────────
create or replace function public.validate_promo(p_code text, p_fare numeric)
returns table (valid boolean, discount numeric, final numeric, message text)
language plpgsql stable security definer set search_path = public as $$
declare r public.promo_codes; d numeric;
begin
  select * into r from public.promo_codes where lower(code) = lower(btrim(p_code));
  if not found then return query select false, 0::numeric, p_fare, 'كود غير صحيح'; return; end if;
  if not r.active then return query select false, 0::numeric, p_fare, 'الكود غير مفعّل'; return; end if;
  if r.expires_at is not null and r.expires_at < now() then
    return query select false, 0::numeric, p_fare, 'انتهت صلاحية الكود'; return; end if;
  if p_fare < coalesce(r.min_fare, 0) then
    return query select false, 0::numeric, p_fare, 'قيمة الرحلة أقلّ من حدّ الكود'; return; end if;
  -- استخدام واحد لكل عميل.
  if exists (select 1 from public.rides
             where customer_id = auth.uid() and lower(promo_code) = lower(r.code)) then
    return query select false, 0::numeric, p_fare, 'استخدمت هذا الكود من قبل'; return; end if;
  if r.max_uses is not null and
     (select count(*) from public.rides where lower(promo_code) = lower(r.code)) >= r.max_uses then
    return query select false, 0::numeric, p_fare, 'نفد استخدام الكود'; return; end if;
  d := case when r.discount_type = 'percent'
            then round(p_fare * r.discount_value / 100)
            else least(r.discount_value, p_fare) end;
  return query select true, d, greatest(0, p_fare - d), 'تم تطبيق الخصم ✓';
end $$;
grant execute on function public.validate_promo(text, numeric) to authenticated;

-- ── (C9) انتهاء مهلة الطلبات المعلّقة بلا سائق: إلغاء + استرجاع الدفع المسبق ────
create or replace function public.expire_stale_searching_rides()
returns int language plpgsql security definer set search_path = public as $$
declare r record; v_wallet uuid; n int := 0;
begin
  for r in select id, customer_id, fare, payment_method, prepaid
           from public.rides
           where status in ('searching','requested')
             and created_at < now() - interval '15 minutes'
           for update skip locked loop
    if r.payment_method = 'wallet' and r.prepaid and coalesce(r.fare,0) > 0 then
      select id into v_wallet from public.wallets where user_id = r.customer_id for update;
      if v_wallet is not null then
        update public.wallets set balance = balance + r.fare, updated_at = now() where id = v_wallet;
        insert into public.transactions (wallet_id, type, amount, ride_id, note)
          values (v_wallet, 'topup', r.fare, r.id, 'استرجاع رحلة لم تُقبَل (انتهت المهلة)');
      end if;
    end if;
    update public.rides set status = 'cancelled' where id = r.id;
    n := n + 1;
  end loop;
  return n;
end $$;
-- جدولة كل 5 دقائق (يتطلّب pg_cron المفعّل مسبقاً للترحيل).
select cron.unschedule('expire-stale-rides') where exists (select 1 from cron.job where jobname = 'expire-stale-rides');
select cron.schedule('expire-stale-rides', '*/5 * * * *', $$select public.expire_stale_searching_rides()$$);

-- ── (A3) تعطيل خصم VIP التلقائي (يخالف السياسة المعلنة «بلا خصم تلقائي») ────────
revoke all on function public.charge_due_vip_subscriptions() from public;
revoke all on function public.charge_due_vip_subscriptions() from authenticated;
