import { useState } from 'react'
import Logo from '@/components/Logo'

/**
 * لوحة الأدمن (هيكل مبدئي).
 * تشمل لاحقاً: اعتماد التعبئات، إدارة السائقين، والإعدادات (عمولة المنصة + الحساب البنكي).
 */
export default function AdminDashboard() {
  const [commission, setCommission] = useState(15)

  return (
    <div className="screen max-w-2xl">
      <header className="flex items-center gap-3 border-b border-hairline px-4 py-4">
        <Logo size={36} rounded={10} />
        <h1 className="text-lg font-bold">لوحة تحكم قريب</h1>
      </header>

      <main className="flex-1 space-y-4 p-4">
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'رحلات اليوم', value: '128' },
            { label: 'سائقون متصلون', value: '34' },
            { label: 'تعبئات معلّقة', value: '5' },
          ].map((s) => (
            <div key={s.label} className="card p-4 text-center">
              <p className="text-2xl font-extrabold text-green">{s.value}</p>
              <p className="text-xs text-ink-muted">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="card space-y-3 p-4">
          <p className="font-bold">عمولة المنصة</p>
          <input
            type="range"
            min={0}
            max={40}
            value={commission}
            onChange={(e) => setCommission(Number(e.target.value))}
            className="w-full accent-green"
          />
          <p className="text-sm text-ink-soft">
            النسبة الحالية: <span className="font-bold text-green">{commission}%</span> — تُخصم من
            أرباح السائق تلقائياً.
          </p>
        </div>

        <div className="card space-y-3 p-4">
          <p className="font-bold">الحساب البنكي لاستقبال التحويلات</p>
          <input className="field" placeholder="اسم البنك" defaultValue="بنك الخرطوم" />
          <input className="field" placeholder="اسم الحساب" defaultValue="شركة قريب للنقل" />
          <input className="field text-left" dir="ltr" placeholder="رقم الحساب" />
          <button className="btn-primary w-full">حفظ الإعدادات</button>
        </div>
      </main>
    </div>
  )
}
