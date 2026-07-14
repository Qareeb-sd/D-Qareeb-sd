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
alter table public.users add column if not exists birthdate date;   -- تاريخ الميلاد (يُدخَل عند إنشاء الحساب)

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
  commission_rate numeric(4,3),                     -- نسبة العمولة لهذا النوع (0..1)؛ null = استخدم العمولة العامة
  sort_order   int not null default 0,
  active       boolean not null default true,
  updated_at   timestamptz not null default now()
);
-- ترقية القواعد القديمة (إضافة عمود العمولة إن لم يكن موجوداً)
alter table public.service_pricing add column if not exists commission_rate numeric(4,3);

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
  v_service     text;
  v_rate        numeric;
  v_commission  numeric;
  v_net         numeric;
  v_dwallet     uuid;
  v_cwallet     uuid;
  v_cbalance    numeric;
begin
  select driver_id, customer_id, fare, status, payment_method, service_id
    into v_driver_user, v_customer, v_fare, v_status, v_payment, v_service
    from public.rides where id = p_ride for update;

  if v_driver_user is null then raise exception 'الرحلة بلا سائق'; end if;
  if auth.uid() <> v_driver_user and not public.is_admin() then
    raise exception 'غير مصرّح';
  end if;
  if v_status = 'completed' then raise exception 'الرحلة مسوّاة مسبقاً'; end if;
  if v_status = 'cancelled' then raise exception 'الرحلة ملغاة'; end if;

  -- عمولة النوع إن ضُبطت، وإلا العمولة العامة من الإعدادات.
  v_rate := coalesce(
    (select commission_rate from public.service_pricing where service_id = v_service),
    (select commission_rate from public.settings where id = 1)
  );
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
--  ملاحظة: التعريف الفعلي (٧ أعمدة: يضيف صورتَي السائق والمركبة) موجود
--  أدناه في قسم «المساءلة» ومسبوق بـ drop — لتفادي تعارض تغيير نوع الإرجاع
--  عند إعادة التشغيل. لذا لا نُعرّفها هنا.
-- ============================================================

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

-- ============================================================
--  التقييمات والشكاوى (متبادلة بين العميل والسائق)
--  العميل يقيّم السائق ويشكوه، والسائق يقيّم العميل ويشكوه.
--  الشكاوى تظهر للأدمن، ومتوسط التقييم يُخزَّن على المستخدم.
-- ============================================================

create table if not exists public.reviews (
  id               uuid primary key default gen_random_uuid(),
  ride_id          uuid not null references public.rides(id) on delete cascade,
  rater_id         uuid not null references public.users(id) on delete cascade,  -- المُقيِّم
  ratee_id         uuid not null references public.users(id) on delete cascade,  -- المُقيَّم
  rater_role       text not null check (rater_role in ('customer','driver')),
  stars            int  not null check (stars between 1 and 5),
  complaint        text,                                     -- شكوى اختيارية
  complaint_status text not null default 'open',             -- open / resolved (مع وجود شكوى)
  created_at       timestamptz not null default now(),
  unique (ride_id, rater_role)                               -- كل طرف يقيّم مرة واحدة لكل رحلة
);
create index if not exists reviews_ratee_idx on public.reviews(ratee_id);

alter table public.reviews enable row level security;
-- طرفا الرحلة يريان تقييماتها، والأدمن/الموظف يرى الكل. الإدراج عبر submit_review فقط.
drop policy if exists "read own reviews" on public.reviews;
create policy "read own reviews" on public.reviews
  for select using (
    rater_id = auth.uid() or ratee_id = auth.uid() or public.is_staff_or_admin()
  );

-- متوسط التقييم على المستخدم (يشمل العميل والسائق).
alter table public.users add column if not exists rating        numeric(2,1);
alter table public.users add column if not exists ratings_count int not null default 0;

