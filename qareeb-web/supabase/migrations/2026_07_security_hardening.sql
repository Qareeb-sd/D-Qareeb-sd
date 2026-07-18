-- ============================================================
--  تحصين أمني ومحاسبي (مراجعة الخلفية) — شغّل هذا المقطع مرّة واحدة.
--
--  السياق: كل التعديلات المشروعة على الجداول الحسّاسة تمرّ عبر دوال
--  SECURITY DEFINER (accept_ride/settle_ride/cancel_ride/approve_topup…)،
--  لكن سياسات RLS كانت تمنح المالك "FOR ALL" (كتابة مباشرة) فيلتفّ حولها.
--  العميل لا يكتب مباشرةً إلا: rides (إدراج طلب) و topups (إدراج تعبئة) و
--  users.sos_contact — لذا حصر باقي الكتابة في القراءة آمن تماماً.
-- ============================================================

-- ── ١) منع تصعيد الصلاحيات: bootstrap_admin كان مكشوفاً لأي مستخدم ──
--    (يُشغَّل من محرّر SQL كمالك القاعدة فقط، لا عبر PostgREST).
revoke execute on function public.bootstrap_admin(text) from public;
revoke execute on function public.bootstrap_admin(text) from anon;
revoke execute on function public.bootstrap_admin(text) from authenticated;

-- ── ٢) السائق لا يعدّل صفّه مباشرةً (كان يمنح نفسه VIP/إعفاء عمولة أو ──
--    يفكّ الإيقاف/التجميد). كل الضبط عبر دوال آمنة (set_driver_online،
--    set_driver_service_prefs، admin_set_driver_vip…).
drop policy if exists "own driver row" on public.drivers;
create policy "read own driver row" on public.drivers
  for select using (auth.uid() = user_id);

-- ── ٣) العميل لا يعدّل رحلاته مباشرةً (كان يضبط status='completed' فيزوّر ──
--    نقاط ولاء/مكافأة دعوة بلا رحلة، أو يعبث بالأجرة قبل التسوية). يبقى
--    الإدراج (إنشاء الطلب) والقراءة فقط؛ كل تغيير حالة/أجرة عبر الدوال.
drop policy if exists "own rides" on public.rides;
create policy "read own rides" on public.rides
  for select using (auth.uid() = customer_id or auth.uid() = driver_id);
create policy "create own rides" on public.rides
  for insert to authenticated with check (auth.uid() = customer_id);

-- ── ٤) العميل لا يعدّل تعبئته بعد الإرسال (كان يرفع amount أو يقلب status ──
--    بعد أن يراجع الأدمن إيصالاً بمبلغ أصغر). إدراج «قيد المراجعة» وقراءة فقط.
drop policy if exists "own topups" on public.topups;
create policy "read own topups" on public.topups
  for select using (
    wallet_id in (select id from public.wallets where user_id = auth.uid())
  );
create policy "create own topups" on public.topups
  for insert to authenticated with check (
    wallet_id in (select id from public.wallets where user_id = auth.uid())
    and status = 'pending'
  );

