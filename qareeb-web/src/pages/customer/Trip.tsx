import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Banknote,
  Landmark,
  Wallet,
  Car,
  MapPin,
  Navigation,
  UserRound,
  Star,
  Phone,
  type LucideIcon,
} from 'lucide-react'
import Screen from '@/components/Screen'
import MapView from '@/components/MapView'
import VehicleImage from '@/components/VehicleImage'
import SosButton from '@/components/SosButton'
import ShareRideButton from '@/components/ShareRideButton'
import RideChat from '@/components/RideChat'
import { useRide } from '@/store/RideContext'
import { useAuth } from '@/store/AuthContext'
import { getService } from '@/data/services'
import { subscribeToRide } from '@/lib/realtime'
import {
  getRideDriver,
  getActiveCustomerRide,
  cancelRide,
  getRide,
  getSettings,
  type RideDriverInfo,
} from '@/lib/api'
import { fetchRoutePath } from '@/lib/maps'
import CancelReasonSheet, { type CancelReason } from '@/components/CancelReasonSheet'
import { notify } from '@/lib/notifications'
import { isSupabaseConfigured } from '@/lib/supabase'
import { money } from '@/lib/format'
import type { PaymentMethod, RideStatus } from '@/lib/types'

const paymentLabels: Record<PaymentMethod, { label: string; icon: LucideIcon }> = {
  cash: { label: 'كاش', icon: Banknote },
  bank_transfer: { label: 'تحويل بنكي', icon: Landmark },
  wallet: { label: 'محفظة قريب', icon: Wallet },
}

/** رسالة حالة الرحلة كما يراها الراكب. */
const statusInfo: Partial<Record<RideStatus, { Icon: LucideIcon; text: string }>> = {
  accepted: { Icon: Car, text: 'السائق في الطريق إليك' },
  arrived: { Icon: MapPin, text: 'وصل السائق — بانتظارك' },
  in_progress: { Icon: Navigation, text: 'الرحلة جارية — في الطريق لوجهتك' },
}

