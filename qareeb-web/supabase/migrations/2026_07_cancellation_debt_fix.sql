-- ============================================================
--  إصلاح دَين الإلغاء (C4): كان يُمسح فور إنشاء أيّ رحلة، فيضيع إن أُلغيت الرحلة
--  مجاناً قبل القبول. الآن يُضاف الدَّين للأجرة عند الإنشاء لكن **لا يُمسح** إلا حين
--  تكتمل الرحلة فعلاً (فيكون قد حُصِّل ضمن الأجرة). شغّل هذا المقطع مرّة واحدة.
-- ============================================================

-- كم من الدَّين بُنِي داخل أجرة هذه الرحلة (يُمسح من المحفظة عند اكتمالها).
alter table public.rides add column if not exists debt_included numeric(12,2) not null default 0;

-- عند الإنشاء: ابنِ الدَّين داخل الأجرة وسجّله، دون مسحه من المحفظة بعد.
create or replace function public.apply_cancellation_debt()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_debt numeric;
begin
  select cancellation_debt into v_debt from public.wallets where user_id = new.customer_id;
  if coalesce(v_debt, 0) > 0 and new.fare is not null then
    new.fare := new.fare + v_debt;
    new.debt_included := v_debt;
  end if;
  return new;
end $$;
drop trigger if exists trg_apply_cancellation_debt on public.rides;
create trigger trg_apply_cancellation_debt
  before insert on public.rides
  for each row execute function public.apply_cancellation_debt();

-- عند الاكتمال: امسح الدَّين المُحصَّل (المبنيّ في الأجرة) من محفظة العميل.
create or replace function public.clear_cancellation_debt()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'completed' and old.status is distinct from 'completed'
     and coalesce(new.debt_included, 0) > 0 then
    update public.wallets
       set cancellation_debt = greatest(0, cancellation_debt - new.debt_included)
     where user_id = new.customer_id;
  end if;
  return new;
end $$;
drop trigger if exists trg_clear_cancellation_debt on public.rides;
create trigger trg_clear_cancellation_debt
  after update on public.rides
  for each row execute function public.clear_cancellation_debt();
