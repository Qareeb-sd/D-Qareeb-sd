import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Clock, ChevronLeft, Package, Building2 } from 'lucide-react'
import BottomNav from '@/components/BottomNav'
import MapView from '@/components/MapView'
import VehicleImage from '@/components/VehicleImage'
import ServiceStateOverlay from '@/components/ServiceStateOverlay'
import Logo from '@/components/Logo'
import {
  listServicePricing,
  listServicePeriods,
  nearbyOnlineDrivers,
  getMyCustomerWarnings,
  getMyAnnouncements,
  type DriverWarning,
} from '@/lib/api'
import type { Announcement } from '@/lib/types'
import { currentPeriod } from '@/lib/pricing'
import { money } from '@/lib/format'
import { getCurrentPos, loadLastPos } from '@/lib/geo'
import { KHARTOUM } from '@/theme'
import { useRide } from '@/store/RideContext'
import { useAuth } from '@/store/AuthContext'
import { useServices } from '@/store/ServicesContext'
import { registerPush } from '@/lib/pushNative'
import { useResumeActiveRide } from '@/hooks/useResumeActiveRide'

/**
 * الرئيسية — أسلوب «الواحة الملكية»: خريطة خلفية ممتدة + هيدر شفاف يطفو فوقها +
 * بطاقة سفلية تحمل بحث الوجهة (بتوقيع خط المسار) واختيار الخدمة.
 * زمردي عميق + عاجي + لمسات ذهبية | خط IBM Plex Sans Arabic | أيقونات خطية.
 */

/** يعلّم إعلاناً كمقروء محلياً حتى لا يظهر مجدداً بعد مشاهدته. */
function markAnnouncementSeen(id: string) {
  try {
    const seen: string[] = JSON.parse(localStorage.getItem('qareeb_seen_ann') ?? '[]')
    if (!seen.includes(id)) seen.push(id)
    localStorage.setItem('qareeb_seen_ann', JSON.stringify(seen.slice(-50)))
  } catch {
    /* لا يهمّ */
  }
}

