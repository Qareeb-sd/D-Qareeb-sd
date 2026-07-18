-- ============================================================
--  بثّ الإشعارات الجماعي على دفعات (قابلية التوسّع لـ 100 ألف مستخدم).
--  بدل تحميل كل المعرّفات في ذاكرة الدالة و IN(...) عملاقة، نُصفّح رموز
--  الأجهزة عبر keyset pagination على token، فتُرسَل على دفعات ثابتة الذاكرة.
--  شغّل هذا المقطع مرّة واحدة.
-- ============================================================

-- فهرس دور المستخدم لتسريع تصفية جمهور البثّ (عملاء/سائقون).
create index if not exists users_role_idx on public.users(role);

-- صفحة من رموز أجهزة جمهور معيّن، مرتّبة بالـ token (keyset) لتصفّح ثابت الذاكرة.
create or replace function public.audience_device_tokens(
  p_audience text, p_after text default null, p_limit int default 500
)
returns table (token text)
language sql stable security definer set search_path = public as $$
  select dt.token
  from public.device_tokens dt
  join public.users u on u.id = dt.user_id
  where (
      p_audience = 'all'
      or (p_audience = 'customers' and u.role = 'customer')
      or (p_audience = 'drivers'   and u.role = 'driver')
    )
    and (p_after is null or dt.token > p_after)
  order by dt.token
  limit least(greatest(coalesce(p_limit, 500), 1), 1000);
$$;

-- تُستدعى فقط من الخادم (service_role في Edge Function) — لا نمنحها للمستخدمين.
revoke all on function public.audience_device_tokens(text, text, int) from public;
revoke all on function public.audience_device_tokens(text, text, int) from authenticated;
