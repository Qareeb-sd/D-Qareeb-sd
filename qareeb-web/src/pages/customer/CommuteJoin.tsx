import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Screen from '@/components/Screen'
import LocationPicker from '@/components/LocationPicker'
import { getService } from '@/data/services'
import { getCommuteOrderByCode, joinCommuteOrder } from '@/lib/commute'
import { KHARTOUM } from '@/theme'
import type { CommuteOrder } from '@/lib/types'

/** صفحة الانضمام عبر رابط الدعوة: يضيف المدعوّ اسمه ومنزله وينضم للطلب. */
export default function CommuteJoin() {
  const { code = '' } = useParams()
  const navigate = useNavigate()

  const [order, setOrder] = useState<CommuteOrder | null | undefined>(undefined)
  const [name, setName] = useState('')
  const [home, setHome] = useState<google.maps.LatLngLiteral>(KHARTOUM)
  const [homeAddress, setHomeAddress] = useState('')
  const [busy, setBusy] = useState(false)
  const located = useRef(false)

  useEffect(() => {
    void getCommuteOrderByCode(code).then(setOrder)
  }, [code])

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

  const join = async () => {
    if (!name.trim()) return
    setBusy(true)
    const { error } = await joinCommuteOrder(order.id, {
      name: name.trim(),
      home: { ...home, address: homeAddress || 'منزلي' },
    })
    setBusy(false)
    if (error) return alert(error)
    navigate(`/commute/${order.id}`)
  }

  return (
    <Screen title="انضمام للترحيل" back>
      {/* تفاصيل الطلب */}
      <div className="card space-y-2 p-4">
        <p className="font-bold">دعوة ترحيل · {service?.name ?? order.service_id}</p>
        <p className="text-sm text-ink-soft">🏢 {order.dest_address ?? 'مكان العمل'}</p>
        <p className="text-sm text-ink-soft">
          ⏰ الوصول {order.scheduled_time} · 📅 {order.days.join(' · ')}
        </p>
      </div>

      <p className="mt-4 mb-1 font-bold">أضف بياناتك</p>
      <input
        className="field"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="اسمك"
      />

      <p className="label mt-3">حدّد منزلك (نقطة انطلاقك)</p>
      <LocationPicker center={home} onChange={setHome} />
      <input
        className="field mt-2"
        value={homeAddress}
        onChange={(e) => setHomeAddress(e.target.value)}
        placeholder="اسم الحي/المكان (اختياري)"
      />

      <button className="btn-primary mt-4 w-full" onClick={join} disabled={busy}>
        {busy ? '…' : 'انضمام للترحيل'}
      </button>
    </Screen>
  )
}
