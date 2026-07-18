-- ============================================================
--  إظهار رقم العضوية في لوحة الأدمن: إضافة member_no لقائمة العملاء.
--  (السائقون يُجلبون عبر join مباشر فلا يحتاجون تعديل دالة.)
--  شغّل هذا المقطع مرّة واحدة.
-- ============================================================
drop function if exists public.admin_list_customers();
create or replace function public.admin_list_customers()
returns table (
  id uuid, full_name text, phone text, rating numeric,
  ratings_count int, rides_count bigint, banned boolean, ban_note text,
  member_no int, created_at timestamptz
) language sql security definer set search_path = public as $$
  select u.id, u.full_name, u.phone, u.rating, u.ratings_count,
         (select count(*) from public.rides r where r.customer_id = u.id),
         coalesce(u.banned, false), u.ban_note, u.member_no, u.created_at
    from public.users u
   where u.role = 'customer' and public.is_staff_or_admin()
   order by u.created_at desc
$$;
grant execute on function public.admin_list_customers() to authenticated;
