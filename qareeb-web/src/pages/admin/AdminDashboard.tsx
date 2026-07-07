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
  type AdminStats,
} from '@/lib/api'
import type { Settings, Topup } from '@/lib/types'

/**
 * لوحة الأدمن: إحصاءات + اعتماد/رفض طلبات التعبئة + إعدادات (العمولة + الحساب البنكي).
 * الأمان الفعلي مفروض عبر RLS ودوال Postgres (is_admin / approve_topup / reject_topup).
 */
export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [topups, setTopups] = useState<Topup[]>([])
  const [settings, setSettings] = useState<Settings | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [savedMsg, setSavedMsg] = useState('')

  useEffect(() => {
    void (async () => {
      const [s, t, cfg] = await Promise.all([
        getAdminStats(),
        listPendingTopups(),
        getSettings(),
      ])
      setStats(s)
      setTopups(t)
      setSettings(cfg)
    })()
  }, [])

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
      bank_name: settings.bank_name,
      bank_account_name: settings.bank_account_name,
      bank_account_number: settings.bank_account_number,
    })
    setSavedMsg(error ? `خطأ: ${error}` : 'تم حفظ الإعدادات ✓')
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
                    <a
                      href={t.proof_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm text-info underline"
                    >
                      الإثبات
                    </a>
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

        {/* الإعدادات */}
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
