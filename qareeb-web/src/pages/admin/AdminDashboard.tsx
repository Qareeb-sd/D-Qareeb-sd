import { useEffect, useMemo, useState } from 'react'
import Logo from '@/components/Logo'
import MapView from '@/components/MapView'
import { StatCard, ChartCard, StatusBadge, BarChart, DonutChart } from '@/components/admin/AdminUI'
import { services } from '@/data/services'
import { money, num } from '@/lib/format'
import { useAuth } from '@/store/AuthContext'
import {
  getAdminStats,
  getSettings,
  listPendingTopups,
  approveTopup,
  rejectTopup,
  updateSettings,
  getProofUrl,
  listServicePricing,
  updateServicePricing,
  listDriverApplications,
  approveDriverApplication,
  rejectDriverApplication,
  getDriverDocUrl,
  listAllDrivers,
  listAllRides,
  listActiveRides,
  deleteDriver,
  getFinancialSummary,
  listSosAlerts,
  resolveSos,
  getMyAdminAccess,
  listStaff,
  setStaff,
  removeStaff,
  setStaffActive,
  listAuditLog,
  type AdminStats,
  type AdminDriverRow,
  type FinancialSummary,
} from '@/lib/api'
import { subscribeToSos, subscribeToTopups, subscribeToDriverApplications } from '@/lib/realtime'
import { exportCsv } from '@/lib/csv'
import { getService } from '@/data/services'
import type {
  Settings,
  Topup,
  ServicePricing,
  DriverApplication,
  Ride,
  SosAlert,
  AdminAccess,
  StaffRow,
  StaffPerm,
  AuditEntry,
} from '@/lib/types'

type Tab = 'overview' | 'requests' | 'drivers' | 'rides' | 'finance' | 'settings' | 'staff' | 'audit'

/** التبويبات مع الصلاحية المطلوبة لكلٍّ (null = تكفي أي صلاحية). */
const tabs: { id: Tab; label: string; perm: StaffPerm | null; ownerOnly?: boolean }[] = [
  { id: 'overview', label: 'نظرة عامة', perm: null },
  { id: 'requests', label: 'الطلبات', perm: 'requests' },
  { id: 'drivers', label: 'السائقون', perm: 'drivers' },
  { id: 'rides', label: 'الرحلات', perm: 'rides' },
  { id: 'finance', label: 'المالية', perm: null, ownerOnly: true },
  { id: 'settings', label: 'الإعدادات', perm: 'settings' },
  { id: 'staff', label: 'الموظفون', perm: null, ownerOnly: true },
  { id: 'audit', label: 'سجلّ النشاط', perm: null, ownerOnly: true },
]

/** أسماء الصلاحيات المعروضة للمالك عند إضافة موظف. */
const permLabels: { id: StaffPerm; label: string; desc: string }[] = [
  { id: 'requests', label: 'الطلبات', desc: 'اعتماد التعبئات وطلبات السائقين' },
  { id: 'drivers', label: 'السائقون', desc: 'عرض وإدارة السائقين' },
  { id: 'rides', label: 'الرحلات', desc: 'متابعة الرحلات' },
  { id: 'settings', label: 'الإعدادات', desc: 'التسعير والعمولة والحساب البنكي' },
]

/**
 * لوحة الأدمن — أقسام مستقلة (تبويبات): نظرة عامة + الطلبات (تعبئات/سائقون)
 * + السائقون + الرحلات + الإعدادات والتسعير. الأمان مفروض عبر RLS ودوال Postgres.
 */
