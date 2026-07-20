import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Building2, Clock, Calendar, Users } from 'lucide-react'
import Screen from '@/components/Screen'
import LocationPicker from '@/components/LocationPicker'
import PlaceSearch from '@/components/PlaceSearch'
import { getService } from '@/data/services'
import { getCommuteOrderByCode, joinCommuteOrder, commuteMemberCount } from '@/lib/commute'
import { getServicePricing, listServicePeriods, getSettings } from '@/lib/api'
import { memberDailyFare, periodFromTime, monthlyTotal } from '@/lib/commutePricing'
import { money } from '@/lib/format'
import { type PeriodRate } from '@/lib/pricing'
import { KHARTOUM } from '@/theme'
import type { CommuteOrder, Settings } from '@/lib/types'

/** صفحة الانضمام عبر رابط الدعوة: يضيف المدعوّ اسمه ومنزله وينضم للطلب. */
export default function CommuteJoin() {
  const { code = '' } = useParams()
  const navigate = useNavigate()

  const [order, setOrder] = useState<CommuteOrder | null | undefined>(undefined)
  const [count, setCount] = useState(0)
  const [name, setName] = useState('')
  const [home, setHome] = useState<google.maps.LatLngLiteral>(KHARTOUM)
  const [homeAddress, setHomeAddress] = useState('')
  const [busy, setBusy] = useState(false)
  const [periodRate, setPeriodRate] = useState<PeriodRate | null>(null)
  const [settings, setSettings] = useState<Settings | null>(null)
  const [payMethod, setPayMethod] = useState<'cash' | 'wallet'>('cash')
  // لا نعرض أجرة الراكب قبل أن يحدّد منزله فعلاً (وإلا حُسِبت على موقعٍ افتراضي).
  const [homeChosen, setHomeChosen] = useState(false)
  const located = useRef(false)

  useEffect(() => {
    void getCommuteOrderByCode(code).then(async (o) => {
      setOrder(o)
      if (o) setCount(await commuteMemberCount(o.id))
    })
  }, [code])

  // تسعير فترة مركبة الطلب حسب وقت ذهابه.
  useEffect(() => {
    if (!order) return
    void Promise.all([getServicePricing(order.service_id), listServicePeriods(), getSettings()]).then(
      ([, periods, s]) => {
        setSettings(s)
        const per = periodFromTime(order.scheduled_time || '07:00')
        const row = periods.find((r) => r.service_id === order.service_id && r.period === per)
        setPeriodRate(
          row
            ? { base_fare: row.base_fare, per_km: row.per_km, per_min: row.per_min, min_fare: row.min_fare }
            : null,
        )
      },
    )
  }, [order])

  useEffect(() => {
    if (located.current || !navigator.geolocation) return
    located.current = true
    navigator.geolocation.getCurrentPosition(
      (p) => setHome({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => {},
      { timeout: 8000 },
    )
  }, [])

  if (order === undefined) {
    return (
      <Screen title="انضمام للترحيل" back>
        <div className="card h-24 animate-pulse" />
      </Screen>
    )
  }

  if (!order) {
    return (
      <Screen title="انضمام للترحيل" back>
        <p className="card p-6 text-center text-sm text-ink-muted">
          رابط الدعوة غير صالح أو انتهى.
        </p>
      </Screen>
    )
  }

  const service = getService(order.service_id)
  const seats = service?.seats ?? 4
  const full = count >= seats
  const plan = order.plan ?? 'daily'

  // أجرة الراكب: منزله → وجهة الطلب (×2 إن ذهاب وإياب)، بعد خصم الترحيل.
  const dest = { lat: order.dest_lat, lng: order.dest_lng }
  const discount = settings?.commute_discount ?? 0
  const weeks = settings?.commute_weeks_per_month ?? 4
  const daily = periodRate ? memberDailyFare(home, dest, periodRate, order.round_trip, discount) : 0
  const monthly = monthlyTotal(daily, order.days.length, weeks)

  const join = async () => {
    if (!name.trim() || full) return
    if (!periodRate || daily <= 0) return alert('يجري حساب السعر… أعد المحاولة بعد لحظة')
    setBusy(true)
    // إعادة التحقق من السعة قبل الإضافة (قد ينضمّ آخرون في نفس اللحظة).
    const current = await commuteMemberCount(order.id)
    if (current >= seats) {
      setCount(current)
      setBusy(false)
      return alert('اكتمل عدد الركّاب لهذه المركبة')
    }
    const { error } = await joinCommuteOrder(
      order.id,
      {
        name: name.trim(),
        home: { ...home, address: homeAddress || 'منزلي' },
        fare: daily,
        pay_method: plan === 'monthly' ? 'wallet' : payMethod,
      },
      plan,
    )
    setBusy(false)
    if (error) return alert(error)
    navigate(`/commute/${order.id}`)
  }

  return (
    <Screen title="انضمام للترحيل" back>
      {/* تفاصيل الطلب */}
      <div className="card space-y-2 p-4">
        <p className="font-bold text-royal">دعوة ترحيل · {service?.name ?? order.service_id}</p>
        <p className="flex items-center gap-2 text-sm text-ink-soft">
          <Building2 className="h-4 w-4 shrink-0 text-sand-ink" strokeWidth={1.8} />
          {order.dest_address ?? 'مكان العمل'}
        </p>
        <p className="flex items-center gap-2 text-sm text-ink-soft">
          <Clock className="h-4 w-4 shrink-0 text-sand-ink" strokeWidth={1.8} />
          الذهاب {order.scheduled_time}
          {order.round_trip && order.return_time ? ` · الإياب ${order.return_time}` : ''}
        </p>
        <p className="flex items-center gap-2 text-sm text-ink-soft">
          <Calendar className="h-4 w-4 shrink-0 text-sand-ink" strokeWidth={1.8} />
          {order.days.join(' · ')}
        </p>
        <p className="flex items-center gap-2 text-sm text-ink-soft">
          <Users className="h-4 w-4 shrink-0 text-sand-ink" strokeWidth={1.8} />
          الركّاب {count} / {seats}
        </p>
      </div>

      {full ? (
        <p className="mt-4 rounded-2xl bg-gold-soft p-4 text-center text-sm text-warning">
          اكتمل عدد الركّاب لهذه المركبة ({seats}). تعذّر الانضمام.
        </p>
      ) : (
        <>
          <p className="mt-4 mb-1 font-bold">أضف بياناتك</p>
          <input
            className="field"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="اسمك"
          />

          <p className="label mt-3">حدّد منزلك (نقطة انطلاقك)</p>
          <PlaceSearch
            value={homeAddress}
            onChange={setHomeAddress}
            onPick={({ pos, address }) => {
              setHome(pos)
              setHomeAddress(address)
              setHomeChosen(true)
            }}
            placeholder="اكتب اسم الحي/المكان أو حدّده بالخريطة"
            className="field mb-2"
          />
          <LocationPicker
            center={home}
            onChange={(p) => {
              setHome(p)
              setHomeChosen(true)
            }}
          />

          {/* السعر + طريقة الدفع — بعد تحديد المنزل فقط */}
          {homeChosen && periodRate && daily > 0 ? (
            <div className="mt-3 space-y-2 rounded-2xl bg-gold-soft p-3 text-sm text-ink">
              {plan === 'daily' ? (
                <>
                  <p>
                    أجرتك اليومية <span className="font-bold text-sand-ink">{money(daily)}</span>
                    {order.round_trip ? ' (ذهاباً وإياباً)' : ' (ذهاب فقط)'}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {(
                      [
                        ['wallet', 'من محفظتي'],
                        ['cash', 'كاش/بنك للسائق'],
                      ] as const
                    ).map(([id, label]) => (
                      <button
                        key={id}
                        onClick={() => setPayMethod(id)}
                        className={`rounded-xl border px-3 py-2 text-sm font-bold transition ${
                          payMethod === id ? 'border-royal bg-royal text-white' : 'border-hairline bg-white text-ink-soft'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {payMethod === 'wallet' && (
                    <p className="text-[11px] text-ink-muted">
                      يجب أن يغطّي رصيدك أجرة اليوم؛ وإلا يتحوّل ذلك اليوم لدفع كاش/بنك للسائق.
                    </p>
                  )}
                </>
              ) : (
                <>
                  <p>
                    اشتراك الشهر <span className="font-bold text-sand-ink">{money(monthly)}</span>
                  </p>
                  <p className="text-[11px] text-ink-muted">
                    = {money(daily)} × {order.days.length} يوم/أسبوع × {weeks} أسابيع — يُخصم مقدّماً من محفظتك عند الانضمام.
                  </p>
                </>
              )}
              {discount > 0 && (
                <p className="text-[11px] text-green">شامل خصم الترحيل {Math.round(discount * 100)}%</p>
              )}
            </div>
          ) : (
            <p className="mt-3 rounded-2xl bg-royal-soft p-3 text-[12px] leading-relaxed text-ink-soft">
              حدّد منزلك أعلاه لتظهر لك أجرتك في هذا الترحيل.
            </p>
          )}

          <button className="btn-primary mt-4 w-full" onClick={join} disabled={busy}>
            {busy
              ? '…'
              : plan === 'monthly'
                ? homeChosen && monthly > 0
                  ? `اشترك ادفع ${money(monthly)}`
                  : 'اشترك في الترحيل'
                : 'انضمام للترحيل'}
          </button>
        </>
      )}
    </Screen>
  )
}
