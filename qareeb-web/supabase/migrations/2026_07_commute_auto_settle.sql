-- ============================================================
--  صرف اشتراكات الترحيل الشهرية تلقائياً (لا إجراء يدوي من الأدمن).
--  المبلغ المحجوز يُضاف لمحفظة السائق (القابل للسحب) نهاية الشهر، ثم يسحبه
--  السائق أو يحوّله لرصيد كبقيّة أرباحه. تُشغَّل يومياً عبر pg_cron.
--  شغّل هذا المقطع مرّة واحدة (يُلغي الحاجة لزرّ «صرف المستحقّ»).
-- ============================================================

-- نُعيد تعريف الدالة بلا فحص is_admin (تُستدعى من المجدول فقط)، ونمنع العملاء.
create or replace function public.settle_due_commute_months()
returns jsonb language plpgsql security definer set search_path = public as $$
declare r record; v_rate numeric; v_comm numeric; v_net numeric; v_dwallet uuid; v_cwallet uuid;
        v_paid int := 0; v_refunded int := 0;
begin
  v_rate := public.commute_commission();
  for r in
    select m.id, m.user_id, m.held, o.driver_id
    from public.commute_members m
    join public.commute_orders o on o.id = m.order_id
    where m.sub_status = 'active' and m.held > 0
      and m.month_start <= ((now() at time zone 'Africa/Khartoum')::date - interval '1 month')
  loop
    if r.driver_id is not null then
      v_comm := round(r.held * coalesce(v_rate, 0));
      v_net  := r.held - v_comm;
      select id into v_dwallet from public.wallets where user_id = r.driver_id for update;
      if v_dwallet is not null then
        -- يُضاف للقابل للسحب — السائق يسحبه أو يحوّله لرصيد لاحقاً.
        update public.wallets set withdrawable = withdrawable + v_net, updated_at = now() where id = v_dwallet;
        insert into public.transactions (wallet_id, type, amount, note)
          values (v_dwallet, 'ride_earning', r.held, 'اشتراك ترحيل شهري');
        if v_comm > 0 then
          insert into public.transactions (wallet_id, type, amount, note)
            values (v_dwallet, 'commission', -v_comm, 'عمولة ترحيل شهري');
        end if;
      end if;
      update public.commute_members set sub_status = 'ended', held = 0 where id = r.id;
      v_paid := v_paid + 1;
    else
      select id into v_cwallet from public.wallets where user_id = r.user_id for update;
      if v_cwallet is not null then
        update public.wallets set balance = balance + r.held, updated_at = now() where id = v_cwallet;
        insert into public.transactions (wallet_id, type, amount, note)
          values (v_cwallet, 'topup', r.held, 'استرجاع اشتراك ترحيل (بلا سائق)');
      end if;
      update public.commute_members set sub_status = 'refunded', held = 0 where id = r.id;
      v_refunded := v_refunded + 1;
    end if;
  end loop;
  return jsonb_build_object('paid_drivers', v_paid, 'refunded', v_refunded);
end $$;

-- لا يستدعيها أحد من العملاء — المجدول فقط.
revoke execute on function public.settle_due_commute_months() from public;
revoke execute on function public.settle_due_commute_months() from anon;
revoke execute on function public.settle_due_commute_months() from authenticated;

-- جدولة يومية (02:00 بتوقيت الخادم) عبر pg_cron.
create extension if not exists pg_cron;
select cron.unschedule('settle-commute-months')
  where exists (select 1 from cron.job where jobname = 'settle-commute-months');
select cron.schedule('settle-commute-months', '0 2 * * *',
  $cron$ select public.settle_due_commute_months() $cron$);
