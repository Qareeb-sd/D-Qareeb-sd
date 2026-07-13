import { useEffect, useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { Navigation, MapPin } from 'lucide-react'
import Screen from '@/components/Screen'
import MapView from '@/components/MapView'
import SosButton from '@/components/SosButton'
import ShareRideButton from '@/components/ShareRideButton'
import { useDriver } from '@/store/DriverContext'
import { useAuth } from '@/store/AuthContext'
import {
  settleRide,
  setRideStatus,
  cancelRide,
  getSettings,
  getActiveDriverRide,
  updateDriverLocation,
} from '@/lib/api'
import { subscribeToRide } from '@/lib/realtime'
import { getService } from '@/data/services'
import { money } from '@/lib/format'
import { fetchRoutePath } from '@/lib/maps'
import { watchPos, getCurrentPos } from '@/lib/geo'

const paymentLabels: Record<string, string> = {
  cash: 'كاش',
  bank_transfer: 'تحويل بنكي',
  wallet: 'محفظة قريب',
}

const statusLabels: Record<string, string> = {
  accepted: 'في الطريق إلى الراكب',
  arrived: 'وصلت — بانتظار الراكب',
  in_progress: 'الرحلة جارية',
}

// مراحل الرحلة كخطوات مرئية.
const STEPS = [
  { key: 'accepted', label: 'مقبولة' },
  { key: 'arrived', label: 'وصلت' },
  { key: 'in_progress', label: 'جارية' },
  { key: 'done', label: 'انتهت' },
]

/** الرحلة الجارية للسائق — بيانات الرحلة، وإكمالها مع تسوية الأرباح (خصم العمولة). */
export default function DriverTrip() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { activeRide, setActiveRide } = useDriver()
  const [rate, setRate] = useState(0.15)
  const [busy, setBusy] = useState(false)
  const [recovering, setRecovering] = useState(!activeRide)
  // موقع السائق الحيّ + خطّ الملاحة إلى الهدف الحالي.
  const [pos, setPos] = useState<google.maps.LatLngLiteral | null>(null)
  const [routePts, setRoutePts] = useState<google.maps.LatLngLiteral[]>([])
  const [eta, setEta] = useState<{ km: number; min: number } | null>(null)

  useEffect(() => {
    void getSettings().then((s) => setRate(s.commission_rate))
  }, [])

  // استرجاع الرحلة الجارية بعد تحديث الصفحة (تُفقد من الذاكرة).
  useEffect(() => {
    if (activeRide || !profile?.id) {
      setRecovering(false)
      return
    }
    let alive = true
    void getActiveDriverRide(profile.id).then((ride) => {
      if (!alive) return
      if (ride) setActiveRide(ride)
      setRecovering(false)
    })
    return () => {
      alive = false
    }
  }, [activeRide, profile?.id, setActiveRide])

  // تحديث موقع السائق اللحظي للراكب + عرضه على الخريطة طوال وجوده في الشاشة.
  // يستخدم @capacitor/geolocation الأصلي (يطلب الإذن ويعمل بموثوقية على الجهاز).
  useEffect(() => {
    const rid = activeRide?.id
    if (!rid) return
    let cancelled = false
    let stop = () => {}
    // موقع فوري أولاً (ليراه الراكب بسرعة) ثم تتبّع مستمر.
    void getCurrentPos().then((here) => {
      if (here && !cancelled) {
        setPos(here)
        void updateDriverLocation(rid, here.lat, here.lng)
      }
    })
    void watchPos((here) => {
      setPos(here)
      void updateDriverLocation(rid, here.lat, here.lng)
    }).then((s) => {
      if (cancelled) s()
      else stop = s
    })
    return () => {
      cancelled = true
      stop()
    }
  }, [activeRide?.id])

  // Realtime: إن ألغى الراكب الرحلة، أبلغ السائق وأعده لقائمة الطلبات.
  useEffect(() => {
    if (!activeRide?.id) return
    const unsub = subscribeToRide(activeRide.id, (ride) => {
      if (ride.status === 'cancelled') {
        setActiveRide(null)
        alert('ألغى الراكب الرحلة.')
        navigate('/driver')
      }
    })
    return unsub
  }, [activeRide?.id, setActiveRide, navigate])

  // الهدف الحالي للملاحة: نقطة الالتقاط قبل بدء الرحلة، ثم الوجهة أثناءها.
  const heading = activeRide?.status === 'in_progress' ? 'dropoff' : 'pickup'
  const target: google.maps.LatLngLiteral | null = activeRide
    ? heading === 'pickup'
      ? { lat: activeRide.pickup_lat, lng: activeRide.pickup_lng }
      : activeRide.dropoff_lat && activeRide.dropoff_lng
        ? { lat: activeRide.dropoff_lat, lng: activeRide.dropoff_lng }
        : null
    : null

  // نقاط الرحلة (لعرضها دائماً على الخريطة).
  const pickupPt: google.maps.LatLngLiteral | null = activeRide
    ? { lat: activeRide.pickup_lat, lng: activeRide.pickup_lng }
    : null
  const dropoffPt: google.maps.LatLngLiteral | null =
    activeRide?.dropoff_lat && activeRide?.dropoff_lng
      ? { lat: activeRide.dropoff_lat, lng: activeRide.dropoff_lng }
      : null

  // خطّ المسار: من موقع السائق للهدف إن توفّر، وإلا نظرة عامّة (التقاط ← وجهة).
  const rOrigin = pos ?? pickupPt
  const rDest = pos ? target : dropoffPt
  useEffect(() => {
    if (!rOrigin || !rDest) {
      setRoutePts([])
      setEta(null)
      return
    }
    let alive = true
    void fetchRoutePath(rOrigin, rDest).then((r) => {
      if (alive && r) {
        setRoutePts(r.points)
        setEta({ km: r.distanceKm, min: r.durationMin })
      }
    })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rOrigin?.lat, rOrigin?.lng, rDest?.lat, rDest?.lng])

  if (recovering) {
    return (
      <Screen title="الرحلة الجارية">
        <div className="flex justify-center py-24">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-royal-soft border-t-royal" />
        </div>
      </Screen>
    )
  }

  if (!activeRide) return <Navigate to="/driver" replace />

  const service = getService(activeRide.service_id)
  const fare = activeRide.fare ?? 0
  const commission = Math.round(fare * rate)
  const net = fare - commission
  const isCash = activeRide.payment_method !== 'wallet'

  const advance = async (status: 'arrived' | 'in_progress') => {
    setBusy(true)
    const { error } = await setRideStatus(activeRide.id, status)
    setBusy(false)
    if (error) return alert(error)
    setActiveRide({ ...activeRide, status })
  }

  const complete = async () => {
    setBusy(true)
    const { error } = await settleRide(activeRide.id)
    setBusy(false)
    if (error) return alert(error)
    const rideId = activeRide.id
    setActiveRide(null)
    // تقييم العميل قبل العودة للمحفظة.
    navigate('/driver/rate', { state: { rideId } })
  }

  const release = async () => {
    if (!confirm('التخلّي عن هذه الرحلة؟ ستعود متاحة لسائق آخر.')) return
    setBusy(true)
    const { error } = await cancelRide(activeRide.id)
    setBusy(false)
    if (error) return alert(error)
    setActiveRide(null)
    navigate('/driver')
  }

  // يفتح ملاحة قوقل خارجياً نحو الهدف الحالي (يفتح التطبيق على الجهاز).
  const openNav = () => {
    if (!target) return
    window.open(
      `https://www.google.com/maps/dir/?api=1&destination=${target.lat},${target.lng}&travelmode=driving`,
      '_blank',
    )
  }

  const stepIndex =
    activeRide.status === 'arrived' ? 1 : activeRide.status === 'in_progress' ? 2 : 0
  const headingLabel = heading === 'pickup' ? 'التوجّه إلى الراكب' : 'التوجّه إلى الوجهة'
  const headingAddress = heading === 'pickup' ? activeRide.pickup_address : activeRide.dropoff_address

  return (
    <Screen title="الرحلة الجارية" bare>
      <SosButton rideId={activeRide.id} role="driver" />
      <div className="relative flex h-full flex-col bg-ivory font-plex">
        {/* الخريطة الحيّة تملأ المساحة العليا (بحدّ أدنى حتى لا ينهار ارتفاعها) */}
        <div className="relative min-h-[48vh] flex-1">
          <MapView
            center={pos ?? target ?? { lat: activeRide.pickup_lat, lng: activeRide.pickup_lng }}
            driver={pos ?? undefined}
            markers={[pickupPt, dropoffPt].filter(Boolean) as google.maps.LatLngLiteral[]}
            route={routePts}
            zoom={15}
            className="absolute inset-0"
          />

          {/* لافتة الهدف الحالي + المسافة/الزمن أعلى الخريطة */}
          <div className="absolute inset-x-3 top-3 flex items-center gap-3 rounded-2xl bg-white/95 p-3 shadow-float backdrop-blur">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-royal-soft text-royal">
              <MapPin className="h-5 w-5" strokeWidth={2} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold text-sand-ink">{headingLabel}</p>
              <p className="truncate text-sm font-semibold text-royal">{headingAddress}</p>
            </div>
            {eta && (
              <div className="shrink-0 text-center">
                <p className="text-base font-extrabold leading-none text-royal">
                  {Math.max(1, Math.round(eta.min))}
                  <span className="text-[10px] font-bold"> د</span>
                </p>
                <p className="text-[10px] text-ink-muted">{eta.km.toFixed(1)} كم</p>
              </div>
            )}
          </div>

          {/* ملاحة صوتية خارجية (اختياري) — الخريطة الداخلية تكفي عادةً */}
          <button
            onClick={openNav}
            className="press-scale absolute bottom-4 left-4 flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-2 text-[12px] font-bold text-royal shadow-float ring-1 ring-hairline"
          >
            <Navigation className="h-3.5 w-3.5" strokeWidth={2.2} />
            ملاحة صوتية
          </button>
        </div>

        {/* لوحة سفلية: خطوات الرحلة + الأرباح + الإجراءات */}
        <section className="relative z-10 -mt-4 rounded-t-[24px] bg-white shadow-soft">
          <div className="px-4 pt-4">
            {/* شريط خطوات الرحلة */}
            <div className="mb-4 flex items-center">
              {STEPS.map((s, i) => {
                const done = i <= stepIndex
                return (
                  <div key={s.key} className="flex flex-1 items-center last:flex-none">
                    <div className="flex flex-col items-center">
                      <span
                        className={`grid h-7 w-7 place-items-center rounded-full text-[11px] font-bold transition ${
                          done ? 'bg-royal text-white' : 'bg-hairline text-ink-muted'
                        }`}
                      >
                        {i + 1}
                      </span>
                      <span
                        className={`mt-1 text-[10px] font-semibold ${
                          done ? 'text-royal' : 'text-ink-muted'
                        }`}
                      >
                        {s.label}
                      </span>
                    </div>
                    {i < STEPS.length - 1 && (
                      <span
                        className={`mx-1 h-[3px] flex-1 rounded-full ${
                          i < stepIndex ? 'bg-royal' : 'bg-hairline'
                        }`}
                      />
                    )}
                  </div>
                )
              })}
            </div>

            <div className="flex items-center justify-between">
              <p className="font-bold text-royal">{service?.name ?? activeRide.service_id}</p>
              <span className="chip-driver">
                {statusLabels[activeRide.status] ?? activeRide.status}
              </span>
            </div>
            <p className="mt-1 text-sm text-ink-soft">
              {activeRide.pickup_address} ← {activeRide.dropoff_address}
            </p>

            {/* تفصيل الأرباح */}
            <div className="mt-3 rounded-2xl border border-hairline bg-ivory/60">
              <Row label="طريقة الدفع" value={paymentLabels[activeRide.payment_method]} />
              <Row label="الأجرة" value={money(fare)} />
              <Row
                label={`عمولة المنصة (${Math.round(rate * 100)}%)`}
                value={`− ${money(commission)}`}
                danger
              />
              <Row label="صافي أرباحك" value={money(net)} strong />
            </div>

            {isCash && (
              <p className="mt-2 text-center text-xs text-ink-muted">
                تستلم الأجرة من الراكب مباشرة، وتُخصم العمولة ({money(commission)}) من محفظتك.
              </p>
            )}
          </div>

          <div
            className="mt-3 space-y-2 border-t border-hairline p-4"
            style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
          >
            <ShareRideButton rideId={activeRide.id} variant="driver" />
            {activeRide.status === 'accepted' && (
              <button className="btn-driver w-full" onClick={() => advance('arrived')} disabled={busy}>
                {busy ? '…' : 'وصلت لموقع الراكب'}
              </button>
            )}
            {activeRide.status === 'arrived' && (
              <button className="btn-driver w-full" onClick={() => advance('in_progress')} disabled={busy}>
                {busy ? '…' : 'بدء الرحلة'}
              </button>
            )}
            {activeRide.status === 'in_progress' && (
              <button className="btn-driver w-full" onClick={complete} disabled={busy}>
                {busy ? '…' : 'إنهاء وتسوية الرحلة'}
              </button>
            )}
            {!['accepted', 'arrived', 'in_progress'].includes(activeRide.status) && (
              <button className="btn-driver w-full" onClick={complete} disabled={busy}>
                {busy ? '…' : 'إنهاء وتسوية الرحلة'}
              </button>
            )}
            {(activeRide.status === 'accepted' || activeRide.status === 'arrived') && (
              <button
                className="w-full text-center text-sm text-danger"
                onClick={release}
                disabled={busy}
              >
                التخلّي عن الرحلة
              </button>
            )}
          </div>
        </section>
      </div>
    </Screen>
  )
}

function Row({
  label,
  value,
  strong,
  danger,
}: {
  label: string
  value: string
  strong?: boolean
  danger?: boolean
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-sm text-ink-soft">{label}</span>
      <span
        className={
          strong ? 'font-extrabold text-sand-ink' : danger ? 'font-medium text-danger' : 'font-medium'
        }
      >
        {value}
      </span>
    </div>
  )
}
