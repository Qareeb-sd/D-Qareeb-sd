import { useState } from 'react'
import AdminSidebar from '@/admin/components/AdminSidebar'
import AdminHeader from '@/admin/components/AdminHeader'
import { money } from '@/lib/format'

interface PricingRow {
  service_id: string
  name: string
  baseFare: number
  perKmUrban: number
  perKmFar: number
  perMinute: number
  active: boolean
}

const initialPricing: PricingRow[] = [
  { service_id: 'standard', name: 'قريب عادي', baseFare: 600, perKmUrban: 130, perKmFar: 160, perMinute: 18, active: true },
  { service_id: 'ladies', name: 'قريب نسائي', baseFare: 900, perKmUrban: 180, perKmFar: 220, perMinute: 25, active: true },
  { service_id: 'amjad', name: 'أمجاد', baseFare: 800, perKmUrban: 160, perKmFar: 200, perMinute: 22, active: true },
  { service_id: 'hiace', name: 'هايس', baseFare: 1200, perKmUrban: 200, perKmFar: 240, perMinute: 30, active: true },
  { service_id: 'rickshaw', name: 'ركشة', baseFare: 300, perKmUrban: 90, perKmFar: 110, perMinute: 12, active: true },
  { service_id: 'open', name: 'مشوار مفتوح', baseFare: 700, perKmUrban: 150, perKmFar: 190, perMinute: 20, active: true },
  { service_id: 'tow', name: 'سحاب', baseFare: 2500, perKmUrban: 300, perKmFar: 350, perMinute: 40, active: true },
]

export default function AdminPricing() {
  const [pricing, setPricing] = useState<PricingRow[]>(initialPricing)
  const [saved, setSaved] = useState(false)

  const update = (id: string, field: keyof PricingRow, value: number | boolean) => {
    setPricing((p) => p.map((row) => (row.service_id === id ? { ...row, [field]: value } : row)))
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
        <AdminHeader title="التسعير" subtitle="إدارة أسعار الخدمات والشرائح" />
        <main className="flex-1 px-8 py-6">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-ink-muted">
              الأجرة = فتح العداد + (كم حضري × سعره) + (كم بعيد × سعره) + (دقائق × السعر)
            </p>
            <div className="flex items-center gap-3">
              {saved && <span className="text-sm text-green font-bold">✓ تم الحفظ</span>}
              <button onClick={save} className="btn-primary">حفظ التغييرات</button>
            </div>
          </div>

          <div className="space-y-3">
            {pricing.map((p) => (
              <div key={p.service_id} className="card p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <h3 className="font-bold text-lg">{p.name}</h3>
                    <label className="flex items-center gap-2">
                      <button
                        onClick={() => update(p.service_id, 'active', !p.active)}
                        className={`relative h-6 w-11 rounded-full transition ${p.active ? 'bg-green' : 'bg-hairline'}`}
                      >
                        <span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-all ${p.active ? 'right-1' : 'right-6'}`} />
                      </button>
                      <span className="text-xs text-ink-muted">{p.active ? 'نشط' : 'معطّل'}</span>
                    </label>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-4">
                  {[
                    { label: 'فتح العداد', field: 'baseFare' as const },
                    { label: 'حضري / كم', field: 'perKmUrban' as const },
                    { label: 'بعيد / كم', field: 'perKmFar' as const },
                    { label: 'الدقيقة', field: 'perMinute' as const },
                  ].map((f) => (
                    <div key={f.field}>
                      <label className="label text-xs">{f.label}</label>
                      <div className="relative">
                        <input
                          type="number"
                          value={p[f.field]}
                          onChange={(e) => update(p.service_id, f.field, Number(e.target.value))}
                          className="field py-2.5 text-left"
                        />
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-ink-muted">ج.س</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  )
}
