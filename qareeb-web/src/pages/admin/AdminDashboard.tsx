import { useEffect, useState } from 'react'
import Logo from '@/components/Logo'
import { money } from '@/lib/format'
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
  getFinancialSummary,
  type AdminStats,
  type AdminDriverRow,
  type FinancialSummary,
} from '@/lib/api'
import { getService } from '@/data/services'
import type { Settings, Topup, ServicePricing, DriverApplication, Ride } from '@/lib/types'

type Tab = 'overview' | 'requests' | 'drivers' | 'rides' | 'settings'

const tabs: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'نظرة عامة' },
  { id: 'requests', label: 'الطلبات' },
  { id: 'drivers', label: 'السائقون' },
  { id: 'rides', label: 'الرحلات' },
  { id: 'settings', label: 'الإعدادات' },
]

const rideStatusLabel: Record<string, string> = {
  requested: 'مطلوبة',
  searching: 'بحث عن سائق',
  accepted: 'مقبولة',
  arrived: 'وصل السائق',
  in_progress: 'جارية',
  completed: 'مكتملة',
  cancelled: 'ملغاة',
}

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

  const [busyId, setBusyId] = useState<string | null>(null)
  const [savedMsg, setSavedMsg] = useState('')
  const [priceMsg, setPriceMsg] = useState('')

  useEffect(() => {
    void (async () => {
      const [s, fin, t, cfg, pr, apps] = await Promise.all([
        getAdminStats(),
        getFinancialSummary(),
        listPendingTopups(),
        getSettings(),
        listServicePricing(),
        listDriverApplications('pending'),
      ])
      setStats(s)
      setFinance(fin)
      setTopups(t)
      setSettings(cfg)
      setPricing(pr)
      setDriverApps(apps)
    })()
  }, [])

  // تحميل كسول للقوائم الثقيلة عند فتح تبويبها أول مرة.
  useEffect(() => {
    if (tab === 'drivers' && drivers === null) void listAllDrivers().then(setDrivers)
    if (tab === 'rides' && rides === null) void listAllRides().then(setRides)
  }, [tab, drivers, rides])

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
    <div className="screen mx-auto max-w-2xl">
      <header className="flex items-center gap-3 border-b border-hairline px-4 py-4">
        <Logo size={36} rounded={10} />
        <h1 className="flex-1 text-lg font-bold">لوحة تحكم قريب</h1>
        <button onClick={() => void signOut()} className="text-sm text-danger">
          خروج
        </button>
      </header>

      {/* تبويبات */}
      <nav className="flex gap-1 overflow-x-auto border-b border-hairline px-2 py-2">
        {tabs.map((tb) => (
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
        {tab === 'overview' && (
          <>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'رحلات اليوم', value: stats?.ridesToday },
                { label: 'سائقون متصلون', value: stats?.onlineDrivers },
                { label: 'تعبئات معلّقة', value: stats?.pendingTopups },
              ].map((s) => (
                <div key={s.label} className="card p-4 text-center">
                  <p className="text-2xl font-extrabold text-green">{s.value ?? '…'}</p>
                  <p className="text-xs text-ink-muted">{s.label}</p>
                </div>
              ))}
            </div>

            <div className="card p-4">
              <p className="mb-3 font-bold">الملخّص المالي</p>
              {!finance ? (
                <p className="py-4 text-center text-sm text-ink-muted">…</p>
              ) : (
                <div className="grid grid-cols-2 gap-3">
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
                    <div className="text-left">
                      <p className="font-bold text-green">{money(r.fare ?? 0)}</p>
                      <p className="text-xs text-ink-muted">
                        {rideStatusLabel[r.status] ?? r.status}
                      </p>
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
                        label="حضري / كم"
                        value={p.per_km_urban}
                        onChange={(v) => setPrice(p.service_id, 'per_km_urban', v)}
                      />
                      <NumField
                        label="بعيد / كم"
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
                    label="نهاية الحضري (كم)"
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