-- ── ٥) رحلات المحفظة كانت لا تُسجّل عمولة (قيد واحد ride_earning=net) فتظهر ──
--    العمولة صفراً والصافي = الإجمالي في الكشوف. نعتمد قيداً مزدوجاً: أجرة
--    كاملة دخلاً + عمولة المنصة (لا تغيّر الرصيد، فالصافي أُضيف للقابل للسحب).
create or replace function public.settle_ride(p_ride uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_driver_user uuid; v_customer uuid; v_fare numeric; v_status ride_status;
  v_payment payment_method; v_service text; v_rate numeric; v_commission numeric;
  v_net numeric; v_dwallet uuid; v_cwallet uuid; v_cbalance numeric; v_prepaid boolean;
  v_vip boolean; v_free timestamptz; v_paid_until timestamptz;
begin
  select driver_id, customer_id, fare, status, payment_method, service_id, prepaid
    into v_driver_user, v_customer, v_fare, v_status, v_payment, v_service, v_prepaid
    from public.rides where id = p_ride for update;

  if v_driver_user is null then raise exception 'الرحلة بلا سائق'; end if;
  if auth.uid() <> v_driver_user and not public.is_admin() then raise exception 'غير مصرّح'; end if;
  if v_status = 'completed' then raise exception 'الرحلة مسوّاة مسبقاً'; end if;
  if v_status = 'cancelled' then raise exception 'الرحلة ملغاة'; end if;

  v_rate := coalesce(
    (select commission_rate from public.service_pricing where service_id = v_service),
    (select commission_rate from public.settings where id = 1));

  -- الإعفاء: VIP مدفوع الاشتراك (سارٍ) أو إعفاء عمولة مؤقّت سارٍ.
  select vip, commission_free_until, vip_paid_until into v_vip, v_free, v_paid_until
    from public.drivers where user_id = v_driver_user;
  if (coalesce(v_vip, false) and v_paid_until is not null and v_paid_until > now())
     or (v_free is not null and v_free > now()) then
    v_rate := 0;
  end if;

  v_fare       := coalesce(v_fare, 0);
  v_commission := round(v_fare * coalesce(v_rate, 0));
  v_net        := v_fare - v_commission;

  if v_payment = 'wallet' and not v_prepaid then
    select id, balance into v_cwallet, v_cbalance from public.wallets where user_id = v_customer for update;
    if v_cwallet is null then raise exception 'محفظة العميل غير موجودة'; end if;
    if v_cbalance < v_fare then raise exception 'رصيد محفظة العميل غير كافٍ'; end if;
    update public.wallets set balance = balance - v_fare, updated_at = now() where id = v_cwallet;
    insert into public.transactions (wallet_id, type, amount, ride_id, note)
      values (v_cwallet, 'ride_payment', -v_fare, p_ride, 'دفع رحلة');
  end if;

  update public.rides set status = 'completed' where id = p_ride;

  select id into v_dwallet from public.wallets where user_id = v_driver_user for update;
  if v_dwallet is not null then
    if v_payment = 'wallet' then
      -- الصافي فقط يُضاف للقابل للسحب (لا يتغيّر عن السابق).
      update public.wallets
        set withdrawable = withdrawable + v_net, updated_at = now()
        where id = v_dwallet;
      -- قيد مزدوج: أجرة كاملة دخلاً ثم عمولة المنصة — تُظهر العمولة في
      -- الكشوف/التقارير لرحلات المحفظة (كانت مفقودة)، ومجموع القيدين = الصافي.
      insert into public.transactions (wallet_id, type, amount, ride_id, note)
        values (v_dwallet, 'ride_earning', v_fare, p_ride, 'أجرة رحلة (محفظة)');
      if v_commission > 0 then
        insert into public.transactions (wallet_id, type, amount, ride_id, note)
          values (v_dwallet, 'commission', -v_commission, p_ride, 'عمولة المنصة (محفظة)');
      end if;
    else
      if v_commission > 0 then
        update public.wallets set balance = balance - v_commission, updated_at = now() where id = v_dwallet;
        insert into public.transactions (wallet_id, type, amount, ride_id, note)
          values (v_dwallet, 'commission', -v_commission, p_ride, 'عمولة المنصة (نقدي/تحويل)');
      end if;
    end if;
  end if;
end $$;

-- ── ٦) عمولة الرحلة تُميَّز باحتوائها ride_id، بينما اشتراك VIP عمولة ──
--    بلا ride_id. نحصر «عمولة الرحلة» في الكشوف بـ ride_id is not null حتى
--    لا يخصم رسم اشتراك VIP من صافي رحلات السائق في يوم التحصيل.
create or replace function public.driver_weekly_statement(p_weeks int default 8)
returns table (
  week_start date, week_end date, rides int,
  gross numeric, commission numeric, net numeric,
  cash_gross numeric, wallet_gross numeric
) language sql security definer set search_path = public stable as $$
  select w.ws, w.we,
         coalesce(s.rides, 0)::int,
         coalesce(s.gross, 0),
         coalesce(c.commission, 0),
         coalesce(s.gross, 0) - coalesce(c.commission, 0),
         coalesce(s.cash_gross, 0),
         coalesce(s.wallet_gross, 0)
  from (
    select (b.cur - (g.n * 7))::date as ws, (b.cur - (g.n * 7) + 6)::date as we
    from (
      select ((now() at time zone 'Africa/Khartoum')::date
              - ((extract(dow from (now() at time zone 'Africa/Khartoum'))::int + 1) % 7)) as cur
    ) b,
    generate_series(0, greatest(p_weeks, 1) - 1) g(n)
  ) w
  left join lateral (
    select count(*) as rides,
           sum(r.fare) as gross,
           sum(r.fare) filter (where r.payment_method = 'cash') as cash_gross,
           sum(r.fare) filter (where r.payment_method = 'wallet') as wallet_gross
    from public.rides r
    where r.driver_id = auth.uid() and r.status = 'completed'
      and (coalesce(r.completed_at, r.created_at) at time zone 'Africa/Khartoum')::date between w.ws and w.we
  ) s on true
  left join lateral (
    -- عمولة الرحلات فقط (ride_id is not null) — تستثني رسم اشتراك VIP.
    select -sum(t.amount) as commission
    from public.transactions t
    join public.wallets wl on wl.id = t.wallet_id
    where wl.user_id = auth.uid() and t.type = 'commission' and t.ride_id is not null
      and (t.created_at at time zone 'Africa/Khartoum')::date between w.ws and w.we
  ) c on true
  order by w.ws desc;
