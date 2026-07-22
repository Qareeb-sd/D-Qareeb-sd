-- ════════════════════════════════════════════════════════════════════
--  تحصينات المراجعة الأمنية — الجولة الثالثة (Round 3)
--  تُطبَّق دفعةً واحدة. كلّ بند مستقلّ وقابل لإعادة التنفيذ بأمان.
-- ════════════════════════════════════════════════════════════════════

-- ── (أ) [حرج] أجور الترحيل يتحكّم بها العميل بلا تحقّق → تهرّب من العمولة ──
--  p_fare يُخزَّن ويُحصَّل حرفياً بلا إعادة حساب. رحلات rides محميّة بحدّ
--  guard_ride_fare، أمّا الترحيل فلا يمرّ بها. نضيف حدّاً أدنى متحفّظاً بنفس
--  المنطق: (أرخص أساس + أرخص/كم × هافرسين المنزل→الوجهة) × 0.30. لا يرفض أي
--  اشتراك حقيقي، لكنه يمنع p_fare=1.
create or replace function public.commute_fare_floor(
  p_service text, p_home_lat double precision, p_home_lng double precision,
  p_dest_lat double precision, p_dest_lng double precision
) returns numeric language sql stable set search_path = public as $$
  select (coalesce(min(base_fare), 0) + coalesce(min(per_km), 0)
          * coalesce(public.haversine_km(p_home_lat, p_home_lng, p_dest_lat, p_dest_lng), 0)) * 0.30
    from public.service_pricing_periods where service_id = p_service;
$$;

-- انضمام يومي آمن (يشمل حدّ الأجرة + الحدّ من السباق).
create or replace function public.commute_join_daily(
  p_order uuid, p_name text, p_home_lat double precision, p_home_lng double precision,
  p_home_addr text, p_fare numeric, p_pay_method text default 'cash',
  p_organizer boolean default false
) returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_plan text; v_service text; v_seats int; v_count int; v_org uuid;
        v_dlat double precision; v_dlng double precision;
begin
  if v_uid is null then raise exception 'غير مصرّح'; end if;

  select plan, service_id, organizer_id, dest_lat, dest_lng
    into v_plan, v_service, v_org, v_dlat, v_dlng
    from public.commute_orders where id = p_order for update;   -- قفل يمنع سباق المقاعد
  if not found then raise exception 'الطلب غير موجود'; end if;
  if coalesce(v_plan, 'daily') <> 'daily' then raise exception 'الطلب ليس يومياً'; end if;

  if coalesce(p_fare, 0) < coalesce(public.commute_fare_floor(v_service, p_home_lat, p_home_lng, v_dlat, v_dlng), 0) then
    raise exception 'سعر الاشتراك لا يطابق التسعير المعتمد';
  end if;

  if exists (select 1 from public.commute_members where order_id = p_order and user_id = v_uid) then
    raise exception 'أنت مشترك بالفعل في هذا الترحيل';
  end if;

  if coalesce(p_organizer, false) then
    if v_org is distinct from v_uid then raise exception 'غير مصرّح'; end if;
  else
    select coalesce(seats, 4) into v_seats from public.service_pricing where service_id = v_service;
    select count(*) into v_count from public.commute_members where order_id = p_order;
    if v_count >= coalesce(v_seats, 4) then
      raise exception 'اكتمل عدد المقاعد في هذا الترحيل';
    end if;
  end if;

  insert into public.commute_members
    (order_id, user_id, name, home_lat, home_lng, home_address, is_organizer, fare, pay_method)
  values (p_order, v_uid, p_name, p_home_lat, p_home_lng, p_home_addr, coalesce(p_organizer, false),
          p_fare, coalesce(p_pay_method, 'cash'));
end $$;
grant execute on function public.commute_join_daily(
  uuid, text, double precision, double precision, text, numeric, text, boolean
) to authenticated;

-- ── (ب) [متوسّط] commute_join_monthly بلا قفل ولا قيد فريد → خصم مزدوج ──
--  إضافة قفل صفّ الطلب + قيد فريد (order_id,user_id) كخطّ دفاع أخير، وحدّ
--  الأجرة الخادمي كاليومي.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'commute_members_order_user_uniq') then
    -- إزالة أي تكرارات موجودة (احتفاظ بالأقدم) قبل إضافة القيد.
    delete from public.commute_members a using public.commute_members b
      where a.order_id = b.order_id and a.user_id = b.user_id
        and a.user_id is not null and a.ctid > b.ctid;
    alter table public.commute_members
      add constraint commute_members_order_user_uniq unique (order_id, user_id);
  end if;
end $$;

create or replace function public.commute_join_monthly(
  p_order uuid, p_name text, p_home_lat double precision, p_home_lng double precision,
  p_home_addr text, p_fare numeric, p_organizer boolean default false
) returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_plan text; v_days int; v_weeks int; v_total numeric;
        v_wallet uuid; v_bal numeric; v_service text; v_dlat double precision; v_dlng double precision;
begin
  if v_uid is null then raise exception 'غير مصرّح'; end if;
  select plan, coalesce(array_length(days, 1), 0), service_id, dest_lat, dest_lng
    into v_plan, v_days, v_service, v_dlat, v_dlng
    from public.commute_orders where id = p_order for update;      -- قفل يمنع الانضمام المتزامن
  if not found then raise exception 'الطلب غير موجود'; end if;
  if v_plan <> 'monthly' then raise exception 'الطلب ليس شهرياً'; end if;

  if coalesce(p_fare, 0) < coalesce(public.commute_fare_floor(v_service, p_home_lat, p_home_lng, v_dlat, v_dlng), 0) then
    raise exception 'سعر الاشتراك لا يطابق التسعير المعتمد';
  end if;

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

