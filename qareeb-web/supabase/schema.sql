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
  scheduled_time text not null,                 -- وقت الذهاب (الوصول للعمل) "HH:MM"
  return_time    text,                          -- وقت الإياب (المغادرة من العمل) "HH:MM" — للذهاب والإياب
  days           text[] not null default '{}',
  round_trip     boolean not null default true,
  invite_code    text not null unique default substr(md5(random()::text), 1, 6),
  status         commute_status not null default 'forming',
  driver_id      uuid references public.users(id) on delete set null,  -- السائق الذي قبِل الطلب
  created_at     timestamptz not null default now()
);
create index if not exists commute_orders_status_idx on public.commute_orders(status);
-- ترقية القواعد القديمة (إن كان الجدول موجوداً بدون الأعمدة الجديدة)
alter table public.commute_orders add column if not exists driver_id uuid references public.users(id) on delete set null;
alter table public.commute_orders add column if not exists return_time text;

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

-- ============================================================
--  الموظفون (وصول محدود للوحة الإدارة بصلاحيات يحدّدها المالك)
--  الصلاحيات: requests (الطلبات) · drivers (السائقون) · rides (الرحلات)
--             · settings (التسعير والإعدادات)
-- ============================================================
create table if not exists public.staff (
  user_id    uuid primary key references public.users(id) on delete cascade,
  perms      text[] not null default '{}',
  active     boolean not null default true,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.staff enable row level security;

-- هل المستخدم موظفاً نشطاً أو أدمن؟ (للقراءة العامة في اللوحة)
create or replace function public.is_staff_or_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from public.staff where user_id = auth.uid() and active
  );
$$;

-- هل يملك صلاحية معيّنة؟ (الأدمن يملك الكل)
create or replace function public.has_perm(p text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from public.staff
    where user_id = auth.uid() and active and p = any(perms)
  );
$$;

drop policy if exists "admin manage staff" on public.staff;
create policy "admin manage staff" on public.staff
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "own staff row" on public.staff;
create policy "own staff row" on public.staff
  for select using (auth.uid() = user_id);

-- صلاحياتي في اللوحة (للواجهة): أدمن → كل الصلاحيات، موظف → صلاحياته.
create or replace function public.my_admin_access()
returns table (is_admin boolean, perms text[])
language sql stable security definer set search_path = public as $$
  select
    public.is_admin(),
    case
      when public.is_admin() then array['requests','drivers','rides','settings']
      else coalesce(
        (select s.perms from public.staff s where s.user_id = auth.uid() and s.active),
        '{}'
      )
    end;
$$;

-- المالك يضيف/يعدّل موظفاً برقم هاتفه (يجب أن يكون سجّل دخوله مرة).
create or replace function public.admin_set_staff(p_phone text, p_perms text[])
returns text language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.is_admin() then raise exception 'غير مصرّح'; end if;
  select id into v_id from auth.users
    where email = regexp_replace(p_phone, '\D', '', 'g') || '@qareeb.sd';
  if v_id is null then
    return 'لا يوجد حساب بهذا الرقم — اطلب من الموظف تسجيل الدخول مرّة من موقع الإدارة أولاً.';
  end if;
  insert into public.staff (user_id, perms, created_by)
    values (v_id, p_perms, auth.uid())
    on conflict (user_id) do update set perms = excluded.perms, active = true;
  return 'تم ✓';
end $$;

