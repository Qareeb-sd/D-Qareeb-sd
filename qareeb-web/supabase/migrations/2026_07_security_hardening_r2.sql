-- ════════════════════════════════════════════════════════════════════
--  تحصينات المراجعة الأمنية — الجولة الثانية (Round 2)
--  تُطبَّق دفعةً واحدة. كلّ بند مستقلّ ويمكن إعادة تنفيذه بأمان (idempotent).
-- ════════════════════════════════════════════════════════════════════

-- ── (أ) [حرج] notify_admins مكشوفة عبر PostgREST لأي مستخدم/زائر ──────
--  الدالّة SECURITY DEFINER وترسل إشعار أدمن بعنوان/نصّ/رابط يتحكّم بها
--  المتصل. بلا REVOKE، يستطيع أي طرف استدعاءها عبر REST وإرسال إشعارات
--  أدمن مزيّفة (تصيّد). المشغّلات (topup/vip/sos) دوالّ SECURITY DEFINER
--  يملكها صاحب القاعدة، فتستمرّ في الاستدعاء داخلياً بعد سحب الصلاحية.
revoke all on function public.notify_admins(text, text, text, text) from public, anon, authenticated;

-- ── (ب) [حرج] الإدراج المباشر في commute_members يتجاوز دالّة الانضمام ─
--  سياسة "add commute members" كانت (with check (true)) فيسمح لأي عميل
--  بإدراج صفّ عضوٍ مباشرةً — متجاوزاً commute_join_daily التي تفرض السعة
--  وقفل المقاعد ومنع التكرار. نُسقط السياسة ونمرّر إنشاء صفّ المنظّم اليومي
--  عبر الدالّة نفسها (p_organizer) بدل الإدراج المباشر.
drop policy if exists "add commute members" on public.commute_members;
-- لا سياسة INSERT بعد الآن: كلّ الإدراجات تمرّ عبر دوالّ SECURITY DEFINER
-- (commute_join_daily / commute_join_monthly) التي تتجاوز RLS بحكم ملكيتها.

create or replace function public.commute_join_daily(
  p_order uuid, p_name text, p_home_lat double precision, p_home_lng double precision,
  p_home_addr text, p_fare numeric, p_pay_method text default 'cash',
  p_organizer boolean default false
) returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_plan text; v_service text; v_seats int; v_count int; v_org uuid;
begin
  if v_uid is null then raise exception 'غير مصرّح'; end if;

  select plan, service_id, organizer_id into v_plan, v_service, v_org
    from public.commute_orders where id = p_order for update;   -- قفل يمنع سباق المقاعد
  if not found then raise exception 'الطلب غير موجود'; end if;
  if coalesce(v_plan, 'daily') <> 'daily' then raise exception 'الطلب ليس يومياً'; end if;

  if exists (select 1 from public.commute_members where order_id = p_order and user_id = v_uid) then
    raise exception 'أنت مشترك بالفعل في هذا الترحيل';
  end if;

  if coalesce(p_organizer, false) then
    -- صفّ المنظّم: يُنشئه صاحب الطلب فقط، ولا يخضع لفحص السعة (هو أوّل عضو).
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

-- ── (ج) [حرج] طلبات الطرود/بين المدن غير قابلة للقبول ولا تظهر للسائق ──
--  service_id لهذه الطلبات = 'package'/'intercity' وهي فئات وهمية لا يملكها
--  أي سائق كـ vehicle_type، فمطابقة vehicle_type = service_id كانت تُقصيها
--  دائماً من list_available_rides وترفض accept_ride لها. نستثنيها من مطابقة
--  الفئة ونكتفي بفحص القدرة (accepts_packages/accepts_intercity).
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
    -- الطرود/بين المدن فئات وهمية → لا تُطابَق بالمركبة، بل بالقدرة أدناه.
    and (r.is_package or r.intercity or d.vehicle_type = r.service_id)
    and (not r.is_package or d.accepts_packages)
    and (not r.intercity  or d.accepts_intercity)
  order by r.created_at asc;
$$;
grant execute on function public.list_available_rides() to authenticated;

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

  -- المحفظة تُدفع مسبقاً قبل الإرسال — لا تُقبل رحلة محفظة غير مدفوعة (تحمي السائق
  -- من عملٍ بلا مقابل إن فشل الدفع المسبق لدى العميل بسبب انقطاع الشبكة).
  if v_payment = 'wallet' and not coalesce(v_prepaid, false) then
    raise exception 'الرحلة غير مدفوعة بعد — بانتظار دفع العميل';
  end if;

  -- مطابقة نوع مركبة السائق مع فئة الطلب — إلا الطرود/بين المدن (فئات وهمية
  -- لا تُطابَق بالمركبة، بل بالقدرة أدناه).
  select vehicle_type into v_vtype from public.drivers where user_id = auth.uid();
  if not (v_pkg or v_inter) and v_vtype is distinct from v_service then
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

-- ── (د) [متوسّط] حدّ الأجرة يُتجاوَز بإرسال وجهة فارغة (fare=1, dropoff=null) ─
--  كان الحدّ الأدنى يُطبَّق فقط عند وجود وجهة. نطبّقه دائماً: بلا وجهة نأخذ
--  مسافة 0 فيصبح الحدّ = base_fare×0.30 على الأقلّ (يمنع الأجرة الوهمية).
create or replace function public.guard_ride_fare()
returns trigger language plpgsql set search_path = public as $$
declare v_km numeric; v_base numeric; v_perkm numeric; v_floor numeric;
begin
  if new.fare is null or new.fare <= 0 then
    raise exception 'سعر الرحلة غير صالح';
  end if;
  if new.fare > 100000000 then           -- سقف أمان ضدّ التلاعب/الأخطاء
    raise exception 'سعر الرحلة تجاوز الحدّ المعقول';
  end if;

  -- حدّ أدنى متحفّظ (يُطبَّق دائماً متى وُجد تسعير مخزّن للخدمة).
  select min(base_fare), min(per_km) into v_base, v_perkm
    from public.service_pricing_periods where service_id = new.service_id;
  if v_base is not null then
    if new.dropoff_lat is not null and new.dropoff_lng is not null then
      v_km := public.haversine_km(new.pickup_lat, new.pickup_lng, new.dropoff_lat, new.dropoff_lng);
    else
      v_km := 0;   -- بلا وجهة: على الأقلّ حدّ الأجرة الأساسية (يمنع fare=1 بوجهة فارغة)
    end if;
    v_floor := (coalesce(v_base, 0) + coalesce(v_perkm, 0) * coalesce(v_km, 0)) * 0.30;
    if new.fare < v_floor then
      raise exception 'سعر الرحلة لا يطابق التسعير المعتمد';
    end if;
  end if;

  return new;
end $$;

drop trigger if exists trg_guard_ride_fare on public.rides;
create trigger trg_guard_ride_fare before insert on public.rides
  for each row execute function public.guard_ride_fare();

-- ── (هـ) [متوسّط] سلّة صور العرض بلا حدّ حجم ولا تقييد نوع ────────────
--  driver-photos عامّة (public) وسياسة الإدراج تسمح لأي مستخدم مصادَق برفع
--  أي محتوى في مجلّد باسم uid — أي استضافة ملفّات مجانية/إساءة. نُقيّد الحجم
--  والأنواع بالصور فقط (لا يكسر تدفّق التسجيل: المتقدّم يرفع صورة فعلاً).
update storage.buckets
   set file_size_limit  = 5242880,                                  -- 5MB
       allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
 where id = 'driver-photos';
