-- ============================================================
--  تحصين أمني — الجولة الثانية (مراجعة دوال SECURITY DEFINER).
--  شغّل هذا المقطع مرّة واحدة في Supabase SQL Editor.
-- ============================================================

-- ── ١) التسوية لا تُقبل إلا لرحلة جارية فعلاً ──
--    كان يمكن لسائق خبيث قبول رحلة «محفظة» ثم تسويتها فوراً (خصم من العميل
--    بلا مشوار). الآن يُشترط أن تكون الرحلة in_progress (الأدمن مستثنى
--    لمعالجة الرحلات العالقة).
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
  -- لا تسوية قبل بدء الرحلة فعلياً (يمنع «قبول ثم تسوية فورية» بلا مشوار).
  if v_status <> 'in_progress' and not public.is_admin() then
    raise exception 'لا يمكن تسوية رحلة لم تبدأ بعد';
  end if;

  v_rate := coalesce(
    (select commission_rate from public.service_pricing where service_id = v_service),
    (select commission_rate from public.settings where id = 1));

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
      update public.wallets
        set withdrawable = withdrawable + v_net, updated_at = now()
        where id = v_dwallet;
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

-- ── ٢) قائمة المكافآت العينية كانت بلا فحص صلاحية — أي مستخدم يجلب أسماء ──
--    وهواتف الجميع مع رموز الاستلام غير المستلَمة. تُحصر الآن في الطاقم.
create or replace function public.admin_list_reward_redemptions()
returns table (
  id uuid, user_name text, user_phone text, title text,
  cost_points int, kind text, value numeric, code text, status text, created_at timestamptz
) language sql security definer set search_path = public stable as $$
  select rr.id, u.full_name, u.phone, rr.title, rr.cost_points, rr.kind,
         rr.value, rr.code, rr.status, rr.created_at
  from public.reward_redemptions rr
  join public.users u on u.id = rr.user_id
  where rr.kind = 'perk' and public.is_staff_or_admin()
  order by (rr.status = 'pending') desc, rr.created_at desc;
$$;
grant execute on function public.admin_list_reward_redemptions() to authenticated;

