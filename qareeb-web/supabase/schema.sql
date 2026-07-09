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
  created_at timestamptz not null default now()
);

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
  driver_id      uuid references public.users(id) on delete set null,  -- السائق الذي قبِل الطلب
  created_at     timestamptz not null default now()
);
create index if not exists commute_orders_status_idx on public.commute_orders(status);
-- ترقية القواعد القديمة (إن كان الجدول موجوداً بدون عمود السائق)
alter table public.commute_orders add column if not exists driver_id uuid references public.users(id) on delete set null;

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

-- ترحيل: السائق يقبل طلباً مُرسَلاً (dispatched → active) ويعيّن نفسه سائقاً.
drop policy if exists "driver accept commute" on public.commute_orders;
create policy "driver accept commute" on public.commute_orders
  for update using (status = 'dispatched') with check (auth.uid() = driver_id);

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
--  منع ترقية الدور ذاتياً (يسدّ ثغرة سياسة "own profile" للكتابة)
--  يُسمح بتغيير users.role فقط للأدمن — عبر لوحة الأدمن أو دوال
--  الاعتماد الآمنة (approve_driver_application) التي تعمل بسياق الأدمن.
-- ============================================================
create or replace function public.prevent_role_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    raise exception 'تغيير الدور غير مسموح';
  end if;
  return new;
end $$;

-- أزل أي مشغّل قديم يستدعي هذه الدالة (بأي اسم) لتفادي التكرار، ثم أنشئ القياسي.
do $$
declare t text;
begin
  for t in
    select tgname from pg_trigger
    where tgrelid = 'public.users'::regclass and not tgisinternal
      and tgfoid = 'public.prevent_role_change'::regproc
  loop
    execute format('drop trigger %I on public.users', t);
  end loop;
end $$;

create trigger prevent_role_change
  before update of role on public.users
  for each row execute function public.prevent_role_change();

-- ============================================================
--  السائق: قبول الرحلات وتسوية الأرباح (خصم العمولة)
-- ============================================================

-- السائق يدير صفّه في drivers
drop policy if exists "own driver row" on public.drivers;
create policy "own driver row" on public.drivers
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- السائق يرى الرحلات المنتظرة سائقاً
drop policy if exists "drivers see open rides" on public.rides;
create policy "drivers see open rides" on public.rides
  for select using (status in ('requested', 'searching'));

-- السائق يقبل رحلة منتظرة (يعيّن نفسه سائقاً)
drop policy if exists "driver accept ride" on public.rides;
create policy "driver accept ride" on public.rides
  for update using (status in ('requested', 'searching'))
  with check (auth.uid() = driver_id);

