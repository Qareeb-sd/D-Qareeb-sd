-- ============================================================
--  رقم العضوية (نسخة محسّنة): سلسلة مستقلّة لكل فئة + بادئة حرفية.
--   • العميل  → «ع‑رقم» يبدأ من ١٠٠٠
--   • الكابتن → «ك‑رقم» يبدأ من ١٠٠٠
--  يتّسع لملايين الأعضاء، والحرف يميّز النوع. يُعاد الترقيم للحسابات الحالية.
--  شغّل هذا المقطع مرّة واحدة (بعد تشغيل member_number الأساسي أو بدونه).
-- ============================================================
create sequence if not exists public.member_seq_customer start 1000;
create sequence if not exists public.member_seq_driver   start 1000;

-- العمود موجود مسبقاً؛ نُزيل التفرّد العام والقيمة الافتراضية (السلاسل والبادئة تكفيان).
alter table public.users add column if not exists member_no int;
alter table public.users drop constraint if exists users_member_no_key;
alter table public.users alter column member_no drop default;

-- منح الرقم عند إنشاء الحساب حسب الدور (قبل الإدراج).
create or replace function public.assign_member_no()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.member_no is null then
    new.member_no := nextval(
      (case when new.role = 'driver'
            then 'public.member_seq_driver'
            else 'public.member_seq_customer' end)::regclass);
  end if;
  return new;
end $$;
drop trigger if exists trg_assign_member_no on public.users;
create trigger trg_assign_member_no before insert on public.users
  for each row execute function public.assign_member_no();

-- عند ترقية عميل إلى سائق: يُمنح رقم كابتن جديد من سلسلة السائقين.
create or replace function public.reassign_driver_member_no()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.role = 'driver' and old.role is distinct from 'driver' then
    new.member_no := nextval('public.member_seq_driver');
  end if;
  return new;
end $$;
drop trigger if exists trg_reassign_driver_member_no on public.users;
create trigger trg_reassign_driver_member_no before update of role on public.users
  for each row execute function public.reassign_driver_member_no();

-- إعادة ترقيم الحسابات الحالية بترتيب التسجيل: العملاء ثم السائقون.
do $$
declare r record;
begin
  perform setval('public.member_seq_customer', 999, true);
  perform setval('public.member_seq_driver',   999, true);
  for r in select id from public.users where role = 'customer' order by created_at, id loop
    update public.users set member_no = nextval('public.member_seq_customer') where id = r.id;
  end loop;
  for r in select id from public.users where role = 'driver' order by created_at, id loop
    update public.users set member_no = nextval('public.member_seq_driver') where id = r.id;
  end loop;
  -- الأدمن بلا رقم عضوية (اتركه فارغاً).
  update public.users set member_no = null where role = 'admin';
end $$;
