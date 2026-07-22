-- تحصين سعر الرحلة (#3): حدّ أدنى خادمي يمنع التلاعب الجسيم بالأجرة من العميل.
--
-- الأجرة كانت تُكتب من الجهاز مباشرةً (fare) بلا إعادة حساب، فيمكن إدخال fare=1.
-- إعادة الحساب الكامل تحتاج مسافة الطريق (توجيه خارجي) غير المتاح داخل القاعدة،
-- فنكتفي بحدٍّ أدنى «متحفّظ جداً» مشتقّ من التسعير المخزّن:
--   • مسافة الهافرسين (خطّ مستقيم) — دائماً أقصر من مسافة الطريق الفعلية.
--   • أرخص فترة تسعير للخدمة، وبلا مكوّن الزمن ولا مضاعف الذروة.
--   • مضروبة في 0.30 كهامش أمان واسع للخصومات/البرومو وفرق المسار.
-- النتيجة: لا تُرفض أي رحلة حقيقية (حتى بخصم ~65%)، لكن تُرفض الأسعار الوهمية.
-- (settle_ride يحسب العمولة من fare، فحماية fare عند الإدخال تحمي إيراد المنصّة.)

create or replace function public.guard_ride_fare()
returns trigger language plpgsql set search_path = public as $$
declare v_km numeric; v_base numeric; v_perkm numeric; v_floor numeric;
begin
  if new.fare is null or new.fare <= 0 then
    raise exception 'سعر الرحلة غير صالح';
  end if;
  if new.fare > 100000000 then           -- سقف أمان ضدّ التلاعب/الأخطاء
    raise exception 'سعر الرحلة تجاوز الحدّ المعقول';
  end if;

  -- حدّ أدنى متحفّظ (لا يُطبَّق إن لا وجهة أو لا تسعير مخزّن للخدمة).
  if new.dropoff_lat is not null and new.dropoff_lng is not null then
    select min(base_fare), min(per_km) into v_base, v_perkm
      from public.service_pricing_periods where service_id = new.service_id;
    if v_base is not null then
      v_km := public.haversine_km(new.pickup_lat, new.pickup_lng, new.dropoff_lat, new.dropoff_lng);
      v_floor := (coalesce(v_base, 0) + coalesce(v_perkm, 0) * coalesce(v_km, 0)) * 0.30;
      if new.fare < v_floor then
        raise exception 'سعر الرحلة لا يطابق التسعير المعتمد';
      end if;
    end if;
  end if;

  return new;
end $$;

drop trigger if exists trg_guard_ride_fare on public.rides;
create trigger trg_guard_ride_fare before insert on public.rides
  for each row execute function public.guard_ride_fare();