-- ── (ج) [منخفض] سباق مكافأة الإحالة → دفع مزدوج ─────────────────────
--  نجعل تعليم «تمّت المكافأة» ذرّياً: نحدّث العلَم أولاً بشرط أنه false، ولا
--  نمنح المكافأة إلا إن نجح التحديث فعلاً (صفّ واحد) — فلا تُمنح مرّتين.
create or replace function public.reward_referral()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_ref uuid; v_reward numeric; v_cw uuid; v_rw uuid; v_claimed int;
begin
  if new.status = 'completed' and old.status is distinct from 'completed' then
    select referred_by into v_ref from public.users where id = new.customer_id;
    if v_ref is not null then
      -- مطالبة ذرّية: من يحدّث الصفّ (false→true) هو الوحيد الذي يمنح المكافأة.
      update public.users set referral_rewarded = true
        where id = new.customer_id and not coalesce(referral_rewarded, false);
      get diagnostics v_claimed = row_count;
      if v_claimed = 1 then
        select referral_reward into v_reward from public.settings where id = 1;
        if coalesce(v_reward, 0) > 0 then
          select id into v_cw from public.wallets where user_id = new.customer_id;
          if v_cw is not null then
            update public.wallets set balance = balance + v_reward, updated_at = now() where id = v_cw;
            insert into public.transactions (wallet_id, type, amount, note)
              values (v_cw, 'topup', v_reward, 'مكافأة دعوة صديق');
          end if;
          select id into v_rw from public.wallets where user_id = v_ref;
          if v_rw is not null then
            update public.wallets set balance = balance + v_reward, updated_at = now() where id = v_rw;
            insert into public.transactions (wallet_id, type, amount, note)
              values (v_rw, 'topup', v_reward, 'مكافأة إحالة صديق');
          end if;
        end if;
      end if;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_reward_referral on public.rides;
create trigger trg_reward_referral after update on public.rides
  for each row execute function public.reward_referral();

-- ── (د) [متوسّط] ad_banners: تسرّب اسم المُعلن وسعر الإعلان لكل مستخدم ──
--  سياسة القراءة كانت تُرجع كلّ الأعمدة (title/daily_price/created_by/clicks)
--  لأي مستخدم مسجّل. نُسقطها ونخدم لَقْطة العرض عبر دالّة تُرجع الحقول الآمنة
--  فقط. القراءة الكاملة تبقى للطاقم عبر سياسة "staff manage ads".
drop policy if exists "read running ads" on public.ad_banners;

create or replace function public.get_active_ad_banner(p_role text)
returns table (id uuid, image_url text, link_url text, audience text)
language sql stable security definer set search_path = public as $$
  select b.id, b.image_url, b.link_url, b.audience
  from public.ad_banners b
  where b.active
    and current_date >= b.start_date
    and current_date <  (b.start_date + b.days)
    and b.audience in ('all', case when p_role = 'customer' then 'customers' else 'drivers' end)
  order by b.created_at desc
  limit 1;
$$;
grant execute on function public.get_active_ad_banner(text) to authenticated;

-- ── (هـ) [منخفض] تعديل السحب/VIP مباشرةً بلا صلاحية «الطلبات» ─────────
--  سياسات UPDATE كانت is_staff_or_admin() بينما دوالّ الاعتماد تشترط
--  has_perm('requests'). موظّف بلا الصلاحية كان يقدر يضبط الحالة مباشرةً
--  (مثلاً rejected) فيجمّد أموال السائق المحجوزة بلا ردّها. نُوائم السياسة.
drop policy if exists "admin update withdrawal" on public.withdrawals;
create policy "admin update withdrawal" on public.withdrawals
  for update using (public.has_perm('requests')) with check (public.has_perm('requests'));

drop policy if exists "admin update vip request" on public.vip_requests;
create policy "admin update vip request" on public.vip_requests
  for update using (public.has_perm('requests')) with check (public.has_perm('requests'));

-- ── (و) [منخفض] تتبّع الرحلة المشتركة يبقى مفتوحاً بعد انتهائها ────────
--  track_shared_ride كان يُرجع الموقع الحيّ لأي رحلة تطابق الرمز حتى بعد
--  اكتمالها/إلغائها. نقصر النتيجة على الرحلات الجارية فقط.
create or replace function public.track_shared_ride(p_token text)
returns table (
  status ride_status, service_id text,
  pickup_lat double precision, pickup_lng double precision, pickup_address text,
  dropoff_lat double precision, dropoff_lng double precision, dropoff_address text,
  driver_lat double precision, driver_lng double precision, driver_loc_at timestamptz,
  driver_name text
) language sql security definer set search_path = public as $$
  select r.status, r.service_id,
         r.pickup_lat, r.pickup_lng, r.pickup_address,
         r.dropoff_lat, r.dropoff_lng, r.dropoff_address,
         r.driver_lat, r.driver_lng, r.driver_loc_at,
         u.full_name
    from public.rides r
    left join public.users u on u.id = r.driver_id
   where r.share_token = p_token
     and r.status not in ('completed', 'cancelled')   -- لا تتبّع بعد انتهاء الرحلة
$$;
grant execute on function public.track_shared_ride(text) to anon, authenticated;

-- ── (ز) [منخفض] الإعلانات تُقرأ بغضّ النظر عن الجمهور ────────────────
--  التصفية كانت في العميل فقط. نضيف شرط الجمهور في السياسة نفسها.
drop policy if exists "read announcements" on public.announcements;
create policy "read announcements" on public.announcements
  for select using (
    auth.uid() is not null
    and (
      audience = 'all'
      or audience = (
        select case when u.role = 'driver' then 'drivers' else 'customers' end
        from public.users u where u.id = auth.uid()
      )
    )
  );
