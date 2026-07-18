-- ============================================================
--  ملخّص أمانات الترحيل الشهرية المحتجَزة لدى المنصّة (نيابةً عن السائقين)
--  لعرضه في لوحة الأدمن. للطاقم/الأدمن فقط. شغّل مرّة واحدة.
-- ============================================================
create or replace function public.commute_held_summary()
returns table (held_total numeric, active_count int, due_count int)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_staff_or_admin() then raise exception 'غير مصرّح'; end if;
  return query
    select coalesce(sum(held), 0),
           count(*)::int,
           count(*) filter (
             where month_start <= ((now() at time zone 'Africa/Khartoum')::date - interval '1 month')
           )::int
    from public.commute_members
    where sub_status = 'active' and held > 0;
end $$;
grant execute on function public.commute_held_summary() to authenticated;
