-- ============================================================
--  توحيد صلاحيات الموظفين مع التبويبات (A5): كل دالة تحت تبويب «الطلبات»
--  تتطلّب صلاحية 'requests' فقط (has_perm يشمل المالك تلقائياً). شغّل مرّة واحدة.
-- ============================================================

-- الدعم والشكاوى: من أيّ موظف → صلاحية «الطلبات».
create or replace function public.admin_set_ticket_status(p_ticket uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_perm('requests') then raise exception 'غير مصرّح'; end if;
  if p_status not in ('open', 'closed') then raise exception 'حالة غير صالحة'; end if;
  update public.support_tickets set status = p_status where id = p_ticket;
end $$;
grant execute on function public.admin_set_ticket_status(uuid, text) to authenticated;

create or replace function public.admin_resolve_complaint(p_review uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_perm('requests') then raise exception 'غير مصرّح'; end if;
  update public.reviews set complaint_status = 'resolved' where id = p_review;
  perform public.log_action('حلّ شكوى', p_review::text);
end $$;
grant execute on function public.admin_resolve_complaint(uuid) to authenticated;

-- اعتماد/رفض السحب: 'requests' فقط (كان يقبل 'drivers' أيضاً).
create or replace function public.approve_withdrawal(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_driver uuid; v_status topup_status;
begin
  if not public.has_perm('requests') then raise exception 'غير مصرّح'; end if;
  select driver_id, status into v_driver, v_status
    from public.withdrawals where id = p_id for update;
  if v_driver is null then raise exception 'الطلب غير موجود'; end if;
  if v_status <> 'pending' then raise exception 'الطلب روجع مسبقاً'; end if;
  update public.withdrawals set status = 'approved', reviewed_by = auth.uid() where id = p_id;
  perform public.log_action('اعتماد سحب أرباح',
    (select full_name from public.users where id = v_driver));
  begin
    perform net.http_post(
      url := 'https://yjdidwnnlyeisaahfmlr.supabase.co/functions/v1/notify-user-fcm',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := jsonb_build_object('withdrawal_id', p_id)
    );
  exception when others then null;
  end;
end $$;
grant execute on function public.approve_withdrawal(uuid) to authenticated;

create or replace function public.reject_withdrawal(p_id uuid, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_driver uuid; v_wallet uuid; v_amount numeric; v_status topup_status;
begin
  if not public.has_perm('requests') then raise exception 'غير مصرّح'; end if;
  select driver_id, wallet_id, amount, status
    into v_driver, v_wallet, v_amount, v_status
    from public.withdrawals where id = p_id for update;
  if v_driver is null then raise exception 'الطلب غير موجود'; end if;
  if v_status <> 'pending' then raise exception 'الطلب روجع مسبقاً'; end if;
  update public.withdrawals
    set status = 'rejected', reviewed_by = auth.uid(), note = coalesce(p_note, note)
    where id = p_id;
  update public.wallets set withdrawable = withdrawable + v_amount, updated_at = now() where id = v_wallet;
  perform public.log_action('رفض سحب أرباح', p_note);
end $$;
grant execute on function public.reject_withdrawal(uuid, text) to authenticated;

-- اعتماد/رفض VIP: 'requests' فقط.
create or replace function public.approve_vip_request(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_driver uuid; v_status topup_status;
begin
  if not public.has_perm('requests') then raise exception 'غير مصرّح'; end if;
  select driver_id, status into v_driver, v_status
    from public.vip_requests where id = p_id for update;
  if v_driver is null then raise exception 'الطلب غير موجود'; end if;
  if v_status <> 'pending' then raise exception 'الطلب روجع مسبقاً'; end if;
  update public.vip_requests set status = 'approved', reviewed_by = auth.uid() where id = p_id;
  update public.drivers
    set vip = true,
        vip_paid_until = greatest(coalesce(vip_paid_until, now()), now()) + interval '1 month'
    where user_id = v_driver;
  perform public.log_action('اعتماد اشتراك VIP',
    (select full_name from public.users where id = v_driver));
end $$;
grant execute on function public.approve_vip_request(uuid) to authenticated;

create or replace function public.reject_vip_request(p_id uuid, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_perm('requests') then raise exception 'غير مصرّح'; end if;
  update public.vip_requests
    set status = 'rejected', reviewed_by = auth.uid(), note = coalesce(p_note, note)
    where id = p_id and status = 'pending';
  perform public.log_action('رفض اشتراك VIP', p_note);
end $$;
grant execute on function public.reject_vip_request(uuid, text) to authenticated;

-- بثّ الإشعارات: 'requests' فقط (كان يقبل 'drivers' أيضاً).
create or replace function public.admin_broadcast(p_title text, p_body text, p_audience text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_perm('requests') then raise exception 'غير مصرّح'; end if;
  if coalesce(trim(p_title), '') = '' or coalesce(trim(p_body), '') = '' then
    raise exception 'العنوان والرسالة مطلوبان';
  end if;
  if p_audience not in ('customers', 'drivers', 'all') then
    raise exception 'جمهور غير صالح';
  end if;
  insert into public.announcements (title, body, audience, created_by)
    values (p_title, p_body, p_audience, auth.uid());
  perform public.log_action('بثّ إشعار (' || p_audience || ')', left(p_title, 60));
  begin
    perform net.http_post(
      url := 'https://yjdidwnnlyeisaahfmlr.supabase.co/functions/v1/notify-user-fcm',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := jsonb_build_object('audience', p_audience, 'title', p_title, 'body', p_body)
    );
  exception when others then null; end;
end $$;
grant execute on function public.admin_broadcast(text, text, text) to authenticated;
