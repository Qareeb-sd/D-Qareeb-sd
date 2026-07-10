import { useState } from 'react'
import AdminSidebar from '@/admin/components/AdminSidebar'
import AdminHeader from '@/admin/components/AdminHeader'

export default function AdminSettings() {
  const [saved, setSaved] = useState(false)
  const [settings, setSettings] = useState({
    commissionRate: 15,
    surgeMultiplier: 1.0,
    tier1MaxKm: 2,
    tier2MaxKm: 10,
    bankName: 'بنك الخرطوم',
    bankAccountName: 'شركة قريب للنقل الذكي',
    bankAccountNumber: '1234567890123',
    autoDispatch: true,
    maxSearchTime: 120,
    sosPhone: '999',
    supportPhone: '+249900000000',
  })

  const update = (field: string, value: unknown) => {
    setSettings((s) => ({ ...s, [field]: value }))
    setSaved(false)
  }

  const save = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div className="flex min-h-screen bg-bg" dir="rtl">
      <AdminSidebar />
      <div className="mr-64 flex flex-1 flex-col">
        <AdminHeader title="الإعدادات" subtitle="إدارة إعدادات المنصة والحساب البنكي" />
        <main className="flex-1 px-8 py-6">
          <div className="mx-auto max-w-3xl space-y-6">
            {/* Commission */}
            <div className="card p-6">
              <h3 className="mb-4 font-bold text-lg">عمولة المنصة</h3>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between">
                    <label className="label">نسبة العمولة</label>
                    <span className="text-2xl font-extrabold text-green">{settings.commissionRate}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={40}
                    value={settings.commissionRate}
                    onChange={(e) => update('commissionRate', Number(e.target.value))}
                    className="mt-2 w-full accent-green"
                  />
                  <p className="mt-1 text-xs text-ink-muted">تُخصم تلقائياً من أرباح السائق</p>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="label">Surge</label>
                    <input
                      type="number"
                      step={0.1}
                      value={settings.surgeMultiplier}
                      onChange={(e) => update('surgeMultiplier', Number(e.target.value))}
                      className="field py-2.5"
                    />
                  </div>
                  <div>
                    <label className="label">نهاية فتح العداد (كم)</label>
                    <input
                      type="number"
                      value={settings.tier1MaxKm}
                      onChange={(e) => update('tier1MaxKm', Number(e.target.value))}
                      className="field py-2.5"
                    />
                  </div>
                  <div>
                    <label className="label">نهاية الحضري (كم)</label>
                    <input
                      type="number"
                      value={settings.tier2MaxKm}
                      onChange={(e) => update('tier2MaxKm', Number(e.target.value))}
                      className="field py-2.5"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Bank Account */}
            <div className="card p-6">
              <h3 className="mb-4 font-bold text-lg">الحساب البنكي لاستقبال التحويلات</h3>
              <div className="space-y-3">
                <div>
                  <label className="label">اسم البنك</label>
                  <input
                    className="field"
                    value={settings.bankName}
                    onChange={(e) => update('bankName', e.target.value)}
                  />
                </div>
                <div>
                  <label className="label">اسم الحساب</label>
                  <input
                    className="field"
                    value={settings.bankAccountName}
                    onChange={(e) => update('bankAccountName', e.target.value)}
                  />
                </div>
                <div>
                  <label className="label">رقم الحساب</label>
                  <input
                    className="field text-left"
                    dir="ltr"
                    value={settings.bankAccountNumber}
                    onChange={(e) => update('bankAccountNumber', e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Platform Settings */}
            <div className="card p-6">
              <h3 className="mb-4 font-bold text-lg">إعدادات التشغيل</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">التوزيع التلقائي</p>
                    <p className="text-xs text-ink-muted">إرسال الطلبات لأقرب سائق تلقائياً</p>
                  </div>
                  <button
                    onClick={() => update('autoDispatch', !settings.autoDispatch)}
                    className={`relative h-7 w-12 rounded-full transition ${settings.autoDispatch ? 'bg-green' : 'bg-hairline'}`}
                  >
                    <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${settings.autoDispatch ? 'right-1' : 'right-6'}`} />
                  </button>
                </div>
                <div className="border-t border-hairline pt-4">
                  <label className="label">أقصى وقت للبحث (ثانية)</label>
                  <input
                    type="number"
                    value={settings.maxSearchTime}
                    onChange={(e) => update('maxSearchTime', Number(e.target.value))}
                    className="field py-2.5 w-32"
                  />
                </div>
                <div className="border-t border-hairline pt-4">
                  <label className="label">رقم الطوارئ (SOS)</label>
                  <input
                    type="text"
                    value={settings.sosPhone}
                    onChange={(e) => update('sosPhone', e.target.value)}
                    className="field py-2.5 w-48 text-left"
                    dir="ltr"
                  />
                </div>
                <div className="border-t border-hairline pt-4">
                  <label className="label">رقم الدعم</label>
                  <input
                    type="text"
                    value={settings.supportPhone}
                    onChange={(e) => update('supportPhone', e.target.value)}
                    className="field py-2.5 w-48 text-left"
                    dir="ltr"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3">
              {saved && <span className="text-sm text-green font-bold">✓ تم حفظ الإعدادات</span>}
              <button onClick={save} className="btn-primary px-8">حفظ</button>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
