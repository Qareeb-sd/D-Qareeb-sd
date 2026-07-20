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
import { visibleServices } from '@/data/services'
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

  // المركبة المطلوبة للترحيل — تحدّد عدد المقاعد (كم راكباً يمكنه الانضمام)
  // وتسعير الفترة. المركبات المدعومة للترحيل هي المشتركة (sharable) عدا «المشوار
  // المفتوح» (إيجار بلا وجهة ثابتة).
  const vehicles = visibleServices().filter((s) => s.sharable && s.id !== 'open')
  const [serviceId, setServiceId] = useState('standard')
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
  const monthlyDiscount = settings?.commute_monthly_discount ?? 0
  const weeks = settings?.commute_weeks_per_month ?? 4
  // أجرة نقطة (منزل → الوجهة، ذهاب/إياب، بعد الخصم) — 0 إن لم يتوفّر التسعير.
  const dailyFareAt = (pos: google.maps.LatLngLiteral) =>
    periodRate ? memberDailyFare(pos, dest, periodRate, roundTrip, discount) : 0
  const orgDaily = dailyFareAt(home)
  const orgMonthly = monthlyTotal(orgDaily, selected.length, weeks, monthlyDiscount)

  // منزل المنظّم = موقعه الحالي مبدئياً. خريطة الوجهة تبدأ عند موقعه أيضاً (لا
  // نفترض الخرطوم) حتى يجدها العميل بجواره ويحدّدها بنفسه — بلا وجهة مفروضة.
  const located = useRef(false)
  useEffect(() => {
    if (located.current || !navigator.geolocation) return
    located.current = true
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const pos = { lat: p.coords.latitude, lng: p.coords.longitude }
        setHome(pos)
        setHomeAddress((a) => a || 'موقعي الحالي')
        // نُوسّط خريطة الوجهة عند العميل فقط طالما لم يحدّدها بعد (destChosen=false).
        setDest((d) => (destChosen ? d : pos))
      },
      () => {},
      { timeout: 8000 },
    )
    // يُنفَّذ مرّة واحدة عند التحميل قبل أي اختيار.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggleDay = (d: string) =>
    setSelected((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]))

  const create = async () => {
    if (selected.length === 0) return
    if (!destChosen) return alert('حدّد مكان العمل (الوجهة) أولاً')
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

        {/* بطاقة الميزة — تعريف مختصر بالترحيل */}
        {commuteEnabled && (
          <div className="rounded-2xl bg-royal-soft p-3 text-sm text-ink">
            <p className="font-bold text-royal">اجعل مشوارك اليومي أوفر 🚗</p>
            <p className="mt-1 text-[12px] leading-relaxed text-ink-soft">
              حدّد منزلك ومكان عملك ووقتك — ثم شارك الرابط مع أصدقائك، وكلٌّ ينطلق من
              منزله إلى نفس المكان، بأجرةٍ مقسّمة وخصمٍ خاصٍّ للترحيل.
            </p>
          </div>
        )}

        {/* ① المركبة — تحدّد سعة الركّاب والتسعير */}
        <div className="card p-4">
          <p className="font-bold text-royal">① المركبة</p>
          <p className="mb-3 text-xs text-ink-soft">اختر النوع حسب عدد الركّاب المتوقّع.</p>
          <div className="grid grid-cols-2 gap-2">
            {vehicles.map((s) => (
              <button
                key={s.id}
                onClick={() => setServiceId(s.id)}
                className={`rounded-2xl border p-3 text-right transition ${
                  serviceId === s.id ? 'border-royal bg-royal-soft' : 'border-hairline bg-white'
                }`}
              >
                <p className="text-sm font-bold text-royal">{s.name}</p>
                <p className="mt-0.5 text-[11px] text-ink-muted">{s.seats} مقاعد</p>
              </button>
            ))}
          </div>
        </div>

        {/* ② منزلك — يُحدَّد تلقائياً من الموقع، قابل للتعديل */}
        <div className="card p-4">
          <p className="font-bold text-royal">② منزلك</p>
          <p className="mb-3 text-xs text-ink-soft">حُدِّد تلقائياً من موقعك — عدّله إن لزم.</p>
          <PlaceSearch
            value={homeAddress}
            onChange={setHomeAddress}
            onPick={({ pos, address }) => {
              setHome(pos)
              setHomeAddress(address)
            }}
            placeholder="اكتب اسم الحي/المكان أو حرّك الخريطة"
            className="field mb-2"
          />
          <LocationPicker center={home} onChange={setHome} className="h-40" />
        </div>

        {/* ② مكان العمل — الوجهة المشتركة (الخطوة الأساسية) */}
        <div className="card p-4">
          <p className="font-bold text-royal">③ مكان العمل</p>
          <p className="mb-3 text-xs text-ink-soft">وجهتكم المشتركة — اكتب اسمها أو حرّك الخريطة لتحديدها.</p>
          <PlaceSearch
            value={destAddress}
            onChange={setDestAddress}
            onPick={({ pos, address }) => {
              setDest(pos)
              setDestAddress(address)
              setDestChosen(true)
            }}
            placeholder="اكتب اسم مكان العمل أو حرّك الخريطة"
            className="field mb-2"
          />
          <LocationPicker
            center={dest}
            onChange={(p) => {
              setDest(p)
              setDestChosen(true)
            }}
            className="h-40"
          />
        </div>

        {/* ③ المواعيد والأيام — بطاقة واحدة */}
        <div className="card space-y-4 p-4">
          <p className="font-bold text-royal">④ المواعيد والأيام</p>

          {/* ذهاب وإياب */}
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">ذهاب وإياب</p>
              <p className="text-xs text-ink-muted">
                {roundTrip ? 'يشمل رحلة العودة من العمل' : 'ذهاب فقط (بدون عودة)'}
              </p>
            </div>
            <button
              onClick={() => setRoundTrip((v) => !v)}
              role="switch"
              aria-checked={roundTrip}
              className={`relative h-7 w-12 shrink-0 rounded-full transition ${roundTrip ? 'bg-royal' : 'bg-hairline'}`}
            >
              <span
                className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${roundTrip ? 'right-1' : 'right-6'}`}
              />
            </button>
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
            </div>
          </div>

          {/* الأيام */}
          <div>
            <p className="label">الأيام</p>
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
        </div>

        {/* ④ الدفع — في النهاية، بعد تحديد الوجهة والمواعيد */}
        {commuteEnabled && (
          <div className="card space-y-3 p-4">
            <p className="font-bold text-royal">⑤ الدفع</p>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ['daily', 'يومي', 'أجرة كل يوم — محفظة أو كاش/بنك للسائق'],
                  ['monthly', 'شهري', 'اشتراك الشهر مقدّماً من محفظتك'],
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
            )}

            {/* مبلغ الاشتراك الشهري فقط (يُخصم مقدّماً عند الإنشاء) */}
            {plan === 'monthly' && destChosen && periodRate && orgMonthly > 0 && (
              <div className="rounded-2xl bg-gold-soft p-3 text-sm text-ink">
                <p>
                  اشتراكك الشهري <span className="font-bold text-sand-ink">{money(orgMonthly)}</span>
                </p>
                <p className="mt-0.5 text-[11px] text-ink-muted">يُخصم مقدّماً من محفظتك عند الإنشاء.</p>
                {monthlyDiscount > 0 && (
                  <p className="mt-0.5 text-[11px] text-green">
                    وفّرت {Math.round(monthlyDiscount * 100)}% باختيارك الاشتراك الشهري 🎉
                  </p>
                )}
                {discount > 0 && (
                  <p className="mt-0.5 text-[11px] text-green">شامل خصم الترحيل {Math.round(discount * 100)}%</p>
                )}
              </div>
            )}
          </div>
        )}

        <button
          className="btn-primary w-full"
          onClick={create}
          disabled={busy || !destChosen || selected.length === 0}
        >
          {busy ? '…' : !destChosen ? 'حدّد مكان العمل أولاً' : 'إنشاء ترحيل ومشاركة الرابط'}
        </button>
      </main>

      <BottomNav />
    </div>
  )
}
