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

-- ---------- الإعدادات (عمولة المنصة + الحساب البنكي) ----------
create table if not exists public.settings (
  id                  int primary key default 1 check (id = 1),  -- صف واحد
  commission_rate     numeric(4,3) not null default 0.150,       -- 0.150 = 15%
  bank_name           text,
  bank_account_name   text,
  bank_account_number text,
  updated_at          timestamptz not null default now()
);
insert into public.settings (id) values (1) on conflict (id) do nothing;

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

-- ملاحظة: عمليات الأدمن (اعتماد التعبئة، تعديل العمولة، تسوية المحافظ)
-- تُنفَّذ عبر service_role من الخادم، أو تُضاف سياسات role='admin' حسب الحاجة.
