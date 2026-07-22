-- تعديل الأدمن لصورة السائق/المركبة (المعروضتين للعميل عند الرحلة).
-- المصدر هو نفس عمودَي drivers.photo_url / vehicle_photo_url اللذين يملؤهما السائق
-- عند التسجيل — فتعديل الأدمن ينعكس فوراً على ما يراه العميل. تمرير null يُبقي القيمة.
create or replace function public.admin_set_driver_photos(
  p_user uuid, p_photo_url text default null, p_vehicle_photo_url text default null
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'غير مصرّح'; end if;
  update public.drivers set
    photo_url         = coalesce(p_photo_url, photo_url),
    vehicle_photo_url = coalesce(p_vehicle_photo_url, vehicle_photo_url)
  where user_id = p_user;
end $$;
grant execute on function public.admin_set_driver_photos(uuid, text, text) to authenticated;
