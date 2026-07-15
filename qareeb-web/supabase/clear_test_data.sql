-- ============================================================
--  مسح بيانات التجربة (شغّله في: Supabase → SQL Editor)
--  يمسح: الرحلات · المعاملات · التعبئات · الترحيل · تنبيهات الطوارئ
--        ويصفّر أرصدة المحافظ.
--  يُبقي: المستخدمين · السائقين · التسعير · الإعدادات (الحساب البنكي والعمولة).
--  ⚠️ لا يمكن التراجع — شغّله فقط عندما تريد بداية نظيفة قبل الإطلاق.
-- ============================================================

begin;

delete from public.transactions;      -- معاملات المحافظ (تشير للرحلات)
delete from public.topups;            -- طلبات التعبئة
delete from public.sos_alerts;        -- تنبيهات الطوارئ
delete from public.commute_members;   -- أعضاء الترحيل
delete from public.commute_orders;    -- طلبات الترحيل
delete from public.rides;             -- الرحلات

update public.wallets set balance = 0; -- تصفير الأرصدة التجريبية

commit;

-- تحقّق (يُفترض أن تعود أصفاراً):
select
  (select count(*) from public.rides)          as rides,
  (select count(*) from public.transactions)   as transactions,
  (select count(*) from public.topups)         as topups,
  (select count(*) from public.commute_orders) as commutes,
  (select count(*) from public.sos_alerts)     as sos;
