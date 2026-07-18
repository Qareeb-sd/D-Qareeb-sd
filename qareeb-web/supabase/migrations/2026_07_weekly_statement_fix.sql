-- ============================================================
--  إصلاح الكشف الأسبوعي للسائق: توحيد حساب الإجمالي والعمولة على «وقت الاكتمال»
--  (كان الإجمالي بوقت الحجز والعمولة بوقت الاكتمال، فيختلّ عند حدود الأسبوع).
--  شغّل هذا المقطع مرّة واحدة.
-- ============================================================
create or replace function public.driver_weekly_statement(p_weeks int default 8)
returns table (
  week_start date, week_end date, rides int,
  gross numeric, commission numeric, net numeric,
  cash_gross numeric, wallet_gross numeric
) language sql security definer set search_path = public stable as $$
  select w.ws, w.we,
         coalesce(s.rides, 0)::int,
         coalesce(s.gross, 0),
         coalesce(c.commission, 0),
         coalesce(s.gross, 0) - coalesce(c.commission, 0),
         coalesce(s.cash_gross, 0),
         coalesce(s.wallet_gross, 0)
  from (
    select (b.cur - (g.n * 7))::date as ws, (b.cur - (g.n * 7) + 6)::date as we
    from (
      select ((now() at time zone 'Africa/Khartoum')::date
              - ((extract(dow from (now() at time zone 'Africa/Khartoum'))::int + 1) % 7)) as cur
    ) b,
    generate_series(0, greatest(p_weeks, 1) - 1) g(n)
  ) w
  left join lateral (
    -- الإجمالي بوقت الاكتمال (لا الحجز) ليطابق أسبوع العمولة.
    select count(*) as rides,
           sum(r.fare) as gross,
           sum(r.fare) filter (where r.payment_method = 'cash') as cash_gross,
           sum(r.fare) filter (where r.payment_method = 'wallet') as wallet_gross
    from public.rides r
    where r.driver_id = auth.uid() and r.status = 'completed'
      and (coalesce(r.completed_at, r.created_at) at time zone 'Africa/Khartoum')::date between w.ws and w.we
  ) s on true
  left join lateral (
    select -sum(t.amount) as commission
    from public.transactions t
    join public.wallets wl on wl.id = t.wallet_id
    where wl.user_id = auth.uid() and t.type = 'commission'
      and (t.created_at at time zone 'Africa/Khartoum')::date between w.ws and w.we
  ) c on true
  order by w.ws desc;
$$;
grant execute on function public.driver_weekly_statement(int) to authenticated;
