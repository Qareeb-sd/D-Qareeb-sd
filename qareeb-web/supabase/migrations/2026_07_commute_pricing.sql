-- ============================================================
--  تسعير الترحيل (الجزء ١: الأعمدة والإعدادات) — شغّل مرّة واحدة.
--  السعر يُحسب كالمشوار العادي: منزل الراكب → الوجهة (×2 ذهاباً وإياباً)
--  بأسعار الفترة للمركبة، مع خصم اختياري وعمولة منصّة يضبطهما الأدمن.
--  خطّتان: يومي (كاش للسائق أو خصم محفظة عند تأكيد السائق) و شهري (دفع مقدّم
--  في المحفظة، يُحوَّل للسائق نهاية الشهر بلا تجديد).
-- ============================================================

-- إعدادات الترحيل على جدول settings.
alter table public.settings add column if not exists commute_enabled boolean not null default true;
-- عمولة المنصّة على الترحيل (كسر 0..1)؛ إن كانت NULL تُستخدم عمولة الرحلات العادية.
alter table public.settings add column if not exists commute_commission_rate numeric(5,3);
-- خصم على السعر المحسوب (كسر 0..1، مثال 0.15 = خصم 15%). 0 = بلا خصم.
alter table public.settings add column if not exists commute_discount numeric(5,4) not null default 0;
-- عدد أسابيع الشهر لحساب إجمالي الاشتراك الشهري.
alter table public.settings add column if not exists commute_weeks_per_month int not null default 4;

-- خطّة الطلب: يومي أو شهري (يختارها المنظّم عند الإنشاء).
alter table public.commute_orders add column if not exists plan text not null default 'daily';
-- آخر يوم سُوّي فيه التحصيل اليومي (يمنع تكرار خصم اليوم نفسه).
alter table public.commute_orders add column if not exists last_settled date;

-- أعمدة الدفع على العضو.
alter table public.commute_members add column if not exists fare numeric(12,2);          -- أجرة اليوم (ذهاب وإياب، بعد الخصم)
alter table public.commute_members add column if not exists pay_method text default 'cash'; -- 'cash' | 'wallet' (لليومي)
alter table public.commute_members add column if not exists held numeric(12,2) not null default 0; -- المحجوز للاشتراك الشهري
alter table public.commute_members add column if not exists month_start date;            -- بداية تغطية الاشتراك الشهري
alter table public.commute_members add column if not exists sub_status text;              -- 'active' | 'ended' | 'refunded' (شهري)

-- ============================================================
--  دوال المال (الجزء ٢): الانضمام الشهري المقدّم + التحصيل اليومي + صرف نهاية الشهر.
-- ============================================================

-- عمولة الترحيل الفعّالة (تعود لعمولة الرحلات إن لم تُضبط).
create or replace function public.commute_commission() returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce(commute_commission_rate, commission_rate) from public.settings where id = 1;
$$;

-- انضمام شهري: يدفع الراكب إجمالي الشهر مقدّماً من محفظته (يُحجز على صفّه).
create or replace function public.commute_join_monthly(
  p_order uuid, p_name text, p_home_lat double precision, p_home_lng double precision,
  p_home_addr text, p_fare numeric, p_organizer boolean default false
) returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_plan text; v_days int; v_weeks int; v_total numeric;
        v_wallet uuid; v_bal numeric;
begin
  if v_uid is null then raise exception 'غير مصرّح'; end if;
  select plan, coalesce(array_length(days, 1), 0) into v_plan, v_days
    from public.commute_orders where id = p_order;
  if not found then raise exception 'الطلب غير موجود'; end if;
  if v_plan <> 'monthly' then raise exception 'الطلب ليس شهرياً'; end if;
  if exists (select 1 from public.commute_members where order_id = p_order and user_id = v_uid) then
    raise exception 'أنت مشترك بالفعل في هذا الترحيل';
  end if;
  select coalesce(commute_weeks_per_month, 4) into v_weeks from public.settings where id = 1;
  v_total := round(coalesce(p_fare, 0) * greatest(v_days, 1) * greatest(coalesce(v_weeks, 4), 1));
  if v_total <= 0 then raise exception 'سعر الاشتراك غير صالح'; end if;
  select id, balance into v_wallet, v_bal from public.wallets where user_id = v_uid for update;
  if v_wallet is null then raise exception 'المحفظة غير موجودة'; end if;
  if v_bal < v_total then raise exception 'رصيد المحفظة غير كافٍ للاشتراك الشهري'; end if;
  update public.wallets set balance = balance - v_total, updated_at = now() where id = v_wallet;
  insert into public.transactions (wallet_id, type, amount, note)
    values (v_wallet, 'ride_payment', -v_total, 'اشتراك ترحيل شهري (مقدّم)');
  insert into public.commute_members
    (order_id, user_id, name, home_lat, home_lng, home_address, is_organizer, fare, pay_method, held, month_start, sub_status)
  values
    (p_order, v_uid, p_name, p_home_lat, p_home_lng, p_home_addr, coalesce(p_organizer, false),
     p_fare, 'wallet', v_total, (now() at time zone 'Africa/Khartoum')::date, 'active');
end $$;
grant execute on function public.commute_join_monthly(uuid, text, double precision, double precision, text, numeric, boolean) to authenticated;

