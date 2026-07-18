import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Map as MapIcon, Plus, Check } from 'lucide-react'
import BottomNav from '@/components/BottomNav'
import Logo from '@/components/Logo'
import LocationPicker from '@/components/LocationPicker'
import PlaceSearch from '@/components/PlaceSearch'
import VehicleImage from '@/components/VehicleImage'
import { services } from '@/data/services'
import { useAuth } from '@/store/AuthContext'
import { createCommuteOrder, joinCommuteOrder } from '@/lib/commute'
import { KHARTOUM } from '@/theme'

const days = ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة']
const shareable = services.filter((s) => s.sharable)

/** نقطة انطلاق راكب واحد في الترحيل. */
interface PickPoint {
  name: string
  addr: string
  pos: google.maps.LatLngLiteral
  placed: boolean // حُدّدت فعلاً (خريطة/اقتراح/GPS)
}

/**
 * ترحيل — إنشاء طلب مشترك: مركبة + مكان العمل (وجهة) + وقت + أيام.
 * المنظّم يُنشئ الطلب ثم يشارك رابط الدعوة؛ البقية ينضمّون كلٌّ بمنزله.
 */
export default function Commute() {
  const navigate = useNavigate()
  const { profile } = useAuth()

  const [serviceId, setServiceId] = useState(shareable[0].id)
  const [dest, setDest] = useState<google.maps.LatLngLiteral>(KHARTOUM)
  const [destAddress, setDestAddress] = useState('')

  // نقاط الانطلاق (منازل الركاب) — الأولى للمنظّم، والبقية يضيفها حتى سعة المركبة.
  const [points, setPoints] = useState<PickPoint[]>([
    { name: '', addr: '', pos: KHARTOUM, placed: false },
  ])
  const [activeIdx, setActiveIdx] = useState(0)
  const [time, setTime] = useState('07:30')
  const [returnTime, setReturnTime] = useState('15:30')
  const [selected, setSelected] = useState<string[]>([
    'السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء',
  ])
  const [roundTrip, setRoundTrip] = useState(true)
  const [busy, setBusy] = useState(false)
  const [joinCode, setJoinCode] = useState('')

  // سعة المركبة = عدد نقاط الانطلاق (المنازل) الممكنة للذهاب/الإياب.
  const seats = services.find((s) => s.id === serviceId)?.seats ?? 4

  // عند اختيار مركبة أصغر: لا تتجاوز النقاط سعتها.
  useEffect(() => {
    setPoints((cur) => (cur.length > seats ? cur.slice(0, seats) : cur))
    setActiveIdx(0)
  }, [seats])

  // نقطة انطلاق المنظّم = موقعه الحالي مبدئياً، ويمكن تعديلها.
  useEffect(() => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (p) =>
        setPoints((cur) =>
          cur.map((pt, i) =>
            i === 0 && !pt.placed
              ? { ...pt, pos: { lat: p.coords.latitude, lng: p.coords.longitude }, placed: true, addr: pt.addr || 'موقعي الحالي' }
              : pt,
          ),
        ),
      () => {},
      { timeout: 8000 },
    )
  }, [])

  const setPoint = (i: number, patch: Partial<PickPoint>) =>
    setPoints((cur) => cur.map((p, x) => (x === i ? { ...p, ...patch } : p)))

  const addPoint = () => {
    setPoints((cur) => [...cur, { name: '', addr: '', pos: cur[0].pos, placed: false }])
    setActiveIdx(points.length)
  }

  const removePoint = (i: number) => {
    setPoints((cur) => cur.filter((_, x) => x !== i))
    setActiveIdx(0)
  }

  const toggleDay = (d: string) =>
    setSelected((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]))

  const create = async () => {
    if (selected.length === 0) return
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
          organizer: {
            name: profile?.full_name?.trim() || 'المنظّم',
            home: { ...points[0].pos, address: points[0].addr || 'منزل المنظّم' },
          },
        },
        profile?.id ?? null,
      )
      // بقية نقاط الانطلاق تُسجَّل كأعضاء في نفس الطلب (نتابع رغم فشل أحدهم).
      let joinFails = 0
      for (let i = 1; i < points.length; i++) {
        const p = points[i]
        try {
          await joinCommuteOrder(order.id, {
            name: p.name.trim() || `راكب ${i + 1}`,
            home: { ...p.pos, address: p.addr || `نقطة انطلاق ${i + 1}` },
          })
        } catch {
          joinFails++
        }
      }
      setBusy(false)
      if (joinFails > 0) {
        alert(`تم إنشاء الترحيل، لكن تعذّر إضافة ${joinFails} راكب — يمكنهم الانضمام لاحقاً برمز الدعوة.`)
      }
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

        {/* المركبة */}
        <div>
          <p className="label">نوع المركبة</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {shareable.map((s) => (
              <button
                key={s.id}
                onClick={() => setServiceId(s.id)}
                className={`shrink-0 rounded-2xl border p-2 text-center transition ${
                  serviceId === s.id
                    ? 'border-royal bg-royal-soft'
                    : 'border-hairline bg-white'
                }`}
                style={{ width: 96 }}
              >
                <VehicleImage service={s} className="h-10 w-full" />
                <p className="mt-1 text-xs font-bold">{s.name}</p>
                <p className="text-[10px] text-ink-muted">{s.seats} مقاعد</p>
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-ink-soft">
            تتّسع لـ <span className="font-bold text-royal">{seats}</span> نقاط انطلاق —
            كل راكب من منزله إلى مكان العمل، والعودة بالعكس.
          </p>
        </div>

        {/* نقاط الانطلاق (منازل الركاب) — حتى سعة المركبة */}
        <div className="card p-4">
          <div className="mb-1 flex items-center justify-between">
            <p className="font-bold">نقاط الانطلاق</p>
            <span className="text-xs font-bold text-royal">
              {points.length} / {seats}
            </span>
          </div>
          <p className="mb-3 text-xs text-ink-soft">
            كل راكب من منزله إلى الوجهة المشتركة — والإياب بالعكس. أضف نقطة لكل راكب،
            أو شارك رابط الدعوة بعد الإنشاء لينضمّ كلٌّ بنفسه.
          </p>

          <div className="space-y-3">
            {points.map((p, i) => (
              <div
                key={i}
                className={`rounded-2xl border p-3 ${
                  activeIdx === i ? 'border-royal bg-royal-soft/40' : 'border-hairline'
                }`}
              >
                <div className="mb-2 flex items-center justify-between">
                  <p className="flex items-center gap-1.5 text-sm font-bold">
                    <span className="h-2.5 w-2.5 rounded-full bg-royal" />
                    {i === 0 ? 'انطلاقي (المنظّم)' : `راكب ${i + 1}`}
                    {p.placed && <Check className="h-4 w-4 text-royal" strokeWidth={2.5} />}
                  </p>
                  {i > 0 && (
                    <button
                      onClick={() => removePoint(i)}
                      className="text-xs font-bold text-danger"
                    >
                      حذف
                    </button>
                  )}
                </div>
                {i > 0 && (
                  <input
                    className="field mb-2"
                    value={p.name}
                    onChange={(e) => setPoint(i, { name: e.target.value })}
                    placeholder={`اسم الراكب ${i + 1} (اختياري)`}
                  />
                )}
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <PlaceSearch
                      value={p.addr}
                      onFocus={() => setActiveIdx(i)}
                      onChange={(v) => setPoint(i, { addr: v, placed: v.trim() !== '' || p.placed })}
                      onPick={({ pos, address }) => setPoint(i, { pos, addr: address, placed: true })}
                      placeholder="اكتب اسم المكان أو حدّده بالخريطة"
                      className="field"
                    />
                  </div>
                  <button
                    onClick={() => setActiveIdx(i)}
                    aria-label="تحديد على الخريطة"
                    className={`grid shrink-0 place-items-center rounded-xl border px-3 py-2.5 ${
                      activeIdx === i
                        ? 'border-royal bg-royal text-white'
                        : 'border-royal/40 text-royal'
                    }`}
                  >
                    <MapIcon className="h-4 w-4" strokeWidth={1.8} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {points.length < seats && (
            <button
              onClick={addPoint}
              className="btn-outline mt-3 flex w-full items-center justify-center gap-1.5"
            >
              <Plus className="h-4 w-4" strokeWidth={2} /> إضافة نقطة انطلاق ({points.length}/{seats})
            </button>
          )}

          {/* خريطة النقطة النشطة */}
          <p className="mb-1 mt-3 text-xs text-ink-soft">
            حرّك الخريطة لتحديد{' '}
            <span className="font-bold text-royal">
              {activeIdx === 0 ? 'انطلاق المنظّم' : `انطلاق الراكب ${activeIdx + 1}`}
            </span>
          </p>
          <LocationPicker
            center={points[activeIdx]?.pos ?? KHARTOUM}
            onChange={(pos) => setPoint(activeIdx, { pos, placed: true })}
          />
        </div>

        {/* مكان العمل (الوجهة) */}
        <div>
          <p className="label">مكان العمل (الوجهة المشتركة)</p>
          <LocationPicker center={dest} onChange={setDest} />
          <input
            className="field mt-2"
            value={destAddress}
            onChange={(e) => setDestAddress(e.target.value)}
            placeholder="اسم المكان (اختياري)"
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
