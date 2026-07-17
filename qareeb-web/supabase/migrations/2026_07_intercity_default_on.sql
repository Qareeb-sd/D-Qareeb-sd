-- ============================================================
--  تغطية «السفر بين المدن»: تفعيله افتراضياً (نموذج انسحاب) كي لا ينتظر
--  العميل بلا سائق. السائق الذي لا يرغب يعطّله من «حسابي». (#4)
--  شغّل هذا المقطع مرّة واحدة.
-- ============================================================
alter table public.drivers alter column accepts_intercity set default true;
update public.drivers set accepts_intercity = true where accepts_intercity is not true;
