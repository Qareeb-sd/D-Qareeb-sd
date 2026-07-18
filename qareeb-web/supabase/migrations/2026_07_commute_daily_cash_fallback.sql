-- ============================================================
--  الترحيل اليومي: المحفظة تتطلّب رصيداً يغطّي أجرة اليوم (كالمشوار العادي).
--  وإن اختار الراكب المحفظة ولم يكفِ رصيده لحظة التحصيل، يتحوّل تلقائياً لدفع
--  كاش/بنك عند السائق (لا يُترك بلا دفع). شغّل هذا المقطع مرّة واحدة.
-- ============================================================
create or replace function public.commute_settle_day(p_order uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_driver uuid; v_status commute_status; v_plan text; v_last date; v_today date;
        v_rate numeric; r record; v_comm numeric; v_net numeric; v_dwallet uuid;
        v_cwallet uuid; v_cbal numeric; v_paid int := 0; v_cash int := 0; v_fallback int := 0;
begin
  v_today := (now() at time zone 'Africa/Khartoum')::date;
  select driver_id, status, plan, last_settled into v_driver, v_status, v_plan, v_last
    from public.commute_orders where id = p_order for update;
  if not found then raise exception 'الطلب غير موجود'; end if;
  if v_driver is null or v_driver <> auth.uid() then raise exception 'غير مصرّح'; end if;
  if v_status <> 'active' then raise exception 'الترحيل غير نشط'; end if;
  if v_plan <> 'daily' then raise exception 'التحصيل اليومي للخطة اليومية فقط'; end if;
  if v_last = v_today then raise exception 'تم تحصيل اليوم مسبقاً'; end if;

  v_rate := public.commute_commission();
  select id into v_dwallet from public.wallets where user_id = v_driver for update;

  for r in select user_id, fare, pay_method from public.commute_members where order_id = p_order loop
    if coalesce(r.fare, 0) <= 0 then continue; end if;
    v_comm := round(r.fare * coalesce(v_rate, 0));
    v_net  := r.fare - v_comm;

    if r.pay_method = 'wallet' then
      select id, balance into v_cwallet, v_cbal from public.wallets where user_id = r.user_id for update;
      if v_cwallet is not null and v_cbal >= r.fare then
        -- رصيد كافٍ → خصم من محفظة الراكب وإضافة الصافي للسائق (كالمشوار العادي).
        update public.wallets set balance = balance - r.fare, updated_at = now() where id = v_cwallet;
        insert into public.transactions (wallet_id, type, amount, note)
          values (v_cwallet, 'ride_payment', -r.fare, 'ترحيل يومي');
        if v_dwallet is not null then
          update public.wallets set withdrawable = withdrawable + v_net, updated_at = now() where id = v_dwallet;
          insert into public.transactions (wallet_id, type, amount, note)
            values (v_dwallet, 'ride_earning', r.fare, 'ترحيل يومي (محفظة)');
          if v_comm > 0 then
            insert into public.transactions (wallet_id, type, amount, note)
              values (v_dwallet, 'commission', -v_comm, 'عمولة ترحيل (محفظة)');
          end if;
        end if;
        v_paid := v_paid + 1;
      else
        -- رصيد غير كافٍ → يتحوّل لدفع كاش/بنك عند السائق (تُخصم العمولة من محفظته).
        if v_dwallet is not null and v_comm > 0 then
          update public.wallets set balance = balance - v_comm, updated_at = now() where id = v_dwallet;
          insert into public.transactions (wallet_id, type, amount, note)
            values (v_dwallet, 'commission', -v_comm, 'عمولة ترحيل (كاش/بنك — رصيد غير كافٍ)');
        end if;
        v_fallback := v_fallback + 1;
      end if;
    else
      -- كاش/بنك عند السائق: يحصّل نقداً/تحويلاً، وتُخصم عمولة المنصّة من محفظته.
      if v_dwallet is not null and v_comm > 0 then
        update public.wallets set balance = balance - v_comm, updated_at = now() where id = v_dwallet;
        insert into public.transactions (wallet_id, type, amount, note)
          values (v_dwallet, 'commission', -v_comm, 'عمولة ترحيل (كاش/بنك)');
      end if;
      v_cash := v_cash + 1;
    end if;
  end loop;

  update public.commute_orders set last_settled = v_today where id = p_order;
  return jsonb_build_object('wallet_paid', v_paid, 'cash', v_cash, 'fallback_cash', v_fallback);
end $$;
grant execute on function public.commute_settle_day(uuid) to authenticated;