/** شاشة الرحلة الجارية — بيانات السائق، الوجهة، طريقة الدفع. */
export default function Trip() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { rideId, serviceId, pickup, dropoff, payment, fare, restore, reset } = useRide()
  const service = serviceId ? getService(serviceId) : undefined
  const total = fare ?? 0
  const [driver, setDriver] = useState<RideDriverInfo | null>(null)
  const [status, setStatus] = useState<RideStatus | null>(null)
  const [driverPos, setDriverPos] = useState<google.maps.LatLngLiteral | null>(null)
  const [routePts, setRoutePts] = useState<google.maps.LatLngLiteral[]>([])
  const [eta, setEta] = useState<{ km: number; min: number } | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [cancelErr, setCancelErr] = useState('')
  const [cancelFee, setCancelFee] = useState(0)
  const [cancelInfo, setCancelInfo] = useState<string | null>(null)
  const notified = useRef(false)

  // استرجاع الرحلة الجارية بعد تحديث الصفحة (تُفقد الحالة من الذاكرة).
  useEffect(() => {
    if (rideId || !profile?.id) return
    void getActiveCustomerRide(profile.id).then((ride) => {
      if (ride) {
        restore(ride)
        setStatus(ride.status)
      } else navigate('/home', { replace: true })
    })
  }, [rideId, profile?.id, restore, navigate])

  // جلب بيانات السائق المُسنَد فعلياً.
  useEffect(() => {
    if (!rideId) return
    void getRideDriver(rideId).then(setDriver)
  }, [rideId])

  // تهيئة حالة الرحلة أول مرة (قبل وصول أي حدث Realtime).
  useEffect(() => {
    if (status || !profile?.id) return
    void getActiveCustomerRide(profile.id).then((r) => {
      if (r) setStatus(r.status)
    })
  }, [status, profile?.id])

  // موقع السائق الأولي على الخريطة (يُحدَّث بعدها لحظياً عبر صفّ الرحلة).
  useEffect(() => {
    if (!rideId) return
    void getRide(rideId).then((r) => {
      if (r?.driver_lat != null && r?.driver_lng != null)
        setDriverPos({ lat: r.driver_lat, lng: r.driver_lng })
    })
  }, [rideId])

  // Realtime: تابع تقدّم الرحلة وموقع السائق والانتقالات (اكتمال / تخلّي / إلغاء).
  useEffect(() => {
    if (!rideId) return // لا نشترك قبل استرجاع مُعرّف الرحلة (يتجنّب اشتراكاً على '')
    const unsub = subscribeToRide(rideId, (ride) => {
      setStatus(ride.status)
      if (ride.driver_lat != null && ride.driver_lng != null)
        setDriverPos({ lat: ride.driver_lat, lng: ride.driver_lng })
      // إشعار العميل مرّة واحدة لحظة قبول السائق.
      if (ride.status === 'accepted' && !notified.current) {
        notified.current = true
        void notify('تم قبول رحلتك', 'السائق في الطريق إليك — تابع وصوله على الخريطة')
      }
      if (ride.status === 'completed') navigate('/rate', { replace: true })
      else if (ride.status === 'searching') navigate('/find-driver', { replace: true }) // تخلّى السائق → إعادة البحث
      else if (ride.status === 'cancelled') {
        reset()
        navigate('/home', { replace: true })
      }
    })
    return unsub
    // reset مستقرّ سلوكياً (يعيد المسودّة للحالة الافتراضية) — نتجنّب إعادة الاشتراك كل render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rideId, navigate])

  // استطلاع احتياطي كل 3 ثوانٍ — يحدّث موقع السائق والحالة حتى لو تعطّل Realtime.
  useEffect(() => {
    if (!isSupabaseConfigured || !rideId) return
    const iv = setInterval(async () => {
      const ride = await getRide(rideId)
      if (!ride) return
      setStatus(ride.status)
      if (ride.driver_lat != null && ride.driver_lng != null)
        setDriverPos({ lat: ride.driver_lat, lng: ride.driver_lng })
      if (ride.status === 'completed') navigate('/rate', { replace: true })
      else if (ride.status === 'cancelled') {
        reset()
        navigate('/home', { replace: true })
      }
    }, 3000)
    return () => clearInterval(iv)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rideId, navigate])

  // الهدف على الخريطة: نقطة الالتقاط قبل بدء الرحلة، ثم الوجهة أثناءها.
  const target: google.maps.LatLngLiteral | null =
    status === 'in_progress' ? dropoff?.pos ?? null : pickup?.pos ?? null

  // خطّ المسار: من موقع السائق للهدف إن توفّر موقعه، وإلا نظرة عامّة (انطلاق ← وجهة).
  const origin = driverPos ?? pickup?.pos ?? null
  const dest = driverPos ? target : dropoff?.pos ?? null
  useEffect(() => {
    if (!origin || !dest) {
      setRoutePts([])
      setEta(null)
      return
    }
    let alive = true
    void fetchRoutePath(origin, dest).then((r) => {
      if (alive && r) {
        setRoutePts(r.points)
        setEta({ km: r.distanceKm, min: r.durationMin })
      }
    })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origin?.lat, origin?.lng, dest?.lat, dest?.lng])

  // رسوم الإلغاء (تُطبَّق فقط بعد قبول السائق ولسبب غير مبرّر).
  useEffect(() => {
    void getSettings().then((s) => setCancelFee(s.cancellation_fee ?? 0))
  }, [])

  const cancel = async (reason: CancelReason) => {
    setBusy(true)
    setCancelErr('')
    if (rideId) {
      const { result, error } = await cancelRide(rideId, reason.label, reason.code)
      if (error) {
        setBusy(false)
        setCancelErr(error)
        return
      }
      // إن طُبِّقت رسوم، أعلِم العميل قبل العودة للرئيسية.
      if (result && (result.charged > 0 || result.debt > 0)) {
        const parts: string[] = []
        if (result.charged > 0) parts.push(`خُصم ${money(result.charged)} من محفظتك`)
        if (result.debt > 0) parts.push(`${money(result.debt)} تُضاف لأجرة رحلتك القادمة`)
        setBusy(false)
        setCancelInfo(`رسوم إلغاء: ${parts.join('، ')}.`)
        return
      }
    }
    reset()
    navigate('/home', { replace: true })
  }

  const finishCancel = () => {
    reset()
    navigate('/home', { replace: true })
  }

  const banner = status ? statusInfo[status] : undefined
  const cancellable = status !== 'in_progress'

  const pay = paymentLabels[payment]

  return (
    <Screen title="رحلتك الآن" bare>
      <SosButton rideId={rideId} role="customer" />
      <div className="flex h-full flex-col bg-ivory font-plex">
        {/* الخريطة الحيّة تملأ المساحة العليا (بحدّ أدنى حتى لا ينهار ارتفاعها) */}
        <div className="relative min-h-[48vh] flex-1">
          <MapView
            markers={[pickup?.pos, dropoff?.pos].filter(Boolean) as google.maps.LatLngLiteral[]}
            driver={driverPos ?? undefined}
            route={routePts}
            center={driverPos ?? target ?? dropoff?.pos}
            zoom={15}
            className="absolute inset-0"
          />
          {/* لافتة الحالة أعلى الخريطة — مع عدّاد وصول متوقّع بارز */}
          {banner && (
            <div className="absolute inset-x-3 top-3 flex items-center gap-3 rounded-2xl bg-white/95 p-3 shadow-float backdrop-blur">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-royal-soft text-royal">
                <banner.Icon className="h-5 w-5" strokeWidth={2} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-royal">
                  {status === 'accepted' && eta
                    ? `السائق يصل خلال ~${Math.max(1, Math.round(eta.min))} دقيقة`
                    : banner.text}
                </p>
                {eta && status !== 'arrived' && (
                  <p className="text-[12px] text-ink-soft">
                    {status === 'in_progress' ? 'الوصول للوجهة' : 'المسافة'} · {eta.km.toFixed(1)} كم
                  </p>
                )}
              </div>
              {eta && status !== 'arrived' && (
                <div className="shrink-0 rounded-xl bg-green-mint px-3 py-1.5 text-center">
                  <p className="text-xl font-extrabold leading-none text-green">
                    {Math.max(1, Math.round(eta.min))}
                  </p>
                  <p className="text-[9px] font-bold text-green">دقيقة</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* لوحة سفلية */}
        <section className="relative z-10 -mt-4 rounded-t-[24px] bg-white shadow-soft">
          <div className="space-y-3 px-4 pt-4">
            {/* السائق */}
            <div className="flex items-center gap-3 rounded-2xl border border-hairline bg-ivory/50 p-3.5">
              {driver?.photo_url ? (
                <img
                  src={driver.photo_url}
                  alt={driver.full_name ?? 'السائق'}
                  className="h-12 w-12 shrink-0 rounded-full object-cover ring-2 ring-sand/40"
                />
              ) : (
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-royal-soft text-royal">
                  <UserRound className="h-6 w-6" strokeWidth={1.8} />
                </div>
              )}
              <div className="flex-1">
                <p className="font-bold text-royal">{driver?.full_name ?? 'سائق قريب'}</p>
                <p className="flex items-center gap-1 text-sm text-ink-soft">
                  {service?.name}
                  {driver?.rating != null && (
                    <>
                      {' · '}
                      <Star className="h-3.5 w-3.5 fill-sand text-sand" /> {driver.rating}
                    </>
                  )}
                  {driver?.plate_number ? ` · ${driver.plate_number}` : ''}
                </p>
              </div>
              <div className="flex shrink-0 flex-col gap-1.5">
                <a
                  href={`tel:${driver?.phone ?? ''}`}
                  className={`press-scale flex items-center justify-center gap-1.5 rounded-2xl bg-royal px-4 py-2 text-sm font-bold text-white ${driver?.phone ? '' : 'pointer-events-none opacity-40'}`}
                >
                  <Phone className="h-4 w-4" strokeWidth={2} />
                  اتصال
                </a>
                {rideId && profile?.id && (
                  <RideChat
                    rideId={rideId}
                    myId={profile.id}
                    role="customer"
                    otherName={driver?.full_name ?? 'سائق قريب'}
                  />
                )}
              </div>
            </div>

            {/* المركبة والوجهة + الدفع */}
            <div className="flex items-center gap-3 rounded-2xl border border-hairline bg-ivory/50 p-3.5">
              {driver?.vehicle_photo_url ? (
                <img
                  src={driver.vehicle_photo_url}
                  alt="المركبة"
                  className="h-12 w-16 shrink-0 rounded-xl object-cover"
                />
              ) : (
                service && <VehicleImage service={service} className="h-12 w-16" />
              )}
              <div className="flex-1 text-sm">
                <p className="text-ink-muted">الوجهة</p>
                <p className="truncate font-medium">{dropoff?.address ?? '—'}</p>
                <p className="mt-1 flex items-center gap-1 text-[12px] text-sand-ink">
                  <pay.icon className="h-3.5 w-3.5" strokeWidth={2} />
                  {pay.label}
                  {payment === 'wallet' && ' · مدفوعة'}
                </p>
              </div>
              <p className="font-extrabold text-royal">{money(total)}</p>
            </div>
          </div>

          <div className="mt-3 space-y-2 border-t border-hairline p-4"
            style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
            <ShareRideButton rideId={rideId} />
            {isSupabaseConfigured ? (
              <p className="text-center text-sm text-ink-soft">
                {status === 'in_progress'
                  ? 'الرحلة جارية إلى وجهتك.'
                  : 'السائق في طريقه — يمكنك الإلغاء قبل بدء الرحلة.'}
              </p>
            ) : (
              <button className="btn-primary w-full" onClick={() => navigate('/rate', { replace: true })}>
                إنهاء الرحلة (معاينة)
              </button>
            )}
            {cancelInfo ? (
              <div className="space-y-3 rounded-2xl border border-hairline bg-ivory/60 p-4 text-center">
                <p className="text-sm font-bold text-royal">تم إلغاء الرحلة</p>
                <p className="text-[13px] text-ink-soft">{cancelInfo}</p>
                <button className="btn-primary w-full" onClick={finishCancel}>
                  حسناً
                </button>
              </div>
            ) : (
              cancellable &&
              (confirmCancel ? (
                <CancelReasonSheet
                  busy={busy}
                  error={cancelErr}
                  fee={status === 'accepted' || status === 'arrived' ? cancelFee : 0}
                  onConfirm={cancel}
                  onDismiss={() => {
                    setConfirmCancel(false)
                    setCancelErr('')
                  }}
                />
              ) : (
                <>
                  {cancelErr && (
                    <p className="text-center text-sm text-danger">{cancelErr}</p>
                  )}
                  <button
                    className="w-full text-center text-sm text-danger"
                    onClick={() => setConfirmCancel(true)}
                  >
                    إلغاء الرحلة
                  </button>
                </>
              )))}
          </div>
        </section>
      </div>
    </Screen>
  )
}
