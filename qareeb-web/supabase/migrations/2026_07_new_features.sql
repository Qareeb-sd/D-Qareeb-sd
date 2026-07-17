-- ============================================================
--  متجر المكافآت — استبدال نقاط الولاء بمكافآت مُنسّقة (#7)
--  شغّل هذا القسم كاملاً مرّة واحدة.
-- ============================================================
create table if not exists public.rewards (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text,
  cost_points int  not null check (cost_points > 0),
  kind        text not null default 'wallet' check (kind in ('wallet', 'perk')),
  value       numeric(12,2) not null default 0,   -- مبلغ ج.س عند kind='wallet'
  active      boolean not null default true,
  sort        int not null default 0,
  created_at  timestamptz not null default now()
);
alter table public.rewards enable row level security;
drop policy if exists "anyone read active rewards" on public.rewards;
create policy "anyone read active rewards" on public.rewards
  for select using (active or public.is_staff_or_admin());
drop policy if exists "admin write rewards" on public.rewards;
create policy "admin write rewards" on public.rewards
  for all using (public.has_perm('settings')) with check (public.has_perm('settings'));

create table if not exists public.reward_redemptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  reward_id   uuid references public.rewards(id) on delete set null,
  title       text not null,
  cost_points int  not null,
  kind        text not null,
  value       numeric(12,2) not null default 0,
  code        text,                                 -- رمز الاستلام للمكافآت العينية
  status      text not null default 'fulfilled' check (status in ('pending', 'fulfilled', 'cancelled')),
  created_at  timestamptz not null default now()
);
alter table public.reward_redemptions enable row level security;
drop policy if exists "user read own redemptions" on public.reward_redemptions;
create policy "user read own redemptions" on public.reward_redemptions
  for select using (user_id = auth.uid() or public.is_staff_or_admin());
drop policy if exists "staff manage redemptions" on public.reward_redemptions;
create policy "staff manage redemptions" on public.reward_redemptions
  for update using (public.has_perm('settings')) with check (public.has_perm('settings'));

-- قائمة المكافآت المتاحة للعميل (المفعّلة فقط).
create or replace function public.list_rewards()
returns setof public.rewards language sql security definer set search_path = public stable as $$
  select * from public.rewards where active order by sort, cost_points;
$$;
grant execute on function public.list_rewards() to authenticated;

