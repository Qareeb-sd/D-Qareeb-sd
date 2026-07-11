import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BottomNav from '@/components/BottomNav'
import MapView from '@/components/MapView'
import VehicleImage from '@/components/VehicleImage'
import Logo from '@/components/Logo'
import { services } from '@/data/services'
import { listServicePricing } from '@/lib/api'
import { money } from '@/lib/format'
import { KHARTOUM } from '@/theme'
import { useRide } from '@/store/RideContext'

const CHIPS = [
  { key: 'favorite', label: 'المفضلة', icon: '⭐' },
  { key: 'work', label: 'العمل', icon: '💼' },
  { key: 'home', label: 'المنزل', icon: '🏠' },
]

// سيّارات وهمية قرب المركز لإظهار الحركة على الخريطة (تظهر عند تفعيل مفتاح الخرائط).
const nearbyCars = [
  { lat: KHARTOUM.lat + 0.006, lng: KHARTOUM.lng - 0.004 },
  { lat: KHARTOUM.lat - 0.005, lng: KHARTOUM.lng + 0.006 },
  { lat: KHARTOUM.lat + 0.004, lng: KHARTOUM.lng + 0.007 },
  { lat: KHARTOUM.lat - 0.006, lng: KHARTOUM.lng - 0.005 },
]

export default function Home() {
  const navigate = useNavigate()
  const { setServiceId } = useRide()
  const [prices, setPrices] = useState<Record<string, number>>({})

  useEffect(() => {
    void listServicePricing().then((rows) => {
      const map: Record<string, number> = {}
      rows.forEach((r) => (map[r.service_id] = r.base_fare))
      setPrices(map)
    })
  }, [])

  const chooseService = (id: string) => {
    setServiceId(id)
    navigate('/select-location')
  }

  return (
    <div className="screen">
      <header className="flex items-center gap-3 px-4 py-3">
        <Logo size={38} rounded={11} />
        <div className="flex-1">
          <p className="text-xs text-ink-muted">أهلاً بك في</p>
          <p className="font-extrabold text-green">قريب</p>
        </div>
      </header>

      {/* الخريطة مع السيّارات القريبة */}
      <div className="relative min-h-[200px] flex-1 overflow-hidden">
        <MapView center={KHARTOUM} driverMarkers={nearbyCars} className="h-full w-full" />
        {/* نبضة موقعي في المنتصف */}
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <span className="relative grid h-6 w-6 place-items-center">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green/30" />
            <span className="relative h-4 w-4 rounded-full bg-green ring-2 ring-white" />
          </span>
        </div>
      </div>

      {/* اللوحة السفلية */}
      <div className="relative z-10 -mt-5 rounded-t-3xl border-t border-hairline bg-white px-4 pt-3">
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-hairline" />

        {/* بحث الوجهة */}
        <button
          onClick={() => navigate('/select-location')}
          className="flex w-full items-center gap-3 rounded-2xl border border-hairline bg-white px-4 py-3.5 text-right shadow-sm"
        >
          <span className="text-green">🔎</span>
          <span className="flex-1 text-ink-muted">وين ماشي؟</span>
        </button>

        {/* الأماكن المحفوظة */}
        <div className="mt-3 grid grid-cols-3 gap-2">
          {CHIPS.map((c) => (
            <button
              key={c.key}
              onClick={() => navigate('/select-location')}
              className="rounded-2xl bg-hairline/40 px-2 py-2.5 text-sm font-bold text-ink-soft"
            >
              {c.icon} {c.label}
            </button>
          ))}
        </div>

        {/* اختر الخدمة */}
        <div className="mb-2 mt-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">اختر الخدمة</h2>
          <button onClick={() => navigate('/services')} className="text-sm font-bold text-green">
            الكل ‹
          </button>
        </div>

        <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-4">
          {services.map((s) => {
            const accent = s.femaleDriver
              ? '#C13584'
              : s.id === 'open'
                ? '#B07E00'
                : null
            return (
              <button
                key={s.id}
                onClick={() => chooseService(s.id)}
                className="card w-36 shrink-0 p-3 text-center"
              >
                <VehicleImage service={s} className="h-14 w-full" />
                <p className="mt-1 font-bold" style={accent ? { color: accent } : undefined}>
                  {s.name}
                </p>
                <p className="line-clamp-2 min-h-[28px] text-[11px] text-ink-soft">{s.tagline}</p>
                <p className="text-[11px] text-ink-muted">{s.seats} مقاعد</p>
                <p className="mt-0.5 text-sm font-extrabold text-green">
                  {prices[s.id] ? money(prices[s.id]) : '—'}
                </p>
              </button>
            )
          })}
        </div>
      </div>

      <BottomNav />
    </div>
  )
}
