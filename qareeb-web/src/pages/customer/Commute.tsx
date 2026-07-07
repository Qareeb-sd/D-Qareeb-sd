import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BottomNav from '@/components/BottomNav'
import Logo from '@/components/Logo'
import LocationPicker from '@/components/LocationPicker'
import VehicleImage from '@/components/VehicleImage'
import { services } from '@/data/services'
import { useAuth } from '@/store/AuthContext'
import { createCommuteOrder } from '@/lib/commute'
import { KHARTOUM } from '@/theme'

const days = ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة']
const shareable = services.filter((s) => s.sharable)

/**
 * ترحيل — إنشاء طلب مشترك: مركبة + مكان العمل (وجهة) + وقت + أيام.
 * المنظّم يُنشئ الطلب ثم يشارك رابط الدعوة؛ البقية ينضمّون كلٌّ بمنزله.
 */
export default function Commute() {
  const navigate = useNavigate()
  const { profile } = useAuth()

  const [serviceId, setServiceId] = useState(shareable[0].id)
  const [name, setName] = useState(profile?.full_name ?? '')
  const [dest, setDest] = useState<google.maps.LatLngLiteral>(KHARTOUM)
  const [destAddress, setDestAddress] = useState('')
  const [time, setTime] = useState('07:30')
  const [selected, setSelected] = useState<string[]>([
    'السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء',
  ])
  const [roundTrip, setRoundTrip] = useState(true)
  const [busy, setBusy] = useState(false)

  // منزل المنظّم = موقعه الحالي (يمكن تعديله لاحقاً).
  const home = useRef<google.maps.LatLngLiteral>(KHARTOUM)
  useEffect(() => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (p) => (home.current = { lat: p.coords.latitude, lng: p.coords.longitude }),
      () => {},
      { timeout: 8000 },
    )
  }, [])

  const toggleDay = (d: string) =>
    setSelected((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]))

  const create = async () => {
    if (!name.trim() || selected.length === 0) return
    setBusy(true)
    const order = await createCommuteOrder(
      {
        service_id: serviceId,
        dest: { ...dest, address: destAddress || 'مكان العمل' },
        scheduled_time: time,
        days: selected,
        round_trip: roundTrip,
        organizer: { name: name.trim(), home: { ...home.current, address: 'منزلي' } },
      },
      profile?.id ?? null,
    )
    setBusy(false)
    navigate(`/commute/${order.id}`)
  }

  return (
    <div className="screen">
      <header className="flex items-center gap-3 px-4 py-4">
        <Logo size={36} rounded={10} />
        <div>
          <h1 className="text-lg font-bold">ترحيل يومي</h1>
          <p className="text-xs text-ink-muted">مشوار مشترك لنفس المكان — كلٌّ من منزله</p>
        </div>
      </header>

      <main className="flex-1 space-y-4 px-4 pb-24">
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
                    ? 'border-green bg-green-soft'
                    : 'border-hairline bg-white'
                }`}
                style={{ width: 96 }}
              >
                <VehicleImage service={s} className="h-10 w-full" />
                <p className="mt-1 text-xs font-bold">{s.name}</p>
              </button>
            ))}
          </div>
        </div>

        {/* اسم المنظّم */}
        <div>
          <label className="label">اسمك</label>
          <input
            className="field"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="اسمك"
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

        {/* الوقت */}
        <div>
          <label className="label">وقت الوصول</label>
          <input
            type="time"
            className="field"
            dir="ltr"
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
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
                    on ? 'border-green bg-green text-white' : 'border-hairline bg-white text-ink-soft'
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
            <p className="text-xs text-ink-muted">رحلة العودة في نفس اليوم</p>
          </div>
          <button
            onClick={() => setRoundTrip((v) => !v)}
            role="switch"
            aria-checked={roundTrip}
            className={`relative h-7 w-12 rounded-full transition ${roundTrip ? 'bg-green' : 'bg-hairline'}`}
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