$$;
grant execute on function public.driver_weekly_statement(int) to authenticated;

create or replace function public.driver_ride_stats()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  tz text := 'Africa/Khartoum';
  v_uid uuid := auth.uid();
  v_wallet uuid := (select id from public.wallets where user_id = v_uid);
  v_today_gross numeric := coalesce((select sum(fare) from public.rides
     where driver_id = v_uid and status = 'completed'
       and (created_at at time zone tz)::date = (now() at time zone tz)::date), 0);
  -- عمولة الرحلات فقط (ride_id is not null) — يستبعد رسم اشتراك VIP من الصافي.
  v_today_comm numeric := coalesce((select -sum(amount) from public.transactions
     where wallet_id = v_wallet and type = 'commission' and ride_id is not null
       and (created_at at time zone tz)::date = (now() at time zone tz)::date), 0);
begin
  return jsonb_build_object(
    'today', round(v_today_gross),
    'today_count', coalesce((select count(*) from public.rides
       where driver_id = v_uid and status = 'completed'
         and (created_at at time zone tz)::date = (now() at time zone tz)::date), 0),
    'today_net', round(v_today_gross - v_today_comm),
    'month', coalesce((select round(sum(fare)) from public.rides
       where driver_id = v_uid and status = 'completed'
         and date_trunc('month', created_at at time zone tz) = date_trunc('month', now() at time zone tz)), 0),
    'total', coalesce((select round(sum(fare)) from public.rides
       where driver_id = v_uid and status = 'completed'), 0),
    'count', coalesce((select count(*) from public.rides
       where driver_id = v_uid and status = 'completed'), 0)
  );
end $$;
grant execute on function public.driver_ride_stats() to authenticated;

-- ── ٧) «إجمالي التعبئات» في ملخّص الأدمن كان يجمع كل معاملات type='topup' ──
--    (تشمل استرجاعات الإلغاء ومكافآت الدعوة واستبدال النقاط…). نحصره في
--    التعبئات البنكية المعتمدة فعلاً عبر ملاحظتها المميّزة.
create or replace function public.admin_financial_summary()
returns table (
  platform_commission numeric,
  total_topups        numeric,
  ride_payments       numeric,
  driver_earnings     numeric,
  completed_rides     bigint,
  wallet_liability    numeric
) language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_staff_or_admin() then raise exception 'غير مصرّح'; end if;
  return query
    select
      coalesce(-sum(t.amount) filter (where t.type = 'commission'), 0),
      coalesce( sum(t.amount) filter (where t.type = 'topup' and t.note = 'تعبئة رصيد (معتمدة)'), 0),
      coalesce(-sum(t.amount) filter (where t.type = 'ride_payment'), 0),
      coalesce( sum(t.amount) filter (where t.type = 'ride_earning'), 0),
      (select count(*) from public.rides where status = 'completed'),
      coalesce((select sum(balance) from public.wallets), 0)
    from public.transactions t;
end $$;
grant execute on function public.admin_financial_summary() to authenticated;
