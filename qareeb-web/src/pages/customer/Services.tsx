import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BottomNav from '@/components/BottomNav'
import VehicleImage from '@/components/VehicleImage'
import { BackIcon } from '@/components/Icons'
import { services } from '@/data/services'
import { listServicePricing } from '@/lib/api'
import { money } from '@/lib/format'
import { useRide } from '@/store/RideContext'

/** صفحة اختيار الخدمة الكاملة — شبكة المركبات مع السعر والحالة. */
export default function Services() {
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

  const choose = (id: string) => {
    setServiceId(id)
    navigate('/select-location')
  }

  return (
    <div className="screen">
      <header className="flex items-center gap-2 px-4 py-3">
        <button
          onClick={() => navigate(-1)}
          aria-label="رجوع"
          className="grid h-9 w-9 place-items-center rounded-full text-ink-soft hover:bg-green-soft"
        >
          <BackIcon />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold">اختر الخدمة</h1>
          <p className="text-xs text-ink-soft">اختر نوع المركبة المناسب لك</p>
        </div>
      </header>

      <main className="flex-1 px-4 pb-28">
        <div className="grid grid-cols-2 gap-3 pt-2">
          {services.map((s) => {
            const accent = s.femaleDriver
              ? { color: '#E85C9E', text: '#C13584', badge: 'سائقة', badgeText: '#fff' }
              : s.id === 'open'
                ? { color: '#F2C200', text: '#B07E00', badge: 'مفتوح', badgeText: '#4A3A00' }
                : null
            return (
              <button
                key={s.id}
                onClick={() => choose(s.id)}
                className="card relative flex flex-col p-3 text-center transition hover:shadow-lift"
              >
                {accent && (
                  <span
                    className="absolute right-2 top-2 rounded-full px-2 py-0.5 text-[11px] font-bold"
                    style={{ backgroundColor: accent.color, color: accent.badgeText }}
                  >
                    {accent.badge}
                  </span>
                )}
                <VehicleImage service={s} className="mt-2 h-20 w-full" />
                <p className="mt-2 font-bold" style={accent ? { color: accent.text } : undefined}>
                  {s.name}
                </p>
                <p className="text-xs text-ink-soft">{s.tagline}</p>
                <p className="mt-1 text-sm font-bold text-green">{s.seats} مقاعد</p>
                <p className="text-xs text-ink-muted">~ {prices[s.id] ? money(prices[s.id]) : '—'}</p>
                <span className="mx-auto mt-2 rounded-full bg-green-soft px-2.5 py-1 text-[11px] font-bold text-green">
                  🕒 متاح الآن
                </span>
              </button>
            )
          })}
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
