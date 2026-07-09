-- ============================================================
--  قريب (Qareeb) — مخطط قاعدة البيانات (Supabase / Postgres)
--  شغّله من: Supabase Dashboard → SQL Editor، أو:
--    supabase db push
-- ============================================================

-- امتدادات
create extension if not exists "pgcrypto";

-- ---------- الأنواع ----------
do $$ begin
  create type user_role as enum ('customer', 'driver', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type payment_method as enum ('cash', 'bank_transfer', 'wallet');
exception when duplicate_object then null; end $$;

do $$ begin
  create type ride_status as enum
    ('requested','searching','accepted','arrived','in_progress','completed','cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type transaction_type as enum ('topup','ride_payment','ride_earning','commission');
exception when duplicate_object then null; end $$;

do $$ begin
  create type topup_status as enum ('pending','approved','rejected');
exception when duplicate_object then null; end $$;

-- ---------- المستخدمون ----------
-- profiles مرتبطة بـ auth.users (id نفسه)
create table if not exists public.users (
  id         uuid primary key references auth.users(id) on delete cascade,
  phone      text unique not null,
  full_name  text,
  role       user_role not null default 'customer',
  sos_contact1 text,                           -- جهة طوارئ 1 (يضبطها العميل)
  sos_contact2 text,                           -- جهة طوارئ 2
  created_at timestamptz not null default now()
);
-- ترقية للقواعد القائمة
alter table public.users add column if not exists sos_contact1 text;
alter table public.users add column if not exists sos_contact2 text;

-- ---------- السائقون ----------
create table if not exists public.drivers (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users(id) on delete cascade,
  vehicle_type text not null,
  plate_number text,
  is_online    boolean not null default false,
  rating       numeric(2,1) default 5.0,
  created_at   timestamptz not null default now()
);
create index if not exists drivers_online_idx on public.drivers(is_online);
-- حالة طلب السائق: pending / approved / rejected (تسجيل ذاتي بموافقة الأدمن)
alter table public.drivers add column if not exists status text not null default 'pending';

-- ---------- الرحلات ----------
create table if not exists public.rides (
  id             uuid primary key default gen_random_uuid(),
  customer_id    uuid not null references public.users(id) on delete cascade,
  driver_id      uuid references public.users(id) on delete set null,
  service_id     text not null,               -- standard / vip / hiace / amjad ...
  status         ride_status not null default 'requested',
  pickup_lat     double precision not null,
  pickup_lng     double precision not null,
  pickup_address text,
  dropoff_lat    double precision,
  dropoff_lng    double precision,
  dropoff_address text,
  fare           numeric(12,2),
  payment_method payment_method not null default 'cash',
  rating         int check (rating between 1 and 5),
  created_at     timestamptz not null default now()
);
create index if not exists rides_customer_idx on public.rides(customer_id);
create index if not exists rides_driver_idx   on public.rides(driver_id);
create index if not exists rides_status_idx   on public.rides(status);

-- تتبع مباشر: آخر موقع للسائق (يُبثّ عبر Realtime على صفّ الرحلة نفسه)
alter table public.rides add column if not exists driver_lat    double precision;
alter table public.rides add column if not exists driver_lng    double precision;
alter table public.rides add column if not exists driver_loc_at timestamptz;

-- ---------- اشتراكات الإشعارات (Web Push) ----------
create table if not exists public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  endpoint   text unique not null,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);
create index if not exists push_subs_user_idx on public.push_subscriptions(user_id);

-- ---------- تنبيهات الطوارئ (SOS) ----------
create table if not exists public.sos_alerts (
  id         uuid primary key default gen_random_uuid(),
  ride_id    uuid references public.rides(id) on delete set null,
  user_id    uuid not null references public.users(id) on delete cascade,
  role       text not null default 'customer',  -- customer / driver
  lat        double precision,
  lng        double precision,
  note       text,
  status     text not null default 'open',       -- open / resolved
  created_at timestamptz not null default now()
);
create index if not exists sos_open_idx on public.sos_alerts(status);

-- ---------- المحافظ ----------
create table if not exists public.wallets (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid unique not null references public.users(id) on delete cascade,
  balance    numeric(12,2) not null default 0,
  updated_at timestamptz not null default now()
);

-- ---------- المعاملات ----------
create table if not exists public.transactions (
  id         uuid primary key default gen_random_uuid(),
  wallet_id  uuid not null references public.wallets(id) on delete cascade,
  type       transaction_type not null,
  amount     numeric(12,2) not null,          -- موجب = إيداع، سالب = خصم
  ride_id    uuid references public.rides(id) on delete set null,
  note       text,
  created_at timestamptz not null default now()
);
create index if not exists tx_wallet_idx on public.transactions(wallet_id);

-- ---------- التعبئة (تحويل بنكي) ----------
create table if not exists public.topups (
  id          uuid primary key default gen_random_uuid(),
  wallet_id   uuid not null references public.wallets(id) on delete cascade,
  amount      numeric(12,2) not null,
  proof_url   text,                            -- رابط الإثبات في Storage
  status      topup_status not null default 'pending',
  reviewed_by uuid references public.users(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists topups_status_idx on public.topups(status);

-- ---------- الإعدادات (عمولة + Surge + شرائح + الحساب البنكي) ----------
create table if not exists public.settings (
  id                  int primary key default 1 check (id = 1),  -- صف واحد
  commission_rate     numeric(4,3) not null default 0.150,       -- 0.150 = 15%
  surge_multiplier    numeric(4,2) not null default 1.00,        -- التسعير الديناميكي
  tier1_max_km        numeric(6,2) not null default 2,           -- نهاية فتح العداد
  tier2_max_km        numeric(6,2) not null default 10,          -- نهاية الشريحة الحضرية
  bank_name           text,
  bank_account_name   text,
  bank_account_number text,
  updated_at          timestamptz not null default now()
);
insert into public.settings (id) values (1) on conflict (id) do nothing;
-- ترقية القواعد القديمة (إن كان الصف موجوداً بدون الأعمدة الجديدة)
alter table public.settings add column if not exists surge_multiplier numeric(4,2) not null default 1.00;
alter table public.settings add column if not exists tier1_max_km numeric(6,2) not null default 2;
alter table public.settings add column if not exists tier2_max_km numeric(6,2) not null default 10;

-- ---------- تسعير المركبات (تسعيرة مستقلة لكل نوع) ----------
create table if not exists public.service_pricing (
  service_id   text primary key,        -- ladies / amjad / hiace / rickshaw / open / tow
  name         text not null,
  base_fare    numeric(12,2) not null default 0,   -- فتح العداد (يغطي أول tier1_max_km)
  per_km_urban numeric(12,2) not null default 0,   -- الشريحة الحضرية (tier1..tier2)
  per_km_far   numeric(12,2) not null default 0,   -- الشريحة التعويضية (> tier2)
  per_minute   numeric(12,2) not null default 0,   -- سعر الدقيقة
  sort_order   int not null default 0,
  active       boolean not null default true,
  updated_at   timestamptz not null default now()
);

-- بذور التسعير الابتدائية (بالجنيه السوداني — تُعدَّل من لوحة الأدمن)
insert into public.service_pricing
  (service_id, name, base_fare, per_km_urban, per_km_far, per_minute, sort_order) values
  ('standard', 'قريب عادي',    600,  130, 160, 18, 0),
  ('ladies',   'قريب نسائي',   900,  180, 220, 25, 1),
  ('amjad',    'أمجاد',        800,  160, 200, 22, 2),
  ('hiace',    'هايس',        1200,  200, 240, 30, 3),
  ('rickshaw', 'ركشة',         300,   90, 110, 12, 4),
  ('open',     'مشوار مفتوح',  700,  150, 190, 20, 5),
  ('tow',      'سحاب',        2500,  300, 350, 40, 6)
on conflict (service_id) do nothing;

-- ---------- ترحيل (المشاركة اليومية) ----------
do $$ begin
  create type commute_status as enum ('forming','dispatched','active','cancelled');
exception when duplicate_object then null; end $$;

create table if not exists public.commute_orders (
  id             uuid primary key default gen_random_uuid(),
  organizer_id   uuid references public.users(id) on delete set null,
  service_id     text not null,                 -- أي نوع عدا سحاب
  dest_lat       double precision not null,     -- مكان العمل (الوجهة المشتركة)
  dest_lng       double precision not null,
  dest_address   text,
  scheduled_time text not null,                 -- "HH:MM"
  days           text[] not null default '{}',
  round_trip     boolean not null default true,
  invite_code    text not null unique default substr(md5(random()::text), 1, 6),
  status         commute_status not null default 'forming',
  created_at     timestamptz not null default now()
);
create index if not exists commute_orders_status_idx on public.commute_orders(status);

create table if not exists public.commute_members (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references public.commute_orders(id) on delete cascade,
  user_id      uuid references public.users(id) on delete set null,
  name         text not null,
  home_lat     double precision not null,       -- منزل العضو (نقطة انطلاقه)
  home_lng     double precision not null,
  home_address text,
  is_organizer boolean not null default false,
  created_at   timestamptz not null default now()
);
create index if not exists commute_members_order_idx on public.commute_members(order_id);

-- ============================================================
--  دالة: إنشاء محفظة تلقائياً لكل مستخدم جديد
-- ============================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.wallets (user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end $$;

drop trigger if exists on_user_created on public.users;
create trigger on_user_created
  after insert on public.users
  for each row execute function public.handle_new_user();

-- ============================================================
--  أمان مستوى الصف (RLS)
-- ============================================================
alter table public.users        enable row level security;
alter table public.drivers      enable row level security;
alter table public.rides        enable row level security;
alter table public.wallets      enable row level security;
alter table public.transactions enable row level security;
alter table public.topups       enable row level security;
alter table public.settings     enable row level security;
alter table public.service_pricing enable row level security;
alter table public.commute_orders  enable row level security;
alter table public.commute_members enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.sos_alerts enable row level security;

-- الإشعارات: كل مستخدم يدير اشتراكاته فقط (الإرسال يتم بدور service_role الذي يتجاوز RLS).
drop policy if exists "own push subs" on public.push_subscriptions;
create policy "own push subs" on public.push_subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- هل المستخدم الحالي أدمن؟ (تُعرَّف مبكراً لأن السياسات أدناه تستخدمها)
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.users where id = auth.uid() and role = 'admin'
  );
$$;

-- التسعير: قراءة للجميع (المصادَق عليهم)
drop policy if exists "read pricing" on public.service_pricing;
create policy "read pricing" on public.service_pricing
  for select using (auth.role() = 'authenticated');

-- ترحيل: المصادَق عليهم يقرؤون الطلبات (للوصول عبر رابط الدعوة) وينشئونها ويحدّثونها.
drop policy if exists "read commute orders" on public.commute_orders;
create policy "read commute orders" on public.commute_orders
  for select using (auth.role() = 'authenticated');

drop policy if exists "create commute orders" on public.commute_orders;
create policy "create commute orders" on public.commute_orders
  for insert to authenticated with check (true);

drop policy if exists "update own commute orders" on public.commute_orders;
create policy "update own commute orders" on public.commute_orders
  for update using (auth.uid() = organizer_id or public.is_admin());

-- ترحيل: الأعضاء يُقرؤون ويُضافون من قِبل المصادَق عليهم.
drop policy if exists "read commute members" on public.commute_members;
create policy "read commute members" on public.commute_members
  for select using (auth.role() = 'authenticated');

drop policy if exists "add commute members" on public.commute_members;
create policy "add commute members" on public.commute_members
  for insert to authenticated with check (true);

-- المستخدم يقرأ/يعدّل بياناته
drop policy if exists "own profile" on public.users;
create policy "own profile" on public.users
  for all using (auth.uid() = id) with check (auth.uid() = id);

-- الرحلات: العميل أو السائق المرتبط بها
drop policy if exists "own rides" on public.rides;
create policy "own rides" on public.rides
  for all using (auth.uid() = customer_id or auth.uid() = driver_id)
  with check (auth.uid() = customer_id);

-- المحفظة: صاحبها فقط
drop policy if exists "own wallet" on public.wallets;
create policy "own wallet" on public.wallets
  for select using (auth.uid() = user_id);

-- المعاملات: عبر المحفظة المملوكة
drop policy if exists "own transactions" on public.transactions;
create policy "own transactions" on public.transactions
  for select using (
    wallet_id in (select id from public.wallets where user_id = auth.uid())
  );

-- التعبئة: صاحب المحفظة ينشئ ويقرأ
drop policy if exists "own topups" on public.topups;
create policy "own topups" on public.topups
  for all using (
    wallet_id in (select id from public.wallets where user_id = auth.uid())
  ) with check (
    wallet_id in (select id from public.wallets where user_id = auth.uid())
  );

-- الإعدادات: قراءة للجميع (المصادَق عليهم)
drop policy if exists "read settings" on public.settings;
create policy "read settings" on public.settings
  for select using (auth.role() = 'authenticated');

-- ============================================================
--  صلاحيات الأدمن
-- ============================================================

-- الأدمن يقرأ كل المستخدمين والمحافظ والتعبئات (للوحة التحكم)
drop policy if exists "admin read users" on public.users;
create policy "admin read users" on public.users
  for select using (public.is_admin());

drop policy if exists "admin read wallets" on public.wallets;
create policy "admin read wallets" on public.wallets
  for select using (public.is_admin());

drop policy if exists "admin read topups" on public.topups;
create policy "admin read topups" on public.topups
  for select using (public.is_admin());

-- الطوارئ: المستخدم يُطلق تنبيهه، ويقرؤه هو أو الأدمن، والأدمن يعالجه.
drop policy if exists "raise own sos" on public.sos_alerts;
create policy "raise own sos" on public.sos_alerts
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "read sos" on public.sos_alerts;
create policy "read sos" on public.sos_alerts
  for select using (auth.uid() = user_id or public.is_admin());

drop policy if exists "admin update sos" on public.sos_alerts;
create policy "admin update sos" on public.sos_alerts
  for update using (public.is_admin()) with check (public.is_admin());

-- الأدمن يعدّل الإعدادات (العمولة + Surge + الشرائح + الحساب البنكي)
drop policy if exists "admin write settings" on public.settings;
create policy "admin write settings" on public.settings
  for update using (public.is_admin()) with check (public.is_admin());

-- الأدمن يعدّل تسعير المركبات
drop policy if exists "admin write pricing" on public.service_pricing;
create policy "admin write pricing" on public.service_pricing
  for all using (public.is_admin()) with check (public.is_admin());

-- ============================================================
--  اعتماد/رفض التعبئة (عمليات ذرّية عبر دوال آمنة)
-- ============================================================

-- اعتماد تعبئة: يعلّمها approved، يضيف المبلغ للمحفظة، ويسجّل معاملة — كلها معاً.
create or replace function public.approve_topup(p_topup uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_wallet uuid;
  v_amount numeric;
  v_status topup_status;
begin
  if not public.is_admin() then
    raise exception 'غير مصرّح';
  end if;

  select wallet_id, amount, status
    into v_wallet, v_amount, v_status
    from public.topups where id = p_topup for update;

  if v_wallet is null then raise exception 'التعبئة غير موجودة'; end if;
  if v_status <> 'pending' then raise exception 'التعبئة روجعت مسبقاً'; end if;

  update public.topups
    set status = 'approved', reviewed_by = auth.uid()
    where id = p_topup;

  update public.wallets
    set balance = balance + v_amount, updated_at = now()
    where id = v_wallet;

  insert into public.transactions (wallet_id, type, amount, note)
    values (v_wallet, 'topup', v_amount, 'تعبئة رصيد (معتمدة)');
end $$;

-- رفض تعبئة
create or replace function public.reject_topup(p_topup uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'غير مصرّح'; end if;
  update public.topups
    set status = 'rejected', reviewed_by = auth.uid()
    where id = p_topup and status = 'pending';
end $$;

-- ملاحظة: لتعيين أول أدمن:  update public.users set role = 'admin' where phone = '+249...';

-- ============================================================
--  السائق: قبول الرحلات وتسوية الأرباح (خصم العمولة)
-- ============================================================

-- السائق يدير صفّه في drivers (وينشئ طلب التسجيل)
drop policy if exists "own driver row" on public.drivers;
create policy "own driver row" on public.drivers
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- الأدمن يقرأ كل السائقين (لعرض طلبات التسجيل واعتمادها)
drop policy if exists "admin read drivers" on public.drivers;
create policy "admin read drivers" on public.drivers
  for select using (public.is_admin());

-- أمان: يمنع أي مستخدم من ترقية دوره بنفسه (الدور يتغيّر فقط عبر دوال الأدمن الآمنة).
create or replace function public.prevent_role_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    raise exception 'تغيير الدور غير مسموح';
  end if;
  return new;
end $$;
drop trigger if exists trg_prevent_role_change on public.users;
create trigger trg_prevent_role_change before update on public.users
  for each row execute function public.prevent_role_change();

-- الأدمن يعتمد طلب سائق: يجعل الصفّ approved ويمنح دور driver — معاً.
create or replace function public.approve_driver(p_driver uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_user uuid;
begin
  if not public.is_admin() then raise exception 'غير مصرّح'; end if;
  select user_id into v_user from public.drivers where id = p_driver;
  if v_user is null then raise exception 'الطلب غير موجود'; end if;
  update public.drivers set status = 'approved' where id = p_driver;
  update public.users   set role = 'driver'   where id = v_user;
end $$;

create or replace function public.reject_driver(p_driver uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'غير مصرّح'; end if;
  update public.drivers set status = 'rejected' where id = p_driver;
end $$;

-- السائق يرى الرحلات المنتظرة سائقاً
drop policy if exists "drivers see open rides" on public.rides;
create policy "drivers see open rides" on public.rides
  for select using (status in ('requested', 'searching'));

-- السائق يقبل رحلة منتظرة (يعيّن نفسه سائقاً)
drop policy if exists "driver accept ride" on public.rides;
create policy "driver accept ride" on public.rides
  for update using (status in ('requested', 'searching'))
  with check (auth.uid() = driver_id);

-- تتبع مباشر: السائق المرتبط بالرحلة يحدّث موقعه فقط (بلا استهلاك خرائط قوقل).
-- عبر دالة آمنة حتى لا تتعارض مع سياسة الكتابة العامة على صفّ الرحلة.
create or replace function public.update_driver_location(
  p_ride uuid,
  p_lat  double precision,
  p_lng  double precision
) returns void language plpgsql security definer set search_path = public as $$
begin
  update public.rides
     set driver_lat = p_lat, driver_lng = p_lng, driver_loc_at = now()
   where id = p_ride
     and driver_id = auth.uid()
     and status in ('accepted', 'arrived', 'in_progress');
end $$;

-- تسوية رحلة عند اكتمالها: يُقيَّد للسائق (الأجرة − العمولة)، وتُسجَّل
-- معاملتان (أرباح إجمالية + عمولة سالبة) بحيث يتطابق مجموعهما مع صافي الرصيد.
create or replace function public.settle_ride(p_ride uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_driver_user uuid;
  v_fare        numeric;
  v_status      ride_status;
  v_rate        numeric;
  v_wallet      uuid;
  v_commission  numeric;
  v_net         numeric;
begin
  select driver_id, fare, status
    into v_driver_user, v_fare, v_status
    from public.rides where id = p_ride for update;

  if v_driver_user is null then raise exception 'الرحلة بلا سائق'; end if;
  if auth.uid() <> v_driver_user and not public.is_admin() then
    raise exception 'غير مصرّح';
  end if;
  if v_status = 'completed' then raise exception 'الرحلة مسوّاة مسبقاً'; end if;

  select commission_rate into v_rate from public.settings where id = 1;
  v_commission := round(coalesce(v_fare, 0) * coalesce(v_rate, 0));
  v_net        := coalesce(v_fare, 0) - v_commission;

  update public.rides set status = 'completed' where id = p_ride;

  select id into v_wallet from public.wallets where user_id = v_driver_user;
  if v_wallet is not null then
    update public.wallets
      set balance = balance + v_net, updated_at = now()
      where id = v_wallet;
    insert into public.transactions (wallet_id, type, amount, ride_id, note) values
      (v_wallet, 'ride_earning', coalesce(v_fare, 0), p_ride, 'أرباح رحلة (إجمالي)'),
      (v_wallet, 'commission',   -v_commission,       p_ride, 'عمولة المنصة');
  end if;
end $$;

-- ============================================================
--  التخزين: إثباتات التحويل (bucket خاص topup-proofs)
-- ============================================================

insert into storage.buckets (id, name, public)
  values ('topup-proofs', 'topup-proofs', false)
  on conflict (id) do nothing;

-- كل مستخدم يرفع في مجلده الخاص (المسار يبدأ بمعرّفه): "<uid>/<file>"
drop policy if exists "upload own proof" on storage.objects;
create policy "upload own proof" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'topup-proofs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- المستخدم يقرأ إثباته، والأدمن يقرأ كل الإثباتات
drop policy if exists "read own or admin proof" on storage.objects;
create policy "read own or admin proof" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'topup-proofs'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );

-- ============================================================
--  Realtime: تفعيل النشر على جدول الرحلات
--  (يمكّن اشتراكات العميل/السائق اللحظية على تغيّرات rides)
-- ============================================================
do $$
declare
  t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['rides', 'commute_orders', 'commute_members', 'sos_alerts'] loop
      if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
      ) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;
