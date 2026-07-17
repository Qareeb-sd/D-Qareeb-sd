import { useEffect, useRef, useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import {
  MapPin,
  User,
  Phone,
  Star,
  Volume2,
  VolumeX,
  ArrowUp,
  ArrowUpLeft,
  ArrowUpRight,
  ArrowLeft,
  ArrowRight,
  CornerUpLeft,
  CornerUpRight,
  RotateCcw,
  RefreshCw,
  Flag,
} from 'lucide-react'
import Screen from '@/components/Screen'
import MapView from '@/components/MapView'
import SosButton from '@/components/SosButton'
import ShareRideButton from '@/components/ShareRideButton'
import RideChat from '@/components/RideChat'
import { useDriver } from '@/store/DriverContext'
import { useAuth } from '@/store/AuthContext'
import {
  settleRide,
  setRideStatus,
  cancelRide,
  getSettings,
  getDriver,
  getActiveDriverRide,
  getRideCustomer,
  updateDriverLocation,
} from '@/lib/api'
import type { Driver } from '@/lib/types'
import { subscribeToRide } from '@/lib/realtime'
import { getService } from '@/data/services'
import { money } from '@/lib/format'
import { haversineKm } from '@/lib/pricing'
import { fetchRouteNav, type NavStep } from '@/lib/maps'
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

/** سهم اتجاه كبير للمناورة التالية — يُشتقّ من نوع/اتجاه مناورة OSRM. */
function ManeuverArrow({
  type,
  modifier,
  className = 'h-7 w-7',
}: {
  type?: string
  modifier?: string
  className?: string
}) {
  const cls = className
  const sw = 2.6
  if (type === 'arrive') return <Flag className={cls} strokeWidth={sw} />
  if (type === 'roundabout' || type === 'rotary') return <RefreshCw className={cls} strokeWidth={sw} />
  switch (modifier) {
    case 'left':
      return <ArrowLeft className={cls} strokeWidth={sw} />
    case 'right':
      return <ArrowRight className={cls} strokeWidth={sw} />
    case 'sharp left':
      return <CornerUpLeft className={cls} strokeWidth={sw} />
    case 'sharp right':
      return <CornerUpRight className={cls} strokeWidth={sw} />
    case 'slight left':
      return <ArrowUpLeft className={cls} strokeWidth={sw} />
    case 'slight right':
      return <ArrowUpRight className={cls} strokeWidth={sw} />
    case 'uturn':
      return <RotateCcw className={cls} strokeWidth={sw} />
    default:
      return <ArrowUp className={cls} strokeWidth={sw} />
  }
}

// مسافة مقروءة عربياً للنطق الصوتي.
const spokenDist = (d: number) =>
  d < 950 ? `${Math.round(d / 10) * 10} متر` : `${(d / 1000).toFixed(1)} كيلومتر`

// نطق تعليمة الملاحة عربياً عبر Web Speech API (متوفّر داخل WebView الأندرويد).
function speak(text: string) {
  try {
    const synth = window.speechSynthesis
    if (!synth) return
    synth.cancel() // أَلغِ ما في الطابور حتى تفوز أحدث مناورة
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'ar-SA'
    u.rate = 1
    u.pitch = 1
    synth.speak(u)
  } catch {
    /* غير مدعوم — نكتفي بالعرض المرئي */
  }
}

/** الرحلة الجارية للسائق — بيانات الرحلة، وإكمالها مع تسوية الأرباح (خصم العمولة). */
export default function DriverTrip() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { activeRide, setActiveRide } = useDriver()
  const [rate, setRate] = useState(0.15)
  const [driver, setDriver] = useState<Driver | null>(null)
  const [customer, setCustomer] = useState<{
    full_name: string | null
    phone: string | null
    rating: number | null
  } | null>(null)
  const [busy, setBusy] = useState(false)
  const [recovering, setRecovering] = useState(!activeRide)
  // موقع السائق الحيّ + خطّ الملاحة إلى الهدف الحالي.
  const [pos, setPos] = useState<google.maps.LatLngLiteral | null>(null)
  const [routePts, setRoutePts] = useState<google.maps.LatLngLiteral[]>([])
  const [eta, setEta] = useState<{ km: number; min: number } | null>(null)
  const [navSteps, setNavSteps] = useState<NavStep[]>([])
  // كتم التوجيه الصوتي (يُحفظ بين الجلسات).
  const [muted, setMuted] = useState(() => {
    try {
      return localStorage.getItem('qareeb_nav_muted') === '1'
    } catch {
      return false
    }
  })
  // تتبّع ما نُطق لكل مناورة حتى لا يتكرّر النطق كل ثانية.
  const spokenRef = useRef<{ approach: string | null; now: string | null }>({
    approach: null,
    now: null,
  })
  // آخر نقطة حُسِب منها المسار — لخنق طلبات OSRM (نعيد الحساب فقط عند تحرّك مؤثّر
  // أو تغيّر الوجهة، لا مع كل نبضة GPS — مهمّ لموثوقية الخادم العام داخل السودان).
  const lastRouteRef = useRef<{ origin: google.maps.LatLngLiteral; destKey: string } | null>(null)

  useEffect(() => {
    void getSettings().then((s) => setRate(s.commission_rate))
    if (profile?.id) void getDriver(profile.id).then(setDriver)
  }, [profile?.id])

  // معلومات الراكب (اسم/هاتف/تقييم) للاتصال والتحقّق.
  useEffect(() => {
    const rid = activeRide?.id
    if (!rid) return
    void getRideCustomer(rid).then(setCustomer)
  }, [activeRide?.id])

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
    let lastPos: google.maps.LatLngLiteral | null = null
    void watchPos((here) => {
      lastPos = here
      setPos(here)
      void updateDriverLocation(rid, here.lat, here.lng)
    }).then((s) => {
      if (cancelled) s()
      else stop = s
    })
    // بثّ دوري مضمون كل 6 ثوانٍ — يضمن أن يرى الراكب موقع السائق حتى لو كان
    // واقفاً/بطيئاً (watchPosition لا يُطلق تحديثاً بلا حركة GPS كبيرة).
    const beat = setInterval(() => {
      if (cancelled) return
      if (lastPos) {
        void updateDriverLocation(rid, lastPos.lat, lastPos.lng)
      } else {
        void getCurrentPos().then((here) => {
          if (here && !cancelled) {
            lastPos = here
            setPos(here)
            void updateDriverLocation(rid, here.lat, here.lng)
          }
        })
      }
    }, 6000)
    return () => {
      cancelled = true
      clearInterval(beat)
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
        navigate('/driver', { replace: true })
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

  // خطّ المسار يحترم المرحلة دائماً:
  // • مرحلة الوصول للراكب: موقع السائق ← نقطة الالتقاط (لا تُرسم رحلة العميل بعد).
  // • مرحلة الرحلة: موقع السائق ← الوجهة.
  // قبل جهوزية الـGPS في مرحلة الالتقاط لا نرسم شيئاً (كي لا يظهر مسار الرحلة مبكّراً)؛
  // وفي مرحلة الرحلة فقط نعرض نظرة عامّة (التقاط ← وجهة) ريثما يجهز الموقع.
  const rOrigin = pos ?? pickupPt
  const rDest = pos ? target : heading === 'dropoff' ? dropoffPt : null
  useEffect(() => {
    if (!rOrigin || !rDest) {
      setRoutePts([])
      setEta(null)
      lastRouteRef.current = null
      return
    }
    // خنق: أعِد حساب المسار فقط إذا تغيّرت الوجهة، أو تحرّك السائق أكثر من ~45م منذ
    // آخر حساب، أو لم يُحسب مسار بعد. يبقى شريط المناورة حيّاً (يُحسب محلياً من الموقع).
    const destKey = `${rDest.lat.toFixed(5)},${rDest.lng.toFixed(5)}`
    const prev = lastRouteRef.current
    const movedM = prev ? haversineKm(prev.origin, rOrigin) * 1000 : Infinity
    if (prev && prev.destKey === destKey && movedM < 45) return
    lastRouteRef.current = { origin: rOrigin, destKey }
    let alive = true
    void fetchRouteNav(rOrigin, rDest).then((r) => {
      if (alive && r) {
        setRoutePts(r.points)
        setEta({ km: r.distanceKm, min: r.durationMin })
        setNavSteps(r.steps)
      }
    })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rOrigin?.lat, rOrigin?.lng, rDest?.lat, rDest?.lng])

  // المناورة التالية للملاحة داخل التطبيق: أقرب خطوة أمام السائق.
  const nextStep = (() => {
    if (!pos || navSteps.length === 0) return null
    const distM = (a: google.maps.LatLngLiteral, b: google.maps.LatLngLiteral) =>
      haversineKm(a, b) * 1000
    let best: { step: NavStep; d: number } | null = null
    for (const s of navSteps) {
      // نتخطّى «ابدأ»؛ ونبحث عن أقرب مناورة متبقّية أمام السائق.
      if (s.instruction.startsWith('ابدأ')) continue
      const d = distM(pos, s.location)
      if (!best || d < best.d) best = { step: s, d }
    }
    return best
  })()

  // حفظ تفضيل الكتم.
  useEffect(() => {
    try {
      localStorage.setItem('qareeb_nav_muted', muted ? '1' : '0')
    } catch {
      /* لا يهمّ إن تعذّر */
    }
  }, [muted])

  // التوجيه الصوتي: أعلن المناورة القادمة مرّة عند الاقتراب (~300م) ومرّة عند الوصول (~60م).
  const nsKey = nextStep
    ? `${nextStep.step.location.lat.toFixed(5)},${nextStep.step.location.lng.toFixed(5)}`
    : null
  const nsDist = nextStep?.d ?? null
  const nsText = nextStep?.step.instruction ?? null
  useEffect(() => {
    if (muted || !nsKey || nsDist == null || !nsText) return
    // إعلان اقتراب مبكّر (مرّة واحدة لكل مناورة).
    if (nsDist <= 300 && nsDist > 60 && spokenRef.current.approach !== nsKey) {
      spokenRef.current.approach = nsKey
      speak(`بعد ${spokenDist(nsDist)}، ${nsText}`)
    }
    // إعلان «الآن» عند الاقتراب الشديد من المناورة (مرّة واحدة).
    if (nsDist <= 60 && spokenRef.current.now !== nsKey) {
      spokenRef.current.now = nsKey
      speak(nsText)
    }
  }, [nsKey, nsDist, nsText, muted])

  // إيقاف أي نطق جارٍ عند مغادرة الشاشة.
  useEffect(() => {
    return () => {
      try {
        window.speechSynthesis?.cancel()
      } catch {
        /* غير مدعوم */
      }
    }
  }, [])

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
  // إعفاء العمولة يطابق settle_ride: إعفاء مؤقّت ساري، أو VIP باشتراك مدفوع.
  const now = Date.now()
  const exemptFree =
    Boolean(driver?.commission_free_until) &&
    new Date(driver!.commission_free_until as string).getTime() > now
  const exemptVip =
    Boolean(driver?.vip) &&
    Boolean(driver?.vip_paid_until) &&
    new Date(driver!.vip_paid_until as string).getTime() > now
  const exempt = exemptFree || exemptVip
  const effectiveRate = exempt ? 0 : rate
  const commission = Math.round(fare * effectiveRate)
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
    navigate('/driver/rate', { state: { rideId }, replace: true })
  }

  const release = async () => {
    if (!confirm('التخلّي عن هذه الرحلة؟ ستعود متاحة لسائق آخر.')) return
    setBusy(true)
    const { error } = await cancelRide(activeRide.id)
    setBusy(false)
    if (error) return alert(error)
    setActiveRide(null)
    navigate('/driver', { replace: true })
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
            markers={
              (heading === 'pickup'
                ? // مرحلة الوصول: نُبرز نقطة الراكب فقط (لا نُشتّت بوجهة الرحلة بعد).
                  [pickupPt]
                : // مرحلة الرحلة: نقاط التوقّف ثم الوجهة.
                  [
                    ...(activeRide.stops?.map((s) => ({ lat: s.lat, lng: s.lng })) ?? []),
                    dropoffPt,
                  ]
              ).filter(Boolean) as google.maps.LatLngLiteral[]
            }
            route={routePts}
            zoom={pos ? 16 : 15}
            className="absolute inset-0"
          />

          {/* لافتة ملاحة احترافية: شريط المرحلة + المناورة الكبيرة + العنوان/الوقت */}
          <div className="absolute inset-x-3 top-3 overflow-hidden rounded-2xl shadow-float">
            {/* شريط المرحلة — لون مميّز لكل مرحلة حتى لا يلتبس على السائق */}
            <div
              className={`flex items-center justify-between px-4 py-1.5 text-white ${
                heading === 'pickup' ? 'bg-green' : 'bg-royal'
              }`}
            >
              <span className="text-xs font-extrabold">
                {heading === 'pickup' ? '① التوجّه إلى الراكب' : '② توصيل الراكب إلى الوجهة'}
              </span>
              <button
                onClick={() => setMuted((m) => !m)}
                aria-label={muted ? 'تشغيل الصوت' : 'كتم الصوت'}
                className="press-scale grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/20"
              >
                {muted ? (
                  <VolumeX className="h-4 w-4" strokeWidth={2.2} />
                ) : (
                  <Volume2 className="h-4 w-4" strokeWidth={2.2} />
                )}
              </button>
            </div>

            {/* المناورة الكبيرة — سهم ضخم + مسافة بارزة + تعليمة واضحة (تباين عالٍ) */}
            {nextStep ? (
              <div
                className={`flex items-center gap-3 px-4 py-3 text-white ${
                  heading === 'pickup' ? 'bg-green' : 'bg-royal'
                }`}
              >
                <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white/15">
                  <ManeuverArrow
                    type={nextStep.step.type}
                    modifier={nextStep.step.modifier}
                    className="h-9 w-9"
                  />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-3xl font-black leading-none">
                    {nextStep.d < 950
                      ? `${Math.round(nextStep.d / 10) * 10} م`
                      : `${(nextStep.d / 1000).toFixed(1)} كم`}
                  </p>
                  <p className="mt-1 truncate text-sm font-bold text-white/90">
                    {nextStep.step.instruction}
                  </p>
                </div>
              </div>
            ) : (
              <div
                className={`px-4 py-3 text-white ${heading === 'pickup' ? 'bg-green' : 'bg-royal'}`}
              >
                <p className="text-sm font-bold text-white/90">
                  {pos ? 'جارٍ حساب المسار…' : 'جارٍ تحديد موقعك…'}
                </p>
              </div>
            )}

            {/* العنوان الهدف + زمن/مسافة الوصول (خلفية بيضاء) */}
            <div className="flex items-center gap-3 bg-white/95 px-4 py-2.5 backdrop-blur">
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
          </div>

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
              {activeRide.pickup_address}
              {activeRide.stops?.length
                ? activeRide.stops.map((s) => ` ← ${s.address ?? 'توقّف'}`).join('')
                : ''}{' '}
              ← {activeRide.dropoff_address}
            </p>
            {activeRide.stops?.length ? (
              <p className="mt-0.5 text-[11px] font-bold text-sand-ink">
                تتضمّن {activeRide.stops.length} نقطة توقّف
              </p>
            ) : null}

            {/* الراكب — اسم/تقييم + زر اتصال */}
            <div className="mt-3 flex items-center gap-3 rounded-2xl border border-hairline bg-ivory/60 p-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-sand/20">
                <User className="h-5 w-5 text-royal" strokeWidth={2} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold text-royal">
                  {activeRide.rider_name || customer?.full_name || 'الراكب'}
                </p>
                {activeRide.rider_name ? (
                  <span className="mt-0.5 inline-block rounded-md bg-sand-soft px-1.5 py-0.5 text-[10px] font-bold text-sand-ink">
                    رحلة لشخص آخر
                  </span>
                ) : (
                  customer?.rating != null && (
                    <p className="flex items-center gap-1 text-xs text-ink-soft">
                      <Star className="h-3.5 w-3.5 text-sand" fill="currentColor" strokeWidth={2} />
                      {customer.rating}
                    </p>
                  )
                )}
              </div>
              <div className="flex shrink-0 flex-col gap-1.5">
                {(activeRide.rider_phone || customer?.phone) && (
                  <a
                    href={`tel:${activeRide.rider_phone || customer?.phone}`}
                    className="flex items-center justify-center gap-1.5 rounded-xl bg-royal px-3 py-2 text-sm font-bold text-white"
                  >
                    <Phone className="h-4 w-4" strokeWidth={2} />
                    اتصال
                  </a>
                )}
                {profile?.id && (
                  <RideChat
                    rideId={activeRide.id}
                    myId={profile.id}
                    role="driver"
                    otherName={activeRide.rider_name || customer?.full_name || 'الراكب'}
                  />
                )}
              </div>
            </div>

            {/* تفصيل الأرباح */}
            <div className="mt-3 rounded-2xl border border-hairline bg-ivory/60">
              <Row label="طريقة الدفع" value={paymentLabels[activeRide.payment_method]} />
              <Row label="الأجرة" value={money(fare)} />
              {exempt ? (
                <Row
                  label={exemptVip ? 'عمولة المنصة (VIP)' : 'عمولة المنصة (إعفاء)'}
                  value="معفاة"
                  strong
                />
              ) : (
                <Row
                  label={`عمولة المنصة (${Math.round(effectiveRate * 100)}%)`}
                  value={`− ${money(commission)}`}
                  danger
                />
              )}
              <Row label="صافي أرباحك" value={money(net)} strong />
            </div>

            {exempt && (
              <p className="mt-2 text-center text-xs font-medium text-green">
                {exemptVip
                  ? 'أنت سائق VIP — بلا عمولة على هذه الرحلة.'
                  : 'معفى من العمولة حالياً — تحصل على كامل الأجرة.'}
              </p>
            )}

            {isCash && (
              <p className="mt-2 text-center text-xs text-ink-muted">
                {exempt
                  ? 'تستلم كامل الأجرة من الراكب مباشرة — لا عمولة.'
                  : `تستلم الأجرة من الراكب مباشرة، وتُخصم العمولة (${money(commission)}) من محفظتك.`}
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
