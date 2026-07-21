-- Realtime للوحة الأدمن: تحديث لحظي لقوائم الطلبات المعلّقة دون تحديث يدوي.
-- كانت topups / vip_requests / withdrawals خارج النشر، فكان الأدمن يعتمد على
-- الاستقصاء كل ١٢ ثانية فقط — يبدو كأنّ الطلب «لا يظهر حتى أُحدّث الصفحة».
-- إضافتها للنشر تجعل اشتراك subscribeToTopups (وأخواته) يعمل فوراً.

do $$
declare
  t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['topups', 'vip_requests', 'withdrawals'] loop
      if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
      ) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;