-- ── ٣) رسوم الإلغاء: ادّعاء «سيارة/سائق مختلف» لم يعد يُعفي تلقائياً ──
--    (كان أي عميل يتهرّب من الرسوم باختيار هذا السبب). يُتحقّق فقط من
--    «السائق بعيد» هندسياً؛ والمخالفات تُسجَّل في سبب الإلغاء لمراجعة الأدمن
--    وردّ الرسوم للحالات الصادقة.
create or replace function public.cancel_ride(
  p_ride uuid,
  p_reason text default null,
  p_reason_code text default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_customer uuid; v_driver uuid; v_status ride_status;
  v_fare numeric; v_prepaid boolean; v_cwallet uuid; v_bal numeric;
  v_plat double precision; v_plng double precision;
  v_dlat double precision; v_dlng double precision;
  v_fee numeric := 0; v_far_km numeric; v_far_min numeric;
  v_excused boolean := false; v_dist numeric; v_eta_min numeric;
  v_charged numeric := 0; v_debt numeric := 0;
begin
  select customer_id, driver_id, status, fare, prepaid,
         pickup_lat, pickup_lng, driver_lat, driver_lng
    into v_customer, v_driver, v_status, v_fare, v_prepaid,
         v_plat, v_plng, v_dlat, v_dlng
    from public.rides where id = p_ride for update;

  if v_customer is null then raise exception 'الرحلة غير موجودة'; end if;
  if v_status in ('completed', 'cancelled') then raise exception 'لا يمكن إلغاء هذه الرحلة'; end if;

  if auth.uid() = v_customer then
    if v_status not in ('requested', 'searching', 'accepted', 'arrived') then
      raise exception 'لا يمكن الإلغاء بعد بدء الرحلة';
    end if;

    -- الرسوم تُطبَّق فقط بعد قبول السائق (accepted/arrived)؛ قبلها الإلغاء مجّاني.
    if v_status in ('accepted', 'arrived') then
      if p_reason_code = 'driver_far' then
        if v_dlat is null or v_dlng is null then
          v_excused := true; -- موقع السائق غير معروف بعد — لصالح العميل
        else
          select cancellation_far_km, cancellation_far_min
            into v_far_km, v_far_min from public.settings where id = 1;
          v_dist := public.haversine_km(v_plat, v_plng, v_dlat, v_dlng);
          v_eta_min := (v_dist * 1.3 / 25.0) * 60.0; -- تقدير الزمن (عامل طريق 1.3، 25كم/س)
          v_excused := v_dist > coalesce(v_far_km, 5) or v_eta_min > coalesce(v_far_min, 15);
        end if;
      else
        -- «سيارة/سائق مختلف» ادّعاء غير قابل للتحقّق آلياً — تُطبَّق الرسوم
        -- ويُسجَّل السبب؛ الأدمن يراجع ويردّ الرسوم للحالات الصادقة.
        v_excused := false;
      end if;

      if not v_excused then
        select cancellation_fee into v_fee from public.settings where id = 1;
        v_fee := coalesce(v_fee, 0);
      end if;
    end if;

    update public.rides
       set status = 'cancelled',
           cancel_reason = nullif(btrim(coalesce(p_reason, '')), '')
     where id = p_ride;

    -- استرجاع الدفع المسبق (إن وُجد).
    if v_prepaid then
      select id into v_cwallet from public.wallets where user_id = v_customer for update;
      if v_cwallet is not null then
        update public.wallets set balance = balance + coalesce(v_fare, 0), updated_at = now() where id = v_cwallet;
        insert into public.transactions (wallet_id, type, amount, ride_id, note)
          values (v_cwallet, 'topup', coalesce(v_fare, 0), p_ride, 'استرجاع دفع رحلة ملغاة');
      end if;
      update public.rides set prepaid = false where id = p_ride;
    end if;

    -- رسوم الإلغاء: خصم من المحفظة، والباقي دَيْن على الرحلة القادمة.
    if v_fee > 0 then
      select id, balance into v_cwallet, v_bal from public.wallets where user_id = v_customer for update;
      if v_cwallet is null then
        v_debt := v_fee; -- لا محفظة (نادر) — يبقى ديناً نظرياً
      elsif v_bal >= v_fee then
        update public.wallets set balance = balance - v_fee, updated_at = now() where id = v_cwallet;
        insert into public.transactions (wallet_id, type, amount, ride_id, note)
          values (v_cwallet, 'ride_payment', -v_fee, p_ride, 'رسوم إلغاء الرحلة');
        v_charged := v_fee;
      else
        if v_bal > 0 then
          update public.wallets set balance = 0, updated_at = now() where id = v_cwallet;
          insert into public.transactions (wallet_id, type, amount, ride_id, note)
            values (v_cwallet, 'ride_payment', -v_bal, p_ride, 'رسوم إلغاء (خصم جزئي)');
          v_charged := v_bal;
        end if;
        v_debt := v_fee - v_charged;
        update public.wallets set cancellation_debt = cancellation_debt + v_debt where id = v_cwallet;
      end if;
      perform public.log_action('رسوم إلغاء رحلة', v_fee::text || ' ج.س');
    end if;

    return jsonb_build_object('fee', v_fee, 'charged', v_charged, 'debt', v_debt, 'excused', v_excused);

  elsif auth.uid() = v_driver then
    if v_status not in ('accepted', 'arrived') then
      raise exception 'لا يمكن التخلّي عن الرحلة الآن';
    end if;
    update public.rides set status = 'searching', driver_id = null where id = p_ride;
    return jsonb_build_object('fee', 0, 'charged', 0, 'debt', 0, 'excused', true);
  else
    raise exception 'غير مصرّح';
  end if;
end $$;
grant execute on function public.cancel_ride(uuid, text, text) to authenticated;

-- ── ٤) رمز مشاركة الرحلة كان ٨ خانات فقط (قابل للتخمين بالتعداد، ويكشف ──
--    اسم السائق وموقعه الحيّ لمن يخمّنه). الرموز الجديدة ٣٢ خانة (128-بت).
create or replace function public.ensure_ride_share(p_ride uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_customer uuid; v_driver uuid; v_token text;
begin
  select customer_id, driver_id, share_token
    into v_customer, v_driver, v_token
    from public.rides where id = p_ride;
  if not found then raise exception 'الرحلة غير موجودة'; end if;
  if auth.uid() is null
     or (auth.uid() <> v_customer and auth.uid() is distinct from v_driver) then
    raise exception 'غير مصرّح';
  end if;
  if v_token is null then
    -- 128-بت من العشوائية (لا يُخمَّن بالتعداد).
    v_token := md5(gen_random_uuid()::text || gen_random_uuid()::text);
    update public.rides set share_token = v_token where id = p_ride;
  end if;
  return v_token;
end $$;
grant execute on function public.ensure_ride_share(uuid) to authenticated;

-- ── ٥) log_action للاستدعاء الداخلي فقط — كان أي مستخدم يحقن سطوراً مزوّرة ──
--    في سجلّ التدقيق. (الدوال الآمنة تستدعيه كمالكها فلا تتأثّر.)
revoke execute on function public.log_action(text, text) from public;
revoke execute on function public.log_action(text, text) from anon;
revoke execute on function public.log_action(text, text) from authenticated;

-- ── ٦) الخريطة الحرارية كانت تكشف إحداثيات التقاط دقيقة لأي مستخدم — ──
--    تُحصر في السائقين، وتُقرَّب الإحداثيات (~110م) فتبقى خريطة كثافة لا عناوين.
create or replace function public.demand_hotspots(p_hours int default 3)
returns table (lat double precision, lng double precision)
language sql security definer set search_path = public stable as $$
  select round(pickup_lat::numeric, 3)::double precision,
         round(pickup_lng::numeric, 3)::double precision
  from public.rides
  where created_at > now() - make_interval(hours => p_hours)
    and pickup_lat is not null and pickup_lng is not null
    and exists (select 1 from public.drivers d where d.user_id = auth.uid())
  order by created_at desc
  limit 500;
$$;
grant execute on function public.demand_hotspots(int) to authenticated;