-- تسوية رحلة عند اكتمالها — مسار موحّد للإنهاء (يستدعيه السائق أو الأدمن):
--   • دفع بمحفظة قريب: تُخصم الأجرة من محفظة العميل، ويُقيَّد للسائق (الأجرة − العمولة).
--     (المنصة تحصّل الأجرة وتحتفظ بالعمولة.)
--   • كاش/تحويل بنكي: يستلم السائق الأجرة مباشرة، فتُخصم العمولة فقط من محفظته
--     (السائق يدين للمنصة بالعمولة).
create or replace function public.settle_ride(p_ride uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_driver_user uuid;
  v_customer    uuid;
  v_fare        numeric;
  v_status      ride_status;
  v_payment     payment_method;
  v_rate        numeric;
  v_commission  numeric;
  v_net         numeric;
  v_dwallet     uuid;
  v_cwallet     uuid;
  v_cbalance    numeric;
begin
  select driver_id, customer_id, fare, status, payment_method
    into v_driver_user, v_customer, v_fare, v_status, v_payment
    from public.rides where id = p_ride for update;

  if v_driver_user is null then raise exception 'الرحلة بلا سائق'; end if;
  if auth.uid() <> v_driver_user and not public.is_admin() then
    raise exception 'غير مصرّح';
  end if;
  if v_status = 'completed' then raise exception 'الرحلة مسوّاة مسبقاً'; end if;
  if v_status = 'cancelled' then raise exception 'الرحلة ملغاة'; end if;

  select commission_rate into v_rate from public.settings where id = 1;
  v_fare       := coalesce(v_fare, 0);
  v_commission := round(v_fare * coalesce(v_rate, 0));
  v_net        := v_fare - v_commission;

  -- خصم من العميل عند الدفع بالمحفظة (الكاش/التحويل يُدفع للسائق مباشرة).
  if v_payment = 'wallet' then
    select id, balance into v_cwallet, v_cbalance
      from public.wallets where user_id = v_customer for update;
    if v_cwallet is null then raise exception 'محفظة العميل غير موجودة'; end if;
    if v_cbalance < v_fare then raise exception 'رصيد محفظة العميل غير كافٍ'; end if;
    update public.wallets
      set balance = balance - v_fare, updated_at = now()
      where id = v_cwallet;
    insert into public.transactions (wallet_id, type, amount, ride_id, note)
      values (v_cwallet, 'ride_payment', -v_fare, p_ride, 'دفع رحلة');
  end if;

  update public.rides set status = 'completed' where id = p_ride;

  -- تسوية محفظة السائق.
  select id into v_dwallet from public.wallets where user_id = v_driver_user for update;
  if v_dwallet is not null then
    if v_payment = 'wallet' then
      -- المنصة حصّلت الأجرة → تُقيَّد للسائق (الأجرة إيداعاً والعمولة خصماً).
      update public.wallets
        set balance = balance + v_net, updated_at = now()
        where id = v_dwallet;
      insert into public.transactions (wallet_id, type, amount, ride_id, note) values
        (v_dwallet, 'ride_earning', v_fare,        p_ride, 'أرباح رحلة (إجمالي)'),
        (v_dwallet, 'commission',   -v_commission, p_ride, 'عمولة المنصة');
    else
      -- الكاش/التحويل: السائق حصّل الأجرة مباشرة ويدين للمنصة بالعمولة.
      update public.wallets
        set balance = balance - v_commission, updated_at = now()
        where id = v_dwallet;
      insert into public.transactions (wallet_id, type, amount, ride_id, note) values
        (v_dwallet, 'commission', -v_commission, p_ride, 'عمولة المنصة (نقدي/تحويل)');
    end if;
  end if;
end $$;

-- تقدّم الرحلة: السائق يعلّم "وصل" (arrived) أو "بدأت" (in_progress).
-- (الإكمال يتم حصراً عبر settle_ride لضمان الدفع.)
create or replace function public.set_ride_status(p_ride uuid, p_status ride_status)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_driver uuid;
  v_cur    ride_status;
begin
  if p_status not in ('arrived', 'in_progress') then
    raise exception 'حالة غير مسموحة';
  end if;
  select driver_id, status into v_driver, v_cur
    from public.rides where id = p_ride for update;
  if v_driver is null then raise exception 'الرحلة بلا سائق'; end if;
  if auth.uid() <> v_driver and not public.is_admin() then
    raise exception 'غير مصرّح';
  end if;
  if v_cur not in ('accepted', 'arrived', 'in_progress') then
    raise exception 'لا يمكن تغيير حالة هذه الرحلة';
  end if;
  update public.rides set status = p_status where id = p_ride;
end $$;

-- ============================================================
--  بيانات السائق المُسنَد لرحلة (يقرؤها العميل/السائق/الأدمن فقط)
-- ============================================================
create or replace function public.get_ride_driver(p_ride uuid)
returns table (full_name text, phone text, rating numeric, vehicle_type text, plate_number text)
language sql stable security definer set search_path = public as $$
  select u.full_name, u.phone, d.rating, d.vehicle_type, d.plate_number
  from public.rides r
  join public.users u on u.id = r.driver_id
  left join public.drivers d on d.user_id = r.driver_id
  where r.id = p_ride
    and (auth.uid() = r.customer_id or auth.uid() = r.driver_id or public.is_admin());
$$;

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
--  طلبات الانضمام كسائق (KYC) + وثائقها + اعتمادها من الأدمن
-- ============================================================
do $$ begin
  create type driver_app_status as enum ('pending', 'approved', 'rejected');
exception when duplicate_object then null; end $$;

create table if not exists public.driver_applications (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references public.users(id) on delete cascade,
  full_name            text not null,
  phone                text not null,
  email                text,
  vehicle_type         text not null,               -- من كتالوج الخدمات
  plate_number         text not null,               -- لوحة السيارة
  is_rented            boolean not null default false,
  residence            text,                         -- السكن / العنوان
  -- الوثائق والصور (مسارات داخل bucket خاص "driver-docs")
  driving_license_url  text,                         -- رخصة القيادة
  vehicle_license_url  text,                         -- رخصة/استمارة السيارة
  rental_contract_url  text,                         -- عقد الإيجار (إن كانت مستأجرة)
  transport_permit_url text,                         -- تصريح النقل
  photo_front_url      text,                         -- صورة أمامية
  photo_back_url       text,                         -- صورة خلفية
  photo_side_url       text,                         -- صورة جانبية (الأطراف)
  photo_interior_url   text,                         -- صورة داخلية
  status               driver_app_status not null default 'pending',
  review_note          text,                         -- سبب الرفض (اختياري)
  reviewed_by          uuid references public.users(id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index if not exists driver_apps_status_idx on public.driver_applications(status);
create index if not exists driver_apps_user_idx on public.driver_applications(user_id);

alter table public.driver_applications enable row level security;

-- المستخدم ينشئ/يقرأ/يحدّث طلبه فقط
drop policy if exists "own driver application" on public.driver_applications;
create policy "own driver application" on public.driver_applications
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- الأدمن يقرأ كل الطلبات (الاعتماد/الرفض عبر دوال security definer أدناه)
drop policy if exists "admin read driver apps" on public.driver_applications;
create policy "admin read driver apps" on public.driver_applications
  for select using (public.is_admin());

-- اعتماد طلب سائق: يعلّمه approved، يُنشئ/يحدّث صفّ السائق، ويرقّي الدور — ذرّياً.
create or replace function public.approve_driver_application(p_app uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_user   uuid;
  v_vtype  text;
  v_plate  text;
  v_status driver_app_status;
  v_driver uuid;
begin
  if not public.is_admin() then raise exception 'غير مصرّح'; end if;

  select user_id, vehicle_type, plate_number, status
    into v_user, v_vtype, v_plate, v_status
    from public.driver_applications where id = p_app for update;

  if v_user is null then raise exception 'الطلب غير موجود'; end if;
  if v_status <> 'pending' then raise exception 'الطلب روجع مسبقاً'; end if;

  update public.driver_applications
    set status = 'approved', reviewed_by = auth.uid(), updated_at = now()
    where id = p_app;

  select id into v_driver from public.drivers where user_id = v_user;
  if v_driver is null then
    insert into public.drivers (user_id, vehicle_type, plate_number)
      values (v_user, v_vtype, v_plate);
  else
    update public.drivers set vehicle_type = v_vtype, plate_number = v_plate
      where id = v_driver;
  end if;

  update public.users set role = 'driver' where id = v_user;
end $$;

-- رفض طلب سائق (مع سبب اختياري)
create or replace function public.reject_driver_application(p_app uuid, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'غير مصرّح'; end if;
  update public.driver_applications
    set status = 'rejected', review_note = p_note, reviewed_by = auth.uid(), updated_at = now()
    where id = p_app and status = 'pending';
end $$;

-- التخزين: وثائق السائق (bucket خاص driver-docs)
insert into storage.buckets (id, name, public)
  values ('driver-docs', 'driver-docs', false)
  on conflict (id) do nothing;

drop policy if exists "upload own driver doc" on storage.objects;
create policy "upload own driver doc" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'driver-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "read own or admin driver doc" on storage.objects;
create policy "read own or admin driver doc" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'driver-docs'
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
    foreach t in array array['rides', 'commute_orders', 'commute_members', 'driver_applications'] loop
      if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
      ) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;
