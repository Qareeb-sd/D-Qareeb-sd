-- ============================================================
--  رقم العضوية: رقم تسلسلي فريد يُمنح تلقائياً لكل مستخدم (عميل/سائق)
--  عند إنشاء حسابه، ويُعبّأ للحسابات الحالية بترتيب التسجيل.
--  شغّل هذا المقطع مرّة واحدة في Supabase SQL Editor.
-- ============================================================
create sequence if not exists public.member_seq start 1000;
alter table public.users add column if not exists member_no int unique;
alter table public.users alter column member_no set default nextval('public.member_seq');

-- تعبئة الحسابات الحالية بترتيب تاريخ التسجيل.
do $$
declare r record;
begin
  for r in select id from public.users where member_no is null order by created_at, id loop
    update public.users set member_no = nextval('public.member_seq') where id = r.id;
  end loop;
end $$;