-- التحصيل اليومي: السائق يؤكّد «تم ترحيل اليوم» فيُحصَّل لكل راكب يومه (مرّة/يوم).
--   محفظة → خصم من الراكب وإضافة الصافي للسائق (نموذج قيد مزدوج كالرحلات).
--   كاش   → السائق يحصّل نقداً، وتُخصم عمولة المنصّة من محفظته.
create or replace function public.commute_settle_day(p_order uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_driver uuid; v_status commute_status; v_plan text; v_last date; v_today date;
        v_rate numeric; r record; v_comm numeric; v_net numeric; v_dwallet uuid;
        v_cwallet uuid; v_cbal numeric; v_paid int := 0; v_cash int := 0; v_skip int := 0;
begin
  v_today := (now() at time zone 'Africa/Khartoum')::date;
  select driver_id, status, plan, last_settled into v_driver, v_status, v_plan, v_last
    from public.commute_orders where id = p_order for update;
  if not found then raise exception 'الطلب غير موجود'; end if;
  if v_driver is null or v_driver <> auth.uid() then raise exception 'غير مصرّح'; end if;
  if v_status <> 'active' then raise exception 'الترحيل غير نشط'; end if;
  if v_plan <> 'daily' then raise exception 'التحصيل اليومي للخطة اليومية فقط'; end if;
  if v_last = v_today then raise exception 'تم تحصيل اليوم مسبقاً'; end if;

  v_rate := public.commute_commission();
  select id into v_dwallet from public.wallets where user_id = v_driver for update;

  for r in select user_id, fare, pay_method from public.commute_members where order_id = p_order loop
    if coalesce(r.fare, 0) <= 0 then continue; end if;
    v_comm := round(r.fare * coalesce(v_rate, 0));
    v_net  := r.fare - v_comm;
    if r.pay_method = 'wallet' then
      select id, balance into v_cwallet, v_cbal from public.wallets where user_id = r.user_id for update;
      if v_cwallet is null or v_cbal < r.fare then v_skip := v_skip + 1; continue; end if;
      update public.wallets set balance = balance - r.fare, updated_at = now() where id = v_cwallet;
      insert into public.transactions (wallet_id, type, amount, note)
        values (v_cwallet, 'ride_payment', -r.fare, 'ترحيل يومي');
      if v_dwallet is not null then
        update public.wallets set withdrawable = withdrawable + v_net, updated_at = now() where id = v_dwallet;
        insert into public.transactions (wallet_id, type, amount, note)
          values (v_dwallet, 'ride_earning', r.fare, 'ترحيل يومي (محفظة)');
        if v_comm > 0 then
          insert into public.transactions (wallet_id, type, amount, note)
            values (v_dwallet, 'commission', -v_comm, 'عمولة ترحيل (محفظة)');
        end if;
      end if;
      v_paid := v_paid + 1;
    else
      if v_dwallet is not null and v_comm > 0 then
        update public.wallets set balance = balance - v_comm, updated_at = now() where id = v_dwallet;
        insert into public.transactions (wallet_id, type, amount, note)
          values (v_dwallet, 'commission', -v_comm, 'عمولة ترحيل (كاش)');
      end if;
      v_cash := v_cash + 1;
    end if;
  end loop;

  update public.commute_orders set last_settled = v_today where id = p_order;
  return jsonb_build_object('wallet_paid', v_paid, 'cash', v_cash, 'skipped', v_skip);
end $$;
grant execute on function public.commute_settle_day(uuid) to authenticated;

-- صرف نهاية الشهر (بلا تجديد): يُحوّل المحجوز لمحفظة السائق ناقص العمولة، وإن لم
--   يوجد سائق يُعاد للراكب. للأدمن (أو مهمّة مجدولة).
create or replace function public.settle_due_commute_months()
returns jsonb language plpgsql security definer set search_path = public as $$
declare r record; v_rate numeric; v_comm numeric; v_net numeric; v_dwallet uuid; v_cwallet uuid;
        v_paid int := 0; v_refunded int := 0;
begin
  if not public.is_admin() then raise exception 'غير مصرّح'; end if;
  v_rate := public.commute_commission();
  for r in
    select m.id, m.user_id, m.held, o.driver_id
    from public.commute_members m
    join public.commute_orders o on o.id = m.order_id
    where m.sub_status = 'active' and m.held > 0
      and m.month_start <= ((now() at time zone 'Africa/Khartoum')::date - interval '1 month')
  loop
    if r.driver_id is not null then
      v_comm := round(r.held * coalesce(v_rate, 0));
      v_net  := r.held - v_comm;
      select id into v_dwallet from public.wallets where user_id = r.driver_id for update;
      if v_dwallet is not null then
        update public.wallets set withdrawable = withdrawable + v_net, updated_at = now() where id = v_dwallet;
        insert into public.transactions (wallet_id, type, amount, note)
          values (v_dwallet, 'ride_earning', r.held, 'اشتراك ترحيل شهري');
        if v_comm > 0 then
          insert into public.transactions (wallet_id, type, amount, note)
            values (v_dwallet, 'commission', -v_comm, 'عمولة ترحيل شهري');
        end if;
      end if;
      update public.commute_members set sub_status = 'ended', held = 0 where id = r.id;
      v_paid := v_paid + 1;
    else
      select id into v_cwallet from public.wallets where user_id = r.user_id for update;
      if v_cwallet is not null then
        update public.wallets set balance = balance + r.held, updated_at = now() where id = v_cwallet;
        insert into public.transactions (wallet_id, type, amount, note)
          values (v_cwallet, 'topup', r.held, 'استرجاع اشتراك ترحيل (بلا سائق)');
      end if;
      update public.commute_members set sub_status = 'refunded', held = 0 where id = r.id;
      v_refunded := v_refunded + 1;
    end if;
  end loop;
  return jsonb_build_object('paid_drivers', v_paid, 'refunded', v_refunded);
end $$;
grant execute on function public.settle_due_commute_months() to authenticated;
