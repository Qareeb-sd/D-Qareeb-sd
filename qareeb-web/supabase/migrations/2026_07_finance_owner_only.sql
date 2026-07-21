-- تحصين: الملخّص المالي والتحليلات المعمّقة للمالك فقط (is_admin) بدل أي موظّف.
-- كانتا محروستين بـ is_staff_or_admin، فيقدر موظّف محدود الصلاحية جلب العمولة
-- والأرباح والالتزامات والإيراد اليومي من الشبكة رغم إخفائها في الواجهة.

create or replace function public.admin_financial_summary()
returns table (
  platform_commission numeric,
  total_topups        numeric,
  ride_payments       numeric,
  driver_earnings     numeric,
  completed_rides     bigint,
  wallet_liability    numeric
) language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'غير مصرّح'; end if;
  return query
    select
      coalesce(-sum(t.amount) filter (where t.type = 'commission'), 0),
      coalesce( sum(t.amount) filter (where t.type = 'topup' and t.note = 'تعبئة رصيد (معتمدة)'), 0),
      coalesce(-sum(t.amount) filter (where t.type = 'ride_payment'), 0),
      coalesce( sum(t.amount) filter (where t.type = 'ride_earning'), 0),
      (select count(*) from public.rides where status = 'completed'),
      coalesce((select sum(balance) from public.wallets), 0)
    from public.transactions t;
end $$;
grant execute on function public.admin_financial_summary() to authenticated;

create or replace function public.admin_deep_analytics(p_days int default 30)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v jsonb; tz text := 'Africa/Khartoum';
begin
  if not public.is_admin() then raise exception 'غير مصرّح'; end if;
  select jsonb_build_object(
    'peakHours', (
      select coalesce(jsonb_agg(jsonb_build_object('hour', g.h, 'value', coalesce(t.c, 0)) order by g.h), '[]'::jsonb)
      from generate_series(0, 23) g(h)
      left join (
        select extract(hour from (created_at at time zone tz))::int hr, count(*) c
        from public.rides
        where created_at >= now() - make_interval(days => p_days)
        group by 1
      ) t on t.hr = g.h
    ),
    'revenue30', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'd', to_char(g::date, 'YYYY-MM-DD'),
        'value', (select coalesce(round(sum(fare)), 0) from public.rides r
                   where r.status = 'completed'
                     and (r.created_at at time zone tz)::date = g::date)
      ) order by g), '[]'::jsonb)
      from generate_series(((now() at time zone tz)::date - (greatest(p_days, 1) - 1)),
                           (now() at time zone tz)::date, interval '1 day') g
    ),
    'topAreas', (
      select coalesce(jsonb_agg(jsonb_build_object('area', area, 'value', c) order by c desc), '[]'::jsonb)
      from (
        select coalesce(
                 nullif(btrim(split_part(pickup_address, '،', 1)), ''),
                 nullif(btrim(split_part(pickup_address, ',', 1)), ''),
                 'غير محدّد') area,
               count(*) c
        from public.rides
        where created_at >= now() - make_interval(days => p_days)
        group by 1
        order by c desc
        limit 8
      ) t
    )
  ) into v;
  return v;
end $$;
grant execute on function public.admin_deep_analytics(int) to authenticated;
