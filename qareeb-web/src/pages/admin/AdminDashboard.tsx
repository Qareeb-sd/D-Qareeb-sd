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
  type AdminStats,
  type AdminDriverRow,
  type FinancialSummary,
} from '@/lib/api'
import { subscribeToSos } from '@/lib/realtime'
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
} from '@/lib/types'

type Tab = 'overview' | 'requests' | 'drivers' | 'rides' | 'settings' | 'staff'

/** التبويبات مع الصلاحية المطلوبة لكلٍّ (null = تكفي أي صلاحية). */
const tabs: { id: Tab; label: string; perm: StaffPerm | null; ownerOnly?: boolean }[] = [
  { id: 'overview', label: 'نظرة عامة', perm: null },
  { id: 'requests', label: 'الطلبات', perm: 'requests' },
  { id: 'drivers', label: 'السائقون', perm: 'drivers' },
  { id: 'rides', label: 'الرحلات', perm: 'rides' },
  { id: 'settings', label: 'الإعدادات', perm: 'settings' },
  { id: 'staff', label: 'الموظفون', perm: null, ownerOnly: true },
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
  }, [tab, staffList])

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
    return { weekly, vehicle, completedCount: completed.length, revenue }
  }, [rides])

  // تنبيهات الطوارئ — تُحمَّل وتُتابَع لحظياً (تظهر فوق كل التبويبات).
  useEffect(() => {
    const load = () => listSosAlerts().then(setSos)
    void load()
    return subscribeToSos(load)
  }, [])

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

  return (
    <div className="screen mx-auto w-full max-w-7xl px-2 sm:px-4">
      <header className="flex items-center gap-3 bg-green px-4 py-4 text-white shadow-card">
        <Logo size={36} rounded={10} />
        <h1 className="flex-1 text-lg font-extrabold">لوحة تحكم قريب</h1>
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
              <span className="mr-1 rounded-full bg-gold px-1.5 text-xs text-white">
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
            <p className="mb-3 font-bold">كل السائقين</p>
            {drivers === null ? (
              <p className="py-6 text-center text-sm text-ink-muted">…</p>
            ) : drivers.length === 0 ? (
              <p className="py-6 text-center text-sm text-ink-muted">لا يوجد سائقون بعد</p>
            ) : (
              <div className="divide-y divide-hairline">
                {drivers.map((d) => (
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
            <p className="mb-3 font-bold">أحدث الرحلات</p>
            {rides === null ? (
              <p className="py-6 text-center text-sm text-ink-muted">…</p>
            ) : rides.length === 0 ? (
              <p className="py-6 text-center text-sm text-ink-muted">لا توجد رحلات بعد</p>
            ) : (
              <div className="divide-y divide-hairline">
                {rides.map((r) => (
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
                يجب أن يكون الموظف قد سجّل دخوله مرّة واحدة من موقع الإدارة بهاتفه
                (ستظهر له «لا يملك صلاحية» — هذا طبيعي)، ثم أضِفه هنا بصلاحياته.
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
                        <p className="truncate font-bold">{s.users?.full_name ?? 'موظف'}</p>
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
