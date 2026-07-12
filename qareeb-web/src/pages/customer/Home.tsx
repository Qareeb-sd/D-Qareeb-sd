import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Clock, House, Briefcase, ChevronLeft } from 'lucide-react'
import BottomNav from '@/components/BottomNav'
import MapView from '@/components/MapView'
import VehicleImage from '@/components/VehicleImage'
import Logo from '@/components/Logo'
import { services } from '@/data/services'
import { listServicePricing } from '@/lib/api'
import { money } from '@/lib/format'
import { KHARTOUM } from '@/theme'
import { useRide } from '@/store/RideContext'

/**
 * الرئيسية — أسلوب «الواحة الملكية»: خريطة خلفية ممتدة + هيدر شفاف يطفو فوقها +
 * بطاقة سفلية تحمل بحث الوجهة (بتوقيع خط المسار) واختيار الخدمة.
 * زمردي عميق + عاجي + لمسات ذهبية | خط IBM Plex Sans Arabic | أيقونات خطية.
 */

const SHORTCUTS = [
  { key: 'home', label: 'المنزل', icon: House },
  { key: 'work', label: 'العمل', icon: Briefcase },
]

// سيّارات وهمية قرب المركز لإظهار الحركة على الخريطة.
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
  const [selected, setSelected] = useState(services[0]?.id ?? 'standard')

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
    <div className="relative h-full min-h-screen w-full overflow-hidden bg-ivory font-plex">
      {/* الخريطة كخلفية ممتدة */}
      <div className="absolute inset-0">
        <MapView center={KHARTOUM} driverMarkers={nearbyCars} zoom={15} className="absolute inset-0" />
        {/* تدرّج علوي لوضوح الهيدر */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-ivory via-ivory/70 to-transparent" />
        {/* نبضة موقعي */}
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <span className="relative grid h-6 w-6 place-items-center">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-royal/25" />
            <span className="relative h-3.5 w-3.5 rounded-full bg-royal ring-2 ring-white" />
          </span>
        </div>
      </div>

      {/* الهيدر الشفاف */}
      <header
        className="absolute inset-x-0 top-0 z-20 flex animate-fade-up items-center justify-between px-5 pb-2"
        style={{ paddingTop: 'max(env(safe-area-inset-top), 16px)' }}
      >
        <div className="flex items-center gap-3">
          <Logo size={44} rounded={13} />
          <div>
            <p className="text-[11px] font-medium tracking-wide text-sand-ink">أهلاً بك في</p>
            <h1 className="text-[19px] font-bold leading-tight text-royal">قريب</h1>
          </div>
        </div>
        <button
          onClick={() => navigate('/rides')}
          className="press-scale grid h-11 w-11 place-items-center rounded-full bg-white text-royal shadow-card"
          aria-label="رحلاتي"
        >
          <Clock className="h-5 w-5" strokeWidth={1.8} />
        </button>
      </header>

      {/* البطاقة السفلية */}
      <section className="absolute inset-x-0 bottom-0 z-20 animate-sheet-up">
        <div className="rounded-t-[28px] bg-white px-5 pb-24 pt-3 shadow-soft">
          {/* مقبض ذهبي */}
          <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-sand/60" />

          {/* بحث الوجهة — بتوقيع خط المسار */}
          <button
            onClick={() => navigate('/select-location')}
            className="press-scale flex w-full items-center gap-3 rounded-2xl border border-sand/35 bg-ivory/80 px-4 py-4 text-right shadow-card"
          >
            <span className="ml-1 flex shrink-0 flex-col items-center gap-[3px]">
              <span className="h-2 w-2 rounded-full bg-royal" />
              <span className="h-[3px] w-[3px] rounded-full bg-sand" />
              <span className="h-[3px] w-[3px] rounded-full bg-sand" />
              <span className="mt-0.5 grid h-9 w-9 place-items-center rounded-full bg-royal">
                <Search className="h-4 w-4 text-white" strokeWidth={2} />
              </span>
            </span>
            <span className="flex-1 text-[15px] font-semibold text-royal">وين ماشي؟</span>
            <span className="flex items-center gap-1.5">
              {SHORTCUTS.map((s) => {
                const Icon = s.icon
                return (
                  <span
                    key={s.key}
                    onClick={(e) => {
                      e.stopPropagation()
                      navigate('/select-location')
                    }}
                    className="flex items-center gap-1 rounded-full border border-hairline/70 bg-white px-2.5 py-1.5 text-[11px] text-ink-soft"
                  >
                    <Icon className="h-3.5 w-3.5 text-sand-ink" strokeWidth={1.8} />
                    {s.label}
                  </span>
                )
              })}
            </span>
          </button>

          {/* اختر الخدمة */}
          <div className="mb-3 mt-6 flex items-center justify-between">
            <h2 className="text-[15px] font-bold text-royal">اختر الخدمة</h2>
            <button
              onClick={() => navigate('/services')}
              className="press-scale flex items-center gap-0.5 text-[12px] font-medium text-sand-ink"
            >
              الكل
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
            {services.map((s, i) => {
              const isActive = selected === s.id
              return (
                <button
                  key={s.id}
                  onClick={() => {
                    if (isActive) chooseService(s.id)
                    else setSelected(s.id)
                  }}
                  style={{ animationDelay: `${i * 55}ms` }}
                  className={`press-scale animate-fade-up w-32 shrink-0 rounded-2xl border p-3 text-center transition-colors ${
                    isActive ? 'border-transparent bg-royal ring-gold' : 'border-hairline/60 bg-ivory/60'
                  }`}
                >
                  <VehicleImage service={s} className="mb-1 h-12 w-full" />
                  <p
                    className={`text-[13px] font-bold leading-tight ${
                      isActive ? 'text-white' : s.femaleDriver ? 'text-ladies' : 'text-royal'
                    }`}
                  >
                    {s.name}
                  </p>
                  <p
                    className={`mt-0.5 line-clamp-2 min-h-[26px] text-[10px] leading-snug ${
                      isActive ? 'text-white/70' : 'text-ink-muted'
                    }`}
                  >
                    {s.tagline}
                  </p>
                  <p
                    className={`mt-1 text-[13px] font-semibold ${isActive ? 'text-[#e3c98f]' : 'text-sand-ink'}`}
                  >
                    {prices[s.id] ? money(prices[s.id]) : '—'}
                  </p>
                </button>
              )
            })}
          </div>
        </div>
      </section>

      <BottomNav />
    </div>
  )
}
