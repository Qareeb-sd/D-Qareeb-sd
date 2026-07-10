-- ============================================================
--  تعيين أدمن (شغّله في: Supabase → SQL Editor)
--  يعمل مرّة واحدة لكل رقم. لا يحتاج تشغيل schema.sql كاملاً.
--
--  الخطوات:
--   1) افتح موقع الأدمن وسجّل الدخول مرّة بالرقم المطلوب (أرقام فقط، مثل 916460666)
--      + كلمة سر. ستظهر «لا يملك صلاحية» — هذا طبيعي (أنشأ الحساب).
--   2) شغّل هذا الملف كاملاً هنا.
--   3) عدّل الرقم في آخر سطر إن لزم، ثم Run.
--   4) ارجع للموقع: «تسجيل الخروج» ثم ادخل بنفس الرقم — تفتح اللوحة.
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

-- ← ضع رقم الأدمن بالضبط كما تكتبه في شاشة الدخول (أرقام فقط)
select public.bootstrap_admin('916460666');

-- (اختياري) اعرض كل الحسابات وأدوارها للتأكّد:
-- select u.phone, u.role, a.email
-- from public.users u left join auth.users a on a.id = u.id
-- order by u.created_at desc;