-- المالك يزيل موظفاً.
create or replace function public.admin_remove_staff(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'غير مصرّح'; end if;
  delete from public.staff where user_id = p_user;
end $$;

-- المالك يفعّل/يعطّل موظفاً مؤقّتاً (بدون حذف صلاحياته).
create or replace function public.admin_set_staff_active(p_user uuid, p_active boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'غير مصرّح'; end if;
  update public.staff set active = p_active where user_id = p_user;
end $$;

-- ============================================================
--  سجلّ النشاط (Audit log) — من فعل ماذا ومتى
-- ============================================================
create table if not exists public.audit_log (
  id         bigint generated always as identity primary key,
  actor_id   uuid references public.users(id) on delete set null,
  actor_name text,           -- اسم الفاعل وقت الحدث (لقطة)
  action     text not null,  -- approve_topup / reject_topup / approve_driver / ...
  target     text,           -- وصف مختصر للهدف (رقم/اسم)
  created_at timestamptz not null default now()
);
create index if not exists audit_log_created_idx on public.audit_log(created_at desc);
alter table public.audit_log enable row level security;

drop policy if exists "staff read audit" on public.audit_log;
create policy "staff read audit" on public.audit_log
  for select using (public.is_staff_or_admin());

-- تسجيل حدث في السجلّ (يُستدعى داخل الدوال الآمنة).
create or replace function public.log_action(p_action text, p_target text)
returns void language plpgsql security definer set search_path = public as $$
declare v_name text;
begin
  select full_name into v_name from public.users where id = auth.uid();
  insert into public.audit_log (actor_id, actor_name, action, target)
    values (auth.uid(), coalesce(v_name, 'مستخدم'), p_action, p_target);
end $$;

-- ============================================================
--  الحسابات الداخلية (HR مصغّر): منصرفات · رواتب · حسابات بنكية
--  للمالك فقط (is_admin). لا علاقة لها بمحافظ العملاء.
-- ============================================================

-- الحسابات البنكية للشركة (خزائن)
create table if not exists public.company_accounts (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,                 -- اسم الحساب/الخزينة
  bank       text,                          -- البنك
  number     text,                          -- رقم الحساب
  balance    numeric(14,2) not null default 0,
  created_at timestamptz not null default now()
);
alter table public.company_accounts enable row level security;

-- الموظفون في كشف الرواتب (منفصل عن صلاحيات staff)
create table if not exists public.hr_employees (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  role       text,                          -- المسمّى الوظيفي
  phone      text,
  salary     numeric(14,2) not null default 0,  -- الراتب الشهري
  active     boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.hr_employees enable row level security;

-- المنصرفات (رواتب/إيجار/صيانة/…)
create table if not exists public.expenses (
  id          uuid primary key default gen_random_uuid(),
  category    text not null default 'other', -- salary/rent/fuel/maintenance/marketing/other
  description text,
  amount      numeric(14,2) not null,
  employee_id uuid references public.hr_employees(id) on delete set null,
  account_id  uuid references public.company_accounts(id) on delete set null,
  spent_at    date not null default current_date,
  created_by  uuid references public.users(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists expenses_date_idx on public.expenses(spent_at desc);
alter table public.expenses enable row level security;

-- كلها للمالك فقط (قراءة وكتابة)
do $$ begin
  perform 1;
end $$;
drop policy if exists "owner accounts" on public.company_accounts;
create policy "owner accounts" on public.company_accounts
  for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "owner hr" on public.hr_employees;
create policy "owner hr" on public.hr_employees
  for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "owner expenses" on public.expenses;
create policy "owner expenses" on public.expenses
  for all using (public.is_admin()) with check (public.is_admin());

-- تسجيل منصرف (يخصم من رصيد الحساب إن حُدّد) — للمالك.
create or replace function public.add_expense(
  p_category text, p_description text, p_amount numeric,
  p_employee uuid, p_account uuid, p_date date
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'غير مصرّح'; end if;
  insert into public.expenses (category, description, amount, employee_id, account_id, spent_at, created_by)
    values (p_category, p_description, p_amount, p_employee, p_account, coalesce(p_date, current_date), auth.uid());
  if p_account is not null then
    update public.company_accounts set balance = balance - p_amount where id = p_account;
  end if;
  perform public.log_action('تسجيل منصرف', p_category || ' — ' || p_amount::text || ' ج.س');
end $$;

-- صرف رواتب كل الموظفين النشطين دفعة واحدة (لشهر) — للمالك.
create or replace function public.pay_salaries(p_account uuid, p_note text default null)
returns numeric language plpgsql security definer set search_path = public as $$
declare v_total numeric := 0; r record;
begin
  if not public.is_admin() then raise exception 'غير مصرّح'; end if;
  for r in select id, name, salary from public.hr_employees where active and salary > 0 loop
    insert into public.expenses (category, description, amount, employee_id, account_id, created_by)
      values ('salary', coalesce(p_note,'راتب') || ' — ' || r.name, r.salary, r.id, p_account, auth.uid());
    v_total := v_total + r.salary;
  end loop;
  if p_account is not null and v_total > 0 then
    update public.company_accounts set balance = balance - v_total where id = p_account;
  end if;
  perform public.log_action('صرف رواتب', v_total::text || ' ج.س');
  return v_total;
end $$;

-- ============================================================
--  الميزانية حسب البنود (نِسَب من الإيراد) — شهري/سنوي
-- ============================================================
create table if not exists public.budget_plan (
  category text primary key,           -- salary/rent/fuel/maintenance/marketing/other
  percent  numeric(5,2) not null default 0
);
insert into public.budget_plan (category, percent) values
  ('salary',30),('rent',10),('fuel',10),('maintenance',10),('marketing',5),('other',5)
  on conflict (category) do nothing;
alter table public.budget_plan enable row level security;
drop policy if exists "owner budget" on public.budget_plan;
create policy "owner budget" on public.budget_plan
  for all using (public.is_admin()) with check (public.is_admin());

-- المالك يضبط نسبة بند.
create or replace function public.set_budget(p_category text, p_percent numeric)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'غير مصرّح'; end if;
  insert into public.budget_plan (category, percent) values (p_category, p_percent)
    on conflict (category) do update set percent = excluded.percent;
end $$;

-- تقرير الميزانية للفترة:
--  المجمّع (pool) = رصيد الحسابات البنكية الحالي + منصرفات الفترة
--  (أي المبلغ قبل صرف هذه الفترة، فيبقى تخصيص كل بند ثابتاً رغم الخصم).
--  المخصّص = المجمّع × النسبة، والمتاح = المخصّص − المصروف.
create or replace function public.budget_report(p_scope text)
returns table (category text, percent numeric, allocated numeric, spent numeric, income numeric)
language plpgsql stable security definer set search_path = public as $$
declare v_start date; v_pool numeric; v_period_spent numeric;
begin
  if not public.is_admin() then raise exception 'غير مصرّح'; end if;
  v_start := case when p_scope = 'year' then date_trunc('year', now())::date
                  else date_trunc('month', now())::date end;
  select coalesce(sum(amount),0) into v_period_spent from public.expenses where spent_at >= v_start;
  -- المجمّع = «نصيبي» (العمولة − كل المنصرفات + المُستدان) + منصرفات الفترة (لتثبيت التخصيص).
  v_pool := (
    (select coalesce(-sum(amount),0) from public.transactions where type='commission')
    - (select coalesce(sum(amount),0) from public.expenses)
    + (select coalesce(sum(amount),0) from public.loans where active)
  ) + v_period_spent;
  return query
    select b.category, b.percent,
           round(v_pool * b.percent / 100, 2) as allocated,
           coalesce((select sum(e.amount) from public.expenses e
                     where e.category = b.category and e.spent_at >= v_start), 0) as spent,
           v_pool as income
    from public.budget_plan b
    order by b.percent desc;
end $$;

-- ============================================================
--  الخزينة: فصل أموال العملاء/السائقين عن «نصيبي» (العمولة) + الاستدانة
-- ============================================================
create table if not exists public.loans (
  id         uuid primary key default gen_random_uuid(),
  source     text not null default 'customer',   -- customer / driver
  amount     numeric(14,2) not null,
  note       text,
  active     boolean not null default true,        -- true = دَين لم يُسدَّد بعد
  created_at timestamptz not null default now()
);
alter table public.loans enable row level security;
drop policy if exists "owner loans" on public.loans;
create policy "owner loans" on public.loans
  for all using (public.is_admin()) with check (public.is_admin());

-- الصورة المالية: أمانات العملاء/السائقين + العمولة + المنصرفات + المُستدان + المتاح.
create or replace function public.company_finance()
returns table (
  customer_float numeric, driver_float numeric,
  commission numeric, expenses numeric, borrowed numeric, treasury numeric
) language plpgsql stable security definer set search_path = public as $$
declare v_cust numeric; v_drv numeric; v_comm numeric; v_exp numeric; v_borrow numeric;
begin
  if not public.is_admin() then raise exception 'غير مصرّح'; end if;
  select coalesce(sum(w.balance),0) into v_cust
    from public.wallets w join public.users u on u.id = w.user_id where u.role = 'customer';
  select coalesce(sum(w.balance),0) into v_drv
    from public.wallets w join public.users u on u.id = w.user_id where u.role = 'driver';
  select coalesce(-sum(amount),0) into v_comm from public.transactions where type = 'commission';
  select coalesce(sum(amount),0) into v_exp from public.expenses;
  select coalesce(sum(amount),0) into v_borrow from public.loans where active;
  return query select v_cust, v_drv, v_comm, v_exp, v_borrow, (v_comm - v_exp + v_borrow);
end $$;

-- استدانة من محفظة العملاء/السائقين لحسابنا (تزيد المتاح، كدَين).
create or replace function public.borrow_from_float(p_source text, p_amount numeric, p_note text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'غير مصرّح'; end if;
  insert into public.loans (source, amount, note) values (p_source, p_amount, p_note);
  perform public.log_action('استدانة من المحافظ',
    (case p_source when 'driver' then 'السائقين' else 'العملاء' end) || ' — ' || p_amount::text || ' ج.س');
end $$;

-- سداد دَين (يعيد المبلغ، فينقص المتاح).
create or replace function public.repay_loan(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'غير مصرّح'; end if;
  update public.loans set active = false where id = p_id;
  perform public.log_action('سداد استدانة', p_id::text);
end $$;


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
  for select using (public.is_staff_or_admin());

drop policy if exists "admin read wallets" on public.wallets;
create policy "admin read wallets" on public.wallets
  for select using (public.is_staff_or_admin());

drop policy if exists "admin read topups" on public.topups;
create policy "admin read topups" on public.topups
  for select using (public.is_staff_or_admin());

-- الأدمن يقرأ كل السائقين والرحلات والمعاملات (للقوائم والملخّص المالي)
drop policy if exists "admin read drivers" on public.drivers;
create policy "admin read drivers" on public.drivers
  for select using (public.is_staff_or_admin());

drop policy if exists "admin read rides" on public.rides;
create policy "admin read rides" on public.rides
  for select using (public.is_staff_or_admin());

drop policy if exists "admin read transactions" on public.transactions;
create policy "admin read transactions" on public.transactions
  for select using (public.is_staff_or_admin());

-- ملخّص مالي للمنصة (أدمن فقط) — إجماليات من جدول المعاملات والمحافظ.
create or replace function public.admin_financial_summary()
returns table (
  platform_commission numeric,   -- إجمالي عمولة المنصة
  total_topups        numeric,   -- إجمالي التعبئات المعتمدة
  ride_payments       numeric,   -- إجمالي ما دفعه العملاء (محفظة)
  driver_earnings     numeric,   -- إجمالي أرباح السائقين (إجمالي الأجرة)
  completed_rides     bigint,    -- عدد الرحلات المكتملة
  wallet_liability    numeric    -- مجموع أرصدة كل المحافظ
) language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_staff_or_admin() then raise exception 'غير مصرّح'; end if;
  return query
    select
      coalesce(-sum(t.amount) filter (where t.type = 'commission'), 0),
      coalesce( sum(t.amount) filter (where t.type = 'topup'), 0),
      coalesce(-sum(t.amount) filter (where t.type = 'ride_payment'), 0),
      coalesce( sum(t.amount) filter (where t.type = 'ride_earning'), 0),
      (select count(*) from public.rides where status = 'completed'),
      coalesce((select sum(balance) from public.wallets), 0)
    from public.transactions t;
end $$;

-- الطوارئ: المستخدم يُطلق تنبيهه، ويقرؤه هو أو الأدمن، والأدمن يعالجه.
drop policy if exists "raise own sos" on public.sos_alerts;
create policy "raise own sos" on public.sos_alerts
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "read sos" on public.sos_alerts;
create policy "read sos" on public.sos_alerts
  for select using (auth.uid() = user_id or public.is_staff_or_admin());

drop policy if exists "admin update sos" on public.sos_alerts;
create policy "admin update sos" on public.sos_alerts
  for update using (public.is_staff_or_admin()) with check (public.is_staff_or_admin());

-- الأدمن يعدّل الإعدادات (العمولة + Surge + الشرائح + الحساب البنكي)
drop policy if exists "admin write settings" on public.settings;
create policy "admin write settings" on public.settings
  for update using (public.has_perm('settings')) with check (public.has_perm('settings'));

-- الأدمن يعدّل تسعير المركبات
drop policy if exists "admin write pricing" on public.service_pricing;
create policy "admin write pricing" on public.service_pricing
  for all using (public.has_perm('settings')) with check (public.has_perm('settings'));

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
  if not public.has_perm('requests') then
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

  perform public.log_action('اعتماد تعبئة', v_amount::text || ' ج.س');
end $$;

-- رفض تعبئة
create or replace function public.reject_topup(p_topup uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_perm('requests') then raise exception 'غير مصرّح'; end if;
  update public.topups
    set status = 'rejected', reviewed_by = auth.uid()
    where id = p_topup and status = 'pending';
  perform public.log_action('رفض تعبئة', 'طلب ' || substr(p_topup::text,1,8));
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
--  ترقية رقم هاتف إلى أدمن (تجاوز آمن لحاجز تغيير الدور)
--  الاستخدام في محرّر SQL:  select public.bootstrap_admin('916460666');
--  الرقم = نفس ما تكتبه في شاشة الدخول (أرقام فقط، البريد يُشتق منه).
--  اشترط تسجيل الدخول مرّة أولاً بالرقم من موقع الأدمن ليُنشأ الحساب.
-- ============================================================
create or replace function public.bootstrap_admin(p_phone text)
returns text language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_n int;
begin
  select id into v_id from auth.users
    where email = regexp_replace(p_phone, '\D', '', 'g') || '@qareeb.sd';
  if v_id is null then
    return 'لا يوجد حساب بهذا الرقم — سجّل الدخول أولاً بالرقم ' || p_phone || ' من موقع الأدمن ثم أعد المحاولة.';
  end if;
  alter table public.users disable trigger prevent_role_change;
  update public.users set role = 'admin' where id = v_id;
  get diagnostics v_n = row_count;
  alter table public.users enable trigger prevent_role_change;
  if v_n = 0 then
    return 'الحساب موجود بالمصادقة بلا صف مستخدم — افتح موقع الأدمن مرّة ثم أعد المحاولة.';
  end if;
  return 'تم ✓ الرقم ' || p_phone || ' صار أدمن — سجّل خروجاً ثم دخولاً من جديد.';
end $$;

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
  for select using (public.is_staff_or_admin());

-- (منع ترقية الدور ذاتياً مُعرّف أعلاه — trigger واحد يكفي.)

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

-- الأدمن يحذف سائقاً: يزيل صفّه من drivers ويعيد دور المستخدم لعميل.
create or replace function public.admin_delete_driver(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_perm('drivers') then raise exception 'غير مصرّح'; end if;
  delete from public.drivers where user_id = p_user;
  update public.users set role = 'customer' where id = p_user and role = 'driver';
  perform public.log_action('حذف سائق', (select full_name from public.users where id = p_user));
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

-- إلغاء الرحلة:
--   • العميل يلغيها (قبل بدء الرحلة) → cancelled.
--   • السائق يتخلّى عنها (بعد القبول/الوصول) → تعود searching بلا سائق.
create or replace function public.cancel_ride(p_ride uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_customer uuid;
  v_driver   uuid;
  v_status   ride_status;
begin
  select customer_id, driver_id, status
    into v_customer, v_driver, v_status
    from public.rides where id = p_ride for update;

  if v_customer is null then raise exception 'الرحلة غير موجودة'; end if;
  if v_status in ('completed', 'cancelled') then
    raise exception 'لا يمكن إلغاء هذه الرحلة';
  end if;

  if auth.uid() = v_customer then
    if v_status not in ('requested', 'searching', 'accepted', 'arrived') then
      raise exception 'لا يمكن الإلغاء بعد بدء الرحلة';
    end if;
    update public.rides set status = 'cancelled' where id = p_ride;
  elsif auth.uid() = v_driver then
    if v_status not in ('accepted', 'arrived') then
      raise exception 'لا يمكن التخلّي عن الرحلة الآن';
    end if;
    update public.rides set status = 'searching', driver_id = null where id = p_ride;
  else
    raise exception 'غير مصرّح';
  end if;
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
  if not public.has_perm('requests') then raise exception 'غير مصرّح'; end if;

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
  perform public.log_action('اعتماد سائق',
    (select full_name from public.users where id = v_user) || ' — ' || v_plate);
end $$;

-- رفض طلب سائق (مع سبب اختياري)
create or replace function public.reject_driver_application(p_app uuid, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_name text;
begin
  if not public.has_perm('requests') then raise exception 'غير مصرّح'; end if;
  select full_name into v_name from public.driver_applications where id = p_app;
  update public.driver_applications
    set status = 'rejected', review_note = p_note, reviewed_by = auth.uid(), updated_at = now()
    where id = p_app and status = 'pending';
  perform public.log_action('رفض سائق', coalesce(v_name, '') || coalesce(' — ' || p_note, ''));
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
    foreach t in array array['rides', 'commute_orders', 'commute_members', 'driver_applications', 'sos_alerts'] loop
      if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
      ) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;
