-- تتبّع نقرات الإعلان: عدّاد + دالّة زيادة آمنة (بلا منح كتابة عامة على الجدول).
alter table public.ad_banners add column if not exists clicks int not null default 0;

create or replace function public.ad_banner_click(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.ad_banners set clicks = clicks + 1 where id = p_id;
end $$;
grant execute on function public.ad_banner_click(uuid) to authenticated;
