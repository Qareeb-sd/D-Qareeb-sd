import { useState, useEffect, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { User, Star, LifeBuoy, Crown, BadgePercent, MessageSquare, ChevronLeft } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import DriverNav from '@/components/DriverNav'
import NotificationToggle from '@/components/NotificationToggle'
import VipSubscribe from '@/components/VipSubscribe'
import { useAuth } from '@/store/AuthContext'
import { getDriver, updateEmergencyContacts, setDriverServicePrefs } from '@/lib/api'
import { getService } from '@/data/services'
import { Package, Building2 } from 'lucide-react'

export default function DriverProfile() {
  const navigate = useNavigate()
  const { profile, signOut, refreshProfile } = useAuth()
  const userId = profile?.id ?? 'demo-user'
  const { data: driver, refetch: refetchDriver } = useQuery({
    queryKey: ['driver', userId],
    queryFn: () => getDriver(userId),
  })

  const [c1, setC1] = useState(profile?.sos_contact1 ?? '')
  const [c2, setC2] = useState(profile?.sos_contact2 ?? '')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  // تفضيلات الخدمات (طرود/سفر) — تُهيّأ من بيانات السائق وتُحفظ فور التبديل.
  const [prefPkg, setPrefPkg] = useState(true)
  const [prefInter, setPrefInter] = useState(false)
  useEffect(() => {
    if (driver) {
      setPrefPkg(driver.accepts_packages ?? true)
      setPrefInter(driver.accepts_intercity ?? false)
    }
  }, [driver])
  const savePrefs = async (pkg: boolean, inter: boolean) => {
    setPrefPkg(pkg)
    setPrefInter(inter)
    const { error } = await setDriverServicePrefs(pkg, inter)
    if (error) {
      // تراجع بصري عند الفشل
      setPrefPkg(driver?.accepts_packages ?? true)
      setPrefInter(driver?.accepts_intercity ?? false)
      alert(error)
    } else {
      void refetchDriver()
    }
  }

  const saveContacts = async () => {
    setBusy(true)
    setMsg('')
    const { error } = await updateEmergencyContacts(
      profile?.id ?? '',
      c1.trim() || null,
      c2.trim() || null,
    )
    await refreshProfile()
    setBusy(false)
    setMsg(error ? `خطأ: ${error}` : 'تم حفظ جهات الطوارئ ✓')
  }

  const logout = async () => {
    await signOut()
    navigate('/driver/login')
  }

  return (
    <div className="screen font-plex bg-ivory">
      <header className="border-b border-hairline px-4 py-4">
        <h1 className="text-lg font-bold">حسابي</h1>
      </header>

      <main className="flex-1 px-4 pb-24">
        <div className="card flex items-center gap-4 p-4">
          <div className="grid h-14 w-14 place-items-center rounded-full bg-sand/25">
            <User className="h-7 w-7 text-royal" strokeWidth={2} />
          </div>
          <div>
            <p className="font-bold">{profile?.full_name ?? 'سائق قريب'}</p>
            <p className="text-sm text-ink-soft" dir="ltr">
              {profile?.phone ?? '—'}
            </p>
          </div>
        </div>

        {driver && (
          <div className="card mt-4 divide-y divide-hairline p-0">
            <Row label="المركبة" value={getService(driver.vehicle_type)?.name ?? driver.vehicle_type} />
            <Row label="رقم اللوحة" value={driver.plate_number ?? '—'} />
            <Row
              label="التقييم"
              value={
                <span className="inline-flex items-center gap-1">
                  <Star className="h-4 w-4 text-sand" fill="currentColor" strokeWidth={2} />
                  {driver.rating != null
                    ? `${driver.rating} · ${profile?.ratings_count ?? 0} تقييم`
                    : '—'}
                </span>
              }
            />
          </div>
        )}

        {/* حالة العمولة / اشتراك VIP */}
        {driver && <CommissionStatus driver={driver} />}
        {driver && (
          <VipSubscribe driver={driver} userId={userId} onChanged={() => void refetchDriver()} />
        )}

        {/* تفضيلات الخدمات: استقبال الطرود / السفر بين المدن */}
        {driver && (
          <div className="card mt-4 p-4">
            <p className="mb-1 font-bold">أنواع الطلبات التي أستقبلها</p>
            <p className="mb-3 text-xs text-ink-muted">
              تصلك طلبات الطرود والسفر بين المدن فقط إن فعّلتها — وإلا تذهب لسائق آخر.
            </p>
            <PrefToggle
              Icon={Package}
              label="توصيل الطرود"
              hint="طلبات إرسال طرود لعنوان آخر"
              on={prefPkg}
              onChange={(v) => void savePrefs(v, prefInter)}
            />
            <div className="my-2 h-px bg-hairline" />
            <PrefToggle
              Icon={Building2}
              label="السفر بين المدن"
              hint="رحلات طويلة لمدينة أخرى"
              on={prefInter}
              onChange={(v) => void savePrefs(prefPkg, v)}
            />
          </div>
        )}

        {/* جهات الطوارئ (مثل العميل) */}
        <div className="card mt-4 p-4">
          <div className="mb-1 flex items-center gap-2">
            <LifeBuoy className="h-5 w-5 text-danger" strokeWidth={2} />
            <p className="font-bold">جهات الطوارئ</p>
          </div>
          <p className="mb-3 text-xs text-ink-muted">
            رقمان يصلهما تنبيه فيه موقعك عند ضغطك زر الطوارئ أثناء الرحلة.
          </p>
          <input
            className="field text-left"
            dir="ltr"
            inputMode="tel"
            placeholder="رقم جهة الطوارئ الأولى"
            value={c1}
            onChange={(e) => setC1(e.target.value)}
          />
          <input
            className="field mt-2 text-left"
            dir="ltr"
            inputMode="tel"
            placeholder="رقم جهة الطوارئ الثانية (اختياري)"
            value={c2}
            onChange={(e) => setC2(e.target.value)}
          />
          {msg && <p className="mt-2 text-sm text-green">{msg}</p>}
          <button onClick={saveContacts} disabled={busy} className="btn-driver mt-3 w-full">
            {busy ? '…' : 'حفظ جهات الطوارئ'}
          </button>
        </div>

        {/* الدعم داخل التطبيق */}
        <button
          onClick={() => navigate('/driver/support')}
          className="mt-4 flex w-full items-center gap-3 rounded-2xl border border-royal/20 bg-royal-soft/40 px-4 py-3.5 text-right"
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-royal/10">
            <MessageSquare className="h-5 w-5 text-royal" strokeWidth={2} />
          </span>
          <span className="flex-1">
            <span className="block font-bold text-royal">تواصل مع الدعم</span>
            <span className="block text-xs text-ink-muted">راسل الإدارة مباشرة داخل التطبيق</span>
          </span>
          <ChevronLeft className="h-5 w-5 text-ink-muted" strokeWidth={2} />
        </button>

        <NotificationToggle userId={profile?.id ?? 'demo-user'} />

        <button onClick={logout} className="btn-outline mt-6 w-full text-danger">
          تسجيل الخروج
        </button>
      </main>

      <DriverNav />
    </div>
  )
}

/** بطاقة حالة العمولة/الاشتراك للسائق (تُدار من الأدمن). */
function CommissionStatus({ driver }: { driver: import('@/lib/types').Driver }) {
  const now = Date.now()
  const fmt = (s: string) => new Date(s).toLocaleDateString('ar-SD')
  const vipActive =
    Boolean(driver.vip) &&
    Boolean(driver.vip_paid_until) &&
    new Date(driver.vip_paid_until as string).getTime() > now
  const freeActive =
    Boolean(driver.commission_free_until) &&
    new Date(driver.commission_free_until as string).getTime() > now

  if (vipActive) {
    return (
      <div className="mt-4 rounded-2xl border border-sand bg-sand-soft/50 p-4">
        <div className="flex items-center gap-2">
          <Crown className="h-5 w-5 text-sand-ink" strokeWidth={2} />
          <p className="font-bold text-royal">سائق VIP</p>
          <span className="ms-auto chip bg-green-soft text-xs font-bold text-green">فعّال</span>
        </div>
        <p className="mt-1 text-sm text-ink-soft">
          بلا عمولة على رحلاتك. الاشتراك ساري حتى{' '}
          <span className="font-bold text-royal">{fmt(driver.vip_paid_until as string)}</span>.
        </p>
      </div>
    )
  }
  if (driver.vip) {
    // VIP لكن انتهى الاشتراك (دفع مقدّم) → العمولة تعود حتى يجدّد بنفسه.
    return (
      <div className="mt-4 rounded-2xl border border-danger/40 bg-danger/5 p-4">
        <div className="flex items-center gap-2">
          <Crown className="h-5 w-5 text-danger" strokeWidth={2} />
          <p className="font-bold text-royal">انتهى اشتراك VIP</p>
        </div>
        <p className="mt-1 text-sm text-ink-soft">
          اشتراكك الشهري (المدفوع مقدّماً) انتهى، لذا تُطبَّق العمولة على رحلاتك. جدّد الاشتراك من
          الزرّ أدناه لاستعادة الإعفاء — بلا أيّ خصم تلقائي من محفظتك.
        </p>
      </div>
    )
  }
  if (freeActive) {
    return (
      <div className="mt-4 rounded-2xl border border-green/30 bg-green-soft/40 p-4">
        <div className="flex items-center gap-2">
          <BadgePercent className="h-5 w-5 text-green" strokeWidth={2} />
          <p className="font-bold text-royal">إعفاء من العمولة</p>
        </div>
        <p className="mt-1 text-sm text-ink-soft">
          معفى من العمولة حتى{' '}
          <span className="font-bold text-royal">
            {fmt(driver.commission_free_until as string)}
          </span>{' '}
          — تحصل على كامل الأجرة.
        </p>
      </div>
    )
  }
  return null
}

/** مفتاح تبديل لتفضيل خدمة (طرود/سفر). */
function PrefToggle({
  Icon,
  label,
  hint,
  on,
  onChange,
}: {
  Icon: typeof Package
  label: string
  hint: string
  on: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${
          on ? 'bg-green-soft text-green' : 'bg-ivory text-ink-muted'
        }`}
      >
        <Icon className="h-5 w-5" strokeWidth={2} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-bold text-royal">{label}</p>
        <p className="text-xs text-ink-muted">{hint}</p>
      </div>
      <button
        role="switch"
        aria-checked={on}
        aria-label={label}
        onClick={() => onChange(!on)}
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
          on ? 'bg-green' : 'bg-ink-muted/30'
        }`}
      >
        <span
          className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${
            on ? 'right-0.5' : 'right-[22px]'
          }`}
        />
      </button>
    </div>
  )
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between px-4 py-3.5">
      <span className="text-sm text-ink-soft">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}
