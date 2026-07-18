-- ============================================================
--  تقييم العميل يحفظ نجمته على الرحلة (rides.rating) — كي:
--   • يظهر التقييم في «رحلاتي».
--   • يُعرف أنّ الرحلة قُيّمت (فلا تُعاد شاشة التقييم عند فتح التطبيق لاحقاً).
--  شغّل هذا المقطع مرّة واحدة.
-- ============================================================
create or replace function public.submit_review(
  p_ride uuid, p_stars int, p_complaint text default null,
  p_driver_mismatch boolean default false, p_vehicle_mismatch boolean default false,
  p_tags text[] default null, p_comment text default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_customer uuid; v_driver uuid; v_status ride_status;
  v_role text; v_ratee uuid; v_avg numeric; v_cnt int; v_complaint text;
begin
  if p_stars is null or p_stars < 1 or p_stars > 5 then
    raise exception 'التقييم يجب أن يكون بين 1 و5';
  end if;
  select customer_id, driver_id, status into v_customer, v_driver, v_status
    from public.rides where id = p_ride;
  if not found then raise exception 'الرحلة غير موجودة'; end if;
  if v_status <> 'completed' then raise exception 'لا يمكن التقييم قبل انتهاء الرحلة'; end if;

  if auth.uid() = v_customer then v_role := 'customer'; v_ratee := v_driver;
  elsif auth.uid() = v_driver then v_role := 'driver'; v_ratee := v_customer;
  else raise exception 'غير مصرّح — لست طرفاً في هذه الرحلة'; end if;
  if v_ratee is null then raise exception 'لا يوجد طرف آخر لتقييمه'; end if;

  v_complaint := nullif(btrim(coalesce(p_complaint, '')), '');
  if p_driver_mismatch then
    v_complaint := concat_ws(' | ', v_complaint, 'مخالفة: السائق يختلف عن المسجّل (حساب مُعار)');
  end if;
  if p_vehicle_mismatch then
    v_complaint := concat_ws(' | ', v_complaint, 'مخالفة: المركبة تختلف عن المسجّلة');
  end if;

  insert into public.reviews
    (ride_id, rater_id, ratee_id, rater_role, stars, complaint, driver_mismatch, vehicle_mismatch,
     complaint_status, tags, comment)
  values
    (p_ride, auth.uid(), v_ratee, v_role, p_stars, v_complaint, p_driver_mismatch, p_vehicle_mismatch,
     case when v_complaint is not null then 'open' else 'resolved' end,
     p_tags, nullif(btrim(coalesce(p_comment, '')), ''))
  on conflict (ride_id, rater_role) do update
    set stars = excluded.stars, complaint = excluded.complaint,
        driver_mismatch = excluded.driver_mismatch, vehicle_mismatch = excluded.vehicle_mismatch,
        complaint_status = case when excluded.complaint is not null then 'open' else 'resolved' end,
        tags = excluded.tags, comment = excluded.comment, created_at = now();

  -- تقييم العميل يُحفظ على الرحلة (يُستخدم للعرض ولمعرفة أنّها قُيّمت).
  if v_role = 'customer' then
    update public.rides set rating = p_stars where id = p_ride;
  end if;

  select round(avg(stars)::numeric, 1), count(*) into v_avg, v_cnt
    from public.reviews where ratee_id = v_ratee;
  update public.users   set rating = v_avg, ratings_count = v_cnt where id = v_ratee;
  update public.drivers set rating = v_avg where user_id = v_ratee;
end $$;
grant execute on function public.submit_review(uuid, int, text, boolean, boolean, text[], text) to authenticated;
