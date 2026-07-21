-- بنرات الإعلانات المدفوعة — يرفعها الأدمن (صورة + رابط) وتظهر في الرئيسية.
-- «سعر يومي» + «عدد أيام» → يظهر البنر تلقائياً طوال المدة ثم يختفي، والإيراد = أيام × السعر.
-- الجمهور لكل إعلان: الكل / العملاء / السائقون (كنظام الإعلانات النصية).

create table if not exists public.ad_banners (
  id          uuid primary key default gen_random_uuid(),
  title       text,                        -- اسم المُعلن/الحملة (يراه الأدمن فقط)
  image_url   text not null,               -- صورة البنر (bucket عام)
  link_url    text,                        -- رابط يُفتح عند الضغط (اختياري)
  audience    text not null default 'all'
              check (audience in ('all', 'customers', 'drivers')),
  daily_price numeric(12,2) not null default 0,
  days        int not null default 1 check (days between 1 and 3650),
  start_date  date not null default current_date,
  active      boolean not null default true,
  created_by  uuid references public.users(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists ad_banners_running_idx on public.ad_banners(active, start_date);

alter table public.ad_banners enable row level security;

-- المستخدمون المسجّلون يقرؤون البنرات النشطة السارية فقط (اليوم داخل [start_date, start_date+days)).
drop policy if exists "read running ads" on public.ad_banners;
create policy "read running ads" on public.ad_banners
  for select to authenticated
  using (
    active
    and current_date >= start_date
    and current_date < (start_date + days)
  );

-- الأدمن/الطاقم: إدارة كاملة (وقراءة كل الإعلانات في اللوحة، سارية أو منتهية).
drop policy if exists "staff manage ads" on public.ad_banners;
create policy "staff manage ads" on public.ad_banners
  for all to authenticated
  using (public.is_staff_or_admin())
  with check (public.is_staff_or_admin());