export default function AdminDashboard() {
  const { signOut } = useAuth()
  const [tab, setTab] = useState<Tab>('overview')

  const [stats, setStats] = useState<AdminStats | null>(null)
  const [finance, setFinance] = useState<FinancialSummary | null>(null)
  const [topups, setTopups] = useState<Topup[]>([])
  const [settings, setSettings] = useState<Settings | null>(null)
  const [pricing, setPricing] = useState<ServicePricing[]>([])
  const [driverApps, setDriverApps] = useState<DriverApplication[]>([])
  const [drivers, setDrivers] = useState<AdminDriverRow[] | null>(null)
  const [rides, setRides] = useState<Ride[] | null>(null)
  const [activeRides, setActiveRides] = useState<Ride[]>([])
  const [sos, setSos] = useState<SosAlert[]>([])

  // صلاحياتي (مالك أم موظف؟) + قائمة الموظفين (للمالك)
  const [access, setAccess] = useState<AdminAccess>({ is_admin: false, perms: [] })
  const [staffList, setStaffList] = useState<StaffRow[] | null>(null)
  const [staffPhone, setStaffPhone] = useState('')
  const [staffPerms, setStaffPerms] = useState<StaffPerm[]>(['requests'])
  const [staffMsg, setStaffMsg] = useState('')
  const [audit, setAudit] = useState<AuditEntry[] | null>(null)
  const [toast, setToast] = useState('')

  // بحث/فلترة
  const [rideQuery, setRideQuery] = useState('')
  const [rideStatus, setRideStatus] = useState('')
  const [driverQuery, setDriverQuery] = useState('')

  const [busyId, setBusyId] = useState<string | null>(null)
  const [savedMsg, setSavedMsg] = useState('')
  const [priceMsg, setPriceMsg] = useState('')

  useEffect(() => {
    void (async () => {
      const [s, fin, t, cfg, pr, apps, rd] = await Promise.all([
        getAdminStats(),
        getFinancialSummary(),
        listPendingTopups(),
        getSettings(),
        listServicePricing(),
        listDriverApplications('pending'),
        listAllRides(500),
      ])
      setStats(s)
      setFinance(fin)
      setTopups(t)
      setSettings(cfg)
      setPricing(pr)
      setDriverApps(apps)
      setRides(rd)
    })()
  }, [])

  // تحميل كسول لقائمة السائقين عند فتح تبويبها أول مرة.
  useEffect(() => {
    if (tab === 'drivers' && drivers === null) void listAllDrivers().then(setDrivers)
  }, [tab, drivers])

  // صلاحياتي + قائمة الموظفين (للمالك).
  useEffect(() => {
    void getMyAdminAccess().then(setAccess)
  }, [])
  useEffect(() => {
    if (tab === 'staff' && staffList === null) void listStaff().then(setStaffList)
    if (tab === 'audit' && audit === null) void listAuditLog().then((a) => setAudit(a as AuditEntry[]))
  }, [tab, staffList, audit])

  const toggleStaffActive = async (s: StaffRow) => {
    setBusyId(s.user_id)
    const { error } = await setStaffActive(s.user_id, !s.active)
    setBusyId(null)
    if (error) return alert(error)
    setStaffList((cur) =>
      cur ? cur.map((x) => (x.user_id === s.user_id ? { ...x, active: !s.active } : x)) : cur,
    )
  }

  // قوائم مفلترة
  const filteredRides = (rides ?? []).filter((r) => {
    const okStatus = !rideStatus || r.status === rideStatus
    const q = rideQuery.trim()
    const okQuery =
      !q ||
      (r.pickup_address ?? '').includes(q) ||
      (r.dropoff_address ?? '').includes(q) ||
      (getService(r.service_id)?.name ?? '').includes(q)
    return okStatus && okQuery
  })
  const filteredDrivers = (drivers ?? []).filter((d) => {
    const q = driverQuery.trim()
    return (
      !q ||
      (d.users?.full_name ?? '').includes(q) ||
      (d.users?.phone ?? '').includes(q) ||
      (d.plate_number ?? '').includes(q)
    )
  })

  const togglePerm = (p: StaffPerm) =>
    setStaffPerms((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]))

  const addStaff = async () => {
    if (!staffPhone.trim() || staffPerms.length === 0) return
    setStaffMsg('')
    setBusyId('staff-add')
    const { message, error } = await setStaff(staffPhone.trim(), staffPerms)
    setBusyId(null)
    setStaffMsg(error ?? message ?? '')
    if (!error) {
      setStaffPhone('')
      setStaffList(null) // إعادة التحميل
    }
  }

  const deleteStaff = async (userId: string, name: string) => {
    if (!window.confirm(`إزالة الموظف «${name}» من لوحة الإدارة؟`)) return
    setBusyId(userId)
    const { error } = await removeStaff(userId)
    setBusyId(null)
    if (error) return alert(error)
    setStaffList((cur) => (cur ? cur.filter((s) => s.user_id !== userId) : cur))
  }

  // ===== تصدير CSV =====
  const day = () => new Date().toISOString().slice(0, 10)
  const statusAr: Record<string, string> = {
    requested: 'مطلوبة',
    searching: 'بحث عن سائق',
    accepted: 'مقبولة',
    arrived: 'وصل السائق',
    in_progress: 'جارية',
    completed: 'مكتملة',
    cancelled: 'ملغاة',
  }
  const exportRides = () =>
    exportCsv(
      `الرحلات-${day()}`,
      [
        { key: 'date', label: 'التاريخ' },
        { key: 'service', label: 'المركبة' },
        { key: 'status', label: 'الحالة' },
        { key: 'pickup', label: 'الإقلاع' },
        { key: 'dropoff', label: 'الوجهة' },
        { key: 'fare', label: 'الأجرة' },
      ],
      filteredRides.map((r) => ({
        date: new Date(r.created_at).toLocaleString('ar-SD'),
        service: getService(r.service_id)?.name ?? r.service_id,
        status: statusAr[r.status] ?? r.status,
        pickup: r.pickup_address ?? '',
        dropoff: r.dropoff_address ?? '',
        fare: Math.round(r.fare ?? 0),
      })),
    )
  const exportFinance = () =>
    exportCsv(
      `المالية-${day()}`,
      [
        { key: 'metric', label: 'البند' },
        { key: 'value', label: 'القيمة (ج.س)' },
      ],
      [
        { metric: 'عمولة المنصة', value: Math.round(finance?.platform_commission ?? 0) },
        { metric: 'أرباح السائقين', value: Math.round(finance?.driver_earnings ?? 0) },
        { metric: 'إجمالي التعبئات', value: Math.round(finance?.total_topups ?? 0) },
        { metric: 'مدفوعات المحفظة', value: Math.round(finance?.ride_payments ?? 0) },
        { metric: 'أرصدة المحافظ', value: Math.round(finance?.wallet_liability ?? 0) },
        { metric: 'رحلات مكتملة', value: finance?.completed_rides ?? 0 },
      ],
    )
  const exportAudit = () =>
    exportCsv(
      `سجل-النشاط-${day()}`,
      [
        { key: 'date', label: 'التاريخ' },
        { key: 'actor', label: 'الفاعل' },
        { key: 'action', label: 'الإجراء' },
        { key: 'target', label: 'الهدف' },
      ],
      (audit ?? []).map((a) => ({
        date: new Date(a.created_at).toLocaleString('ar-SD'),
        actor: a.actor_name ?? '',
        action: a.action,
        target: a.target ?? '',
      })),
    )

  // التبويبات المرئية حسب صلاحياتي.
  const visibleTabs = tabs.filter((t) => {
    if (t.ownerOnly) return access.is_admin
    if (t.perm === null) return true
    return access.is_admin || access.perms.includes(t.perm)
  })

  // ===== تحليلات محسوبة من الرحلات الحقيقية =====
  const analytics = useMemo(() => {
    const rs = rides ?? []
    const dayNames = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
    // رحلات آخر 7 أيام حسب اليوم
    const weekly: { label: string; value: number }[] = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const label = dayNames[d.getDay()]
      const count = rs.filter((r) => {
        const rd = new Date(r.created_at)
        return rd.toDateString() === d.toDateString()
      }).length
      weekly.push({ label, value: count })
    }
    // توزيع المركبات (عدد الرحلات لكل نوع)
    const vehicle = services
      .map((s) => ({
        label: s.name,
        value: rs.filter((r) => r.service_id === s.id).length,
        color: s.tint === '#EDEFEC' ? '#1B6B3F' : s.tint,
      }))
      .filter((v) => v.value > 0)
    // إيرادات الرحلات المكتملة
    const completed = rs.filter((r) => r.status === 'completed')
    const revenue = completed.reduce((sum, r) => sum + (r.fare ?? 0), 0)
    // إيرادات آخر ٧ أيام (من الرحلات المكتملة)
    const weeklyRevenue: { label: string; value: number }[] = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const amt = completed
        .filter((r) => new Date(r.created_at).toDateString() === d.toDateString())
        .reduce((sum, r) => sum + (r.fare ?? 0), 0)
      weeklyRevenue.push({ label: dayNames[d.getDay()], value: Math.round(amt) })
    }
    // إيرادات حسب المركبة
    const vehicleRevenue = services
      .map((s) => ({
        label: s.name,
        value: Math.round(
          completed.filter((r) => r.service_id === s.id).reduce((sum, r) => sum + (r.fare ?? 0), 0),
        ),
        color: s.tint === '#EDEFEC' ? '#1B6B3F' : s.tint,
      }))
      .filter((v) => v.value > 0)
    const recentCompleted = completed.slice(0, 12)
    return { weekly, vehicle, completedCount: completed.length, revenue, weeklyRevenue, vehicleRevenue, recentCompleted }
  }, [rides])

  // تنبيهات الطوارئ — تُحمَّل وتُتابَع لحظياً (تظهر فوق كل التبويبات).
  useEffect(() => {
    const load = () => listSosAlerts().then(setSos)
    void load()
    return subscribeToSos(load)
  }, [])

  // إشعار الأدمن: عند طلب تعبئة/سائق جديد → حدّث القائمة + تنبيه صوتي.
  useEffect(() => {
    const ping = () => {
      try {
        // نغمة قصيرة عبر Web Audio (بلا ملفات).
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        const ctx = new AC()
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.frequency.value = 880
        gain.gain.setValueAtTime(0.001, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35)
        osc.start()
        osc.stop(ctx.currentTime + 0.36)
      } catch {
        /* الصوت غير متاح — تجاهل */
      }
    }
    const reloadTopups = () => listPendingTopups().then(setTopups)
    const reloadApps = () => listDriverApplications('pending').then(setDriverApps)
    const primed = { current: false }
    // أول تحميل لا يصدر صوتاً؛ التغيّرات اللاحقة تصدر.
    const onTopup = () => {
      reloadTopups()
      if (primed.current) {
        ping()
        setToast('🔔 طلب تعبئة رصيد جديد')
      }
    }
    const onApp = () => {
      reloadApps()
      if (primed.current) {
        ping()
        setToast('🔔 طلب انضمام سائق جديد')
      }
    }
    const t = setTimeout(() => (primed.current = true), 3000)
    const un1 = subscribeToTopups(onTopup)
    const un2 = subscribeToDriverApplications(onApp)
    return () => {
      clearTimeout(t)
      un1()
      un2()
    }
  }, [])

  // إخفاء التنبيه المنبثق تلقائياً بعد ٦ ثوانٍ.
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 6000)
    return () => clearTimeout(t)
  }, [toast])

  // خريطة النشاط المباشر — الرحلات النشطة (تحديث دوري خفيف).
  useEffect(() => {
    const load = () => void listActiveRides().then(setActiveRides)
    load()
    const iv = setInterval(load, 15000)
    return () => clearInterval(iv)
  }, [])

  const removeDriver = async (userId: string, name: string) => {
    if (!window.confirm(`حذف السائق «${name}»؟ سيعود حسابه عميلاً.`)) return
    setBusyId(userId)
    const { error } = await deleteDriver(userId)
    setBusyId(null)
    if (error) return alert(error)
    setDrivers((cur) => (cur ? cur.filter((d) => d.user_id !== userId) : cur))
  }

  const clearSos = async (id: string) => {
    setBusyId(id)
    const { error } = await resolveSos(id)
    setBusyId(null)
    if (error) return alert(error)
    setSos((cur) => cur.filter((a) => a.id !== id))
  }

  const viewDoc = async (path: string | null) => {
    if (!path) return alert('لا توجد وثيقة مرفقة')
    const url = await getDriverDocUrl(path)
    if (url) window.open(url, '_blank', 'noopener')
    else alert('عرض الوثيقة غير متاح في وضع المعاينة')
  }

  const reviewDriver = async (app: DriverApplication, approve: boolean) => {
    const note = approve ? undefined : window.prompt('سبب الرفض (اختياري):') ?? undefined
    setBusyId(app.id)
    const { error } = approve
      ? await approveDriverApplication(app.id)
      : await rejectDriverApplication(app.id, note)
    setBusyId(null)
    if (error) return alert(error)
    setDriverApps((cur) => cur.filter((a) => a.id !== app.id))
    setDrivers(null) // أعِد تحميل قائمة السائقين لاحقاً (قد يكون أُضيف سائق)
  }

  const viewProof = async (path: string) => {
    const url = await getProofUrl(path)
    if (url) window.open(url, '_blank', 'noopener')
    else alert('عرض الإثبات غير متاح في وضع المعاينة')
  }

  const review = async (id: string, approve: boolean) => {
    setBusyId(id)
    const { error } = approve ? await approveTopup(id) : await rejectTopup(id)
    setBusyId(null)
    if (error) return alert(error)
    setTopups((cur) => cur.filter((t) => t.id !== id))
    setStats((s) => (s ? { ...s, pendingTopups: Math.max(0, s.pendingTopups - 1) } : s))
  }

  const saveSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!settings) return
    setSavedMsg('')
    const { error } = await updateSettings({
      commission_rate: settings.commission_rate,
      surge_multiplier: settings.surge_multiplier,
      tier1_max_km: settings.tier1_max_km,
      tier2_max_km: settings.tier2_max_km,
      bank_name: settings.bank_name,
      bank_account_name: settings.bank_account_name,
      bank_account_number: settings.bank_account_number,
    })
    setSavedMsg(error ? `خطأ: ${error}` : 'تم حفظ الإعدادات ✓')
  }

  const setPrice = (id: string, field: keyof ServicePricing, value: number) =>
    setPricing((cur) => cur.map((p) => (p.service_id === id ? { ...p, [field]: value } : p)))

  const savePrice = async (p: ServicePricing) => {
    setBusyId(p.service_id)
    setPriceMsg('')
    const { error } = await updateServicePricing(p.service_id, {
      base_fare: p.base_fare,
      per_km_urban: p.per_km_urban,
      per_km_far: p.per_km_far,
      per_minute: p.per_minute,
    })
    setBusyId(null)
    setPriceMsg(error ? `خطأ: ${error}` : `تم حفظ تسعيرة «${p.name}» ✓`)
  }

  const commissionPct = settings ? Math.round(settings.commission_rate * 100) : 0
  const pendingCount = topups.length + driverApps.length

  // عنوان التبويب في المتصفح يعكس الطلبات المعلّقة (يظهر حتى لو اللوحة بالخلفية).
  useEffect(() => {
    document.title = pendingCount > 0 ? `(${pendingCount}) لوحة تحكم قريب` : 'لوحة تحكم قريب'
  }, [pendingCount])

  return (
    <div className="screen mx-auto w-full max-w-7xl px-2 sm:px-4">
      {/* تنبيه منبثق عند وصول طلب جديد */}
      {toast && (
        <button
          onClick={() => {
            setTab('requests')
            setToast('')
          }}
          className="fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-2xl bg-green px-5 py-3 text-sm font-bold text-white shadow-lift"
          style={{ animation: 'pulse 1.2s ease-in-out 2' }}
        >
          {toast} — اضغط للعرض
        </button>
      )}

      <header className="flex items-center gap-3 bg-green px-4 py-4 text-white shadow-card">
        <Logo size={36} rounded={10} />
        <h1 className="flex-1 text-lg font-extrabold">لوحة تحكم قريب</h1>
        {/* جرس الطلبات المعلّقة */}
        <button
          onClick={() => setTab('requests')}
          title="الطلبات المعلّقة"
          className="relative grid h-9 w-9 place-items-center rounded-full bg-white/15 text-lg hover:bg-white/25"
        >
          🔔
          {pendingCount > 0 && (
            <span className="absolute -left-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-lemon px-1 text-[10px] font-extrabold text-green-dark">
              {pendingCount}
            </span>
          )}
        </button>
        <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold">الإدارة</span>
        <button
          onClick={() => void signOut()}
          className="rounded-full bg-white/15 px-3 py-1.5 text-sm font-bold hover:bg-white/25"
        >
          خروج
        </button>
      </header>

      {/* تبويبات */}
      <nav className="flex gap-1 overflow-x-auto border-b border-hairline px-2 py-2">
        {visibleTabs.map((tb) => (
          <button
            key={tb.id}
            onClick={() => setTab(tb.id)}
            className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-bold transition ${
              tab === tb.id ? 'bg-green text-white' : 'text-ink-soft hover:bg-green-soft'
            }`}
          >
            {tb.label}
            {tb.id === 'requests' && pendingCount > 0 && (
              <span className="mr-1 inline-flex h-5 min-w-5 animate-pulse items-center justify-center rounded-full bg-danger px-1.5 text-xs font-bold text-white">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </nav>

      <main className="flex-1 space-y-4 p-4">
        {/* تنبيهات الطوارئ — دائمة الظهور فوق كل التبويبات */}
        {sos.length > 0 && (
          <div className="card border border-danger/40 bg-danger/5 p-4">
            <p className="mb-2 font-bold text-danger">🚨 تنبيهات طوارئ ({sos.length})</p>
            <div className="divide-y divide-hairline">
              {sos.map((a) => (
                <div key={a.id} className="flex items-center gap-3 py-2.5">
                  <div className="flex-1 text-sm">
                    <p className="font-bold">{a.role === 'driver' ? 'سائق' : 'راكب'}</p>
                    <p className="text-xs text-ink-muted">
                      {new Date(a.created_at).toLocaleString('ar-SD')}
                      {a.lat != null && a.lng != null ? ' · موقع مرفق' : ''}
                    </p>
                  </div>
                  {a.lat != null && a.lng != null && (
                    <a
                      href={`https://maps.google.com/?q=${a.lat},${a.lng}`}
                      target="_blank"
                      rel="noopener"
                      className="text-sm text-info underline"
                    >
                      الموقع
                    </a>
                  )}
                  <button
                    onClick={() => clearSos(a.id)}
                    disabled={busyId === a.id}
                    className="btn-primary px-3 py-1.5 text-sm"
                  >
                    معالجة
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'overview' && (
          <>
            {/* بطاقات المؤشّرات (KPI) — بيانات حقيقية */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
              <StatCard label="طلبات نشطة" value={num(activeRides.length)} icon="⚡" iconBg="#E8F1EC" accent="#1B6B3F" />
              <StatCard label="رحلات اليوم" value={num(stats?.ridesToday ?? 0)} icon="🚗" iconBg="#E3EEF7" accent="#3A6FB0" />
              <StatCard label="سائقون متصلون" value={num(stats?.onlineDrivers ?? 0)} icon="🧑🏾‍✈️" iconBg="#FBF4DD" accent="#A88528" />
              <StatCard label="طلبات معلّقة" value={num(pendingCount)} hint={`${topups.length} تعبئة · ${driverApps.length} سائق`} icon="⏳" iconBg="#FBF4DD" accent="#A88528" />
              <StatCard label="رحلات مكتملة" value={num(analytics.completedCount)} icon="✅" iconBg="#E8F1EC" accent="#1B6B3F" />
              <StatCard label="إيرادات الرحلات" value={money(analytics.revenue)} icon="💰" iconBg="#E8F1EC" accent="#1B6B3F" />
            </div>

            {/* رسوم بيانية — رحلات الأسبوع + توزيع المركبات */}
            <div className="grid gap-4 lg:grid-cols-2">
              <ChartCard title="الرحلات آخر ٧ أيام" subtitle="عدد الرحلات اليومية">
                <BarChart data={analytics.weekly} />
              </ChartCard>
              <ChartCard title="توزيع المركبات" subtitle="عدد الرحلات لكل نوع">
                <DonutChart segments={analytics.vehicle} />
              </ChartCard>
            </div>

            {/* الطلبات النشطة الآن */}
            <div className="card p-4">
              <div className="mb-3 flex items-center gap-2">
                <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-green" />
                <p className="font-bold">الطلبات النشطة الآن ({activeRides.length})</p>
              </div>
              {activeRides.length === 0 ? (
                <p className="py-6 text-center text-sm text-ink-muted">لا توجد رحلات نشطة حالياً</p>
              ) : (
                <div className="divide-y divide-hairline">
                  {activeRides.map((r) => (
                    <div key={r.id} className="flex items-center gap-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold">
                          {getService(r.service_id)?.name ?? r.service_id}
                        </p>
                        <p className="truncate text-xs text-ink-muted">
                          {r.pickup_address ?? '—'} ← {r.dropoff_address ?? 'مفتوح'}
                        </p>
                      </div>
                      <StatusBadge status={r.status} />
                      <span className="shrink-0 text-sm font-bold text-green">{money(r.fare ?? 0)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* خريطة النشاط المباشر — نقاط انطلاق الرحلات النشطة ومواقع السائقين */}
            <div className="card p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="font-bold">النشاط المباشر على الخريطة</p>
                <span className="chip bg-green-soft text-green">
                  {activeRides.length} رحلة نشطة
                </span>
              </div>
              <MapView
                zoom={activeRides.length ? 11 : 6}
                center={
                  activeRides[0]
                    ? { lat: activeRides[0].pickup_lat, lng: activeRides[0].pickup_lng }
                    : undefined
                }
                markers={activeRides.map((r) => ({ lat: r.pickup_lat, lng: r.pickup_lng }))}
                driverMarkers={activeRides
                  .filter((r) => r.driver_lat != null && r.driver_lng != null)
                  .map((r) => ({ lat: r.driver_lat as number, lng: r.driver_lng as number }))}
                className="h-72 w-full rounded-2xl"
              />
              <p className="mt-2 text-xs text-ink-muted">
                📍 نقطة انطلاق الرحلة · 🚗 موقع السائق المباشر — يتحدّث تلقائياً.
              </p>
            </div>

            <div className="card p-4">
              <p className="mb-3 font-bold">الملخّص المالي</p>
              {!finance ? (
                <p className="py-4 text-center text-sm text-ink-muted">…</p>
              ) : (
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
                  <Metric label="عمولة المنصة" value={money(finance.platform_commission)} accent />
                  <Metric label="أرباح السائقين" value={money(finance.driver_earnings)} />
                  <Metric label="إجمالي التعبئات" value={money(finance.total_topups)} />
                  <Metric label="مدفوعات المحفظة" value={money(finance.ride_payments)} />
                  <Metric label="رحلات مكتملة" value={String(finance.completed_rides)} />
                  <Metric label="أرصدة المحافظ" value={money(finance.wallet_liability)} />
                </div>
              )}
            </div>
          </>
        )}

        {tab === 'requests' && (
          <>
            {/* طلبات التعبئة */}
            <div className="card p-4">
              <p className="mb-3 font-bold">طلبات التعبئة المعلّقة</p>
              {topups.length === 0 ? (
                <p className="py-4 text-center text-sm text-ink-muted">لا توجد طلبات معلّقة</p>
              ) : (
                <div className="divide-y divide-hairline">
                  {topups.map((t) => (
                    <div key={t.id} className="flex items-center gap-3 py-3">
                      <div className="flex-1">
                        <p className="font-bold text-green">{money(t.amount)}</p>
                        <p className="text-xs text-ink-muted">
                          محفظة {t.wallet_id.slice(0, 8)} ·{' '}
                          {new Date(t.created_at).toLocaleDateString('ar-SD')}
                        </p>
                      </div>
                      {t.proof_url && (
                        <button
                          onClick={() => viewProof(t.proof_url!)}
                          className="text-sm text-info underline"
                        >
                          الإثبات
                        </button>
                      )}
                      <button
                        onClick={() => review(t.id, true)}
                        disabled={busyId === t.id}
                        className="btn-primary px-3 py-1.5 text-sm"
                      >
                        اعتماد
                      </button>
                      <button
                        onClick={() => review(t.id, false)}
                        disabled={busyId === t.id}
                        className="btn-outline px-3 py-1.5 text-sm text-danger"
                      >
                        رفض
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* طلبات الانضمام كسائق */}
            <div className="card p-4">
              <p className="mb-3 font-bold">
                طلبات الانضمام كسائق
                {driverApps.length > 0 && (
                  <span className="mr-2 chip bg-green-soft text-green">{driverApps.length}</span>
                )}
              </p>
              {driverApps.length === 0 ? (
                <p className="py-4 text-center text-sm text-ink-muted">لا توجد طلبات معلّقة</p>
              ) : (
                <div className="space-y-3">
                  {driverApps.map((a) => (
                    <div key={a.id} className="rounded-2xl border border-hairline p-3">
                      <div className="min-w-0">
                        <p className="font-bold">{a.full_name}</p>
                        <p className="text-xs text-ink-muted" dir="ltr">
                          {a.phone}
                          {a.email ? ` · ${a.email}` : ''}
                        </p>
                        <p className="mt-1 text-sm text-ink-soft">
                          {getService(a.vehicle_type)?.name ?? a.vehicle_type} · {a.plate_number}
                          {a.is_rented ? ' · مستأجرة' : ''}
                        </p>
                        {a.residence && <p className="text-xs text-ink-muted">📍 {a.residence}</p>}
                      </div>

                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {(
                          [
                            ['رخصة القيادة', a.driving_license_url],
                            ['رخصة السيارة', a.vehicle_license_url],
                            ['تصريح النقل', a.transport_permit_url],
                            ...(a.is_rented
                              ? [['عقد الإيجار', a.rental_contract_url] as const]
                              : []),
                            ['أمامية', a.photo_front_url],
                            ['خلفية', a.photo_back_url],
                            ['جانبية', a.photo_side_url],
                            ['داخلية', a.photo_interior_url],
                          ] as [string, string | null][]
                        ).map(([label, path]) => (
                          <button
                            key={label}
                            onClick={() => viewDoc(path)}
                            className={`rounded-lg px-2 py-1 text-xs ${
                              path
                                ? 'bg-green-soft text-green'
                                : 'bg-hairline text-ink-muted line-through'
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>

                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={() => reviewDriver(a, true)}
                          disabled={busyId === a.id}
                          className="btn-primary flex-1 py-1.5 text-sm"
                        >
                          اعتماد
                        </button>
                        <button
                          onClick={() => reviewDriver(a, false)}
                          disabled={busyId === a.id}
                          className="btn-outline flex-1 py-1.5 text-sm text-danger"
                        >
                          رفض
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {tab === 'drivers' && (
          <div className="card p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="font-bold">كل السائقين ({filteredDrivers.length})</p>
              <input
                className="field w-full max-w-xs"
                value={driverQuery}
                onChange={(e) => setDriverQuery(e.target.value)}
                placeholder="🔍 بحث بالاسم أو الهاتف أو اللوحة"
              />
            </div>
            {drivers === null ? (
              <p className="py-6 text-center text-sm text-ink-muted">…</p>
            ) : filteredDrivers.length === 0 ? (
              <p className="py-6 text-center text-sm text-ink-muted">
                {drivers.length === 0 ? 'لا يوجد سائقون بعد' : 'لا نتائج مطابقة'}
              </p>
            ) : (
              <div className="divide-y divide-hairline">
                {filteredDrivers.map((d) => (
                  <div key={d.id} className="flex items-center gap-3 py-3">
                    <span
                      className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                        d.is_online ? 'bg-green' : 'bg-hairline'
                      }`}
                      title={d.is_online ? 'متصل' : 'غير متصل'}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold">{d.users?.full_name ?? 'سائق'}</p>
                      <p className="truncate text-xs text-ink-muted" dir="ltr">
                        {d.users?.phone ?? '—'}
                      </p>
                    </div>
                    <div className="text-left text-xs text-ink-soft">
                      <p>{getService(d.vehicle_type)?.name ?? d.vehicle_type}</p>
                      <p className="text-ink-muted">
                        {d.plate_number ?? '—'} · ⭐ {d.rating ?? '—'}
                      </p>
                    </div>
                    <button
                      onClick={() => removeDriver(d.user_id, d.users?.full_name ?? 'سائق')}
                      disabled={busyId === d.user_id}
                      className="shrink-0 rounded-lg border border-danger/40 px-2.5 py-1 text-xs font-bold text-danger hover:bg-danger/5"
                    >
                      حذف
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'rides' && (
          <div className="card p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <p className="font-bold">الرحلات ({filteredRides.length})</p>
                <button
                  onClick={exportRides}
                  disabled={filteredRides.length === 0}
                  className="rounded-lg border border-green/40 px-2.5 py-1 text-xs font-bold text-green hover:bg-green/5 disabled:opacity-40"
                >
                  ⬇️ تصدير CSV
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                <select
                  className="field w-auto"
                  value={rideStatus}
                  onChange={(e) => setRideStatus(e.target.value)}
                >
                  <option value="">كل الحالات</option>
                  <option value="searching">بحث عن سائق</option>
                  <option value="accepted">مقبولة</option>
                  <option value="in_progress">جارية</option>
                  <option value="completed">مكتملة</option>
                  <option value="cancelled">ملغاة</option>
                </select>
                <input
                  className="field w-full max-w-xs"
                  value={rideQuery}
                  onChange={(e) => setRideQuery(e.target.value)}
                  placeholder="🔍 بحث بالعنوان أو نوع المركبة"
                />
              </div>
            </div>
            {rides === null ? (
              <p className="py-6 text-center text-sm text-ink-muted">…</p>
            ) : filteredRides.length === 0 ? (
              <p className="py-6 text-center text-sm text-ink-muted">
                {rides.length === 0 ? 'لا توجد رحلات بعد' : 'لا نتائج مطابقة'}
              </p>
            ) : (
              <div className="divide-y divide-hairline">
                {filteredRides.map((r) => (
                  <div key={r.id} className="flex items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold">
                        {getService(r.service_id)?.name ?? r.service_id}
                      </p>
                      <p className="truncate text-xs text-ink-muted">
                        {r.pickup_address ?? '—'} ← {r.dropoff_address ?? '—'}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <p className="font-bold text-green">{money(r.fare ?? 0)}</p>
                      <StatusBadge status={r.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'finance' && access.is_admin && (
          <>
            <div className="flex items-center justify-between">
              <p className="font-bold">الملخّص المالي</p>
              <button
                onClick={exportFinance}
                className="rounded-lg border border-green/40 px-2.5 py-1 text-xs font-bold text-green hover:bg-green/5"
              >
                ⬇️ تصدير CSV
              </button>
            </div>
            {/* ملخّص مالي تفصيلي */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
              <StatCard label="عمولة المنصة" value={money(finance?.platform_commission ?? 0)} icon="🏦" iconBg="#E8F1EC" accent="#1B6B3F" />
              <StatCard label="أرباح السائقين" value={money(finance?.driver_earnings ?? 0)} icon="🧑🏾‍✈️" iconBg="#FBF4DD" accent="#A88528" />
              <StatCard label="إجمالي التعبئات" value={money(finance?.total_topups ?? 0)} icon="💵" iconBg="#E3EEF7" accent="#3A6FB0" />
              <StatCard label="مدفوعات المحفظة" value={money(finance?.ride_payments ?? 0)} icon="💳" iconBg="#E8F1EC" accent="#1B6B3F" />
              <StatCard label="أرصدة المحافظ" value={money(finance?.wallet_liability ?? 0)} icon="👛" iconBg="#FDECEB" accent="#C5453B" />
              <StatCard label="رحلات مكتملة" value={num(finance?.completed_rides ?? 0)} icon="✅" iconBg="#E8F1EC" accent="#1B6B3F" />
            </div>

            {/* إيرادات الأسبوع + الإيراد حسب المركبة */}
            <div className="grid gap-4 lg:grid-cols-2">
              <ChartCard title="إيرادات آخر ٧ أيام" subtitle="من الرحلات المكتملة (ج.س)">
                <BarChart data={analytics.weeklyRevenue} color="#C9A138" format={money} />
              </ChartCard>
              <ChartCard title="الإيرادات حسب المركبة" subtitle="مجموع الأجرة لكل نوع">
                <DonutChart segments={analytics.vehicleRevenue} />
              </ChartCard>
            </div>

            {/* أحدث الرحلات المكتملة */}
            <div className="card p-4">
              <p className="mb-3 font-bold">أحدث الرحلات المكتملة</p>
              {analytics.recentCompleted.length === 0 ? (
                <p className="py-6 text-center text-sm text-ink-muted">لا توجد رحلات مكتملة بعد</p>
              ) : (
                <div className="divide-y divide-hairline">
                  {analytics.recentCompleted.map((r) => (
                    <div key={r.id} className="flex items-center gap-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold">
                          {getService(r.service_id)?.name ?? r.service_id}
                        </p>
                        <p className="truncate text-xs text-ink-muted">
                          {new Date(r.created_at).toLocaleString('ar-SD')}
                        </p>
                      </div>
                      <span className="shrink-0 text-sm font-bold text-green">{money(r.fare ?? 0)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {tab === 'settings' && (
          <>
            {/* تسعير المركبات */}
            <div className="card p-4">
              <p className="font-bold">تسعير المركبات</p>
              <p className="mb-3 text-xs text-ink-muted">
                الأجرة = فتح العداد + شرائح الكيلومتر + الدقائق، مضروبة في معامل Surge.
              </p>
              <div className="space-y-3">
                {pricing.map((p) => (
                  <div key={p.service_id} className="rounded-2xl border border-hairline p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="font-bold">{p.name}</p>
                      <button
                        onClick={() => savePrice(p)}
                        disabled={busyId === p.service_id}
                        className="btn-primary px-3 py-1.5 text-sm"
                      >
                        {busyId === p.service_id ? '…' : 'حفظ'}
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <NumField
                        label="فتح العداد"
                        value={p.base_fare}
                        onChange={(v) => setPrice(p.service_id, 'base_fare', v)}
                      />
                      <NumField
                        label="داخل المدينة / كم"
                        value={p.per_km_urban}
                        onChange={(v) => setPrice(p.service_id, 'per_km_urban', v)}
                      />
                      <NumField
                        label="خارج المدينة / كم"
                        value={p.per_km_far}
                        onChange={(v) => setPrice(p.service_id, 'per_km_far', v)}
                      />
                      <NumField
                        label="سعر الدقيقة"
                        value={p.per_minute}
                        onChange={(v) => setPrice(p.service_id, 'per_minute', v)}
                      />
                    </div>
                  </div>
                ))}
              </div>
              {priceMsg && <p className="mt-3 text-sm text-green">{priceMsg}</p>}
            </div>

            {/* إعدادات المنصة */}
            {settings && (
              <form onSubmit={saveSettings} className="card space-y-4 p-4">
                <div>
                  <p className="font-bold">عمولة المنصة</p>
                  <input
                    type="range"
                    min={0}
                    max={40}
                    value={commissionPct}
                    onChange={(e) =>
                      setSettings({ ...settings, commission_rate: Number(e.target.value) / 100 })
                    }
                    className="mt-2 w-full accent-green"
                  />
                  <p className="text-sm text-ink-soft">
                    النسبة: <span className="font-bold text-green">{commissionPct}%</span> — تُخصم
                    من أرباح السائق تلقائياً.
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <NumField
                    label="Surge (معامل)"
                    step={0.1}
                    value={settings.surge_multiplier}
                    onChange={(v) => setSettings({ ...settings, surge_multiplier: v })}
                  />
                  <NumField
                    label="نهاية فتح العداد (كم)"
                    value={settings.tier1_max_km}
                    onChange={(v) => setSettings({ ...settings, tier1_max_km: v })}
                  />
                  <NumField
                    label="نهاية داخل المدينة (كم)"
                    value={settings.tier2_max_km}
                    onChange={(v) => setSettings({ ...settings, tier2_max_km: v })}
                  />
                </div>

                <div className="space-y-2">
                  <p className="font-bold">الحساب البنكي لاستقبال التحويلات</p>
                  <input
                    className="field"
                    placeholder="اسم البنك"
                    value={settings.bank_name ?? ''}
                    onChange={(e) => setSettings({ ...settings, bank_name: e.target.value })}
                  />
                  <input
                    className="field"
                    placeholder="اسم الحساب"
                    value={settings.bank_account_name ?? ''}
                    onChange={(e) => setSettings({ ...settings, bank_account_name: e.target.value })}
                  />
                  <input
                    className="field text-left"
                    dir="ltr"
                    placeholder="رقم الحساب"
                    value={settings.bank_account_number ?? ''}
                    onChange={(e) =>
                      setSettings({ ...settings, bank_account_number: e.target.value })
                    }
                  />
                </div>

                {savedMsg && <p className="text-sm text-green">{savedMsg}</p>}
                <button className="btn-primary w-full" type="submit">
                  حفظ الإعدادات
                </button>
              </form>
            )}
          </>
        )}

        {tab === 'staff' && access.is_admin && (
          <>
            {/* إضافة موظف */}
            <div className="card p-4">
              <p className="font-bold">إضافة موظف</p>
              <p className="mb-3 text-xs text-ink-muted">
                يكفي أن يسجّل الموظف حساباً في <span className="font-bold">تطبيق «قريب» العادي</span>{' '}
                برقم هاتفه (كأي عميل). ثم أدخل رقمه هنا واختر صلاحياته — يحصل على وصول اللوحة تلقائياً
                دون الحاجة لرؤيتها مسبقاً.
              </p>
              <div className="grid gap-3 md:grid-cols-2">
                <input
                  className="field text-left"
                  dir="ltr"
                  inputMode="tel"
                  value={staffPhone}
                  onChange={(e) => setStaffPhone(e.target.value)}
                  placeholder="رقم هاتف الموظف (مثل 91XXXXXXX)"
                />
                <div className="flex flex-wrap items-center gap-2">
                  {permLabels.map((p) => {
                    const on = staffPerms.includes(p.id)
                    return (
                      <button
                        key={p.id}
                        type="button"
                        title={p.desc}
                        onClick={() => togglePerm(p.id)}
                        className={`chip border px-3 py-1.5 text-sm transition ${
                          on
                            ? 'border-green bg-green text-white'
                            : 'border-hairline bg-white text-ink-soft'
                        }`}
                      >
                        {p.label}
                      </button>
                    )
                  })}
                </div>
              </div>
              <button
                onClick={addStaff}
                disabled={busyId === 'staff-add' || !staffPhone.trim() || staffPerms.length === 0}
                className="btn-primary mt-3"
              >
                {busyId === 'staff-add' ? '…' : 'إضافة / تحديث الصلاحيات'}
              </button>
              {staffMsg && <p className="mt-2 text-sm text-green">{staffMsg}</p>}
            </div>

            {/* قائمة الموظفين */}
            <div className="card p-4">
              <p className="mb-3 font-bold">الموظفون الحاليون</p>
              {staffList === null ? (
                <p className="py-6 text-center text-sm text-ink-muted">…</p>
              ) : staffList.length === 0 ? (
                <p className="py-6 text-center text-sm text-ink-muted">
                  لا يوجد موظفون بعد — أضِف أول موظف من الأعلى.
                </p>
              ) : (
                <div className="divide-y divide-hairline">
                  {staffList.map((s) => (
                    <div key={s.user_id} className="flex items-center gap-3 py-3">
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-green-soft">
                        🧑🏽‍💼
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-bold">
                          {s.users?.full_name ?? 'موظف'}
                          {!s.active && (
                            <span className="chip mr-2 bg-hairline text-[10px] text-ink-muted">
                              معطّل
                            </span>
                          )}
                        </p>
                        <p className="truncate text-xs text-ink-muted" dir="ltr">
                          {s.users?.phone ?? '—'}
                        </p>
                      </div>
                      <div className="flex flex-wrap justify-end gap-1">
                        {s.perms.map((p) => (
                          <span key={p} className="chip bg-green-soft text-xs text-green">
                            {permLabels.find((x) => x.id === p)?.label ?? p}
                          </span>
                        ))}
                      </div>
                      <button
                        onClick={() => toggleStaffActive(s)}
                        disabled={busyId === s.user_id}
                        className={`shrink-0 rounded-lg border px-2.5 py-1 text-xs font-bold ${
                          s.active
                            ? 'border-warning/40 text-warning hover:bg-warning/5'
                            : 'border-green/40 text-green hover:bg-green/5'
                        }`}
                      >
                        {s.active ? 'تعطيل' : 'تفعيل'}
                      </button>
                      <button
                        onClick={() => deleteStaff(s.user_id, s.users?.full_name ?? 'موظف')}
                        disabled={busyId === s.user_id}
                        className="shrink-0 rounded-lg border border-danger/40 px-2.5 py-1 text-xs font-bold text-danger hover:bg-danger/5"
                      >
                        إزالة
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {tab === 'audit' && access.is_admin && (
          <div className="card p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="font-bold">سجلّ النشاط</p>
              <div className="flex items-center gap-3">
                <button
                  onClick={exportAudit}
                  disabled={(audit ?? []).length === 0}
                  className="rounded-lg border border-green/40 px-2.5 py-1 text-xs font-bold text-green hover:bg-green/5 disabled:opacity-40"
                >
                  ⬇️ تصدير CSV
                </button>
                <button
                  onClick={() => void listAuditLog().then((a) => setAudit(a as AuditEntry[]))}
                  className="text-sm text-info underline"
                >
                  تحديث
                </button>
              </div>
            </div>
            <p className="mb-3 text-xs text-ink-muted">
              كل اعتماد/رفض/حذف يُسجَّل باسم فاعله ووقته — مساءلة كاملة.
            </p>
            {audit === null ? (
              <p className="py-6 text-center text-sm text-ink-muted">…</p>
            ) : audit.length === 0 ? (
              <p className="py-6 text-center text-sm text-ink-muted">لا يوجد نشاط مسجّل بعد</p>
            ) : (
              <div className="divide-y divide-hairline">
                {audit.map((a) => (
                  <div key={a.id} className="flex items-center gap-3 py-2.5">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-green-soft text-sm">
                      📝
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">
                        <span className="font-bold">{a.actor_name ?? 'مستخدم'}</span>{' '}
                        <span className="text-ink-soft">{a.action}</span>
                        {a.target ? <span className="text-ink-muted"> · {a.target}</span> : null}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-ink-muted">
                      {new Date(a.created_at).toLocaleString('ar-SD')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

function Metric({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-2xl p-3 ${accent ? 'bg-green-soft' : 'bg-green-mint'}`}>
      <p className={`text-lg font-extrabold ${accent ? 'text-green' : 'text-ink'}`}>{value}</p>
      <p className="text-xs text-ink-muted">{label}</p>
    </div>
  )
}

function NumField({
  label,
  value,
  onChange,
  step = 1,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  step?: number
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-ink-soft">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        step={step}
        min={0}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full rounded-xl border border-hairline bg-white px-3 py-2 text-ink outline-none focus:border-green"
      />
    </label>
  )
}
