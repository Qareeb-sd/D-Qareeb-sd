import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Bell, BellOff, LifeBuoy, Eye, Star, ChevronLeft, Route, Coins, Power, User, Flame, Navigation } from 'lucide-react'
import { haversineKm } from '@/lib/pricing'
import Logo from '@/components/Logo'
import DriverNav from '@/components/DriverNav'
import VehicleImage from '@/components/VehicleImage'
import { useAuth } from '@/store/AuthContext'
import { useDriver } from '@/store/DriverContext'
import {
  getDriver,
  setDriverOnline,
  listAvailableRides,
  acceptRide,
  getWallet,
  listDriverTransactions,
  updateMyLocation,
  getSettings,
} from '@/lib/api'
import { subscribeToRides } from '@/lib/realtime'
import {
  notificationsSupported,
  notificationsGranted,
  enableNotifications,
  alertNewRide,
} from '@/lib/notifications'
import { startCaptainBg, stopCaptainBg } from '@/lib/captainBg'
import { registerPush } from '@/lib/pushNative'
import { ensureGeoPermission, watchPos, getCurrentPos } from '@/lib/geo'
import { getService } from '@/data/services'
import { money } from '@/lib/format'
import type { Driver, Ride } from '@/lib/types'

/** واجهة السائق: التوفّر (متصل/غير متصل) + الطلبات الواردة وقبولها. */
export default function DriverHome() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { setActiveRide } = useDriver()
  const userId = profile?.id ?? 'demo-user'

  const [driver, setDriver] = useState<Driver | null>(null)
  const [online, setOnline] = useState(false)
  const [rides, setRides] = useState<Ride[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)
  const [notifOn, setNotifOn] = useState(notificationsGranted())
  const [acceptMsg, setAcceptMsg] = useState('')
  const [myPos, setMyPos] = useState<google.maps.LatLngLiteral | null>(null)

  // ملخّص اليوم (رحلات + صافي أرباح) — من محفظة السائق ومعاملاتها.
  const { data: wallet } = useQuery({
    queryKey: ['driver-wallet', userId],
    queryFn: () => getWallet(userId),
  })
  const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: getSettings })
  const minBalance = settings?.min_driver_balance ?? 0
  const lowBalance = wallet != null && minBalance > 0 && (wallet.balance ?? 0) < minBalance
  const { data: txs = [] } = useQuery({
    queryKey: ['driver-transactions', wallet?.id],
    queryFn: () => listDriverTransactions(wallet!.id),
    enabled: Boolean(wallet?.id),
  })
  const todayKey = new Date().toDateString()
  const todayTx = txs.filter((t) => new Date(t.created_at).toDateString() === todayKey)
  const tripsToday = todayTx.filter((t) => t.type === 'ride_earning').length
  const earnToday = todayTx
    .filter((t) => t.type === 'ride_earning' || t.type === 'commission')
    .reduce((s, t) => s + t.amount, 0)

  useEffect(() => {
    void getDriver(userId).then((d) => {
      setDriver(d)
      const isOn = d?.is_online ?? false
      setOnline(isOn)
      // إن كان متصلاً مسبقاً (فتح التطبيق من جديد) شغّل الخدمة الأمامية.
      // (تسجيل FCM يتم عند فتح التطبيق في AuthContext ويبقى محفوظاً.)
      if (isOn) void startCaptainBg()
    })
    // اطلب إذن الإشعارات والموقع مبكراً (يُبثّ موقع السائق للراكب فور القبول).
    void enableNotifications().then(setNotifOn)
    void ensureGeoPermission()
    // تسجيل رمز FCM (محاولة موثوقة بعد جهوز التطبيق) — لإشعارات الاعتماد والطلبات.
    if (userId) void registerPush(userId)
  }, [userId])

  // أوقف الخدمة الأمامية عند مغادرة الشاشة إن لم يعد متصلاً (احتياط).
  useEffect(() => {
    return () => {
      if (!online) void stopCaptainBg()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggleNotif = async () => {
    const ok = await enableNotifications()
    setNotifOn(ok)
    if (!ok) alert('فعّل إذن الإشعارات من إعدادات المتصفح لتصلك تنبيهات الطلبات.')
  }

  const seen = useRef<Set<string>>(new Set())
  const primed = useRef(false)

  useEffect(() => {
    if (!online) {
      setRides([])
      return
    }
    let alive = true
    // نبدأ من جديد عند كل اتصال حتى لا ننبّه على طلبات قديمة.
    seen.current = new Set()
    primed.current = false

    const load = () =>
      listAvailableRides().then((r) => {
        if (!alive) return
        setRides(r)
        // بعد أول تحميل: نبّه على أي طلب جديد لم نره من قبل.
        if (primed.current) {
          const fresh = r.some((x) => !seen.current.has(x.id))
          if (fresh) void alertNewRide()
        }
        r.forEach((x) => seen.current.add(x.id))
        primed.current = true
      })

    void load()
    // Realtime: أعِد الجلب فور أي تغيّر على الرحلات + استطلاع احتياطي بطيء.
    // Realtime (فوري إن عمل) + استطلاع احتياطي كل 8 ثوانٍ (يعمل حتى لو تعطّل).
    const unsub = subscribeToRides(load)
    const iv = setInterval(load, 8000)
    return () => {
      alive = false
      unsub()
      clearInterval(iv)
    }
  }, [online])

  // بثّ موقع السائق أثناء الاتصال — ليراه العملاء القريبون على الخريطة قبل الطلب.
  useEffect(() => {
    if (!online) return
    let alive = true
    let last = 0
    const report = (lat: number, lng: number) => {
      if (alive) setMyPos({ lat, lng }) // نحتفظ بالموقع لحساب بُعد الراكب
      const now = Date.now()
      if (now - last < 10000) return // خنق: مرّة كل ١٠ ثوانٍ على الأكثر
      last = now
      void updateMyLocation(lat, lng)
    }
    // أوّل تقرير فوري + متابعة الحركة + استطلاع احتياطي (لو GPS واقف).
    void getCurrentPos().then((p) => {
      if (alive && p) {
        last = 0
        report(p.lat, p.lng)
      }
    })
    let stop = () => {}
    void watchPos((p) => alive && report(p.lat, p.lng)).then((fn) => {
      if (alive) stop = fn
      else fn()
    })
    const iv = setInterval(() => {
      void getCurrentPos().then((p) => {
        if (alive && p) {
          last = 0
          report(p.lat, p.lng)
        }
      })
    }, 20000)
    return () => {
      alive = false
      stop()
      clearInterval(iv)
    }
  }, [online])

  const toggleOnline = async () => {
    const next = !online
    setOnline(next)
    setAcceptMsg('')
    // الخادم يفرض الحدّ الأدنى للرصيد عند الاتصال — نتحقّق أولاً قبل تشغيل الخدمات.
    if (driver) {
      const { error } = await setDriverOnline(driver.id, next)
      if (error) {
        // رُفض الاتصال (رصيد غير كافٍ) — أعِد الحالة وأبلغ السائق.
        setOnline(!next)
        setAcceptMsg(error)
        return
      }
    }
    // الخدمة الأمامية أثناء «متصل» فقط. رمز FCM يبقى محفوظاً (إشعارات الطلبات
    // تُرسَل للمتصلين فقط عبر الخادم، فلا يصل غير المتصل طلباً رغم بقاء رمزه).
    if (next) void startCaptainBg()
    else void stopCaptainBg()
  }

  const accept = async (ride: Ride) => {
    setBusyId(ride.id)
    setAcceptMsg('')
    const { error, taken } = await acceptRide(ride.id)
    setBusyId(null)
    if (error) {
      setAcceptMsg(error)
      return
    }
    if (taken) {
      // أُخذت من سائق آخر — أزِلها من القائمة وأبلغ السائق.
      setRides((cur) => cur.filter((r) => r.id !== ride.id))
      setAcceptMsg('اعتُذر — أُخذ هذا الطلب من سائق آخر.')
      return
    }
    setActiveRide({ ...ride, driver_id: userId, status: 'accepted' })
    navigate('/driver/trip')
  }

  return (
    <div className="screen bg-ivory font-plex">
      <header className="flex items-center gap-3 border-b border-hairline bg-white px-4 py-4">
        <Logo variant="driver" size={38} rounded={12} />
        <div className="flex-1">
          <p className="font-extrabold text-royal">قريب · الكابتن</p>
          <p className="flex items-center gap-1 text-xs text-ink-muted">
            <Star className="h-3.5 w-3.5 text-sand" strokeWidth={2} fill="currentColor" />
            {driver?.rating ?? '—'}
          </p>
        </div>
        {/* زر تفعيل تنبيهات الطلبات (صوت + إشعار) */}
        {notificationsSupported && (
          <button
            onClick={toggleNotif}
            aria-label={notifOn ? 'التنبيهات مفعّلة' : 'تفعيل التنبيهات'}
            title={notifOn ? 'تنبيهات الطلبات مفعّلة' : 'فعّل تنبيهات الطلبات'}
            className={`grid h-9 w-9 place-items-center rounded-full transition ${
              notifOn ? 'bg-royal-soft text-royal' : 'bg-hairline text-ink-soft'
            }`}
          >
            {notifOn ? (
              <Bell className="h-[18px] w-[18px]" strokeWidth={2} />
            ) : (
              <BellOff className="h-[18px] w-[18px]" strokeWidth={2} />
            )}
          </button>
        )}
        {/* مفتاح التوفّر */}
        <button
          onClick={toggleOnline}
          role="switch"
          aria-checked={online}
          className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-bold transition ${
            online ? 'bg-royal text-white' : 'bg-hairline text-ink-soft'
          }`}
        >
          <span className={`h-2 w-2 rounded-full ${online ? 'bg-sand' : 'bg-ink-muted'}`} />
          {online ? 'متصل' : 'غير متصل'}
        </button>
      </header>

      <main className="flex-1 px-4 pt-4 pb-24">
        {/* تنبيه رصيد منخفض — يمنع الاتصال واستقبال الطلبات */}
        {lowBalance && (
          <button
            onClick={() => navigate('/driver/wallet')}
            className="mb-4 flex w-full items-center gap-3 rounded-2xl border border-danger/40 bg-danger/5 p-3.5 text-right"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-danger/15 text-danger">
              <Coins className="h-5 w-5" strokeWidth={2} />
            </span>
            <div className="flex-1">
              <p className="font-bold text-danger">رصيدك منخفض</p>
              <p className="text-xs text-ink-soft">
                رصيدك {money(wallet?.balance ?? 0)} أقلّ من الحدّ الأدنى {money(minBalance)} — عبّئ
                رصيدك لتتمكّن من الاتصال واستقبال الطلبات.
              </p>
            </div>
            <ChevronLeft className="h-5 w-5 text-ink-muted" />
          </button>
        )}

        {/* ملخّص اليوم — رحلات + صافي أرباح + تقييم */}
        <div className="mb-4 grid grid-cols-3 gap-2.5">
          <SummaryStat Icon={Route} label="رحلات اليوم" value={String(tripsToday)} />
          <SummaryStat Icon={Coins} label="أرباح اليوم" value={money(Math.max(0, earnToday))} accent />
          <SummaryStat Icon={Star} label="تقييمك" value={String(driver?.rating ?? '—')} />
        </div>

        {/* السائق يطلب مشواراً لنفسه أو مساعدة عند التعطّل */}
        <button
          onClick={() => navigate('/home')}
          className="mb-3 flex w-full items-center gap-3 rounded-2xl border border-royal/15 bg-royal-soft p-3.5 text-right shadow-card"
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-royal text-white">
            <LifeBuoy className="h-5 w-5" strokeWidth={2} />
          </span>
          <div className="flex-1">
            <p className="font-bold text-royal">اطلب مشوار أو مساعدة</p>
            <p className="text-xs text-ink-soft">تعطّلت سيارتك؟ اطلب سائقاً أو سحّابة كأي راكب.</p>
          </div>
          <ChevronLeft className="h-5 w-5 text-ink-muted" />
        </button>

        <button
          onClick={() => navigate('/driver/demand')}
          className="mb-3 flex w-full items-center gap-3 rounded-2xl border border-orange-200 bg-orange-50 p-3.5 text-right"
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-orange-500/15 text-orange-600">
            <Flame className="h-5 w-5" strokeWidth={2.2} />
          </span>
          <div className="flex-1">
            <p className="font-bold text-royal">خريطة الطلب</p>
            <p className="text-xs text-ink-soft">شاهد أين يكثر الطلب الآن وتوجّه إليه.</p>
          </div>
          <ChevronLeft className="h-5 w-5 text-ink-muted" />
        </button>

        <button
          onClick={() => navigate('/track')}
          className="mb-4 flex w-full items-center gap-2 rounded-2xl border border-hairline bg-white px-4 py-3 text-sm font-medium text-ink-soft"
        >
          <Eye className="h-[18px] w-[18px] text-sand-ink" strokeWidth={2} />
          <span className="flex-1 text-right">تتبّع رحلة (بالرمز)</span>
          <ChevronLeft className="h-5 w-5 text-ink-muted" />
        </button>

        {acceptMsg && (
          <div className="mb-4 rounded-2xl border border-sand/50 bg-sand-soft/60 px-4 py-3 text-center text-sm font-medium text-sand-ink">
            {acceptMsg}
          </div>
        )}

        {!online ? (
          /* غير متصل — دعوة فخمة للانطلاق */
          <div className="animate-fade-up rounded-3xl bg-gradient-to-br from-royal to-[#0A2C22] p-7 text-center text-white shadow-lift">
            <span className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-white/10 ring-1 ring-sand/30">
              <Power className="h-10 w-10 text-sand" strokeWidth={1.8} />
            </span>
            <p className="mt-4 text-xl font-extrabold">جاهز للانطلاق؟</p>
            <p className="mt-1 text-sm text-white/70">
              فعّل الاتصال لاستقبال الطلبات القريبة منك وابدأ الكسب.
            </p>
            <button
              onClick={toggleOnline}
              className="press-scale mt-5 w-full rounded-2xl bg-sand py-3 font-extrabold text-royal"
            >
              اتصل الآن
            </button>
          </div>
        ) : rides.length === 0 ? (
          /* متصل بانتظار الطلبات — حالة هادئة بهوية قريب */
          <div className="flex animate-fade-up flex-col items-center justify-center py-12 text-center">
            <div className="relative grid h-44 w-44 place-items-center">
              <span className="absolute h-full w-full rounded-full bg-green/5" />
              <span
                className="absolute h-full w-full rounded-full bg-green/10"
                style={{ animation: 'ping 2.8s cubic-bezier(0,0,0.2,1) infinite' }}
              />
              <span
                className="absolute h-2/3 w-2/3 rounded-full bg-green/10"
                style={{ animation: 'ping 2.8s cubic-bezier(0,0,0.2,1) infinite', animationDelay: '1.4s' }}
              />
              <span className="relative grid h-24 w-24 place-items-center rounded-3xl bg-white shadow-float ring-1 ring-green/15">
                <Logo variant="driver" size={56} rounded={16} />
              </span>
            </div>
            <span className="mt-7 inline-flex items-center gap-2 rounded-full bg-green-soft px-4 py-1.5 text-sm font-extrabold text-green">
              <span className="h-2 w-2 animate-pulse rounded-full bg-green" />
              أنت متصل الآن
            </span>
            <p className="mt-3 text-base font-bold text-royal">في انتظار طلبات الركّاب</p>
            <p className="mt-1 text-sm text-ink-soft">
              اترك التطبيق يعمل — سيصلك إشعار فور وصول طلب قريب.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <h2 className="font-bold text-royal">طلبات واردة</h2>
            {rides.map((r) => {
              const service = getService(r.service_id)
              // مسافة الرحلة التقديرية (خط مستقيم × معامل الطريق) — تُحسب محلياً بلا خادم.
              const tripKm =
                r.dropoff_lat != null && r.dropoff_lng != null
                  ? haversineKm(
                      { lat: r.pickup_lat, lng: r.pickup_lng },
                      { lat: r.dropoff_lat, lng: r.dropoff_lng },
                    ) * 1.3
                  : null
              // بُعد الراكب عن السائق (خطّ مستقيم × معامل الطريق) + زمن تقريبي.
              const toPickupKm = myPos
                ? haversineKm(myPos, { lat: r.pickup_lat, lng: r.pickup_lng }) * 1.3
                : null
              const toPickupMin = toPickupKm != null ? Math.max(1, Math.round((toPickupKm / 25) * 60)) : null
              return (
                <div key={r.id} className="rounded-2xl bg-white p-4 shadow-card">
                  <div className="flex items-center gap-3">
                    {service && <VehicleImage service={service} className="h-12 w-16" />}
                    <div className="flex-1">
                      <p className="font-bold text-royal">{service?.name ?? r.service_id}</p>
                      <p className="text-sm text-ink-soft">
                        {r.pickup_address} ← {r.dropoff_address}
                      </p>
                    </div>
                    <p className="font-extrabold text-sand-ink">{money(r.fare ?? 0)}</p>
                  </div>

                  {/* الراكب + تقييمه + مسافة الرحلة */}
                  <div className="mt-2 flex items-center gap-3 border-t border-hairline pt-2 text-sm">
                    <span className="flex items-center gap-1.5 font-medium text-ink">
                      <User className="h-4 w-4 text-sand-ink" strokeWidth={2} />
                      {r.customer_name ?? 'راكب'}
                    </span>
                    {r.customer_rating != null && (
                      <span className="flex items-center gap-1 text-ink-soft">
                        <Star className="h-3.5 w-3.5 text-sand" fill="currentColor" strokeWidth={2} />
                        {r.customer_rating}
                      </span>
                    )}
                    {tripKm != null && (
                      <span className="mr-auto flex items-center gap-1 text-ink-soft">
                        <Route className="h-3.5 w-3.5 text-sand-ink" strokeWidth={2} />~
                        {tripKm.toFixed(1)} كم
                      </span>
                    )}
                  </div>

                  {/* بُعد الراكب عن السائق — يقرّر السائق بسرعة */}
                  {toPickupKm != null && (
                    <div className="mt-2 flex items-center gap-2 rounded-xl bg-green-mint px-3 py-2 text-[13px] font-bold text-green">
                      <Navigation className="h-4 w-4" strokeWidth={2.2} />
                      الراكب يبعد ~{toPickupKm.toFixed(1)} كم عنك ({toPickupMin} دقيقة)
                    </div>
                  )}

                  <button
                    onClick={() => accept(r)}
                    disabled={busyId === r.id}
                    className="btn-driver mt-3 w-full"
                  >
                    {busyId === r.id ? '…' : 'قبول الطلب'}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </main>

      <DriverNav />
    </div>
  )
}

/** بطاقة مؤشّر يومي مصغّرة (رحلات/أرباح/تقييم). */
function SummaryStat({
  Icon,
  label,
  value,
  accent,
}: {
  Icon: typeof Route
  label: string
  value: string
  accent?: boolean
}) {
  return (
    <div className="rounded-2xl bg-white p-3 text-center shadow-card">
      <span
        className={`mx-auto grid h-8 w-8 place-items-center rounded-full ${
          accent ? 'bg-sand/20 text-sand-ink' : 'bg-royal-soft text-royal'
        }`}
      >
        <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
      </span>
      <p className={`mt-1.5 text-base font-extrabold ${accent ? 'text-sand-ink' : 'text-royal'}`}>
        {value}
      </p>
      <p className="text-[10px] text-ink-muted">{label}</p>
    </div>
  )
}