-- تقديم تقييم/شكوى — الدور (عميل/سائق) يُستنتج من الرحلة تلقائياً.
create or replace function public.submit_review(
  p_ride uuid, p_stars int, p_complaint text default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_customer uuid; v_driver uuid; v_status ride_status;
  v_role text; v_ratee uuid; v_avg numeric; v_cnt int;
begin
  if p_stars is null or p_stars < 1 or p_stars > 5 then
    raise exception 'التقييم يجب أن يكون بين 1 و5';
  end if;
  select customer_id, driver_id, status into v_customer, v_driver, v_status
    from public.rides where id = p_ride;
  if not found then raise exception 'الرحلة غير موجودة'; end if;
  if v_status <> 'completed' then raise exception 'لا يمكن التقييم قبل انتهاء الرحلة'; end if;

  if auth.uid() = v_customer then
    v_role := 'customer'; v_ratee := v_driver;
  elsif auth.uid() = v_driver then
    v_role := 'driver'; v_ratee := v_customer;
  else
    raise exception 'غير مصرّح — لست طرفاً في هذه الرحلة';
  end if;
  if v_ratee is null then raise exception 'لا يوجد طرف آخر لتقييمه'; end if;

  insert into public.reviews (ride_id, rater_id, ratee_id, rater_role, stars, complaint)
    values (p_ride, auth.uid(), v_ratee, v_role, p_stars,
            nullif(btrim(coalesce(p_complaint, '')), ''))
  on conflict (ride_id, rater_role) do update
    set stars            = excluded.stars,
        complaint        = excluded.complaint,
        complaint_status = case when excluded.complaint is not null then 'open' else 'resolved' end,
        created_at       = now();

  -- إعادة حساب متوسط تقييم المُقيَّم.
  select round(avg(stars)::numeric, 1), count(*) into v_avg, v_cnt
    from public.reviews where ratee_id = v_ratee;
  update public.users   set rating = v_avg, ratings_count = v_cnt where id = v_ratee;
  update public.drivers set rating = v_avg                        where user_id = v_ratee;
end $$;
grant execute on function public.submit_review(uuid, int, text) to authenticated;

-- قائمة العملاء المسجّلين وتقييماتهم (للأدمن/الموظف).
create or replace function public.admin_list_customers()
returns table (
  id uuid, full_name text, phone text, rating numeric,
  ratings_count int, rides_count bigint, created_at timestamptz
) language sql security definer set search_path = public as $$
  select u.id, u.full_name, u.phone, u.rating, u.ratings_count,
         (select count(*) from public.rides r where r.customer_id = u.id),
         u.created_at
    from public.users u
   where u.role = 'customer' and public.is_staff_or_admin()
   order by u.created_at desc
$$;
grant execute on function public.admin_list_customers() to authenticated;

-- قائمة الشكاوى مع أسماء الطرفين (للأدمن/الموظف) — المفتوحة أولاً.
create or replace function public.admin_list_complaints()
returns table (
  id uuid, ride_id uuid, stars int, complaint text, complaint_status text,
  rater_role text, rater_name text, ratee_name text, created_at timestamptz
) language sql security definer set search_path = public as $$
  select rv.id, rv.ride_id, rv.stars, rv.complaint, rv.complaint_status,
         rv.rater_role, ur.full_name, ue.full_name, rv.created_at
    from public.reviews rv
    join public.users ur on ur.id = rv.rater_id
    join public.users ue on ue.id = rv.ratee_id
   where rv.complaint is not null and public.is_staff_or_admin()
   order by (rv.complaint_status = 'open') desc, rv.created_at desc
$$;
grant execute on function public.admin_list_complaints() to authenticated;

-- إغلاق شكوى (تعليمها محلولة).
create or replace function public.admin_resolve_complaint(p_review uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff_or_admin() then raise exception 'غير مصرّح'; end if;
  update public.reviews set complaint_status = 'resolved' where id = p_review;
  perform public.log_action('حلّ شكوى', p_review::text);
end $$;
grant execute on function public.admin_resolve_complaint(uuid) to authenticated;

-- ============================================================
--  مشاركة الرحلة المباشرة (تتبّع لطرف ثالث برمز)
--  العميل أو السائق يولّد رمزاً، ويشاركه مع شخص يتابع الرحلة لحظياً.
-- ============================================================

alter table public.rides add column if not exists share_token text;
create unique index if not exists rides_share_token_idx on public.rides(share_token);

-- توليد/إرجاع رمز مشاركة لرحلة (لطرفَيها فقط).
create or replace function public.ensure_ride_share(p_ride uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_customer uuid; v_driver uuid; v_token text;
begin
  select customer_id, driver_id, share_token
    into v_customer, v_driver, v_token
    from public.rides where id = p_ride;
  if not found then raise exception 'الرحلة غير موجودة'; end if;
  if auth.uid() is null
     or (auth.uid() <> v_customer and auth.uid() is distinct from v_driver) then
    raise exception 'غير مصرّح';
  end if;
  if v_token is null then
    v_token := substr(md5(gen_random_uuid()::text), 1, 8);
    update public.rides set share_token = v_token where id = p_ride;
  end if;
  return v_token;
end $$;
grant execute on function public.ensure_ride_share(uuid) to authenticated;

-- لقطة تتبّع الرحلة عبر الرمز (لأي متابع) — بيانات الموقع فقط، بلا أرقام هواتف.
create or replace function public.track_shared_ride(p_token text)
returns table (
  status ride_status, service_id text,
  pickup_lat double precision, pickup_lng double precision, pickup_address text,
  dropoff_lat double precision, dropoff_lng double precision, dropoff_address text,
  driver_lat double precision, driver_lng double precision, driver_loc_at timestamptz,
  driver_name text
) language sql security definer set search_path = public as $$
  select r.status, r.service_id,
         r.pickup_lat, r.pickup_lng, r.pickup_address,
         r.dropoff_lat, r.dropoff_lng, r.dropoff_address,
         r.driver_lat, r.driver_lng, r.driver_loc_at,
         u.full_name
    from public.rides r
    left join public.users u on u.id = r.driver_id
   where r.share_token = p_token
$$;
grant execute on function public.track_shared_ride(text) to anon, authenticated;

-- ============================================================
--  الخدمات الديناميكية: حقول العرض + الحالة + صور الاستضافة
--  يتيح إضافة/تعديل مركبة من لوحة الأدمن دون تحديث التطبيق.
-- ============================================================
alter table public.service_pricing
  add column if not exists tagline               text,
  add column if not exists seats                 int  not null default 4,
  add column if not exists art                   text not null default 'sedan',
  add column if not exists tint                  text not null default '#EDEFEC',
  add column if not exists image_url             text,
  add column if not exists female_driver         boolean not null default false,
  add column if not exists sharable              boolean not null default true,
  add column if not exists destination_optional  boolean not null default false,
  add column if not exists noun                  text,
  add column if not exists state                 text not null default 'available';

-- الحالة ضمن القيم المسموحة
alter table public.service_pricing drop constraint if exists service_state_chk;
alter table public.service_pricing
  add constraint service_state_chk check (state in ('available','maintenance','coming_soon','hidden'));

-- تعبئة حقول العرض للمركبات الأساسية (لا يمسّ ما عُدّل يدوياً)
update public.service_pricing set tagline=coalesce(tagline,'سيارة عادية · اقتصادي وسريع'), art='sedan',    tint='#EDEFEC', seats=4,  noun=coalesce(noun,'السيارة'), sharable=true                      where service_id='standard';
update public.service_pricing set tagline=coalesce(tagline,'سائقة · للنساء والعائلات'),    art='ladies',   tint='#E85C9E', seats=4,  noun=coalesce(noun,'السيارة'), female_driver=true, sharable=true  where service_id='ladies';
update public.service_pricing set tagline=coalesce(tagline,'داماس · نقل عائلي'),           art='microbus', tint='#3A6FB0', seats=7,  noun=coalesce(noun,'الأمجاد'), sharable=true                      where service_id='amjad';
update public.service_pricing set tagline=coalesce(tagline,'11 راكب · للمجموعات'),         art='van',      tint='#CED2CE', seats=11, noun=coalesce(noun,'الهايس'),  sharable=true                      where service_id='hiace';
update public.service_pricing set tagline=coalesce(tagline,'مشاوير قصيرة · اقتصادي'),      art='rickshaw', tint='#2B2F2C', seats=3,  noun=coalesce(noun,'الركشة'),  sharable=true                      where service_id='rickshaw';
update public.service_pricing set tagline=coalesce(tagline,'استأجر بالساعة أو اليوم'),     art='sedan',    tint='#EDEFEC', seats=4,  noun=coalesce(noun,'السيارة'), sharable=true, destination_optional=true where service_id='open';
update public.service_pricing set tagline=coalesce(tagline,'سطحة · نقل وإنقاذ المركبات'),  art='tow',      tint='#EDEFEC', seats=2,  noun=coalesce(noun,'السطحة'),  sharable=false                     where service_id='tow';

-- bucket صور المركبات (قراءة عامة — يقرأها التطبيق بالرابط)
insert into storage.buckets (id, name, public) values ('vehicles','vehicles', true)
  on conflict (id) do nothing;

-- كتابة صور المركبات: للأدمن (صلاحية settings) فقط؛ القراءة عامة تلقائياً
drop policy if exists "admin write vehicles" on storage.objects;
create policy "admin write vehicles" on storage.objects
  for all to authenticated
  using (bucket_id = 'vehicles' and public.has_perm('settings'))
  with check (bucket_id = 'vehicles' and public.has_perm('settings'));

-- ============================================================
--  رموز التحقق (OTP) عبر واتساب — تُدار حصراً عبر Edge Functions
--  بمفتاح service_role. يخزّن تجزئة الرمز فقط (لا الرمز الصريح).
--  لا سياسات RLS = لا وصول من العميل إطلاقاً؛ الدوال تتجاوز RLS.
-- ============================================================
create table if not exists public.otp_codes (
  phone        text primary key,
  code_hash    text not null,
  expires_at   timestamptz not null,
  attempts     int not null default 0,
  last_sent_at timestamptz not null default now()
);
alter table public.otp_codes enable row level security;
-- عمداً بلا سياسات: يُمنع كل وصول من مفتاح anon/authenticated.

-- ============================================================
--  الدفع المسبق بالمحفظة: عند اختيار «محفظة قريب» يُخصم فوراً عند الطلب.
--  عند الإكمال لا يُخصم من العميل ثانيةً (يُقيَّد للسائق فقط)؛ وعند الإلغاء
--  يُسترجَع للعميل. الكاش/التحويل يبقى كما هو (تسوية عند الإكمال).
-- ============================================================
alter table public.rides add column if not exists prepaid boolean not null default false;

-- خصم الأجرة مسبقاً من محفظة العميل (يستدعيه العميل عند تأكيد رحلة محفظة).
create or replace function public.prepay_ride(p_ride uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_customer uuid; v_fare numeric; v_payment payment_method;
  v_prepaid boolean; v_status ride_status; v_wallet uuid; v_bal numeric;
begin
  select customer_id, fare, payment_method, prepaid, status
    into v_customer, v_fare, v_payment, v_prepaid, v_status
    from public.rides where id = p_ride for update;
  if v_customer is null then raise exception 'الرحلة غير موجودة'; end if;
  if auth.uid() <> v_customer then raise exception 'غير مصرّح'; end if;
  if v_payment <> 'wallet' then return; end if;      -- الدفع المسبق للمحفظة فقط
  if v_prepaid then return; end if;                  -- مدفوعة مسبقاً
  if v_status in ('completed','cancelled') then raise exception 'لا يمكن الدفع لهذه الرحلة'; end if;
  v_fare := coalesce(v_fare, 0);
  select id, balance into v_wallet, v_bal from public.wallets where user_id = v_customer for update;
  if v_wallet is null then raise exception 'المحفظة غير موجودة'; end if;
  if v_bal < v_fare then raise exception 'رصيد المحفظة غير كافٍ'; end if;
  update public.wallets set balance = balance - v_fare, updated_at = now() where id = v_wallet;
  insert into public.transactions (wallet_id, type, amount, ride_id, note)
    values (v_wallet, 'ride_payment', -v_fare, p_ride, 'دفع مسبق (محفظة)');
  update public.rides set prepaid = true where id = p_ride;
end $$;
grant execute on function public.prepay_ride(uuid) to authenticated;

-- تسوية الرحلة (نسخة محدّثة): تتخطّى خصم العميل إن كانت مدفوعة مسبقاً.
create or replace function public.settle_ride(p_ride uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_driver_user uuid; v_customer uuid; v_fare numeric; v_status ride_status;
  v_payment payment_method; v_service text; v_rate numeric; v_commission numeric;
  v_net numeric; v_dwallet uuid; v_cwallet uuid; v_cbalance numeric; v_prepaid boolean;
begin
  select driver_id, customer_id, fare, status, payment_method, service_id, prepaid
    into v_driver_user, v_customer, v_fare, v_status, v_payment, v_service, v_prepaid
    from public.rides where id = p_ride for update;

  if v_driver_user is null then raise exception 'الرحلة بلا سائق'; end if;
  if auth.uid() <> v_driver_user and not public.is_admin() then raise exception 'غير مصرّح'; end if;
  if v_status = 'completed' then raise exception 'الرحلة مسوّاة مسبقاً'; end if;
  if v_status = 'cancelled' then raise exception 'الرحلة ملغاة'; end if;

  v_rate := coalesce(
    (select commission_rate from public.service_pricing where service_id = v_service),
    (select commission_rate from public.settings where id = 1));
  v_fare       := coalesce(v_fare, 0);
  v_commission := round(v_fare * coalesce(v_rate, 0));
  v_net        := v_fare - v_commission;

  -- خصم من العميل عند الدفع بالمحفظة فقط إن لم يُدفع مسبقاً.
  if v_payment = 'wallet' and not v_prepaid then
    select id, balance into v_cwallet, v_cbalance from public.wallets where user_id = v_customer for update;
    if v_cwallet is null then raise exception 'محفظة العميل غير موجودة'; end if;
    if v_cbalance < v_fare then raise exception 'رصيد محفظة العميل غير كافٍ'; end if;
    update public.wallets set balance = balance - v_fare, updated_at = now() where id = v_cwallet;
    insert into public.transactions (wallet_id, type, amount, ride_id, note)
      values (v_cwallet, 'ride_payment', -v_fare, p_ride, 'دفع رحلة');
  end if;

  update public.rides set status = 'completed' where id = p_ride;

  select id into v_dwallet from public.wallets where user_id = v_driver_user for update;
  if v_dwallet is not null then
    if v_payment = 'wallet' then
      update public.wallets set balance = balance + v_net, updated_at = now() where id = v_dwallet;
      insert into public.transactions (wallet_id, type, amount, ride_id, note) values
        (v_dwallet, 'ride_earning', v_fare,        p_ride, 'أرباح رحلة (إجمالي)'),
        (v_dwallet, 'commission',   -v_commission, p_ride, 'عمولة المنصة');
    else
      update public.wallets set balance = balance - v_commission, updated_at = now() where id = v_dwallet;
      insert into public.transactions (wallet_id, type, amount, ride_id, note) values
        (v_dwallet, 'commission', -v_commission, p_ride, 'عمولة المنصة (نقدي/تحويل)');
    end if;
  end if;
end $$;

-- إلغاء الرحلة (نسخة محدّثة): تسترجع الدفع المسبق للعميل عند الإلغاء.
create or replace function public.cancel_ride(p_ride uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_customer uuid; v_driver uuid; v_status ride_status;
  v_fare numeric; v_prepaid boolean; v_cwallet uuid;
begin
  select customer_id, driver_id, status, fare, prepaid
    into v_customer, v_driver, v_status, v_fare, v_prepaid
    from public.rides where id = p_ride for update;

  if v_customer is null then raise exception 'الرحلة غير موجودة'; end if;
  if v_status in ('completed', 'cancelled') then raise exception 'لا يمكن إلغاء هذه الرحلة'; end if;

  if auth.uid() = v_customer then
    if v_status not in ('requested', 'searching', 'accepted', 'arrived') then
      raise exception 'لا يمكن الإلغاء بعد بدء الرحلة';
    end if;
    update public.rides set status = 'cancelled' where id = p_ride;
    -- استرجاع الدفع المسبق (إن وُجد).
    if v_prepaid then
      select id into v_cwallet from public.wallets where user_id = v_customer for update;
      if v_cwallet is not null then
        update public.wallets set balance = balance + coalesce(v_fare,0), updated_at = now() where id = v_cwallet;
        insert into public.transactions (wallet_id, type, amount, ride_id, note)
          values (v_cwallet, 'topup', coalesce(v_fare,0), p_ride, 'استرجاع دفع رحلة ملغاة');
      end if;
      update public.rides set prepaid = false where id = p_ride;
    end if;
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
--  المساءلة والشفافية:
--   • صورة السائق + صورة المركبة تظهران للعميل عند القبول.
--   • التقييم يسأل: هل السائق/المركبة نفسها؟ عدم التطابق = مخالفة «حساب مُعار»
--     تظهر للأدمن.
--   • قائمة رحلات الأدمن بتفاصيل الطرفين والمركبة (للسلطات عند الطلب).
-- ============================================================

-- bucket عام لصور العرض (يقرأها العميل بالرابط). الوثائق السرّية تبقى في driver-docs.
insert into storage.buckets (id, name, public) values ('driver-photos','driver-photos', true)
  on conflict (id) do nothing;
drop policy if exists "upload own driver photo" on storage.objects;
create policy "upload own driver photo" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'driver-photos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "update own driver photo" on storage.objects;
create policy "update own driver photo" on storage.objects
  for update to authenticated
  using (bucket_id = 'driver-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- روابط صور العرض على الطلب والسائق
alter table public.driver_applications add column if not exists driver_photo_url  text;
alter table public.driver_applications add column if not exists vehicle_photo_url text;
alter table public.drivers add column if not exists photo_url         text;
alter table public.drivers add column if not exists vehicle_photo_url text;

-- أعلام عدم تطابق السائق/المركبة على التقييم
alter table public.reviews add column if not exists driver_mismatch  boolean not null default false;
alter table public.reviews add column if not exists vehicle_mismatch boolean not null default false;

-- اعتماد طلب سائق (نسخة محدّثة): تنسخ صور العرض إلى صفّ السائق.
create or replace function public.approve_driver_application(p_app uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_user uuid; v_vtype text; v_plate text; v_status driver_app_status; v_driver uuid;
  v_photo text; v_vphoto text;
begin
  if not public.has_perm('requests') then raise exception 'غير مصرّح'; end if;

  select user_id, vehicle_type, plate_number, status, driver_photo_url, vehicle_photo_url
    into v_user, v_vtype, v_plate, v_status, v_photo, v_vphoto
    from public.driver_applications where id = p_app for update;

  if v_user is null then raise exception 'الطلب غير موجود'; end if;
  if v_status <> 'pending' then raise exception 'الطلب روجع مسبقاً'; end if;

  update public.driver_applications
    set status = 'approved', reviewed_by = auth.uid(), updated_at = now()
    where id = p_app;

  select id into v_driver from public.drivers where user_id = v_user;
  if v_driver is null then
    insert into public.drivers (user_id, vehicle_type, plate_number, photo_url, vehicle_photo_url)
      values (v_user, v_vtype, v_plate, v_photo, v_vphoto);
  else
    update public.drivers
      set vehicle_type = v_vtype, plate_number = v_plate,
          photo_url = coalesce(v_photo, photo_url),
          vehicle_photo_url = coalesce(v_vphoto, vehicle_photo_url)
      where id = v_driver;
  end if;

  update public.users set role = 'driver' where id = v_user;
  perform public.log_action('اعتماد سائق',
    (select full_name from public.users where id = v_user) || ' — ' || v_plate);
end $$;

-- بيانات السائق المُسنَد (نسخة محدّثة): تضيف صورتَي السائق والمركبة.
drop function if exists public.get_ride_driver(uuid);
create or replace function public.get_ride_driver(p_ride uuid)
returns table (
  full_name text, phone text, rating numeric, vehicle_type text, plate_number text,
  photo_url text, vehicle_photo_url text
) language sql stable security definer set search_path = public as $$
  select u.full_name, u.phone, d.rating, d.vehicle_type, d.plate_number, d.photo_url, d.vehicle_photo_url
  from public.rides r
  join public.users u on u.id = r.driver_id
  left join public.drivers d on d.user_id = r.driver_id
  where r.id = p_ride
    and (auth.uid() = r.customer_id or auth.uid() = r.driver_id or public.is_admin());
$$;

-- تقديم تقييم (نسخة محدّثة): يقبل علامتَي عدم التطابق ويسجّلهما كمخالفة/شكوى.
drop function if exists public.submit_review(uuid, int, text);
create or replace function public.submit_review(
  p_ride uuid, p_stars int, p_complaint text default null,
  p_driver_mismatch boolean default false, p_vehicle_mismatch boolean default false
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_customer uuid; v_driver uuid; v_status ride_status;
  v_role text; v_ratee uuid; v_avg numeric; v_cnt int; v_complaint text;
begin
  if p_stars is null or p_stars < 1 or p_stars > 5 then
    raise exception 'التقييم يجب أن يكون بين 1 و5';
  end if;
  select customer_id, driver_id, status into v_customer, v_driver, v_status
    from public.rides where id = p_ride;
  if not found then raise exception 'الرحلة غير موجودة'; end if;
  if v_status <> 'completed' then raise exception 'لا يمكن التقييم قبل انتهاء الرحلة'; end if;

  if auth.uid() = v_customer then
    v_role := 'customer'; v_ratee := v_driver;
  elsif auth.uid() = v_driver then
    v_role := 'driver'; v_ratee := v_customer;
  else
    raise exception 'غير مصرّح — لست طرفاً في هذه الرحلة';
  end if;
  if v_ratee is null then raise exception 'لا يوجد طرف آخر لتقييمه'; end if;

  -- بناء نص الشكوى: يضمّ ملاحظة العميل + أي مخالفة تطابق.
  v_complaint := nullif(btrim(coalesce(p_complaint, '')), '');
  if p_driver_mismatch then
    v_complaint := concat_ws(' | ', v_complaint, 'مخالفة: السائق يختلف عن المسجّل (حساب مُعار)');
  end if;
  if p_vehicle_mismatch then
    v_complaint := concat_ws(' | ', v_complaint, 'مخالفة: المركبة تختلف عن المسجّلة');
  end if;

  insert into public.reviews
    (ride_id, rater_id, ratee_id, rater_role, stars, complaint, driver_mismatch, vehicle_mismatch, complaint_status)
  values
    (p_ride, auth.uid(), v_ratee, v_role, p_stars, v_complaint, p_driver_mismatch, p_vehicle_mismatch,
     case when v_complaint is not null then 'open' else 'resolved' end)
  on conflict (ride_id, rater_role) do update
    set stars            = excluded.stars,
        complaint        = excluded.complaint,
        driver_mismatch  = excluded.driver_mismatch,
        vehicle_mismatch = excluded.vehicle_mismatch,
        complaint_status = case when excluded.complaint is not null then 'open' else 'resolved' end,
        created_at       = now();

  select round(avg(stars)::numeric, 1), count(*) into v_avg, v_cnt
    from public.reviews where ratee_id = v_ratee;
  update public.users   set rating = v_avg, ratings_count = v_cnt where id = v_ratee;
  update public.drivers set rating = v_avg                        where user_id = v_ratee;
end $$;
grant execute on function public.submit_review(uuid, int, text, boolean, boolean) to authenticated;

-- قائمة رحلات الأدمن بتفاصيل الطرفين والمركبة (للسلطات) + أعلام المخالفة.
create or replace function public.admin_list_rides(p_limit int default 100)
returns table (
  id uuid, status ride_status, service_id text, fare numeric, payment_method payment_method,
  prepaid boolean, created_at timestamptz,
  customer_name text, customer_phone text,
  driver_name text, driver_phone text, plate_number text, vehicle_type text,
  pickup_address text, dropoff_address text,
  driver_mismatch boolean, vehicle_mismatch boolean
) language sql stable security definer set search_path = public as $$
  select r.id, r.status, r.service_id, r.fare, r.payment_method, r.prepaid, r.created_at,
         cu.full_name, cu.phone,
         du.full_name, du.phone, d.plate_number, d.vehicle_type,
         r.pickup_address, r.dropoff_address,
         coalesce(rv.driver_mismatch, false), coalesce(rv.vehicle_mismatch, false)
    from public.rides r
    left join public.users cu on cu.id = r.customer_id
    left join public.users du on du.id = r.driver_id
    left join public.drivers d on d.user_id = r.driver_id
    left join public.reviews rv on rv.ride_id = r.id and rv.rater_role = 'customer'
   where public.is_staff_or_admin()
   order by r.created_at desc
   limit p_limit;
$$;
grant execute on function public.admin_list_rides(int) to authenticated;

-- ============================================================
--  منع أكثر من رحلة نشطة للعميل الواحد (دفاع على مستوى القاعدة).
--  ملفوف في do-block: إن وُجدت رحلات نشطة مكرّرة سابقاً لا يُوقف تنفيذ الملف.
-- ============================================================
do $$ begin
  create unique index if not exists rides_one_active_per_customer
    on public.rides (customer_id)
    where status in ('requested','searching','accepted','arrived','in_progress');
exception when others then
  raise notice 'تعذّر إنشاء فهرس الرحلة النشطة الوحيدة (قد توجد رحلات نشطة مكرّرة): %', sqlerrm;
end $$;

-- ============================================================
--  البرومو كود (خصم للعملاء) + إعفاء عمولة السائق + سائق VIP
-- ============================================================

-- أكواد الخصم — تُدار من لوحة الأدمن (صلاحية settings).
create table if not exists public.promo_codes (
  code           text primary key,
  discount_type  text not null default 'percent',   -- percent | fixed
  discount_value numeric(12,2) not null,             -- % أو مبلغ ثابت (ج.س)
  active         boolean not null default true,
  max_uses       int,                                -- null = بلا حدّ
  min_fare       numeric(12,2) not null default 0,
  expires_at     timestamptz,
  created_at     timestamptz not null default now()
);
alter table public.promo_codes enable row level security;
drop policy if exists "staff read promo" on public.promo_codes;
create policy "staff read promo" on public.promo_codes
  for select using (public.is_staff_or_admin());
drop policy if exists "admin write promo" on public.promo_codes;
create policy "admin write promo" on public.promo_codes
  for all using (public.has_perm('settings')) with check (public.has_perm('settings'));

alter table public.rides add column if not exists promo_code text;
alter table public.rides add column if not exists discount  numeric(12,2) not null default 0;

create or replace function public.validate_promo(p_code text, p_fare numeric)
returns table (valid boolean, discount numeric, final numeric, message text)
language plpgsql stable security definer set search_path = public as $$
declare r public.promo_codes; d numeric;
begin
  select * into r from public.promo_codes where lower(code) = lower(btrim(p_code));
  if not found then return query select false, 0::numeric, p_fare, 'كود غير صحيح'; return; end if;
  if not r.active then return query select false, 0::numeric, p_fare, 'الكود غير مفعّل'; return; end if;
  if r.expires_at is not null and r.expires_at < now() then
    return query select false, 0::numeric, p_fare, 'انتهت صلاحية الكود'; return; end if;
  if p_fare < coalesce(r.min_fare, 0) then
    return query select false, 0::numeric, p_fare, 'قيمة الرحلة أقلّ من حدّ الكود'; return; end if;
  if r.max_uses is not null and
     (select count(*) from public.rides where lower(promo_code) = lower(r.code)) >= r.max_uses then
    return query select false, 0::numeric, p_fare, 'نفد استخدام الكود'; return; end if;
  d := case when r.discount_type = 'percent'
            then round(p_fare * r.discount_value / 100)
            else least(r.discount_value, p_fare) end;
  return query select true, d, greatest(0, p_fare - d), 'تم تطبيق الخصم ✓';
end $$;
grant execute on function public.validate_promo(text, numeric) to authenticated;

alter table public.drivers add column if not exists vip boolean not null default false;
alter table public.drivers add column if not exists commission_free_until timestamptz;

create or replace function public.admin_set_driver_vip(p_user uuid, p_vip boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_perm('drivers') then raise exception 'غير مصرّح'; end if;
  update public.drivers set vip = p_vip where user_id = p_user;
  perform public.log_action(case when p_vip then 'تعيين سائق VIP' else 'إلغاء VIP' end,
    (select full_name from public.users where id = p_user));
end $$;
grant execute on function public.admin_set_driver_vip(uuid, boolean) to authenticated;

create or replace function public.admin_set_driver_commission_free(p_user uuid, p_until timestamptz)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_perm('drivers') then raise exception 'غير مصرّح'; end if;
  update public.drivers set commission_free_until = p_until where user_id = p_user;
  perform public.log_action('إعفاء عمولة سائق',
    (select full_name from public.users where id = p_user) || ' حتى ' || coalesce(p_until::text,'-'));
end $$;
grant execute on function public.admin_set_driver_commission_free(uuid, timestamptz) to authenticated;

create or replace function public.settle_ride(p_ride uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_driver_user uuid; v_customer uuid; v_fare numeric; v_status ride_status;
  v_payment payment_method; v_service text; v_rate numeric; v_commission numeric;
  v_net numeric; v_dwallet uuid; v_cwallet uuid; v_cbalance numeric; v_prepaid boolean;
  v_vip boolean; v_free timestamptz;
begin
  select driver_id, customer_id, fare, status, payment_method, service_id, prepaid
    into v_driver_user, v_customer, v_fare, v_status, v_payment, v_service, v_prepaid
    from public.rides where id = p_ride for update;

  if v_driver_user is null then raise exception 'الرحلة بلا سائق'; end if;
  if auth.uid() <> v_driver_user and not public.is_admin() then raise exception 'غير مصرّح'; end if;
  if v_status = 'completed' then raise exception 'الرحلة مسوّاة مسبقاً'; end if;
  if v_status = 'cancelled' then raise exception 'الرحلة ملغاة'; end if;

  v_rate := coalesce(
    (select commission_rate from public.service_pricing where service_id = v_service),
    (select commission_rate from public.settings where id = 1));

  select vip, commission_free_until into v_vip, v_free
    from public.drivers where user_id = v_driver_user;
  if coalesce(v_vip, false) or (v_free is not null and v_free > now()) then
    v_rate := 0;
  end if;

  v_fare       := coalesce(v_fare, 0);
  v_commission := round(v_fare * coalesce(v_rate, 0));
  v_net        := v_fare - v_commission;

  if v_payment = 'wallet' and not v_prepaid then
    select id, balance into v_cwallet, v_cbalance from public.wallets where user_id = v_customer for update;
    if v_cwallet is null then raise exception 'محفظة العميل غير موجودة'; end if;
    if v_cbalance < v_fare then raise exception 'رصيد محفظة العميل غير كافٍ'; end if;
    update public.wallets set balance = balance - v_fare, updated_at = now() where id = v_cwallet;
    insert into public.transactions (wallet_id, type, amount, ride_id, note)
      values (v_cwallet, 'ride_payment', -v_fare, p_ride, 'دفع رحلة');
  end if;

  update public.rides set status = 'completed' where id = p_ride;

  select id into v_dwallet from public.wallets where user_id = v_driver_user for update;
  if v_dwallet is not null then
    if v_payment = 'wallet' then
      update public.wallets set balance = balance + v_net, updated_at = now() where id = v_dwallet;
      insert into public.transactions (wallet_id, type, amount, ride_id, note) values
        (v_dwallet, 'ride_earning', v_fare, p_ride, 'أرباح رحلة (إجمالي)');
      if v_commission > 0 then
        insert into public.transactions (wallet_id, type, amount, ride_id, note)
          values (v_dwallet, 'commission', -v_commission, p_ride, 'عمولة المنصة');
      end if;
    else
      if v_commission > 0 then
        update public.wallets set balance = balance - v_commission, updated_at = now() where id = v_dwallet;
        insert into public.transactions (wallet_id, type, amount, ride_id, note)
          values (v_dwallet, 'commission', -v_commission, p_ride, 'عمولة المنصة (نقدي/تحويل)');
      end if;
    end if;
  end if;
end $$;

-- ============================================================
--  التسعير حسب الفترة الزمنية (صباح/ظهر/مساء/ليل) — بتوقيت الخرطوم UTC+2
--  الصيغة: الأجرة = فتح العداد + (سعر الكيلومتر × كم) + (سعر الدقيقة × دقيقة)
--          ثم الحدّ الأدنى min_fare فقط (بلا سقف)، وتقرّب لأقرب 100.
--  قابلة للتعديل من لوحة الأدمن (صلاحية settings).
-- ============================================================
create table if not exists public.service_pricing_periods (
  service_id  text not null references public.service_pricing(service_id) on delete cascade,
  period      text not null check (period in ('morning','afternoon','evening','night')),
  base_fare   numeric(12,2) not null default 0,
  per_km      numeric(12,2) not null default 0,
  per_min     numeric(12,2) not null default 56,
  min_fare    numeric(12,2) not null default 0,
  updated_at  timestamptz not null default now(),
  primary key (service_id, period)
);
alter table public.service_pricing_periods enable row level security;
drop policy if exists "read pricing periods" on public.service_pricing_periods;
create policy "read pricing periods" on public.service_pricing_periods
  for select using (auth.role() = 'authenticated');
drop policy if exists "admin write pricing periods" on public.service_pricing_periods;
create policy "admin write pricing periods" on public.service_pricing_periods
  for all using (public.has_perm('settings')) with check (public.has_perm('settings'));

-- بذور التسعير حسب الفترات (تُطبَّق مرّة؛ تعديلات الأدمن تبقى بفضل do nothing).
-- الفئات: economy→standard/open/amjad · women→ladies · rickshaw · hiace · sahab→tow
insert into public.service_pricing_periods (service_id, period, base_fare, per_km, per_min, min_fare) values
  ('standard','morning',   3508, 3508, 56,  8800),
  ('standard','afternoon', 3508, 3508, 56,  8800),
  ('standard','evening',   3859, 3859, 56,  9600),
  ('standard','night',     4034, 4034, 56, 10100),
  ('open','morning',       3508, 3508, 56,  8800),
  ('open','afternoon',     3508, 3508, 56,  8800),
  ('open','evening',       3859, 3859, 56,  9600),
  ('open','night',         4034, 4034, 56, 10100),
  ('amjad','morning',      3508, 3508, 56,  8800),
  ('amjad','afternoon',    3508, 3508, 56,  8800),
  ('amjad','evening',      3859, 3859, 56,  9600),
  ('amjad','night',        4034, 4034, 56, 10100),
  ('ladies','morning',     3508, 3508, 56,  8800),
  ('ladies','afternoon',   3508, 3508, 56,  8800),
  ('ladies','evening',     3859, 3859, 56,  9600),
  ('ladies','night',       4034, 4034, 56, 10100),
  ('rickshaw','morning',   1559, 1559, 56,  3900),
  ('rickshaw','afternoon', 1559, 1559, 56,  3900),
  ('rickshaw','evening',   1715, 1715, 56,  4300),
  ('rickshaw','night',     1793, 1793, 56,  4500),
  ('hiace','morning',      5457, 5457, 56, 13600),
  ('hiace','afternoon',    5457, 5457, 56, 13600),
  ('hiace','evening',      6275, 6275, 56, 15000),
  ('hiace','night',        6275, 6275, 56, 15700),
  ('tow','morning',       12902,12902, 56, 15500),
  ('tow','afternoon',     12902,12902, 56, 15500),
  ('tow','evening',       14193,14193, 56, 17000),
  ('tow','night',         14838,14838, 56, 17800)
on conflict (service_id, period) do nothing;

-- ============================================================
--  اشتراك VIP الشهري: السائق VIP بلا عمولة مقابل رسم شهري يُخصم من محفظته.
--  الإعفاء من العمولة يسري فقط ما دام الاشتراك مدفوعاً (vip_paid_until > now).
-- ============================================================
alter table public.settings add column if not exists vip_subscription_fee numeric(12,2) not null default 0;
alter table public.drivers  add column if not exists vip_paid_until timestamptz; -- الاشتراك مدفوع حتى

-- تعيين VIP (نسخة محدّثة): يمنح الشهر الأول عند التفعيل إن لم يكن مشتركاً.
create or replace function public.admin_set_driver_vip(p_user uuid, p_vip boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_perm('drivers') then raise exception 'غير مصرّح'; end if;
  if p_vip then
    update public.drivers
      set vip = true,
          vip_paid_until = case
            when vip_paid_until is null or vip_paid_until < now() then now() + interval '1 month'
            else vip_paid_until end
      where user_id = p_user;
  else
    update public.drivers set vip = false where user_id = p_user;
  end if;
  perform public.log_action(case when p_vip then 'تعيين سائق VIP' else 'إلغاء VIP' end,
    (select full_name from public.users where id = p_user));
end $$;
grant execute on function public.admin_set_driver_vip(uuid, boolean) to authenticated;

-- تسوية الرحلة (نسخة محدّثة): إعفاء العمولة يتطلّب اشتراك VIP مدفوعاً أو إعفاءً مؤقّتاً.
create or replace function public.settle_ride(p_ride uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_driver_user uuid; v_customer uuid; v_fare numeric; v_status ride_status;
  v_payment payment_method; v_service text; v_rate numeric; v_commission numeric;
  v_net numeric; v_dwallet uuid; v_cwallet uuid; v_cbalance numeric; v_prepaid boolean;
  v_vip boolean; v_free timestamptz; v_paid_until timestamptz;
begin
  select driver_id, customer_id, fare, status, payment_method, service_id, prepaid
    into v_driver_user, v_customer, v_fare, v_status, v_payment, v_service, v_prepaid
    from public.rides where id = p_ride for update;

  if v_driver_user is null then raise exception 'الرحلة بلا سائق'; end if;
  if auth.uid() <> v_driver_user and not public.is_admin() then raise exception 'غير مصرّح'; end if;
  if v_status = 'completed' then raise exception 'الرحلة مسوّاة مسبقاً'; end if;
  if v_status = 'cancelled' then raise exception 'الرحلة ملغاة'; end if;

  v_rate := coalesce(
    (select commission_rate from public.service_pricing where service_id = v_service),
    (select commission_rate from public.settings where id = 1));

  select vip, commission_free_until, vip_paid_until into v_vip, v_free, v_paid_until
    from public.drivers where user_id = v_driver_user;
  if (v_free is not null and v_free > now())
     or (coalesce(v_vip, false) and v_paid_until is not null and v_paid_until > now()) then
    v_rate := 0;
  end if;

  v_fare       := coalesce(v_fare, 0);
  v_commission := round(v_fare * coalesce(v_rate, 0));
  v_net        := v_fare - v_commission;

  if v_payment = 'wallet' and not v_prepaid then
    select id, balance into v_cwallet, v_cbalance from public.wallets where user_id = v_customer for update;
    if v_cwallet is null then raise exception 'محفظة العميل غير موجودة'; end if;
    if v_cbalance < v_fare then raise exception 'رصيد محفظة العميل غير كافٍ'; end if;
    update public.wallets set balance = balance - v_fare, updated_at = now() where id = v_cwallet;
    insert into public.transactions (wallet_id, type, amount, ride_id, note)
      values (v_cwallet, 'ride_payment', -v_fare, p_ride, 'دفع رحلة');
  end if;

  update public.rides set status = 'completed' where id = p_ride;

  select id into v_dwallet from public.wallets where user_id = v_driver_user for update;
  if v_dwallet is not null then
    if v_payment = 'wallet' then
      update public.wallets set balance = balance + v_net, updated_at = now() where id = v_dwallet;
      insert into public.transactions (wallet_id, type, amount, ride_id, note) values
        (v_dwallet, 'ride_earning', v_fare, p_ride, 'أرباح رحلة (إجمالي)');
      if v_commission > 0 then
        insert into public.transactions (wallet_id, type, amount, ride_id, note)
          values (v_dwallet, 'commission', -v_commission, p_ride, 'عمولة المنصة');
      end if;
    else
      if v_commission > 0 then
        update public.wallets set balance = balance - v_commission, updated_at = now() where id = v_dwallet;
        insert into public.transactions (wallet_id, type, amount, ride_id, note)
          values (v_dwallet, 'commission', -v_commission, p_ride, 'عمولة المنصة (نقدي/تحويل)');
      end if;
    end if;
  end if;
end $$;

-- تحصيل اشتراكات VIP المستحقّة (أدمن): يخصم الرسم الشهري من محافظ السائقين
-- المستحقّين ويمدّد الاشتراك شهراً. من لا يكفي رصيده يبقى مستحقّاً (تُطبَّق عليه
-- العمولة حتى يُسدّد). يعيد عدد المدفوع والمتعذّر.
create or replace function public.charge_due_vip_subscriptions()
returns table (charged int, failed int)
language plpgsql security definer set search_path = public as $$
declare v_fee numeric; r record; v_wallet uuid; v_bal numeric; v_c int := 0; v_f int := 0;
begin
  if not public.is_admin() then raise exception 'غير مصرّح'; end if;
  select vip_subscription_fee into v_fee from public.settings where id = 1;
  if coalesce(v_fee, 0) <= 0 then return query select 0, 0; return; end if;
  for r in
    select user_id from public.drivers
     where vip and (vip_paid_until is null or vip_paid_until < now())
  loop
    select id, balance into v_wallet, v_bal from public.wallets where user_id = r.user_id for update;
    if v_wallet is null then v_f := v_f + 1; continue; end if;
    if v_bal >= v_fee then
      update public.wallets set balance = balance - v_fee, updated_at = now() where id = v_wallet;
      insert into public.transactions (wallet_id, type, amount, note)
        values (v_wallet, 'commission', -v_fee, 'اشتراك VIP شهري');
      update public.drivers
        set vip_paid_until = greatest(coalesce(vip_paid_until, now()), now()) + interval '1 month'
        where user_id = r.user_id;
      v_c := v_c + 1;
    else
      v_f := v_f + 1;
    end if;
  end loop;
  perform public.log_action('تحصيل اشتراكات VIP', v_c::text || ' مدفوع، ' || v_f::text || ' متعذّر');
  return query select v_c, v_f;
end $$;
grant execute on function public.charge_due_vip_subscriptions() to authenticated;

-- ============================================================
--  قبول الرحلة بشكل ذرّي: يمنع ازدواج الإرسال بين سائقَين.
--  يقفل الصفّ، يرفض إن كانت مأخوذة/غير متاحة (يعيد false بلا خطأ)،
--  ويمنع القبول إن كان لدى السائق رحلة جارية. driver_id = auth.uid().
-- ============================================================
create or replace function public.accept_ride(p_ride uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_status ride_status; v_driver uuid;
begin
  select status, driver_id into v_status, v_driver
    from public.rides where id = p_ride for update;
  if v_status is null then raise exception 'الرحلة غير موجودة'; end if;

  if exists (
    select 1 from public.rides
     where driver_id = auth.uid()
       and status in ('accepted', 'arrived', 'in_progress')
  ) then
    raise exception 'لديك رحلة جارية بالفعل';
  end if;

  -- أُخذت من سائق آخر أو لم تعد قابلة للقبول.
  if v_driver is not null or v_status not in ('searching', 'requested') then
    return false;
  end if;

  update public.rides
     set driver_id = auth.uid(), status = 'accepted'
   where id = p_ride;
  return true;
end $$;
grant execute on function public.accept_ride(uuid) to authenticated;

-- ============================================================
--  طلبات اشتراك VIP من السائق: يدفع من محفظته أو يحوّل بنكياً بإيصال،
--  والأدمن يعتمد التحويل. الإيصال يُرفع في bucket topup-proofs (مجلّد السائق).
-- ============================================================
create table if not exists public.vip_requests (
  id          uuid primary key default gen_random_uuid(),
  driver_id   uuid not null references public.users(id) on delete cascade, -- user_id للسائق
  amount      numeric(12,2) not null,
  method      text not null check (method in ('wallet', 'bank_transfer')),
  proof_url   text,                                   -- مسار الإيصال (تحويل بنكي)
  status      topup_status not null default 'pending',
  note        text,
  reviewed_by uuid references public.users(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists vip_requests_status_idx on public.vip_requests(status);
alter table public.vip_requests enable row level security;

-- السائق يقرأ طلباته، والطاقم/الأدمن يقرؤون الكل.
drop policy if exists "own vip requests" on public.vip_requests;
create policy "own vip requests" on public.vip_requests
  for select using (auth.uid() = driver_id or public.is_staff_or_admin());
-- الإدخال يتم حصراً عبر دالة request_vip (SECURITY DEFINER) — لا سياسة إدخال مباشرة.
drop policy if exists "admin update vip request" on public.vip_requests;
create policy "admin update vip request" on public.vip_requests
  for update using (public.is_staff_or_admin()) with check (public.is_staff_or_admin());

-- طلب اشتراك VIP: wallet → خصم فوري وتفعيل؛ bank_transfer → طلب معلّق للاعتماد.
create or replace function public.request_vip(p_method text, p_proof_url text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_fee numeric; v_wallet uuid; v_bal numeric; v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'غير مصرّح'; end if;
  if p_method not in ('wallet', 'bank_transfer') then raise exception 'طريقة دفع غير صالحة'; end if;
  if not exists (select 1 from public.drivers where user_id = v_uid) then
    raise exception 'الحساب ليس سائقاً';
  end if;
  select vip_subscription_fee into v_fee from public.settings where id = 1;
  if coalesce(v_fee, 0) <= 0 then raise exception 'اشتراك VIP غير مفعّل حالياً'; end if;
  if exists (select 1 from public.vip_requests where driver_id = v_uid and status = 'pending') then
    raise exception 'لديك طلب قيد المراجعة بالفعل';
  end if;

  if p_method = 'wallet' then
    select id, balance into v_wallet, v_bal from public.wallets where user_id = v_uid for update;
    if v_wallet is null then raise exception 'المحفظة غير موجودة'; end if;
    if v_bal < v_fee then raise exception 'رصيد المحفظة غير كافٍ'; end if;
    update public.wallets set balance = balance - v_fee, updated_at = now() where id = v_wallet;
    insert into public.transactions (wallet_id, type, amount, note)
      values (v_wallet, 'commission', -v_fee, 'اشتراك VIP شهري');
    update public.drivers
      set vip = true,
          vip_paid_until = greatest(coalesce(vip_paid_until, now()), now()) + interval '1 month'
      where user_id = v_uid;
    insert into public.vip_requests (driver_id, amount, method, status, reviewed_by, note)
      values (v_uid, v_fee, 'wallet', 'approved', v_uid, 'دفع من المحفظة');
    return jsonb_build_object('status', 'approved');
  else
    insert into public.vip_requests (driver_id, amount, method, proof_url, status)
      values (v_uid, v_fee, 'bank_transfer', p_proof_url, 'pending');
    perform public.log_action('طلب اشتراك VIP (تحويل)', v_fee::text || ' ج.س');
    return jsonb_build_object('status', 'pending');
  end if;
end $$;
grant execute on function public.request_vip(text, text) to authenticated;

-- اعتماد طلب VIP (أدمن): يفعّل VIP ويمدّد شهراً.
create or replace function public.approve_vip_request(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_driver uuid; v_status topup_status;
begin
  if not public.has_perm('requests') and not public.has_perm('drivers') then
    raise exception 'غير مصرّح';
  end if;
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

-- رفض طلب VIP (أدمن).
create or replace function public.reject_vip_request(p_id uuid, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_perm('requests') and not public.has_perm('drivers') then
    raise exception 'غير مصرّح';
  end if;
  update public.vip_requests
    set status = 'rejected', reviewed_by = auth.uid(), note = coalesce(p_note, note)
    where id = p_id and status = 'pending';
  perform public.log_action('رفض اشتراك VIP', p_note);
end $$;
grant execute on function public.reject_vip_request(uuid, text) to authenticated;
