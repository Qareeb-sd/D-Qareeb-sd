-- ============================================================
--  إصلاح الحلقة اللانهائية في سياسات الترحيل (infinite recursion).
--  كانت سياسة قراءة commute_orders تستعلم commute_members، وسياسة قراءة
--  commute_members تستعلم commute_orders → تكرار لا نهائي. الحلّ: نقل فحص
--  العضوية/الملكية إلى دوال SECURITY DEFINER تتجاوز RLS فتكسر الحلقة.
--  شغّل هذا المقطع مرّة واحدة.
-- ============================================================

create or replace function public.is_commute_member(p_order uuid, p_uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.commute_members where order_id = p_order and user_id = p_uid);
$$;
create or replace function public.is_commute_order_party(p_order uuid, p_uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.commute_orders
    where id = p_order and (organizer_id = p_uid or driver_id = p_uid)
  );
$$;
grant execute on function public.is_commute_member(uuid, uuid) to authenticated;
grant execute on function public.is_commute_order_party(uuid, uuid) to authenticated;

drop policy if exists "read commute orders" on public.commute_orders;
create policy "read commute orders" on public.commute_orders for select using (
  public.is_staff_or_admin()
  or organizer_id = auth.uid()
  or driver_id = auth.uid()
  or public.is_commute_member(id, auth.uid())
);

drop policy if exists "read commute members" on public.commute_members;
create policy "read commute members" on public.commute_members for select using (
  public.is_staff_or_admin()
  or user_id = auth.uid()
  or public.is_commute_order_party(order_id, auth.uid())
);