-- استبدال مكافأة: يخصم النقاط ويطبّق الأثر (رصيد محفظة أو مكافأة عينية برمز).
create or replace function public.redeem_reward(p_reward_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  r public.rewards;
  v_have int;
  v_wallet uuid;
  v_code text;
begin
  if v_uid is null then raise exception 'غير مصرّح'; end if;
  select * into r from public.rewards where id = p_reward_id;
  if not found or not r.active then raise exception 'المكافأة غير متاحة'; end if;
  select loyalty_points into v_have from public.users where id = v_uid for update;
  if coalesce(v_have, 0) < r.cost_points then raise exception 'نقاطك غير كافية'; end if;
  update public.users set loyalty_points = loyalty_points - r.cost_points where id = v_uid;

  if r.kind = 'wallet' then
    select id into v_wallet from public.wallets where user_id = v_uid for update;
    if v_wallet is null then raise exception 'المحفظة غير موجودة'; end if;
    update public.wallets set balance = balance + r.value, updated_at = now() where id = v_wallet;
    insert into public.transactions (wallet_id, type, amount, note)
      values (v_wallet, 'topup', r.value, 'مكافأة: ' || r.title);
    insert into public.reward_redemptions (user_id, reward_id, title, cost_points, kind, value, status)
      values (v_uid, r.id, r.title, r.cost_points, r.kind, r.value, 'fulfilled');
    return jsonb_build_object('kind', 'wallet', 'value', r.value);
  else
    v_code := upper(substr(md5(gen_random_uuid()::text), 1, 6));
    insert into public.reward_redemptions (user_id, reward_id, title, cost_points, kind, value, code, status)
      values (v_uid, r.id, r.title, r.cost_points, r.kind, r.value, v_code, 'pending');
    return jsonb_build_object('kind', 'perk', 'code', v_code);
  end if;
end $$;
grant execute on function public.redeem_reward(uuid) to authenticated;

-- سجلّ استبدالات العميل الحالي.
create or replace function public.my_reward_redemptions()
returns setof public.reward_redemptions language sql security definer set search_path = public stable as $$
  select * from public.reward_redemptions where user_id = auth.uid() order by created_at desc;
$$;
grant execute on function public.my_reward_redemptions() to authenticated;

-- إدارة المكافآت (أدمن): إضافة/تعديل.
create or replace function public.admin_upsert_reward(
  p_id uuid, p_title text, p_description text, p_cost_points int,
  p_kind text, p_value numeric, p_active boolean, p_sort int
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.has_perm('settings') then raise exception 'غير مصرّح'; end if;
  if coalesce(trim(p_title), '') = '' then raise exception 'العنوان مطلوب'; end if;
  if coalesce(p_cost_points, 0) <= 0 then raise exception 'عدد النقاط غير صالح'; end if;
  if p_kind not in ('wallet', 'perk') then raise exception 'نوع غير صالح'; end if;
  if p_id is null then
    insert into public.rewards (title, description, cost_points, kind, value, active, sort)
      values (p_title, p_description, p_cost_points, p_kind, coalesce(p_value, 0), coalesce(p_active, true), coalesce(p_sort, 0))
      returning id into v_id;
  else
    update public.rewards set
      title = p_title, description = p_description, cost_points = p_cost_points,
      kind = p_kind, value = coalesce(p_value, 0), active = coalesce(p_active, true), sort = coalesce(p_sort, 0)
      where id = p_id returning id into v_id;
  end if;
  perform public.log_action('تعديل مكافأة', p_title);
  return v_id;
end $$;
grant execute on function public.admin_upsert_reward(uuid, text, text, int, text, numeric, boolean, int) to authenticated;

create or replace function public.admin_delete_reward(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_perm('settings') then raise exception 'غير مصرّح'; end if;
  delete from public.rewards where id = p_id;
  perform public.log_action('حذف مكافأة', p_id::text);
end $$;
grant execute on function public.admin_delete_reward(uuid) to authenticated;

-- قائمة كل المكافآت للأدمن (شاملة المعطّلة).
create or replace function public.admin_list_rewards()
returns setof public.rewards language sql security definer set search_path = public stable as $$
  select * from public.rewards order by sort, cost_points;
$$;
grant execute on function public.admin_list_rewards() to authenticated;

-- طلبات المكافآت العينية المعلّقة (للأدمن لتسليمها).
create or replace function public.admin_list_reward_redemptions()
returns table (
  id uuid, user_name text, user_phone text, title text,
  cost_points int, kind text, value numeric, code text, status text, created_at timestamptz
) language sql security definer set search_path = public stable as $$
  select rr.id, u.full_name, u.phone, rr.title, rr.cost_points, rr.kind,
         rr.value, rr.code, rr.status, rr.created_at
  from public.reward_redemptions rr
  join public.users u on u.id = rr.user_id
  where rr.kind = 'perk'
  order by (rr.status = 'pending') desc, rr.created_at desc;
$$;
grant execute on function public.admin_list_reward_redemptions() to authenticated;

create or replace function public.admin_fulfill_redemption(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_perm('settings') then raise exception 'غير مصرّح'; end if;
  update public.reward_redemptions set status = 'fulfilled' where id = p_id and status = 'pending';
  perform public.log_action('تسليم مكافأة', p_id::text);
end $$;
grant execute on function public.admin_fulfill_redemption(uuid) to authenticated;

-- ============================================================
--  كشف حساب أسبوعي للسائق (#12) — ملخّص لكل أسبوع (السبت→الجمعة).
--  شغّل هذا القسم كاملاً مرّة واحدة.
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
    -- بداية كل أسبوع = السبت (نمط الأسبوع في السودان).
    select (b.cur - (g.n * 7))::date as ws, (b.cur - (g.n * 7) + 6)::date as we
    from (
      select ((now() at time zone 'Africa/Khartoum')::date
              - ((extract(dow from (now() at time zone 'Africa/Khartoum'))::int + 1) % 7)) as cur
    ) b,
    generate_series(0, greatest(p_weeks, 1) - 1) g(n)
  ) w
  left join lateral (
    select count(*) as rides,
           sum(r.fare) as gross,
           sum(r.fare) filter (where r.payment_method = 'cash') as cash_gross,
           sum(r.fare) filter (where r.payment_method = 'wallet') as wallet_gross
    from public.rides r
    where r.driver_id = auth.uid() and r.status = 'completed'
      and (r.created_at at time zone 'Africa/Khartoum')::date between w.ws and w.we
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

-- ============================================================
--  تحليلات أعمق للأدمن (#11): ساعات الذروة + إيراد 30 يوماً + أكثر المناطق طلباً.
--  شغّل هذا القسم كاملاً مرّة واحدة.
-- ============================================================
create or replace function public.admin_deep_analytics(p_days int default 30)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v jsonb; tz text := 'Africa/Khartoum';
begin
  if not public.is_staff_or_admin() then raise exception 'غير مصرّح'; end if;
  select jsonb_build_object(
    -- توزّع الطلبات على ساعات اليوم (0..23) خلال المدّة.
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
    -- إيراد يومي لآخر p_days يوماً.
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
    -- أكثر مناطق الانطلاق طلباً (بحسب أوّل مقطع من العنوان).
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

-- ============================================================
--  الدعم داخل التطبيق (#9): تذاكر + محادثة العميل/السائق مع الإدارة.
--  شغّل هذا القسم كاملاً مرّة واحدة.
-- ============================================================
create table if not exists public.support_tickets (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.users(id) on delete cascade,
  subject         text not null,
  status          text not null default 'open' check (status in ('open', 'closed')),
  last_message_at timestamptz not null default now(),
  unread_admin    boolean not null default true,   -- رسالة جديدة لم يقرأها الأدمن
  unread_user     boolean not null default false,  -- ردّ جديد لم يقرأه المستخدم
  created_at      timestamptz not null default now()
);
alter table public.support_tickets enable row level security;
drop policy if exists "user read own tickets" on public.support_tickets;
create policy "user read own tickets" on public.support_tickets
  for select using (user_id = auth.uid() or public.is_staff_or_admin());

create table if not exists public.support_messages (
  id         uuid primary key default gen_random_uuid(),
  ticket_id  uuid not null references public.support_tickets(id) on delete cascade,
  sender     text not null check (sender in ('user', 'admin')),
  body       text not null,
  created_at timestamptz not null default now()
);
alter table public.support_messages enable row level security;
drop policy if exists "read ticket messages" on public.support_messages;
create policy "read ticket messages" on public.support_messages
  for select using (
    public.is_staff_or_admin()
    or exists (select 1 from public.support_tickets t
               where t.id = ticket_id and t.user_id = auth.uid())
  );

-- فتح تذكرة جديدة (المستخدم) — عنوان + أوّل رسالة.
create or replace function public.open_support_ticket(p_subject text, p_body text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_id uuid;
begin
  if v_uid is null then raise exception 'غير مصرّح'; end if;
  if coalesce(btrim(p_subject), '') = '' or coalesce(btrim(p_body), '') = '' then
    raise exception 'العنوان والرسالة مطلوبان';
  end if;
  insert into public.support_tickets (user_id, subject) values (v_uid, left(p_subject, 120))
    returning id into v_id;
  insert into public.support_messages (ticket_id, sender, body) values (v_id, 'user', p_body);
  return v_id;
end $$;
grant execute on function public.open_support_ticket(text, text) to authenticated;

-- إرسال رسالة (المستخدم لتذكرته، أو الأدمن لأي تذكرة).
create or replace function public.send_support_message(p_ticket uuid, p_body text)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_owner uuid; v_staff boolean := public.is_staff_or_admin();
begin
  if v_uid is null then raise exception 'غير مصرّح'; end if;
  if coalesce(btrim(p_body), '') = '' then raise exception 'الرسالة فارغة'; end if;
  select user_id into v_owner from public.support_tickets where id = p_ticket;
  if v_owner is null then raise exception 'التذكرة غير موجودة'; end if;
  if v_owner <> v_uid and not v_staff then raise exception 'غير مصرّح'; end if;

  insert into public.support_messages (ticket_id, sender, body)
    values (p_ticket, case when v_staff and v_owner <> v_uid then 'admin' else 'user' end, p_body);
  update public.support_tickets set
    last_message_at = now(),
    status = 'open',
    unread_admin = case when v_staff and v_owner <> v_uid then unread_admin else true end,
    unread_user  = case when v_staff and v_owner <> v_uid then true else unread_user end
    where id = p_ticket;

  -- إشعار المستخدم عند ردّ الإدارة.
  if v_staff and v_owner <> v_uid then
    begin
      perform net.http_post(
        url := 'https://yjdidwnnlyeisaahfmlr.supabase.co/functions/v1/notify-user-fcm',
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body := jsonb_build_object('user_id', v_owner, 'title', 'ردّ من دعم قريب',
                                   'body', left(p_body, 120), 'data', jsonb_build_object('type', 'support'))
      );
    exception when others then null; end;
  end if;
end $$;
grant execute on function public.send_support_message(uuid, text) to authenticated;

-- تذاكر المستخدم الحالي.
create or replace function public.my_support_tickets()
returns setof public.support_tickets language sql security definer set search_path = public stable as $$
  select * from public.support_tickets where user_id = auth.uid() order by last_message_at desc;
$$;
grant execute on function public.my_support_tickets() to authenticated;

-- رسائل تذكرة واحدة (يملكها المستخدم أو الأدمن) — ويعلّمها مقروءة للطرف القارئ.
create or replace function public.support_ticket_messages(p_ticket uuid)
returns setof public.support_messages language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_owner uuid; v_staff boolean := public.is_staff_or_admin();
begin
  select user_id into v_owner from public.support_tickets where id = p_ticket;
  if v_owner is null then raise exception 'التذكرة غير موجودة'; end if;
  if v_owner <> v_uid and not v_staff then raise exception 'غير مصرّح'; end if;
  if v_staff and v_owner <> v_uid then
    update public.support_tickets set unread_admin = false where id = p_ticket;
  else
    update public.support_tickets set unread_user = false where id = p_ticket;
  end if;
  return query select * from public.support_messages where ticket_id = p_ticket order by created_at;
end $$;
grant execute on function public.support_ticket_messages(uuid) to authenticated;

-- أدمن: كل التذاكر مع اسم/هاتف المستخدم وآخر رسالة.
create or replace function public.admin_list_support_tickets()
returns table (
  id uuid, user_id uuid, user_name text, user_phone text, user_role text,
  subject text, status text, unread_admin boolean,
  last_message_at timestamptz, last_body text, created_at timestamptz
) language sql security definer set search_path = public stable as $$
  select t.id, t.user_id, u.full_name, u.phone, u.role,
         t.subject, t.status, t.unread_admin, t.last_message_at,
         (select m.body from public.support_messages m
           where m.ticket_id = t.id order by m.created_at desc limit 1),
         t.created_at
  from public.support_tickets t
  join public.users u on u.id = t.user_id
  where public.is_staff_or_admin()
  order by t.unread_admin desc, t.last_message_at desc;
$$;
grant execute on function public.admin_list_support_tickets() to authenticated;

-- أدمن: إغلاق/إعادة فتح تذكرة.
create or replace function public.admin_set_ticket_status(p_ticket uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff_or_admin() then raise exception 'غير مصرّح'; end if;
  if p_status not in ('open', 'closed') then raise exception 'حالة غير صالحة'; end if;
  update public.support_tickets set status = p_status where id = p_ticket;
end $$;
grant execute on function public.admin_set_ticket_status(uuid, text) to authenticated;

-- عدد التذاكر غير المقروءة (شارة للأدمن).
create or replace function public.admin_unread_tickets_count()
returns int language sql security definer set search_path = public stable as $$
  select case when public.is_staff_or_admin()
    then (select count(*)::int from public.support_tickets where unread_admin and status = 'open')
    else 0 end;
$$;
grant execute on function public.admin_unread_tickets_count() to authenticated;

-- ============================================================
--  توصيل الطرود (#1) + الرحلات بين المدن (#2): أعمدة على rides + تحديث RPC.
--  شغّل هذا القسم كاملاً مرّة واحدة.
-- ============================================================
alter table public.rides add column if not exists is_package      boolean not null default false;
alter table public.rides add column if not exists package_note    text;
alter table public.rides add column if not exists recipient_name  text;
alter table public.rides add column if not exists recipient_phone text;
alter table public.rides add column if not exists intercity       boolean not null default false;

-- إعادة تعريف قائمة الطلبات المتاحة لتشمل حقول الطرد/بين المدن (تغيّر نوع الإرجاع → drop أولاً).
drop function if exists public.list_available_rides();
create or replace function public.list_available_rides()
returns table (
  id uuid, customer_id uuid, driver_id uuid, service_id text, status ride_status,
  pickup_lat double precision, pickup_lng double precision, pickup_address text,
  dropoff_lat double precision, dropoff_lng double precision, dropoff_address text,
  fare numeric, payment_method payment_method, created_at timestamptz,
  customer_name text, customer_rating numeric,
  is_package boolean, package_note text, recipient_name text, recipient_phone text, intercity boolean
) language sql stable security definer set search_path = public as $$
  select r.id, r.customer_id, r.driver_id, r.service_id, r.status,
         r.pickup_lat, r.pickup_lng, r.pickup_address,
         r.dropoff_lat, r.dropoff_lng, r.dropoff_address,
         r.fare, r.payment_method, r.created_at,
         cu.full_name, cu.rating,
         r.is_package, r.package_note, r.recipient_name, r.recipient_phone, r.intercity
  from public.rides r
  join public.users cu on cu.id = r.customer_id
  where r.status = 'searching' and r.driver_id is null
    and exists (select 1 from public.drivers d where d.user_id = auth.uid())
  order by r.created_at asc;
$$;
grant execute on function public.list_available_rides() to authenticated;

-- مضاعف سعر الرحلات بين المدن (#2) — يُطبَّق على الأجرة عند intercity=true.
alter table public.settings add column if not exists intercity_multiplier numeric(4,2) not null default 1.5;
