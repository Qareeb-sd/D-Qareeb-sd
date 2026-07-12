import { useEffect, useState } from 'react'
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
import { useRide } from '@/store/RideContext'
import { useAuth } from '@/store/AuthContext'
import { getService } from '@/data/services'
import { subscribeToRide } from '@/lib/realtime'
import {
  getRideDriver,
  getActiveCustomerRide,
  cancelRide,
  getRide,
  type RideDriverInfo,
} from '@/lib/api'
import { isSupabaseConfigured } from '@/lib/supabase'
import { money } from '@/lib/format'
import type { PaymentMethod, RideStatus } from '@/lib/types'

const payments: { id: PaymentMethod; label: string; icon: LucideIcon }[] = [
  { id: 'cash', label: 'كاش', icon: Banknote },
  { id: 'bank_transfer', label: 'تحويل بنكي', icon: Landmark },
  { id: 'wallet', label: 'محفظة قريب', icon: Wallet },
]

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
  const { rideId, serviceId, dropoff, payment, setPayment, fare, restore, reset } = useRide()
  const service = serviceId ? getService(serviceId) : undefined
  const total = fare ?? 0
  const [driver, setDriver] = useState<RideDriverInfo | null>(null)
  const [status, setStatus] = useState<RideStatus | null>(null)
  const [driverPos, setDriverPos] = useState<google.maps.LatLngLiteral | null>(null)
  const [busy, setBusy] = useState(false)

  // استرجاع الرحلة الجارية بعد تحديث الصفحة (تُفقد الحالة من الذاكرة).
  useEffect(() => {
    if (rideId || !profile?.id) return
    void getActiveCustomerRide(profile.id).then((ride) => {
      if (ride) {
        restore(ride)
        setStatus(ride.status)
      } else navigate('/home')
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
    const unsub = subscribeToRide(rideId ?? '', (ride) => {
      setStatus(ride.status)
      if (ride.driver_lat != null && ride.driver_lng != null)
        setDriverPos({ lat: ride.driver_lat, lng: ride.driver_lng })
      if (ride.status === 'completed') navigate('/rate')
      else if (ride.status === 'searching') navigate('/find-driver') // تخلّى السائق → إعادة البحث
      else if (ride.status === 'cancelled') {
        reset()
        navigate('/home')
      }
    })
    return unsub
    // reset مستقرّ سلوكياً (يعيد المسودّة للحالة الافتراضية) — نتجنّب إعادة الاشتراك كل render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rideId, navigate])

  const cancel = async () => {
    setBusy(true)
    if (rideId) {
      const { error } = await cancelRide(rideId)
      if (error) {
        setBusy(false)
        return alert(error)
      }
    }
    reset()
    navigate('/home')
  }

  const banner = status ? statusInfo[status] : undefined
  const cancellable = status !== 'in_progress'

  return (
    <Screen title="رحلتك الآن" bare>
      <SosButton rideId={rideId} role="customer" />
      <div className="flex h-full flex-col">
        <MapView
          marker={dropoff?.pos}
          driver={driverPos ?? undefined}
          center={driverPos ?? dropoff?.pos}
          className="h-56 w-full"
        />

        <div className="flex-1 space-y-4 p-4">
          {/* حالة الرحلة */}
          {banner && (
            <div className="flex items-center gap-3 rounded-2xl border border-royal/15 bg-royal/[0.05] p-3.5">
              <banner.Icon className="h-6 w-6 text-royal" strokeWidth={1.8} />
              <p className="font-bold text-royal">{banner.text}</p>
            </div>
          )}

          {/* السائق */}
          <div className="card flex items-center gap-3 p-4">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-royal-soft text-royal">
              <UserRound className="h-6 w-6" strokeWidth={1.8} />
            </div>
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
            <a
              href={`tel:${driver?.phone ?? ''}`}
              className={`press-scale flex items-center gap-1.5 rounded-2xl bg-royal-soft px-4 py-2 text-sm font-bold text-royal ${driver?.phone ? '' : 'pointer-events-none opacity-40'}`}
            >
              <Phone className="h-4 w-4" strokeWidth={2} />
              اتصال
            </a>
          </div>

          {/* المركبة والوجهة */}
          <div className="card flex items-center gap-3 p-4">
            {service && <VehicleImage service={service} className="h-14 w-20" />}
            <div className="flex-1 text-sm">
              <p className="text-ink-muted">الوجهة</p>
              <p className="font-medium">{dropoff?.address ?? '—'}</p>
            </div>
            <p className="font-extrabold text-royal">{money(total)}</p>
          </div>

          {/* طريقة الدفع */}
          <div>
            <p className="label">طريقة الدفع</p>
            <div className="grid grid-cols-3 gap-2">
              {payments.map((p) => {
                const Icon = p.icon
                const on = payment === p.id
                return (
                  <button
                    key={p.id}
                    onClick={() => setPayment(p.id)}
                    className={`press-scale flex flex-col items-center gap-1 rounded-2xl border p-3 text-center text-sm transition ${
                      on
                        ? 'border-transparent bg-royal font-bold text-white ring-gold'
                        : 'border-hairline bg-white text-ink-soft'
                    }`}
                  >
                    <Icon className="h-5 w-5" strokeWidth={1.8} />
                    {p.label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <div className="space-y-2 border-t border-hairline p-4">
          <ShareRideButton rideId={rideId} />
          {isSupabaseConfigured ? (
            <p className="text-center text-sm text-ink-soft">
              {status === 'in_progress'
                ? 'الرحلة جارية إلى وجهتك.'
                : 'السائق في طريقه — يمكنك الإلغاء قبل بدء الرحلة.'}
            </p>
          ) : (
            <button className="btn-primary w-full" onClick={() => navigate('/rate')}>
              إنهاء الرحلة (معاينة)
            </button>
          )}
          {cancellable && (
            <button
              className="btn-outline w-full text-danger"
              onClick={cancel}
              disabled={busy}
            >
              {busy ? '…' : 'إلغاء الرحلة'}
            </button>
          )}
        </div>
      </div>
    </Screen>
  )
}
