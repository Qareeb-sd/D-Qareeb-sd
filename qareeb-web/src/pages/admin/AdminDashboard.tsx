import { useEffect, useState } from 'react'
import Logo from '@/components/Logo'
import { money } from '@/lib/format'
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
  type AdminStats,
} from '@/lib/api'
import type { Settings, Topup, ServicePricing } from '@/lib/types'

/**
 * لوحة الأدمن: إحصاءات + اعتماد التعبئات + إعدادات المنصة (عمولة/Surge/شرائح/بنك)
 * + تسعير كل نوع مركبة. الأمان مفروض عبر RLS ودوال Postgres.
 */
export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [topups, setTopups] = useState<Topup[]>([])
  const [settings, setSettings] = useState<Settings | null>(null)
  const [pricing, setPricing] = useState<ServicePricing[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)
  const [savedMsg, setSavedMsg] = useState('')
  const [priceMsg, setPriceMsg] = useState('')

  useEffect(() => {
    void (async () => {
      const [s, t, cfg, pr] = await Promise.all([
        getAdminStats(),
        listPendingTopups(),
        getSettings(),
        listServicePricing(),
      ])
      setStats(s)
      setTopups(t)
      setSettings(cfg)
      setPricing(pr)
    })()
  }, [])

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

  return (
    <div className="screen max-w-2xl">
      <header className="flex items-center gap-3 border-b border-hairline px-4 py-4">
        <Logo size={36} rounded={10} />
        <h1 className="text-lg font-bold">لوحة تحكم قريب</h1>
      </header>

      <main className="flex-1 space-y-4 p-4">
        {/* إحصاءات */}
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
                النسبة: <span className="font-bold text-green">{commissionPct}%</span> — تُخصم من
                أرباح السائق تلقائياً.
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
                onChange={(e) =>
                  setSettings({ ...settings, bank_account_name: e.target.value })
                }
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
      </main>
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
