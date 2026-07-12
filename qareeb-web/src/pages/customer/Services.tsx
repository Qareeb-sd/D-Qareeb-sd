import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Clock } from 'lucide-react'
import BottomNav from '@/components/BottomNav'
import VehicleImage from '@/components/VehicleImage'
import ServiceStateOverlay from '@/components/ServiceStateOverlay'
import { listServicePricing } from '@/lib/api'
import { money } from '@/lib/format'
import { useRide } from '@/store/RideContext'
import { useServices } from '@/store/ServicesContext'

/** صفحة اختيار الخدمة الكاملة — شبكة المركبات مع السعر والحالة. */
export default function Services() {
  const navigate = useNavigate()
  const { setServiceId } = useRide()
  const { services: allServices } = useServices()
  const services = allServices.filter((s) => (s.state ?? 'available') !== 'hidden')
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
          className="grid h-9 w-9 place-items-center rounded-full text-royal hover:bg-ivory"
        >
          <ChevronRight className="h-5 w-5" strokeWidth={2} />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-royal">اختر الخدمة</h1>
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
            const state = s.state ?? 'available'
            const disabled = state !== 'available'
            return (
              <button
                key={s.id}
                disabled={disabled}
                onClick={() => !disabled && choose(s.id)}
                className={`card relative flex flex-col p-3 text-center transition hover:shadow-lift ${
                  disabled ? 'cursor-not-allowed' : ''
                }`}
              >
                <ServiceStateOverlay state={s.state} />
                {accent && !disabled && (
                  <span
                    className="absolute right-2 top-2 z-20 rounded-full px-2 py-0.5 text-[11px] font-bold"
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
                <p className="mt-1 text-sm font-bold text-royal">{s.seats} مقاعد</p>
                <p className="text-xs text-ink-muted">~ {prices[s.id] ? money(prices[s.id]) : '—'}</p>
                {state === 'maintenance' ? (
                  <span className="mx-auto mt-2 flex items-center gap-1 rounded-full bg-[#F4C20D]/20 px-2.5 py-1 text-[11px] font-bold text-[#8A6D00]">
                    تحت الصيانة
                  </span>
                ) : state === 'coming_soon' ? (
                  <span className="mx-auto mt-2 flex items-center gap-1 rounded-full bg-royal/[0.07] px-2.5 py-1 text-[11px] font-bold text-royal">
                    قريباً
                  </span>
                ) : (
                  <span className="mx-auto mt-2 flex items-center gap-1 rounded-full bg-royal/[0.07] px-2.5 py-1 text-[11px] font-bold text-royal">
                    <Clock className="h-3 w-3" strokeWidth={2} /> متاح الآن
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