export default function Home() {
  const navigate = useNavigate()
  const { setServiceId } = useRide()
  const { profile } = useAuth()
  const { services: allServices } = useServices()
  // إن كانت هناك رحلة جارية، يعيد العميل إليها فوراً (منع فقدانها عند «رجوع»/الخروج).
  const checkingActive = useResumeActiveRide()
  // تُستبعد الخدمات المخفية من العرض؛ الصيانة/قريباً تظهر معطّلة.
  const services = allServices.filter((s) => (s.state ?? 'available') !== 'hidden')
  const [prices, setPrices] = useState<Record<string, number>>({})
  const [selected, setSelected] = useState('standard')
  const [mapCenter, setMapCenter] = useState(loadLastPos() ?? KHARTOUM)
  const [nearby, setNearby] = useState<{ lat: number; lng: number; icon?: string }[]>([])
  const [warning, setWarning] = useState<DriverWarning | null>(null)
  const [announcement, setAnnouncement] = useState<Announcement | null>(null)

  // تسجيل رمز الإشعارات عند فتح الرئيسية (محاولة موثوقة بعد جهوز التطبيق).
  useEffect(() => {
    if (profile?.id) void registerPush(profile.id)
  }, [profile?.id])

  // تحذير الإدارة — أحدث تحذير لم يُطّلع عليه (يُخفى بعد الإغلاق محليّاً).
  useEffect(() => {
    if (!profile?.id) return
    void getMyCustomerWarnings(profile.id).then((ws) => {
      let seen: string[] = []
      try {
        seen = JSON.parse(localStorage.getItem('qareeb_seen_cwarnings') ?? '[]')
      } catch {
        seen = []
      }
      const fresh = ws.find((w) => !seen.includes(w.id))
      if (fresh) setWarning(fresh)
    })
  }, [profile?.id])

  const dismissWarning = () => {
    if (!warning) return
    try {
      const seen: string[] = JSON.parse(localStorage.getItem('qareeb_seen_cwarnings') ?? '[]')
      seen.push(warning.id)
      localStorage.setItem('qareeb_seen_cwarnings', JSON.stringify(seen.slice(-50)))
    } catch {
      /* لا يهمّ */
    }
    setWarning(null)
  }

  // إعلانات الإدارة — أحدث إعلان لم يُطّلع عليه.
  useEffect(() => {
    void getMyAnnouncements('customer').then((list) => {
      let seen: string[] = []
      try {
        seen = JSON.parse(localStorage.getItem('qareeb_seen_ann') ?? '[]')
      } catch {
        seen = []
      }
      const fresh = list.find((a) => !seen.includes(a.id))
      if (fresh) {
        setAnnouncement(fresh)
        markAnnouncementSeen(fresh.id) // يُعلَّم كمقروء فور عرضه فلا يعود بعد مشاهدته
      }
    })
  }, [])

  const dismissAnnouncement = () => {
    if (!announcement) return
    markAnnouncementSeen(announcement.id)
    setAnnouncement(null)
  }

  useEffect(() => {
    // السعر المعروض = الحدّ الأدنى للفترة الحالية (وإلا فتح العداد القديم).
    void Promise.all([listServicePeriods(), listServicePricing()]).then(([periods, rows]) => {
      const p = currentPeriod()
      const map: Record<string, number> = {}
      rows.forEach((r) => (map[r.service_id] = r.base_fare))
      periods.filter((r) => r.period === p).forEach((r) => (map[r.service_id] = r.min_fare))
      setPrices(map)
    })
  }, [])

  // موقع العميل + السيارات المتصلة القريبة على الخريطة (تحديث دوري).
  useEffect(() => {
    let alive = true
    let center = mapCenter
    const iconFor = (vt: string) => {
      const s = allServices.find((x) => x.id === vt)
      return s?.imageUrl || s?.image
    }
    const loadDrivers = (c: { lat: number; lng: number }) =>
      nearbyOnlineDrivers(c.lat, c.lng).then((ds) => {
        if (alive)
          setNearby(ds.map((d) => ({ lat: d.lat, lng: d.lng, icon: iconFor(d.vehicle_type) })))
      })
    void getCurrentPos().then((p) => {
      if (!alive || !p) return void loadDrivers(center)
      center = p
      setMapCenter(p)
      void loadDrivers(p)
    })
    const iv = setInterval(() => void loadDrivers(center), 15000)
    return () => {
      alive = false
      clearInterval(iv)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const chooseService = (id: string) => {
    setServiceId(id)
    navigate('/select-location')
  }

  // أثناء التحقّق من وجود رحلة جارية — مؤشّر بدل وميض شاشة الطلب الجديد.
  if (checkingActive) {
    return (
      <div className="flex h-full min-h-screen items-center justify-center bg-ivory">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-royal-soft border-t-royal" />
      </div>
    )
  }

  return (
    <div className="relative flex h-full min-h-screen w-full flex-col overflow-hidden bg-ivory font-plex">
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

      {/* منطقة الخريطة — تملأ المساحة المرئية والدبوس في وسطها */}
      <div className="relative z-0 flex-1">
        <MapView
          center={mapCenter}
          driverMarkers={nearby}
          zoom={15}
          className="absolute inset-0"
        />
        {/* تدرّج علوي لوضوح الهيدر */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-ivory via-ivory/70 to-transparent" />
        {/* عدّاد السيارات المتصلة القريبة — أعلى الخريطة كي لا تحجبه البطاقة السفلية */}
        <div
          className="pointer-events-none absolute inset-x-0 flex justify-center px-4"
          style={{ top: 'max(env(safe-area-inset-top), 16px)', marginTop: 60 }}
        >
          <span
            className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold shadow-float ${
              nearby.length > 0 ? 'bg-green text-white' : 'bg-white/95 text-ink-soft'
            }`}
          >
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                nearby.length > 0 ? 'animate-pulse bg-sand' : 'bg-ink-muted'
              }`}
            />
            {nearby.length > 0
              ? `${nearby.length} سيارة متصلة قريبة منك`
              : 'لا سيارات متصلة قريبة الآن'}
          </span>
        </div>
        {/* نبضة موقعي — في وسط منطقة الخريطة المرئية */}
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <span className="relative grid h-6 w-6 place-items-center">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-royal/25" />
            <span className="relative h-3.5 w-3.5 rounded-full bg-royal ring-2 ring-white" />
          </span>
        </div>
      </div>

      {/* البطاقة السفلية */}
      <section className="relative z-20 -mt-6 animate-sheet-up">
        <div className="rounded-t-[28px] bg-white px-5 pb-4 pt-3 shadow-soft">
          {/* مقبض ذهبي */}
          <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-sand/60" />

          {/* إعلان من قريب */}
          {announcement && (
            <div className="mb-3 rounded-2xl border border-royal/15 bg-royal-soft p-3">
              <div className="flex items-start gap-2.5">
                <span className="text-lg">📢</span>
                <div className="flex-1">
                  <p className="text-sm font-bold text-royal">{announcement.title}</p>
                  <p className="mt-0.5 text-[13px] text-ink">{announcement.body}</p>
                </div>
              </div>
              <button
                onClick={dismissAnnouncement}
                className="mt-2 w-full rounded-xl bg-royal py-2 text-sm font-bold text-white"
              >
                حسناً
              </button>
            </div>
          )}

          {/* تحذير من إدارة قريب */}
          {warning && (
            <div className="mb-3 rounded-2xl border border-sand/50 bg-sand-soft/60 p-3">
              <div className="flex items-start gap-2.5">
                <span className="text-lg">⚠️</span>
                <div className="flex-1">
                  <p className="text-sm font-bold text-sand-ink">تحذير من إدارة قريب</p>
                  <p className="mt-0.5 text-[13px] text-ink">{warning.message}</p>
                </div>
              </div>
              <button
                onClick={dismissWarning}
                className="mt-2 w-full rounded-xl bg-sand py-2 text-sm font-bold text-royal"
              >
                اطّلعت وفهمت
              </button>
            </div>
          )}

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
            <ChevronLeft className="h-5 w-5 text-ink-muted" />
          </button>

          {/* خدمات إضافية: توصيل طرد + رحلة بين المدن */}
          <div className="mt-3 grid grid-cols-2 gap-3">
            <button
              onClick={() => {
                setServiceId('package')
                navigate('/select-location', { state: { mode: 'package' } })
              }}
              className="press-scale flex items-center gap-2 rounded-2xl border border-sand/35 bg-ivory/70 px-3 py-3 text-right"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-sand-soft text-sand-ink">
                <Package className="h-5 w-5" strokeWidth={2} />
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] font-bold text-royal">توصيل طرد</span>
                <span className="block truncate text-[10px] text-ink-muted">أرسل غرضاً لأي مكان</span>
              </span>
            </button>
            <button
              onClick={() => {
                setServiceId('intercity')
                navigate('/select-location', { state: { mode: 'intercity' } })
              }}
              className="press-scale flex items-center gap-2 rounded-2xl border border-sand/35 bg-ivory/70 px-3 py-3 text-right"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-royal-soft text-royal">
                <Building2 className="h-5 w-5" strokeWidth={2} />
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] font-bold text-royal">بين المدن</span>
                <span className="block truncate text-[10px] text-ink-muted">سفر لمدينة أخرى</span>
              </span>
            </button>
          </div>

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
              const state = s.state ?? 'available'
              const disabled = state !== 'available'
              const isActive = selected === s.id && !disabled
              return (
                <button
                  key={s.id}
                  disabled={disabled}
                  onClick={() => {
                    if (disabled) return
                    // نقرة واحدة تختار الخدمة وتنتقل مباشرة (بدل الحاجة لنقرتين).
                    setSelected(s.id)
                    chooseService(s.id)
                  }}
                  style={{ animationDelay: `${i * 55}ms` }}
                  className={`press-scale animate-fade-up relative w-32 shrink-0 rounded-2xl border p-3 text-center transition-colors ${
                    isActive ? 'border-transparent bg-royal ring-gold' : 'border-hairline/60 bg-ivory/60'
                  } ${disabled ? 'cursor-not-allowed' : ''}`}
                >
                  <ServiceStateOverlay state={s.state} />
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
