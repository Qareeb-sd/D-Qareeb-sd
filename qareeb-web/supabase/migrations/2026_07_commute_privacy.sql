-- ============================================================
--  خصوصية الترحيل: منع تسريب أسماء ومنازل المشتركين لكل مستخدم.
--  كانت commute_orders/commute_members قابلة للقراءة من أي مستخدم مصادَق
--  (+ بثّ Realtime). نُحكِم القراءة على المشاركين فقط، ونوجّه التصفّح/القبول
--  والانضمام عبر دوال SECURITY DEFINER (كما في الرحلات).
--  شغّل هذا المقطع مرّة واحدة في Supabase SQL Editor.
-- ============================================================

-- ── دوال آمنة للمسارات التي تحتاج قراءة عبر-المستخدمين ──

-- معاينة الانضمام: جلب الطلب برمز الدعوة (المنضمّ ليس عضواً بعد).
create or replace function public.commute_order_by_code(p_code text)
returns setof public.commute_orders
language sql security definer set search_path = public stable as $$
  select * from public.commute_orders where invite_code = p_code limit 1;
$$;
grant execute on function public.commute_order_by_code(text) to authenticated;

-- عدّاد أعضاء الطلب (لفحص السعة قبل الانضمام) — بلا كشف تفاصيل الأعضاء.
create or replace function public.commute_order_member_count(p_order uuid)
returns int language sql security definer set search_path = public stable as $$
  select count(*)::int from public.commute_members where order_id = p_order;
$$;
grant execute on function public.commute_order_member_count(uuid) to authenticated;

-- تصفّح السائق للطلبات المُرسَلة (المتاحة للقبول) — للسائقين فقط.
create or replace function public.list_dispatched_commutes()
returns setof public.commute_orders
language sql security definer set search_path = public stable as $$
  select o.* from public.commute_orders o
  where o.status = 'dispatched'
    and exists (select 1 from public.drivers d where d.user_id = auth.uid())
  order by o.created_at desc;
$$;
grant execute on function public.list_dispatched_commutes() to authenticated;

-- أعضاء الطلب (نقاط الالتقاط) — مصرّح: الطاقم/المنظّم/سائق الطلب/عضو فيه، أو
-- سائق يتصفّح طلباً مُرسَلاً (للتخطيط قبل القبول). غير ذلك لا صفوف.
create or replace function public.commute_members_of(p_order uuid)
returns setof public.commute_members
language plpgsql security definer set search_path = public stable as $$
declare v_org uuid; v_drv uuid; v_status commute_status;
begin
  select organizer_id, driver_id, status into v_org, v_drv, v_status
    from public.commute_orders where id = p_order;
  if not found then return; end if;
  if public.is_staff_or_admin()
     or v_org = auth.uid()
     or v_drv = auth.uid()
     or exists (select 1 from public.commute_members m
                where m.order_id = p_order and m.user_id = auth.uid())
     or (v_status = 'dispatched'
         and exists (select 1 from public.drivers d where d.user_id = auth.uid()))
  then
    return query
      select * from public.commute_members where order_id = p_order order by is_organizer desc;
  end if;
  return;
end $$;
grant execute on function public.commute_members_of(uuid) to authenticated;

-- قبول الترحيل ذرّياً (dispatched → active، السائق = المتصل) — للسائقين فقط.
create or replace function public.accept_commute_order(p_order uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_status commute_status;
begin
  if not exists (select 1 from public.drivers where user_id = auth.uid()) then
    raise exception 'الحساب ليس سائقاً';
  end if;
  select status into v_status from public.commute_orders where id = p_order for update;
  if v_status is null then raise exception 'الطلب غير موجود'; end if;
  if v_status <> 'dispatched' then raise exception 'الطلب غير متاح للقبول'; end if;
  update public.commute_orders set status = 'active', driver_id = auth.uid() where id = p_order;
end $$;
grant execute on function public.accept_commute_order(uuid) to authenticated;

-- ── إحكام سياسات القراءة على المشاركين فقط ──

-- الطلبات: يقرؤها المنظّم/السائق المُسنَد/عضو فيها/الطاقم فقط.
--  (التصفّح للسائق عبر list_dispatched_commutes، والمعاينة عبر commute_order_by_code.)
drop policy if exists "read commute orders" on public.commute_orders;
create policy "read commute orders" on public.commute_orders for select using (
  public.is_staff_or_admin()
  or organizer_id = auth.uid()
  or driver_id = auth.uid()
  or exists (select 1 from public.commute_members m
             where m.order_id = id and m.user_id = auth.uid())
);

-- الأعضاء: يقرؤهم صاحب الصفّ/منظّم الطلب/سائقه/الطاقم فقط.
--  (السائق المتصفّح يقرأ عبر commute_members_of.)
drop policy if exists "read commute members" on public.commute_members;
create policy "read commute members" on public.commute_members for select using (
  public.is_staff_or_admin()
  or user_id = auth.uid()
  or exists (select 1 from public.commute_orders o
             where o.id = order_id and (o.organizer_id = auth.uid() or o.driver_id = auth.uid()))
);

-- الإدراج: يربط الصفّ بمُدرِجه (user_id = المتصل) — لازم لسياسة القراءة أعلاه.
drop policy if exists "add commute members" on public.commute_members;
create policy "add commute members" on public.commute_members for insert to authenticated
  with check (user_id = auth.uid());

-- القبول صار عبر accept_commute_order — نُسقِط سياسة التحديث المباشر.
drop policy if exists "driver accept commute" on public.commute_orders;
