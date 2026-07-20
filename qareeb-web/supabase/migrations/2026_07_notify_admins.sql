-- إشعارات الإدارة (Web Push) — مشغّلات تستدعي دالة notify-admins عند الأحداث المهمّة.
--
-- التصميم: لا نُضمّن رابط الدالة ولا السرّ في هذا الملف (لئلّا يتسرّبا في Git).
-- بل نقرؤهما من جدول إعداد مقفل (app_push_config) يملؤه الأدمن مرّةً واحدة:
--
--   insert into public.app_push_config (id, fn_base_url, webhook_secret)
--   values (1, 'https://<PROJECT_REF>.functions.supabase.co', '<WEBHOOK_SECRET>')
--   on conflict (id) do update
--     set fn_base_url = excluded.fn_base_url, webhook_secret = excluded.webhook_secret;
--
-- قبل ملئه: المشغّلات تعمل بلا أثر (تتخطّى الإرسال بهدوء) فلا تُعطّل الإدخال.

create extension if not exists pg_net with schema extensions;

-- ---------- جدول الإعداد (مقفل — لا وصول لأحد عبر PostgREST) ----------
create table if not exists public.app_push_config (
  id             int primary key default 1 check (id = 1),
  fn_base_url    text,            -- مثال: https://abc.functions.supabase.co
  webhook_secret text,            -- نفس WEBHOOK_SECRET المضبوط في أسرار الدالة
  updated_at     timestamptz not null default now()
);
alter table public.app_push_config enable row level security;
-- بلا سياسات → لا يقرؤه/يكتبه أي دور عبر الـ API. تصل إليه فقط الدوال SECURITY DEFINER
-- ودور الخدمة (service_role) الذي يتخطّى RLS.

-- ---------- دالّة الإرسال المركزية ----------
create or replace function public.notify_admins(
  p_title text,
  p_body  text,
  p_url   text default '/admin',
  p_tag   text default 'qareeb-admin'
)
returns void language plpgsql security definer
set search_path = public, extensions as $$
declare
  v_url    text;
  v_secret text;
begin
  select fn_base_url, webhook_secret into v_url, v_secret
  from public.app_push_config where id = 1;

  -- لم يُضبط الإعداد بعد → لا نُرسل (نتخطّى بهدوء).
  if v_url is null or v_url = '' then return; end if;

  perform net.http_post(
    url     := v_url || '/notify-admins',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'x-webhook-secret', coalesce(v_secret, '')),
    body    := jsonb_build_object(
                 'title', p_title,
                 'body',  p_body,
                 'url',   p_url,
                 'tag',   p_tag)
  );
end $$;

-- ---------- تعبئة جديدة بانتظار المراجعة ----------
create or replace function public.trg_notify_topup()
returns trigger language plpgsql security definer
set search_path = public, extensions as $$
begin
  if new.status = 'pending' then
    perform public.notify_admins(
      '💰 تعبئة جديدة',
      'طلب تعبئة رصيد بانتظار مراجعتك واعتماده',
      '/admin',
      'qareeb-topup');
  end if;
  return new;
end $$;

drop trigger if exists trg_notify_topup on public.topups;
create trigger trg_notify_topup
  after insert on public.topups
  for each row execute function public.trg_notify_topup();

-- ---------- طلب اشتراك VIP جديد (تحويل بنكي) ----------
create or replace function public.trg_notify_vip_request()
returns trigger language plpgsql security definer
set search_path = public, extensions as $$
begin
  if new.status = 'pending' then
    perform public.notify_admins(
      '👑 طلب اشتراك VIP',
      'سائق يطلب اشتراك VIP بتحويل بنكي — بانتظار الاعتماد',
      '/admin',
      'qareeb-vip');
  end if;
  return new;
end $$;

drop trigger if exists trg_notify_vip_request on public.vip_requests;
create trigger trg_notify_vip_request
  after insert on public.vip_requests
  for each row execute function public.trg_notify_vip_request();

-- ---------- تنبيه طوارئ (SOS) ----------
create or replace function public.trg_notify_sos()
returns trigger language plpgsql security definer
set search_path = public, extensions as $$
begin
  if new.status = 'open' then
    perform public.notify_admins(
      '🆘 تنبيه طوارئ',
      'وصل تنبيه طوارئ — افتح اللوحة فوراً لمتابعة الموقع',
      '/admin',
      'qareeb-sos');
  end if;
  return new;
end $$;

drop trigger if exists trg_notify_sos on public.sos_alerts;
create trigger trg_notify_sos
  after insert on public.sos_alerts
  for each row execute function public.trg_notify_sos();
