import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BottomNav from '@/components/BottomNav'
import Logo from '@/components/Logo'
import LocationPicker from '@/components/LocationPicker'
import PlaceSearch from '@/components/PlaceSearch'
import { useAuth } from '@/store/AuthContext'
import { createCommuteOrder } from '@/lib/commute'
import { getServicePricing, listServicePeriods, getSettings } from '@/lib/api'
import { memberDailyFare, periodFromTime, monthlyTotal } from '@/lib/commutePricing'
import { type PeriodRate } from '@/lib/pricing'
import { money } from '@/lib/format'
import type { Settings } from '@/lib/types'
import { KHARTOUM } from '@/theme'

const days = ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة']

/**
 * ترحيل — إنشاء طلب مشترك: مركبة + مكان العمل (وجهة) + وقت + أيام.
 * المنظّم يُنشئ الطلب ثم يشارك رابط الدعوة؛ البقية ينضمّون كلٌّ بمنزله.
 */
export default function Commute() {
  const navigate = useNavigate()
  const { profile } = useAuth()

  // الترحيل دائماً بالمركبة العادية «قريب عادي» — بلا اختيار مركبة.
  const serviceId = 'standard'
  const [dest, setDest] = useState<google.maps.LatLngLiteral>(KHARTOUM)
  const [destAddress, setDestAddress] = useState('')
  // لا نعرض أي سعر قبل أن يحدّد المنظّم الوجهة فعلاً — وإلا حُسِب على إحداثيات
  // افتراضية (موقعه الحالي → الخرطوم) فأظهر أرقاماً خيالية.
  const [destChosen, setDestChosen] = useState(false)

  // منزل المنظّم فقط. بقية الركّاب ينضمّون كلٌّ بمنزله عبر رابط الدعوة.
  const [home, setHome] = useState<google.maps.LatLngLiteral>(KHARTOUM)
  const [homeAddress, setHomeAddress] = useState('')
  const [time, setTime] = useState('07:30')
  const [returnTime, setReturnTime] = useState('15:30')
  const [selected, setSelected] = useState<string[]>([
    'السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء',
  ])
  const [roundTrip, setRoundTrip] = useState(true)
  const [busy, setBusy] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  // خطّة الدفع (يومي/شهري) + طريقة دفع المنظّم لليومي.
  const [plan, setPlan] = useState<'daily' | 'monthly'>('daily')
  const [payMethod, setPayMethod] = useState<'cash' | 'wallet'>('cash')
  const [periodRate, setPeriodRate] = useState<PeriodRate | null>(null)
  const [settings, setSettings] = useState<Settings | null>(null)

  // تسعير فترة المركبة حسب وقت الذهاب (يُعاد حسابه عند تغيّر الوقت).
  useEffect(() => {
    void Promise.all([getServicePricing(serviceId), listServicePeriods(), getSettings()]).then(
      ([, periods, s]) => {
        setSettings(s)
        const per = periodFromTime(time || '07:00')
        const row = periods.find((r) => r.service_id === serviceId && r.period === per)
        setPeriodRate(
          row
            ? { base_fare: row.base_fare, per_km: row.per_km, per_min: row.per_min, min_fare: row.min_fare }
            : null,
        )
      },
    )
  }, [serviceId, time])

  const commuteEnabled = settings?.commute_enabled ?? true
  const discount = settings?.commute_discount ?? 0
  const weeks = settings?.commute_weeks_per_month ?? 4
  // أجرة نقطة (منزل → الوجهة، ذهاب/إياب، بعد الخصم) — 0 إن لم يتوفّر التسعير.
  const dailyFareAt = (pos: google.maps.LatLngLiteral) =>
    periodRate ? memberDailyFare(pos, dest, periodRate, roundTrip, discount) : 0
  const orgDaily = dailyFareAt(home)
  const orgMonthly = monthlyTotal(orgDaily, selected.length, weeks)

  // منزل المنظّم = موقعه الحالي مبدئياً، ويمكن تعديله.
  const located = useRef(false)
  useEffect(() => {
    if (located.current || !navigator.geolocation) return
    located.current = true
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setHome({ lat: p.coords.latitude, lng: p.coords.longitude })
        setHomeAddress((a) => a || 'موقعي الحالي')
      },
      () => {},
      { timeout: 8000 },
    )
  }, [])

  const toggleDay = (d: string) =>
    setSelected((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]))

  const create = async () => {
    if (selected.length === 0) return
    if (!periodRate || orgDaily <= 0) return alert('يجري حساب السعر… أعد المحاولة بعد لحظة')
    setBusy(true)
    try {
      const order = await createCommuteOrder(
        {
          service_id: serviceId,
          dest: { ...dest, address: destAddress || 'مكان العمل' },
          scheduled_time: time,
          return_time: roundTrip ? returnTime : null,
          days: selected,
          round_trip: roundTrip,
          plan,
          organizer: {
            name: profile?.full_name?.trim() || 'المنظّم',
            home: { ...home, address: homeAddress || 'منزل المنظّم' },
            fare: orgDaily,
            pay_method: plan === 'monthly' ? 'wallet' : payMethod,
          },
        },
        profile?.id ?? null,
      )
      // بقية الركّاب ينضمّون كلٌّ بمنزله عبر رابط الدعوة (لا تُضاف نقاط الآخرين هنا).
      setBusy(false)
      navigate(`/commute/${order.id}`)
    } catch (e) {
      setBusy(false)
      alert(e instanceof Error ? e.message : 'تعذّر إنشاء الترحيل، تحقّق من اتصالك وحاول مجدداً.')
    }
  }

  return (
    <div className="screen">
      <header className="flex items-center gap-3 px-4 py-4">
        <Logo size={36} rounded={10} />
        <div>
          <h1 className="text-lg font-bold text-royal">ترحيل يومي</h1>
          <p className="text-xs text-ink-muted">مشوار مشترك لنفس المكان — كلٌّ من منزله</p>
        </div>
      </header>

      <main className="flex-1 space-y-4 px-4 pb-24">
        {/* انضمام بدعوة زميل عبر الرمز */}
        <div className="card p-4">
          <p className="font-bold text-royal">لديك رمز دعوة؟</p>
          <p className="mb-2 text-xs text-ink-muted">
            أدخل الرمز الذي وصلك من منظّم الترحيل للانضمام لمشوارهم.
          </p>
          <div className="flex gap-2">
            <input
              className="field flex-1 text-center tracking-[0.3em]"
              dir="ltr"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.trim())}
              placeholder="رمز الدعوة"
            />
            <button
              onClick={() => joinCode && navigate(`/commute/join/${joinCode}`)}
              disabled={!joinCode}
              className="press-scale rounded-2xl bg-royal px-5 font-bold text-white disabled:opacity-40"
            >
              انضمام
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="h-px flex-1 bg-hairline" />
          <span className="text-xs font-bold text-ink-muted">أو أنشئ ترحيلاً جديداً</span>
          <span className="h-px flex-1 bg-hairline" />
        </div>

        {/* خطّة الدفع + التسعير */}
        {commuteEnabled && (
          <div className="card space-y-3 p-4">
            <p className="label">خطّة الدفع</p>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ['daily', 'يومي', 'أجرة كل يوم — من المحفظة (بشرط كفاية الرصيد) أو كاش/بنك للسائق'],
                  ['monthly', 'شهري', 'تدفع اشتراك الشهر مقدّماً من محفظتك'],
                ] as const
              ).map(([id, label, desc]) => (
                <button
                  key={id}
                  onClick={() => setPlan(id)}
                  className={`rounded-2xl border p-3 text-right transition ${
                    plan === id ? 'border-royal bg-royal-soft' : 'border-hairline bg-white'
                  }`}
                >
                  <p className="text-sm font-bold text-royal">{label}</p>
                  <p className="mt-0.5 text-[11px] text-ink-muted">{desc}</p>
                </button>
              ))}
            </div>

            {/* طريقة دفع المنظّم (اليومي فقط) */}
            {plan === 'daily' && (
              <div>
                <p className="label">طريقة دفعك (المنظّم)</p>
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
                  <p className="mt-1 text-[11px] text-ink-muted">
                    يجب أن يغطّي رصيد محفظتك أجرة اليوم؛ وإلا يتحوّل ذلك اليوم لدفع كاش/بنك للسائق.
                  </p>
                )}
              </div>
            )}

            {/* المنظّم لا يُعرض له «أجرة يومية» — كلّ راكب يدفع أجرته من منزله عند
                ركوبه. نعرض مبلغ الاشتراك الشهري فقط لأنه يُخصم مقدّماً عند الإنشاء. */}
            {plan === 'monthly' && destChosen && periodRate && orgMonthly > 0 ? (
              <div className="rounded-2xl bg-gold-soft p-3 text-sm text-ink">
                <p>
                  اشتراكك الشهري <span className="font-bold text-sand-ink">{money(orgMonthly)}</span>
                </p>
                <p className="mt-0.5 text-[11px] text-ink-muted">يُخصم مقدّماً من محفظتك عند الإنشاء.</p>
                {discount > 0 && (
                  <p className="mt-0.5 text-[11px] text-green">شامل خصم الترحيل {Math.round(discount * 100)}%</p>
                )}
              </div>
            ) : (
              <div className="rounded-2xl bg-royal-soft p-3 text-sm text-ink">
                <p className="font-bold text-royal">اجعل مشوارك اليومي أوفر 🚗</p>
                <p className="mt-1 text-[12px] leading-relaxed text-ink-soft">
                  أنشئ ترحيلاً وشاركه مع أصدقائك وزملائك — كلٌّ ينطلق من منزله إلى نفس المكان
                  ويعود، بأجرةٍ مقسّمة وخصمٍ خاصٍّ للترحيل.
                </p>
              </div>
            )}
          </div>
        )}

        {/* منزلك (نقطة انطلاقك) — بحث بالاسم أو تحديد بالخريطة */}
        <div className="card p-4">
          <p className="font-bold text-royal">منزلك (نقطة انطلاقك)</p>
          <p className="mb-3 text-xs text-ink-soft">
            حدّد منزلك فقط — بقية الركّاب ينضمّون كلٌّ بمنزله عبر رابط الدعوة بعد الإنشاء.
          </p>
          <PlaceSearch
            value={homeAddress}
            onChange={setHomeAddress}
            onPick={({ pos, address }) => {
              setHome(pos)
              setHomeAddress(address)
            }}
            placeholder="اكتب اسم الحي/المكان أو حدّده بالخريطة"
            className="field mb-2"
          />
          <LocationPicker center={home} onChange={setHome} />
        </div>

        {/* مكان العمل (الوجهة) — بحث بالاسم أو تحديد بالخريطة */}
        <div>
          <p className="label">مكان العمل (الوجهة المشتركة)</p>
          <PlaceSearch
            value={destAddress}
            onChange={setDestAddress}
            onPick={({ pos, address }) => {
              setDest(pos)
              setDestAddress(address)
              setDestChosen(true)
            }}
            placeholder="اكتب اسم مكان العمل أو حدّده بالخريطة"
            className="field mb-2"
          />
          <LocationPicker
            center={dest}
            onChange={(p) => {
              setDest(p)
              setDestChosen(true)
            }}
          />
        </div>

        {/* أوقات الذهاب والإياب */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">وقت الذهاب</label>
            <input
              type="time"
              className="field"
              dir="ltr"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
            <p className="mt-1 text-[11px] text-ink-muted">الوصول لمكان العمل</p>
          </div>
          <div className={roundTrip ? '' : 'opacity-40'}>
            <label className="label">وقت الإياب</label>
            <input
              type="time"
              className="field"
              dir="ltr"
              value={returnTime}
              disabled={!roundTrip}
              onChange={(e) => setReturnTime(e.target.value)}
            />
            <p className="mt-1 text-[11px] text-ink-muted">المغادرة من العمل</p>
          </div>
        </div>

        {/* الأيام */}
        <div className="card p-4">
          <p className="label">أيام الترحيل</p>
          <div className="flex flex-wrap gap-2">
            {days.map((d) => {
              const on = selected.includes(d)
              return (
                <button
                  key={d}
                  onClick={() => toggleDay(d)}
                  className={`chip border px-3 py-1.5 ${
                    on ? 'border-royal bg-royal text-white' : 'border-hairline bg-white text-ink-soft'
                  }`}
                >
                  {d}
                </button>
              )
            })}
          </div>
        </div>

        {/* ذهاب وإياب */}
        <div className="card flex items-center justify-between p-4">
          <div>
            <p className="font-medium">ذهاب وإياب</p>
            <p className="text-xs text-ink-muted">
              {roundTrip
                ? 'الإياب من مكان العمل إلى منزل كل راكب'
                : 'ذهاب فقط (بدون رحلة عودة)'}
            </p>
          </div>
          <button
            onClick={() => setRoundTrip((v) => !v)}
            role="switch"
            aria-checked={roundTrip}
            className={`relative h-7 w-12 rounded-full transition ${roundTrip ? 'bg-royal' : 'bg-hairline'}`}
          >
            <span
              className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${roundTrip ? 'right-1' : 'right-6'}`}
            />
          </button>
        </div>

        <button className="btn-primary w-full" onClick={create} disabled={busy}>
          {busy ? '…' : 'إنشاء ترحيل ومشاركة الرابط'}
        </button>
      </main>

      <BottomNav />
    </div>
  )
}
